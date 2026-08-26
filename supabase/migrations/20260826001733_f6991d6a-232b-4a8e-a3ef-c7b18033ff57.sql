-- =============================================================
-- EloShape: Semi-Splits, bracket engine and trusted scoring
-- Additive migration. Existing data preserved.
-- =============================================================

-- ---------- enums ----------
do $$ begin
  create type public.split_status as enum
    ('upcoming','qualifiers','seeding','playoffs','semifinals','final','completed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.qualification_status as enum ('qualified','withdrawn','replaced');
exception when duplicate_object then null; end $$;

-- ---------- competitive_splits ----------
create table if not exists public.competitive_splits (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  slug text not null unique,
  name text not null,
  division_id uuid references public.divisions(id),
  region_id uuid references public.regions(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.split_status not null default 'upcoming',
  playoff_size integer not null default 16,
  dispute_deadline_at timestamptz,
  playoff_reveal_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.competitive_splits to anon, authenticated;
grant all on public.competitive_splits to service_role;
alter table public.competitive_splits enable row level security;

do $$ begin
  create policy "Splits are public" on public.competitive_splits for select using (true);
exception when duplicate_object then null; end $$;

drop trigger if exists competitive_splits_updated_at on public.competitive_splits;
create trigger competitive_splits_updated_at before update on public.competitive_splits
for each row execute function public.set_updated_at();

-- ---------- tournaments: split linkage + lifecycle markers ----------
alter table public.tournaments
  add column if not exists split_id uuid references public.competitive_splits(id) on delete set null,
  add column if not exists qualifier_index integer,
  add column if not exists split_phase text,
  add column if not exists entries_locked_at timestamptz,
  add column if not exists bracket_generated_at timestamptz,
  add column if not exists finalized_at timestamptz;

create index if not exists tournaments_split_idx on public.tournaments(split_id, qualifier_index);

-- ---------- matches: byes + deterministic coordinates ----------
alter table public.matches
  add column if not exists is_bye boolean not null default false;

-- Historical/demo brackets were 1-based. Shift them once to zero-based so the
-- generated engine and legacy rows share one coordinate system.
do $$ begin
  if exists (select 1 from public.matches) and
     not exists (select 1 from public.matches where round_index = 0) then
    update public.matches set round_index = round_index - 1, bracket_slot = bracket_slot - 1;
  end if;
end $$;

do $$ begin
  alter table public.matches
    add constraint matches_coordinate_unique unique (tournament_id, round_index, bracket_slot);
exception when duplicate_table then null; when duplicate_object then null; end $$;

-- ---------- entries: elimination round + roster lock ----------
alter table public.tournament_entries
  add column if not exists eliminated_in_round integer,
  add column if not exists roster_locked_at timestamptz;

-- ---------- riot account level snapshot (private data) ----------
alter table public.riot_accounts
  add column if not exists account_level integer,
  add column if not exists account_level_synced_at timestamptz;

-- ---------- player ledger: deterministic uniqueness ----------
alter table public.ranking_points
  add column if not exists event_key text;

create unique index if not exists ranking_points_event_unique
  on public.ranking_points(profile_id, tournament_id, event_key)
  where event_key is not null and tournament_id is not null;

-- ---------- team ledger ----------
create table if not exists public.team_ranking_points (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  tournament_id uuid references public.tournaments(id) on delete set null,
  split_id uuid references public.competitive_splits(id) on delete set null,
  season_id uuid references public.seasons(id) on delete set null,
  rule_code text references public.point_rules(code),
  points integer not null default 0,
  event_key text,
  note text,
  awarded_at timestamptz not null default now()
);

create unique index if not exists team_ranking_points_event_unique
  on public.team_ranking_points(team_id, tournament_id, event_key)
  where event_key is not null and tournament_id is not null;

grant select on public.team_ranking_points to anon, authenticated;
grant all on public.team_ranking_points to service_role;
alter table public.team_ranking_points enable row level security;

do $$ begin
  create policy "Team points are public" on public.team_ranking_points for select using (true);
exception when duplicate_object then null; end $$;

-- ---------- split qualifications ----------
create table if not exists public.split_qualifications (
  id uuid primary key default gen_random_uuid(),
  split_id uuid not null references public.competitive_splits(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  qualified_from_tournament_id uuid references public.tournaments(id) on delete set null,
  qualification_position integer,
  replaces_team_id uuid references public.teams(id) on delete set null,
  playoff_seed integer,
  status public.qualification_status not null default 'qualified',
  qualified_at timestamptz not null default now(),
  unique (split_id, team_id)
);

grant select on public.split_qualifications to anon, authenticated;
grant all on public.split_qualifications to service_role;
alter table public.split_qualifications enable row level security;

do $$ begin
  create policy "Qualifications are public" on public.split_qualifications for select using (true);
exception when duplicate_object then null; end $$;

-- ---------- audit log ----------
create table if not exists public.competition_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

grant select on public.competition_audit_log to authenticated;
grant all on public.competition_audit_log to service_role;
alter table public.competition_audit_log enable row level security;

do $$ begin
  create policy "Staff read audit log" on public.competition_audit_log
    for select to authenticated using (private.is_staff());
exception when duplicate_object then null; end $$;

-- =============================================================
-- Trusted helpers (private schema, never exposed through the API)
-- =============================================================

create or replace function private.actor_is_staff(p_actor uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1 from public.user_roles
    where user_id = p_actor and role in ('admin','moderator')
  );
$$;

create or replace function private.audit(p_actor uuid, p_action text, p_entity_type text,
  p_entity_id uuid, p_metadata jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public, private as $$
  insert into public.competition_audit_log(actor_user_id, action, entity_type, entity_id, metadata)
  values (p_actor, p_action, p_entity_type, p_entity_id, coalesce(p_metadata,'{}'::jsonb));
$$;

create or replace function private.team_is_eligible(p_team uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1 from public.teams t
    join public.profiles p on p.id = t.captain_id
    where t.id = p_team and p.eligibility = 'eligible'
  );
$$;

-- Public, read-only split standings (deterministic ordering).
create or replace function public.split_standings(p_split uuid)
returns table (
  team_id uuid, team_slug text, team_name text, team_tag text, logo_url text,
  division_code text, points integer, wins integer, losses integer,
  tournaments_played integer, qualification_status text,
  qualified_from text, qualification_position integer
)
language sql stable security definer set search_path = public as $$
  with base as (
    select tm.id as team_id, tm.slug, tm.name, tm.tag, tm.logo_url, d.code as division_code
    from public.teams tm
    left join public.divisions d on d.id = tm.division_id
    where exists (
      select 1 from public.tournament_entries e
      join public.tournaments t on t.id = e.tournament_id
      where e.team_id = tm.id and t.split_id = p_split and e.status <> 'withdrawn'
    )
  ),
  pts as (
    select trp.team_id, sum(trp.points)::int as p
    from public.team_ranking_points trp where trp.split_id = p_split group by 1
  ),
  res as (
    select e.team_id,
      count(*) filter (where m.status = 'completed' and not m.is_bye and m.winner_entry_id = e.id)::int as w,
      count(*) filter (where m.status = 'completed' and not m.is_bye
                        and m.winner_entry_id is not null and m.winner_entry_id <> e.id)::int as l
    from public.tournament_entries e
    join public.tournaments t on t.id = e.tournament_id
    join public.matches m on m.tournament_id = t.id and (m.entry_a_id = e.id or m.entry_b_id = e.id)
    where t.split_id = p_split and e.team_id is not null
    group by 1
  ),
  tp as (
    select e.team_id, count(distinct e.tournament_id)::int as c
    from public.tournament_entries e
    join public.tournaments t on t.id = e.tournament_id
    where t.split_id = p_split and e.team_id is not null and e.status <> 'withdrawn'
    group by 1
  )
  select b.team_id, b.slug, b.name, b.tag, b.logo_url, b.division_code,
    coalesce(pts.p,0), coalesce(res.w,0), coalesce(res.l,0), coalesce(tp.c,0),
    q.status::text, qt.name, q.qualification_position
  from base b
  left join pts on pts.team_id = b.team_id
  left join res on res.team_id = b.team_id
  left join tp on tp.team_id = b.team_id
  left join public.split_qualifications q on q.split_id = p_split and q.team_id = b.team_id
  left join public.tournaments qt on qt.id = q.qualified_from_tournament_id
  order by coalesce(pts.p,0) desc, coalesce(res.w,0) desc, coalesce(tp.c,0) desc, lower(b.name) asc;
$$;

revoke all on function public.split_standings(uuid) from public;
grant execute on function public.split_standings(uuid) to anon, authenticated, service_role;

-- ---------- aggregate recomputation ----------
create or replace function private.recompute_profile_stats(p_profile uuid)
returns void language plpgsql security definer set search_path = public, private as $$
declare v_season uuid;
begin
  select id into v_season from public.seasons where is_active order by starts_at desc limit 1;
  update public.profiles p set
    points_season = coalesce((select sum(rp.points) from public.ranking_points rp
      where rp.profile_id = p.id and (v_season is null or rp.season_id = v_season or rp.season_id is null)), 0),
    points_month = coalesce((select sum(rp.points) from public.ranking_points rp
      where rp.profile_id = p.id and rp.awarded_at >= now() - interval '30 days'), 0),
    wins = coalesce((select count(*) from public.matches m
      join public.tournament_entries e on e.id = m.winner_entry_id
      where e.profile_id = p.id and m.status = 'completed' and not m.is_bye), 0),
    losses = coalesce((select count(*) from public.matches m
      join public.tournament_entries e on e.profile_id = p.id
      where e.tournament_id = m.tournament_id and (m.entry_a_id = e.id or m.entry_b_id = e.id)
        and m.status = 'completed' and not m.is_bye
        and m.winner_entry_id is not null and m.winner_entry_id <> e.id), 0),
    tournaments_played = coalesce((select count(distinct e.tournament_id)
      from public.tournament_entries e where e.profile_id = p.id and e.status <> 'withdrawn'), 0)
  where p.id = p_profile;
end $$;

create or replace function private.recompute_team_stats(p_team uuid)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  update public.teams t set
    points_season = coalesce((select sum(trp.points) from public.team_ranking_points trp
      where trp.team_id = t.id), 0),
    wins = coalesce((select count(*) from public.matches m
      join public.tournament_entries e on e.id = m.winner_entry_id
      where e.team_id = t.id and m.status = 'completed' and not m.is_bye), 0),
    losses = coalesce((select count(*) from public.matches m
      join public.tournament_entries e on e.team_id = t.id
      where e.tournament_id = m.tournament_id and (m.entry_a_id = e.id or m.entry_b_id = e.id)
        and m.status = 'completed' and not m.is_bye
        and m.winner_entry_id is not null and m.winner_entry_id <> e.id), 0),
    championships = coalesce((select count(*) from public.tournament_entries e
      where e.team_id = t.id and e.placement = 1), 0)
  where t.id = p_team;
end $$;

-- ---------- ledger writer ----------
create or replace function private.award_entry(p_entry uuid, p_rule text, p_points integer,
  p_event_key text, p_note text)
returns void language plpgsql security definer set search_path = public, private as $$
declare e record; t record; v_member record;
begin
  select * into e from public.tournament_entries where id = p_entry;
  if e is null then return; end if;
  select * into t from public.tournaments where id = e.tournament_id;

  if e.profile_id is not null then
    insert into public.ranking_points(profile_id, tournament_id, season_id, rule_code, points, note, event_key)
    values (e.profile_id, t.id, t.season_id, p_rule, p_points, p_note, p_event_key)
    on conflict do nothing;
  end if;

  if e.team_id is not null then
    insert into public.team_ranking_points(team_id, tournament_id, split_id, season_id, rule_code, points, note, event_key)
    values (e.team_id, t.id, t.split_id, t.season_id, p_rule, p_points, p_note, p_event_key)
    on conflict do nothing;

    -- Locked tournament roster only: players registered on the team when the
    -- entry was locked receive the same competition reward on the player ledger.
    for v_member in
      select tm.profile_id from public.team_members tm
      where tm.team_id = e.team_id
        and (e.roster_locked_at is null or tm.joined_at <= e.roster_locked_at)
    loop
      insert into public.ranking_points(profile_id, tournament_id, season_id, rule_code, points, note, event_key)
      values (v_member.profile_id, t.id, t.season_id, p_rule, p_points, p_note, 'team:' || p_event_key)
      on conflict do nothing;
    end loop;
  end if;
end $$;

-- =============================================================
-- Trusted operations
-- =============================================================

-- Lock entries before bracket generation.
create or replace function private.lock_tournament_entries(p_actor uuid, p_tournament uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare t record; v_count integer;
begin
  if not private.actor_is_staff(p_actor) then raise exception 'forbidden'; end if;
  select * into t from public.tournaments where id = p_tournament for update;
  if t is null then raise exception 'tournament_not_found'; end if;
  if t.finalized_at is not null then raise exception 'tournament_finalized'; end if;

  update public.tournament_entries
    set roster_locked_at = coalesce(roster_locked_at, now())
    where tournament_id = t.id and status <> 'withdrawn';

  update public.tournaments
    set status = case when status = 'registration_open' then 'registration_closed'::tournament_status else status end,
        entries_locked_at = coalesce(entries_locked_at, now())
    where id = t.id;

  select count(*) into v_count from public.tournament_entries
    where tournament_id = t.id and status <> 'withdrawn';
  perform private.audit(p_actor, 'entries_locked', 'tournament', t.id,
    jsonb_build_object('entries', v_count));
  return jsonb_build_object('status', 'locked', 'entries', v_count);
end $$;

-- Persist a fully computed bracket atomically. Idempotent: a tournament that
-- already has matches returns already_generated instead of duplicating rows.
create or replace function private.create_bracket(p_actor uuid, p_tournament uuid,
  p_seeds jsonb, p_matches jsonb)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare t record; v_seed jsonb; v_match jsonb; v_inserted integer := 0;
begin
  if not private.actor_is_staff(p_actor) then raise exception 'forbidden'; end if;
  select * into t from public.tournaments where id = p_tournament for update;
  if t is null then raise exception 'tournament_not_found'; end if;
  if t.finalized_at is not null then raise exception 'tournament_finalized'; end if;
  if exists (select 1 from public.matches where tournament_id = t.id) then
    return jsonb_build_object('status', 'already_generated', 'tournament_id', t.id);
  end if;
  if t.entries_locked_at is null then raise exception 'entries_not_locked'; end if;

  for v_seed in select * from jsonb_array_elements(p_seeds) loop
    update public.tournament_entries
      set seed = (v_seed->>'seed')::int
      where id = (v_seed->>'entry_id')::uuid and tournament_id = t.id;
  end loop;

  for v_match in select * from jsonb_array_elements(p_matches) loop
    insert into public.matches(tournament_id, round_label, round_index, bracket_slot, best_of,
      status, entry_a_id, entry_b_id, score_a, score_b, winner_entry_id, is_bye, scheduled_at)
    values (t.id, v_match->>'round_label', (v_match->>'round_index')::int,
      (v_match->>'bracket_slot')::int, coalesce((v_match->>'best_of')::int, 1),
      coalesce((v_match->>'status')::match_status, 'scheduled'),
      nullif(v_match->>'entry_a_id','')::uuid, nullif(v_match->>'entry_b_id','')::uuid,
      coalesce((v_match->>'score_a')::int, 0), coalesce((v_match->>'score_b')::int, 0),
      nullif(v_match->>'winner_entry_id','')::uuid,
      coalesce((v_match->>'is_bye')::boolean, false),
      nullif(v_match->>'scheduled_at','')::timestamptz);
    v_inserted := v_inserted + 1;
  end loop;

  update public.tournaments
    set bracket_generated_at = now(),
        status = case when status in ('registration_open','registration_closed')
                      then 'live'::tournament_status else status end
    where id = t.id;

  perform private.audit(p_actor, 'bracket_generated', 'tournament', t.id,
    jsonb_build_object('matches', v_inserted, 'seeds', jsonb_array_length(p_seeds)));
  return jsonb_build_object('status', 'generated', 'matches', v_inserted);
end $$;

-- Authoritative result reporting. Row-locked; first valid report wins.
create or replace function private.report_match_result(p_actor uuid, p_match uuid,
  p_score_a integer, p_score_b integer)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare m record; t record; v_needed integer; v_winner uuid; v_loser uuid;
  v_next_round integer; v_next_slot integer; nm record;
begin
  if not private.actor_is_staff(p_actor) then raise exception 'forbidden'; end if;

  select * into m from public.matches where id = p_match for update;
  if m is null then raise exception 'match_not_found'; end if;
  if m.status = 'completed' or m.winner_entry_id is not null then
    raise exception 'match_not_reportable';
  end if;
  if m.status = 'cancelled' or m.is_bye then raise exception 'match_not_reportable'; end if;
  if m.entry_a_id is null or m.entry_b_id is null then raise exception 'match_not_reportable'; end if;

  select * into t from public.tournaments where id = m.tournament_id;
  if t.finalized_at is not null then raise exception 'tournament_finalized'; end if;
  if t.status not in ('live','registration_closed') then raise exception 'tournament_not_active'; end if;

  v_needed := (m.best_of / 2) + 1;
  if p_score_a < 0 or p_score_b < 0 then raise exception 'invalid_score'; end if;
  if p_score_a + p_score_b > m.best_of then raise exception 'invalid_score'; end if;
  if greatest(p_score_a, p_score_b) <> v_needed then raise exception 'invalid_score'; end if;
  if p_score_a = p_score_b then raise exception 'invalid_score'; end if;

  if p_score_a > p_score_b then
    v_winner := m.entry_a_id; v_loser := m.entry_b_id;
  else
    v_winner := m.entry_b_id; v_loser := m.entry_a_id;
  end if;

  update public.matches
    set score_a = p_score_a, score_b = p_score_b, winner_entry_id = v_winner, status = 'completed'
    where id = m.id;

  update public.tournament_entries
    set eliminated_in_round = m.round_index
    where id = v_loser and eliminated_in_round is null;

  v_next_round := m.round_index + 1;
  v_next_slot := m.bracket_slot / 2;
  select * into nm from public.matches
    where tournament_id = m.tournament_id and round_index = v_next_round and bracket_slot = v_next_slot
    for update;

  if nm is not null then
    if m.bracket_slot % 2 = 0 then
      if nm.entry_a_id is not null and nm.entry_a_id <> v_winner then raise exception 'advancement_conflict'; end if;
      update public.matches set entry_a_id = v_winner where id = nm.id;
    else
      if nm.entry_b_id is not null and nm.entry_b_id <> v_winner then raise exception 'advancement_conflict'; end if;
      update public.matches set entry_b_id = v_winner where id = nm.id;
    end if;
  end if;

  perform private.audit(p_actor, 'match_result_reported', 'match', m.id,
    jsonb_build_object('tournament_id', m.tournament_id, 'round_index', m.round_index,
      'bracket_slot', m.bracket_slot, 'score_a', p_score_a, 'score_b', p_score_b,
      'winner_entry_id', v_winner));

  return jsonb_build_object('status','completed','match_id', m.id, 'winner_entry_id', v_winner,
    'advanced_to', case when nm is null then null else
      jsonb_build_object('round_index', v_next_round, 'bracket_slot', v_next_slot,
        'slot', case when m.bracket_slot % 2 = 0 then 'A' else 'B' end) end);
end $$;

-- Assign the four qualification slots of a finished qualifier, passing slots
-- down past already-qualified or ineligible teams.
create or replace function private.assign_qualification_slots(p_actor uuid, p_split uuid,
  p_tournament uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare v_rec record; v_assigned integer := 0; v_next_pos integer;
begin
  select coalesce(max(qualification_position), 0) into v_next_pos
    from public.split_qualifications where split_id = p_split;

  for v_rec in
    select e.team_id, e.placement from public.tournament_entries e
    where e.tournament_id = p_tournament and e.team_id is not null and e.status <> 'withdrawn'
    order by e.placement asc nulls last, e.seed asc nulls last
  loop
    exit when v_assigned >= 4;
    if exists (select 1 from public.split_qualifications q
               where q.split_id = p_split and q.team_id = v_rec.team_id) then
      continue;
    end if;
    if not private.team_is_eligible(v_rec.team_id) then continue; end if;

    v_next_pos := v_next_pos + 1;
    v_assigned := v_assigned + 1;
    insert into public.split_qualifications(split_id, team_id, qualified_from_tournament_id,
      qualification_position, status)
    values (p_split, v_rec.team_id, p_tournament, v_next_pos, 'qualified')
    on conflict (split_id, team_id) do nothing;

    perform private.audit(p_actor, 'qualification_assigned', 'team', v_rec.team_id,
      jsonb_build_object('split_id', p_split, 'tournament_id', p_tournament,
        'placement', v_rec.placement, 'qualification_position', v_next_pos));
  end loop;

  return jsonb_build_object('assigned', v_assigned);
end $$;

-- Replace a withdrawn qualified team using split standings.
create or replace function private.replace_withdrawn_qualifier(p_actor uuid, p_split uuid,
  p_team uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare s record; q record; v_candidate record; v_next_pos integer;
begin
  if not private.actor_is_staff(p_actor) then raise exception 'forbidden'; end if;
  select * into s from public.competitive_splits where id = p_split for update;
  if s is null then raise exception 'split_not_found'; end if;
  if s.status not in ('seeding','qualifiers') then raise exception 'replacement_window_closed'; end if;

  select * into q from public.split_qualifications
    where split_id = p_split and team_id = p_team and status = 'qualified' for update;
  if q is null then raise exception 'qualification_not_found'; end if;

  update public.split_qualifications set status = 'withdrawn' where id = q.id;

  select st.* into v_candidate from public.split_standings(p_split) st
    where st.qualification_status is null and private.team_is_eligible(st.team_id)
    limit 1;

  if v_candidate is null then
    perform private.audit(p_actor, 'qualification_replaced', 'team', p_team,
      jsonb_build_object('split_id', p_split, 'replacement', null, 'reason', 'no_candidate'));
    return jsonb_build_object('status','withdrawn','replacement', null);
  end if;

  select coalesce(max(qualification_position), 0) + 1 into v_next_pos
    from public.split_qualifications where split_id = p_split;

  insert into public.split_qualifications(split_id, team_id, qualified_from_tournament_id,
    qualification_position, replaces_team_id, status)
  values (p_split, v_candidate.team_id, null, v_next_pos, p_team, 'qualified')
  on conflict (split_id, team_id) do nothing;

  update public.split_qualifications set status = 'replaced' where id = q.id;

  perform private.audit(p_actor, 'qualification_replaced', 'team', p_team,
    jsonb_build_object('split_id', p_split, 'replacement_team_id', v_candidate.team_id,
      'replacement_points', v_candidate.points));

  return jsonb_build_object('status','replaced','replacement_team_id', v_candidate.team_id,
    'replacement_team_name', v_candidate.team_name);
end $$;

-- Atomic, idempotent tournament closure with flat phase reward + cumulative wins.
create or replace function private.finalize_tournament(p_actor uuid, p_tournament uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare t record; v_rounds integer; v_final record; v_champion uuid; e record;
  v_participation integer; v_match_win integer; v_phase text; v_phase_points integer;
  v_wins integer; v_placement integer; i integer; v_awarded integer := 0; v_qual jsonb;
begin
  if not private.actor_is_staff(p_actor) then raise exception 'forbidden'; end if;
  select * into t from public.tournaments where id = p_tournament for update;
  if t is null then raise exception 'tournament_not_found'; end if;
  if t.finalized_at is not null then
    return jsonb_build_object('status','already_finalized','tournament_id', t.id);
  end if;

  select coalesce(max(round_index) + 1, 0) into v_rounds from public.matches where tournament_id = t.id;
  if v_rounds = 0 then raise exception 'bracket_missing'; end if;

  select * into v_final from public.matches
    where tournament_id = t.id and round_index = v_rounds - 1 and bracket_slot = 0;
  if v_final is null or v_final.status <> 'completed' or v_final.winner_entry_id is null then
    raise exception 'final_not_completed';
  end if;
  if exists (select 1 from public.matches where tournament_id = t.id
             and status not in ('completed','cancelled') and entry_a_id is not null and entry_b_id is not null) then
    raise exception 'matches_pending';
  end if;
  v_champion := v_final.winner_entry_id;

  select points into v_participation from public.point_rules where code = 'participation';
  select points into v_match_win from public.point_rules where code = 'match_win';
  v_participation := coalesce(v_participation, 0);
  v_match_win := coalesce(v_match_win, 0);

  for e in
    select te.* from public.tournament_entries te
    where te.tournament_id = t.id and te.status <> 'withdrawn'
      and exists (select 1 from public.matches m where m.tournament_id = t.id
                  and (m.entry_a_id = te.id or m.entry_b_id = te.id))
  loop
    select count(*) into v_wins from public.matches m
      where m.tournament_id = t.id and m.status = 'completed' and not m.is_bye
        and m.winner_entry_id = e.id;

    if e.id = v_champion then v_phase := 'champion'; v_placement := 1;
    elsif e.eliminated_in_round = v_rounds - 1 then v_phase := 'runner_up'; v_placement := 2;
    elsif e.eliminated_in_round = v_rounds - 2 then v_phase := 'semifinal'; v_placement := 3;
    elsif e.eliminated_in_round = v_rounds - 3 then v_phase := 'quarterfinal'; v_placement := 5;
    else v_phase := null; v_placement := 9;
    end if;

    v_phase_points := 0;
    if v_phase is not null then
      select coalesce(points, 0) into v_phase_points from public.point_rules where code = v_phase;
      v_phase_points := coalesce(v_phase_points, 0);
    end if;

    perform private.award_entry(e.id, 'participation', v_participation, 'participation',
      t.name || ' — participation');
    for i in 1..v_wins loop
      perform private.award_entry(e.id, 'match_win', v_match_win, 'match_win:' || i,
        t.name || ' — series win ' || i);
    end loop;
    if v_phase is not null then
      perform private.award_entry(e.id, v_phase, v_phase_points, 'phase:' || v_phase,
        t.name || ' — ' || v_phase);
    end if;

    update public.tournament_entries
      set placement = v_placement,
          points_awarded = v_participation + (v_wins * v_match_win) + v_phase_points
      where id = e.id;

    if e.profile_id is not null then perform private.recompute_profile_stats(e.profile_id); end if;
    if e.team_id is not null then
      perform private.recompute_team_stats(e.team_id);
      perform private.recompute_profile_stats(tm.profile_id) from public.team_members tm
        where tm.team_id = e.team_id;
    end if;
    v_awarded := v_awarded + 1;
  end loop;

  update public.tournaments
    set finalized_at = now(), status = 'completed'
    where id = t.id;

  v_qual := null;
  if t.split_id is not null and t.qualifier_index is not null then
    v_qual := private.assign_qualification_slots(p_actor, t.split_id, t.id);
  end if;

  perform private.audit(p_actor, 'tournament_finalized', 'tournament', t.id,
    jsonb_build_object('competitors', v_awarded, 'champion_entry_id', v_champion,
      'qualification', v_qual));

  return jsonb_build_object('status','finalized','competitors', v_awarded,
    'champion_entry_id', v_champion, 'qualification', v_qual);
end $$;

-- Controlled split stage transitions.
create or replace function private.set_split_status(p_actor uuid, p_split uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare s record; v_allowed text[];
begin
  if not private.actor_is_staff(p_actor) then raise exception 'forbidden'; end if;
  select * into s from public.competitive_splits where id = p_split for update;
  if s is null then raise exception 'split_not_found'; end if;

  v_allowed := case s.status
    when 'upcoming' then array['qualifiers','cancelled']
    when 'qualifiers' then array['seeding','cancelled']
    when 'seeding' then array['playoffs','cancelled']
    when 'playoffs' then array['semifinals','cancelled']
    when 'semifinals' then array['final','cancelled']
    when 'final' then array['completed','cancelled']
    else array[]::text[] end;

  if not (p_status = any(v_allowed)) then raise exception 'invalid_transition'; end if;

  update public.competitive_splits set status = p_status::split_status where id = p_split;
  perform private.audit(p_actor, 'split_status_changed', 'split', p_split,
    jsonb_build_object('from', s.status, 'to', p_status));
  return jsonb_build_object('status', p_status);
end $$;

revoke all on function private.report_match_result(uuid, uuid, integer, integer) from public;
revoke all on function private.finalize_tournament(uuid, uuid) from public;
revoke all on function private.create_bracket(uuid, uuid, jsonb, jsonb) from public;
revoke all on function private.lock_tournament_entries(uuid, uuid) from public;
revoke all on function private.replace_withdrawn_qualifier(uuid, uuid, uuid) from public;
revoke all on function private.assign_qualification_slots(uuid, uuid, uuid) from public;
revoke all on function private.set_split_status(uuid, uuid, text) from public;

-- =============================================================
-- Demo Semi-Split so the split page has content
-- =============================================================
insert into public.competitive_splits (season_id, slug, name, division_id, region_id,
  starts_at, ends_at, status, playoff_size, dispute_deadline_at, playoff_reveal_at)
select s.id, 'las-silver-semi-split-1', 'LAS Silver Semi-Split 1', d.id, r.id,
  now() - interval '21 days', now() + interval '35 days', 'qualifiers', 16,
  now() + interval '30 days', now() + interval '33 days'
from public.seasons s
join public.divisions d on d.code = 'silver'
left join public.regions r on r.slug = 'las'
where s.is_active
on conflict (slug) do nothing;

update public.tournaments t
  set split_id = cs.id, qualifier_index = 1, split_phase = 'qualifier'
from public.competitive_splits cs
where cs.slug = 'las-silver-semi-split-1' and t.slug = 'rosario-silver-invitational-july';

update public.tournaments t
  set split_id = cs.id, qualifier_index = 2, split_phase = 'qualifier'
from public.competitive_splits cs
where cs.slug = 'las-silver-semi-split-1' and t.slug = 'rosario-open-silver-8';

insert into public.tournaments (slug, name, subtitle, description, division_id, region_id,
  season_id, split_id, qualifier_index, split_phase, status, format, mode, max_participants,
  participants_count, prize, registration_closes_at, starts_at)
select v.slug, v.name, v.subtitle, v.description, d.id, r.id, cs.season_id, cs.id,
  v.qualifier_index, 'qualifier', 'registration_open', 'single_elimination', 'team', 16, 0,
  v.prize, now() + v.closes, now() + v.starts
from (values
  ('las-silver-qualifier-3','LAS Silver Open Qualifier #3','Semi-Split 1 · Week 3',
   'Third Open Qualifier of the LAS Silver Semi-Split. Top 4 eligible teams take Playoff slots.',
   3, 'Playoff slot ×4', interval '6 days', interval '7 days'),
  ('las-silver-qualifier-4','LAS Silver Open Qualifier #4','Semi-Split 1 · Week 4',
   'Final Open Qualifier of the LAS Silver Semi-Split. Top 4 eligible teams take Playoff slots.',
   4, 'Playoff slot ×4', interval '13 days', interval '14 days')
) as v(slug, name, subtitle, description, qualifier_index, prize, closes, starts)
join public.competitive_splits cs on cs.slug = 'las-silver-semi-split-1'
join public.divisions d on d.code = 'silver'
left join public.regions r on r.slug = 'las'
on conflict (slug) do nothing;