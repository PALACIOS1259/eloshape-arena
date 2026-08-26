-- =============================================================
-- EloShape hardening: check-in gating, immutable roster snapshots,
-- full-roster eligibility, atomic playoff generation, safe qualification.
-- =============================================================

-- ---------- 1. tournament / split configuration ----------
alter table public.tournaments
  add column if not exists checkin_required boolean not null default true,
  add column if not exists required_roster_size integer not null default 5,
  add column if not exists min_account_level integer not null default 30,
  add column if not exists required_platform text;

alter table public.competitive_splits
  add column if not exists qualification_slots_per_qualifier integer not null default 4;

-- Historical brackets: entries that already played are treated as checked in.
update public.tournament_entries e
  set status = 'checked_in',
      checked_in_at = coalesce(e.checked_in_at, now())
  from public.tournaments t
  where t.id = e.tournament_id
    and e.status = 'registered'
    and exists (select 1 from public.matches m
                where m.tournament_id = t.id and (m.entry_a_id = e.id or m.entry_b_id = e.id));

-- ---------- 2. immutable roster snapshot ----------
create table if not exists public.tournament_roster_members (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  entry_id uuid not null references public.tournament_entries(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'player',
  is_captain boolean not null default false,
  is_substitute boolean not null default false,
  riot_id text,
  riot_tier text,
  riot_rank text,
  account_level integer,
  locked_at timestamptz not null default now(),
  unique (entry_id, profile_id)
);

grant select on public.tournament_roster_members to anon, authenticated;
grant all on public.tournament_roster_members to service_role;
alter table public.tournament_roster_members enable row level security;

do $$ begin
  create policy "Locked rosters are public" on public.tournament_roster_members
    for select using (true);
exception when duplicate_object then null; end $$;

create index if not exists tournament_roster_members_tournament_idx
  on public.tournament_roster_members(tournament_id);
create index if not exists tournament_roster_members_profile_idx
  on public.tournament_roster_members(profile_id);

-- A snapshot row may never be rewritten once locked.
create or replace function private.roster_snapshot_immutable()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  raise exception 'roster_snapshot_immutable';
end $$;

drop trigger if exists tournament_roster_members_immutable on public.tournament_roster_members;
create trigger tournament_roster_members_immutable
  before update on public.tournament_roster_members
  for each row execute function private.roster_snapshot_immutable();

-- ---------- 3. eligibility helpers ----------
-- Explicit, reason-returning player eligibility. p_tournament may be null for
-- generic (non tournament-specific) checks.
create or replace function private.player_eligibility_reasons(p_profile uuid, p_tournament uuid)
returns text[] language plpgsql stable security definer set search_path = public, private as $$
declare pr record; ra record; t record; d record; v text[] := '{}'; v_min integer := 30;
begin
  if p_profile is null then return array['profile_missing']; end if;
  select * into pr from public.profiles where id = p_profile;
  if pr.id is null then return array['profile_missing']; end if;

  if p_tournament is not null then
    select * into t from public.tournaments where id = p_tournament;
    v_min := coalesce(t.min_account_level, 30);
  end if;

  if pr.eligibility <> 'eligible' then
    v := v || ('eligibility:' || pr.eligibility::text);
  end if;

  select * into ra from public.riot_accounts
    where profile_id = p_profile
    order by ownership_verified desc, data_verified desc, created_at asc
    limit 1;

  if ra.id is null then
    v := v || 'riot_account_missing';
  else
    if ra.solo_tier is null or not ra.data_verified then v := v || 'riot_rank_unverified'; end if;
    if coalesce(ra.account_level, 0) < v_min then v := v || 'account_level_below_minimum'; end if;
    if t.required_platform is not null and lower(coalesce(ra.platform,'')) <> lower(t.required_platform) then
      v := v || 'platform_mismatch';
    end if;
    if t.division_id is not null and ra.solo_tier is not null then
      select * into d from public.divisions where id = t.division_id;
      if d.id is not null and not (upper(ra.solo_tier) in (select upper(x) from unnest(d.riot_tiers) x)) then
        v := v || 'division_mismatch';
      end if;
    end if;
  end if;

  return v;
end $$;

-- Full-roster team eligibility. When p_entry has a locked snapshot the snapshot
-- is authoritative; otherwise the current roster is evaluated.
create or replace function private.team_eligibility(p_team uuid, p_tournament uuid,
  p_entry uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public, private as $$
declare t record; tm record; m record; v_reasons jsonb := '[]'::jsonb; v_count integer := 0;
  r text[]; v_required integer := 5; v_snapshot boolean := false;
begin
  select * into tm from public.teams where id = p_team;
  if tm.id is null then
    return jsonb_build_object('eligible', false, 'active_players', 0,
      'reasons', jsonb_build_array(jsonb_build_object('roster', 'team_missing')));
  end if;
  if tm.captain_id is null then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('roster', 'captain_missing'));
  end if;

  if p_tournament is not null then
    select * into t from public.tournaments where id = p_tournament;
    v_required := coalesce(t.required_roster_size, 5);
  end if;

  if p_entry is not null then
    select exists (select 1 from public.tournament_roster_members where entry_id = p_entry)
      into v_snapshot;
  end if;

  for m in
    select rm.profile_id
      from public.tournament_roster_members rm
      where v_snapshot and rm.entry_id = p_entry and not rm.is_substitute
    union all
    select member.profile_id
      from public.team_members member
      where not v_snapshot and member.team_id = p_team
        and lower(coalesce(member.role, 'player')) <> 'substitute'
  loop
    v_count := v_count + 1;
    r := private.player_eligibility_reasons(m.profile_id, p_tournament);
    if array_length(r, 1) is not null then
      v_reasons := v_reasons || jsonb_build_array(
        jsonb_build_object('profile_id', m.profile_id, 'reasons', to_jsonb(r)));
    end if;
  end loop;

  if v_count < v_required then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'roster', 'incomplete', 'required', v_required, 'active', v_count));
  end if;

  return jsonb_build_object('eligible', jsonb_array_length(v_reasons) = 0,
    'active_players', v_count, 'snapshot', v_snapshot, 'reasons', v_reasons);
end $$;

-- Legacy helper now delegates to the full-roster check.
create or replace function private.team_is_eligible(p_team uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select coalesce((private.team_eligibility(p_team, null, null)->>'eligible')::boolean, false);
$$;

create or replace function private.team_is_eligible(p_team uuid, p_tournament uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select coalesce((private.team_eligibility(p_team, p_tournament, null)->>'eligible')::boolean, false);
$$;

-- Only properly checked-in entries compete (unless the tournament opts out).
create or replace function private.entry_competed(p_entry uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1 from public.tournament_entries e
    join public.tournaments t on t.id = e.tournament_id
    where e.id = p_entry
      and (e.status = 'checked_in' or (t.checkin_required = false and e.status = 'registered'))
  );
$$;

create or replace function private.bracket_entry_ids(p_tournament uuid)
returns setof uuid language sql stable security definer set search_path = public, private as $$
  select e.id from public.tournament_entries e
  join public.tournaments t on t.id = e.tournament_id
  where e.tournament_id = p_tournament
    and (e.status = 'checked_in' or (t.checkin_required = false and e.status = 'registered'));
$$;

-- ---------- 4. roster snapshot writer ----------
create or replace function private.snapshot_entry_roster(p_entry uuid)
returns integer language plpgsql security definer set search_path = public, private as $$
declare e record; v_count integer := 0;
begin
  select * into e from public.tournament_entries where id = p_entry;
  if e.id is null then return 0; end if;
  if exists (select 1 from public.tournament_roster_members where entry_id = e.id) then
    return 0;
  end if;

  if e.team_id is not null then
    insert into public.tournament_roster_members(tournament_id, entry_id, team_id, profile_id,
      role, is_captain, is_substitute, riot_id, riot_tier, riot_rank, account_level)
    select e.tournament_id, e.id, e.team_id, member.profile_id,
      coalesce(member.role, 'player'), member.is_captain,
      lower(coalesce(member.role, 'player')) = 'substitute',
      ra.riot_id, ra.solo_tier, ra.solo_rank, ra.account_level
    from public.team_members member
    left join lateral (
      select * from public.riot_accounts r where r.profile_id = member.profile_id
      order by r.ownership_verified desc, r.data_verified desc, r.created_at asc limit 1
    ) ra on true
    where member.team_id = e.team_id
    on conflict (entry_id, profile_id) do nothing;
  elsif e.profile_id is not null then
    insert into public.tournament_roster_members(tournament_id, entry_id, team_id, profile_id,
      role, is_captain, is_substitute, riot_id, riot_tier, riot_rank, account_level)
    select e.tournament_id, e.id, null, e.profile_id, 'player', true, false,
      ra.riot_id, ra.solo_tier, ra.solo_rank, ra.account_level
    from (select 1) one
    left join lateral (
      select * from public.riot_accounts r where r.profile_id = e.profile_id
      order by r.ownership_verified desc, r.data_verified desc, r.created_at asc limit 1
    ) ra on true
    on conflict (entry_id, profile_id) do nothing;
  end if;

  select count(*) into v_count from public.tournament_roster_members where entry_id = e.id;
  return v_count;
end $$;

-- ---------- 5. locking: check-in + full roster validation + snapshot ----------
create or replace function private.lock_tournament_entries(p_actor uuid, p_tournament uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare t record; e record; v_elig jsonb; v_locked integer := 0;
  v_rejected jsonb := '[]'::jsonb; v_skipped integer := 0;
begin
  if not private.actor_is_staff(p_actor) then raise exception 'forbidden'; end if;
  select * into t from public.tournaments where id = p_tournament for update;
  if t.id is null then raise exception 'tournament_not_found'; end if;
  if t.finalized_at is not null then raise exception 'tournament_finalized'; end if;

  for e in
    select * from public.tournament_entries
    where tournament_id = t.id and status not in ('withdrawn', 'disqualified')
    order by created_at
  loop
    -- Check-in gate: a merely registered entry never enters the bracket.
    if not (e.status = 'checked_in' or (t.checkin_required = false and e.status = 'registered')) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    if e.team_id is not null then
      v_elig := private.team_eligibility(e.team_id, t.id, e.id);
    else
      v_elig := jsonb_build_object(
        'eligible', array_length(private.player_eligibility_reasons(e.profile_id, t.id), 1) is null,
        'reasons', to_jsonb(private.player_eligibility_reasons(e.profile_id, t.id)));
    end if;

    if not coalesce((v_elig->>'eligible')::boolean, false) then
      update public.tournament_entries set status = 'disqualified' where id = e.id;
      v_rejected := v_rejected || jsonb_build_array(jsonb_build_object(
        'entry_id', e.id, 'team_id', e.team_id, 'profile_id', e.profile_id,
        'reasons', v_elig->'reasons'));
      perform private.audit(p_actor, 'entry_rejected', 'tournament_entry', e.id,
        jsonb_build_object('tournament_id', t.id, 'eligibility', v_elig));
      continue;
    end if;

    perform private.snapshot_entry_roster(e.id);
    update public.tournament_entries
      set roster_locked_at = coalesce(roster_locked_at, now())
      where id = e.id;
    v_locked := v_locked + 1;
  end loop;

  update public.tournaments
    set status = case when status = 'registration_open' then 'registration_closed'::tournament_status else status end,
        entries_locked_at = coalesce(entries_locked_at, now())
    where id = t.id;

  perform private.audit(p_actor, 'entries_locked', 'tournament', t.id,
    jsonb_build_object('entries', v_locked, 'not_checked_in', v_skipped,
      'rejected', v_rejected));

  return jsonb_build_object('status', 'locked', 'entries', v_locked,
    'not_checked_in', v_skipped, 'rejected', v_rejected);
end $$;

-- ---------- 6. bracket creation only from locked, checked-in entries ----------
create or replace function private.create_bracket(p_actor uuid, p_tournament uuid,
  p_seeds jsonb, p_matches jsonb)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare t record; v_seed jsonb; v_match jsonb; v_inserted integer := 0; v_entry uuid;
begin
  if not private.actor_is_staff(p_actor) then raise exception 'forbidden'; end if;
  select * into t from public.tournaments where id = p_tournament for update;
  if t.id is null then raise exception 'tournament_not_found'; end if;
  if t.finalized_at is not null then raise exception 'tournament_finalized'; end if;
  if exists (select 1 from public.matches where tournament_id = t.id) then
    return jsonb_build_object('status', 'already_generated', 'tournament_id', t.id);
  end if;
  if t.entries_locked_at is null then raise exception 'entries_not_locked'; end if;

  -- Every seeded entry must be a locked, checked-in competitor of this tournament.
  for v_seed in select * from jsonb_array_elements(p_seeds) loop
    v_entry := (v_seed->>'entry_id')::uuid;
    if not exists (select 1 from private.bracket_entry_ids(t.id) x where x = v_entry) then
      raise exception 'entry_not_checked_in';
    end if;
    if not exists (select 1 from public.tournament_entries
                   where id = v_entry and tournament_id = t.id and roster_locked_at is not null) then
      raise exception 'entry_roster_not_locked';
    end if;
    update public.tournament_entries set seed = (v_seed->>'seed')::int where id = v_entry;
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
                      then 'live'::tournament_status else status end,
        participants_count = (select count(*) from private.bracket_entry_ids(t.id))
    where id = t.id;

  perform private.audit(p_actor, 'bracket_generated', 'tournament', t.id,
    jsonb_build_object('matches', v_inserted, 'seeds', jsonb_array_length(p_seeds)));
  return jsonb_build_object('status', 'generated', 'matches', v_inserted);
end $$;

-- ---------- 7. ledger writer reads the immutable snapshot ----------
create or replace function private.award_entry(p_entry uuid, p_rule text, p_points integer,
  p_event_key text, p_note text)
returns void language plpgsql security definer set search_path = public, private as $$
declare e record; t record; v_member record;
begin
  select * into e from public.tournament_entries where id = p_entry;
  if e.id is null then return; end if;
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

    -- Immutable locked roster only. The mutable team_members table is never read here.
    for v_member in
      select rm.profile_id from public.tournament_roster_members rm
      where rm.entry_id = e.id and not rm.is_substitute
    loop
      insert into public.ranking_points(profile_id, tournament_id, season_id, rule_code, points, note, event_key)
      values (v_member.profile_id, t.id, t.season_id, p_rule, p_points, p_note, 'team:' || p_event_key)
      on conflict do nothing;
    end loop;
  end if;
end $$;

-- ---------- 8. aggregates count only competitors ----------
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
      from public.tournament_entries e
      where e.profile_id = p.id and private.entry_competed(e.id)), 0)
  where p.id = p_profile;
end $$;

-- ---------- 9. finalization: only checked-in competitors, snapshot rosters ----------
create or replace function private.finalize_tournament(p_actor uuid, p_tournament uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare t record; v_rounds integer; v_final record; v_champion uuid; e record;
  v_participation integer; v_match_win integer; v_phase text; v_phase_points integer;
  v_wins integer; v_placement integer; i integer; v_awarded integer := 0; v_qual jsonb;
begin
  if not private.actor_is_staff(p_actor) then raise exception 'forbidden'; end if;
  select * into t from public.tournaments where id = p_tournament for update;
  if t.id is null then raise exception 'tournament_not_found'; end if;
  if t.finalized_at is not null then
    return jsonb_build_object('status','already_finalized','tournament_id', t.id);
  end if;

  select coalesce(max(round_index) + 1, 0) into v_rounds from public.matches where tournament_id = t.id;
  if v_rounds = 0 then raise exception 'bracket_missing'; end if;

  select * into v_final from public.matches
    where tournament_id = t.id and round_index = v_rounds - 1 and bracket_slot = 0;
  if v_final.id is null or v_final.status <> 'completed' or v_final.winner_entry_id is null then
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
    where te.tournament_id = t.id
      and private.entry_competed(te.id)
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
      perform private.recompute_profile_stats(rm.profile_id)
        from public.tournament_roster_members rm where rm.entry_id = e.id;
    end if;
    v_awarded := v_awarded + 1;
  end loop;

  update public.tournaments set finalized_at = now(), status = 'completed' where id = t.id;

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

-- ---------- 10. concurrency-safe qualification allocation ----------
create or replace function private.assign_qualification_slots(p_actor uuid, p_split uuid,
  p_tournament uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare v_rec record; v_assigned integer := 0; v_next_pos integer; v_slots integer;
  v_id uuid; v_skipped jsonb := '[]'::jsonb; v_elig jsonb;
begin
  -- Serialize all qualification writes for this split, whatever tournament closes.
  perform pg_advisory_xact_lock(hashtextextended('split_qualification:' || p_split::text, 0));

  select coalesce(qualification_slots_per_qualifier, 4) into v_slots
    from public.competitive_splits where id = p_split;
  v_slots := coalesce(v_slots, 4);

  select coalesce(max(qualification_position), 0) into v_next_pos
    from public.split_qualifications where split_id = p_split;

  for v_rec in
    select e.id as entry_id, e.team_id, e.placement from public.tournament_entries e
    where e.tournament_id = p_tournament and e.team_id is not null
      and private.entry_competed(e.id)
    order by e.placement asc nulls last, e.seed asc nulls last, e.created_at asc
  loop
    exit when v_assigned >= v_slots;
    if exists (select 1 from public.split_qualifications q
               where q.split_id = p_split and q.team_id = v_rec.team_id) then
      continue;
    end if;

    v_elig := private.team_eligibility(v_rec.team_id, p_tournament, v_rec.entry_id);
    if not coalesce((v_elig->>'eligible')::boolean, false) then
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'team_id', v_rec.team_id, 'reasons', v_elig->'reasons'));
      continue;
    end if;

    -- Only a row that was actually inserted consumes a slot.
    insert into public.split_qualifications(split_id, team_id, qualified_from_tournament_id,
      qualification_position, status)
    values (p_split, v_rec.team_id, p_tournament, v_next_pos + 1, 'qualified')
    on conflict (split_id, team_id) do nothing
    returning id into v_id;

    if v_id is null then continue; end if;

    v_next_pos := v_next_pos + 1;
    v_assigned := v_assigned + 1;
    v_id := null;

    perform private.audit(p_actor, 'qualification_assigned', 'team', v_rec.team_id,
      jsonb_build_object('split_id', p_split, 'tournament_id', p_tournament,
        'placement', v_rec.placement, 'qualification_position', v_next_pos));
  end loop;

  return jsonb_build_object('assigned', v_assigned, 'slots', v_slots, 'skipped', v_skipped);
end $$;

-- ---------- 11. deterministic seed order in SQL ----------
create or replace function private.seed_order(p_size integer)
returns integer[] language plpgsql immutable set search_path = public as $$
declare v_order integer[] := array[1,2]; v_next integer[]; v_len integer; s integer;
begin
  while array_length(v_order, 1) < p_size loop
    v_len := array_length(v_order, 1) * 2;
    v_next := '{}';
    foreach s in array v_order loop
      v_next := v_next || s || (v_len + 1 - s);
    end loop;
    v_order := v_next;
  end loop;
  return v_order;
end $$;

create or replace function private.round_label(p_round_index integer, p_rounds integer)
returns text language sql immutable set search_path = public as $$
  select case p_rounds - 1 - p_round_index
    when 0 then 'Final' when 1 then 'Semifinal' when 2 then 'Quarterfinal'
    else 'Round of ' || (2 ^ (p_rounds - p_round_index))::int::text end;
$$;

-- ---------- 12. atomic split playoff generation ----------
create or replace function private.generate_split_playoffs(p_actor uuid, p_split uuid,
  p_best_of integer default 3, p_allow_short_field boolean default false,
  p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare s record; v_slug text; v_tournament uuid; v_qualified integer := 0;
  v_size integer := 2; v_rounds integer; v_order integer[]; v_row record;
  v_seed integer := 0; v_entry uuid; v_entry_by_seed uuid[]; v_slot integer;
  v_a uuid; v_b uuid; v_present uuid; v_byes integer := 0; v_matches integer := 0;
  v_round integer; v_count integer; v_next_slot integer;
begin
  if not private.actor_is_staff(p_actor) then raise exception 'forbidden'; end if;
  perform pg_advisory_xact_lock(hashtextextended('split_playoffs:' || p_split::text, 0));

  select * into s from public.competitive_splits where id = p_split for update;
  if s.id is null then raise exception 'split_not_found'; end if;
  if s.status not in ('seeding','playoffs') then raise exception 'playoff_window_closed'; end if;

  select count(*) into v_qualified from public.split_qualifications
    where split_id = p_split and status = 'qualified';

  -- The configured playoff field size is the normal requirement.
  if v_qualified <> s.playoff_size then
    if not p_allow_short_field then
      raise exception 'playoff_field_incomplete: % of % qualified', v_qualified, s.playoff_size;
    end if;
    if p_reason is null or length(btrim(p_reason)) = 0 then
      raise exception 'override_reason_required';
    end if;
    if v_qualified < 2 then raise exception 'playoff_field_too_small'; end if;
    perform private.audit(p_actor, 'playoff_field_override', 'split', p_split,
      jsonb_build_object('qualified', v_qualified, 'playoff_size', s.playoff_size,
        'reason', p_reason));
  end if;

  v_slug := s.slug || '-playoffs';
  select id into v_tournament from public.tournaments where slug = v_slug;
  if v_tournament is null then
    insert into public.tournaments(slug, name, subtitle, description, division_id, region_id,
      season_id, split_id, split_phase, status, format, mode, max_participants,
      participants_count, starts_at, checkin_required, required_roster_size)
    values (v_slug, s.name || ' — Playoffs', s.playoff_size || '-team Playoff bracket',
      'Playoff bracket seeded from Semi-Split standings.',
      s.division_id, s.region_id, s.season_id, p_split, 'playoffs',
      'registration_closed', 'single_elimination', 'team', s.playoff_size,
      v_qualified, s.ends_at, false, 5)
    returning id into v_tournament;
  end if;

  if exists (select 1 from public.matches where tournament_id = v_tournament) then
    return jsonb_build_object('status','already_generated','tournament_id', v_tournament,
      'slug', v_slug);
  end if;

  -- Seeds come from Semi-Split standings order, never from qualification order.
  for v_row in
    select st.team_id from public.split_standings(p_split) st
    join public.split_qualifications q
      on q.split_id = p_split and q.team_id = st.team_id and q.status = 'qualified'
    order by st.points desc, st.wins desc, st.tournaments_played desc, lower(st.team_name) asc
  loop
    v_seed := v_seed + 1;

    select id into v_entry from public.tournament_entries
      where tournament_id = v_tournament and team_id = v_row.team_id;
    if v_entry is null then
      insert into public.tournament_entries(tournament_id, team_id, status, seed, roster_locked_at,
        checked_in_at)
      values (v_tournament, v_row.team_id, 'checked_in', v_seed, now(), now())
      returning id into v_entry;
    else
      update public.tournament_entries
        set seed = v_seed, status = 'checked_in',
            checked_in_at = coalesce(checked_in_at, now()),
            roster_locked_at = coalesce(roster_locked_at, now())
        where id = v_entry;
    end if;

    perform private.snapshot_entry_roster(v_entry);
    update public.split_qualifications set playoff_seed = v_seed
      where split_id = p_split and team_id = v_row.team_id;

    v_entry_by_seed[v_seed] := v_entry;
    v_entry := null;
  end loop;

  if v_seed < 2 then raise exception 'playoff_field_too_small'; end if;

  update public.tournaments
    set entries_locked_at = coalesce(entries_locked_at, now()),
        participants_count = v_seed
    where id = v_tournament;

  while v_size < v_seed loop v_size := v_size * 2; end loop;
  v_rounds := (ln(v_size) / ln(2))::int;
  v_order := private.seed_order(v_size);

  -- Empty scaffolding for every coordinate.
  for v_round in 0..v_rounds - 1 loop
    v_count := v_size / (2 ^ (v_round + 1))::int;
    for v_slot in 0..v_count - 1 loop
      insert into public.matches(tournament_id, round_label, round_index, bracket_slot,
        best_of, status, score_a, score_b, is_bye)
      values (v_tournament, private.round_label(v_round, v_rounds), v_round, v_slot,
        coalesce(p_best_of, 3), 'scheduled', 0, 0, false);
      v_matches := v_matches + 1;
    end loop;
  end loop;

  -- Round 0 pairing plus bye auto-advancement.
  for v_slot in 0..(v_size / 2) - 1 loop
    v_a := v_entry_by_seed[v_order[v_slot * 2 + 1]];
    v_b := v_entry_by_seed[v_order[v_slot * 2 + 2]];

    update public.matches set entry_a_id = v_a, entry_b_id = v_b
      where tournament_id = v_tournament and round_index = 0 and bracket_slot = v_slot;

    if v_a is not null and v_b is not null then continue; end if;
    v_present := coalesce(v_a, v_b);
    if v_present is null then continue; end if;

    v_byes := v_byes + 1;
    update public.matches
      set is_bye = true, status = 'completed', winner_entry_id = v_present
      where tournament_id = v_tournament and round_index = 0 and bracket_slot = v_slot;

    if v_rounds > 1 then
      v_next_slot := v_slot / 2;
      if v_slot % 2 = 0 then
        update public.matches set entry_a_id = v_present
          where tournament_id = v_tournament and round_index = 1 and bracket_slot = v_next_slot;
      else
        update public.matches set entry_b_id = v_present
          where tournament_id = v_tournament and round_index = 1 and bracket_slot = v_next_slot;
      end if;
    end if;
  end loop;

  update public.tournaments
    set bracket_generated_at = now(), status = 'live'
    where id = v_tournament;

  update public.competitive_splits
    set status = case when status = 'seeding' then 'playoffs'::split_status else status end
    where id = p_split;

  perform private.audit(p_actor, 'playoffs_generated', 'split', p_split,
    jsonb_build_object('tournament_id', v_tournament, 'teams', v_seed, 'size', v_size,
      'rounds', v_rounds, 'byes', v_byes, 'matches', v_matches,
      'override_reason', p_reason));

  return jsonb_build_object('status','generated','tournament_id', v_tournament, 'slug', v_slug,
    'teams', v_seed, 'size', v_size, 'rounds', v_rounds, 'byes', v_byes, 'matches', v_matches);
end $$;

-- ---------- 13. staff wrapper ----------
create or replace function public.staff_generate_split_playoffs(p_split uuid,
  p_best_of integer default 3, p_allow_short_field boolean default false,
  p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not private.actor_is_staff(v_actor) then raise exception 'forbidden'; end if;
  return private.generate_split_playoffs(v_actor, p_split, p_best_of, p_allow_short_field, p_reason);
end $$;

-- ---------- 14. execute privileges ----------
revoke all on function private.player_eligibility_reasons(uuid, uuid) from public;
revoke all on function private.team_eligibility(uuid, uuid, uuid) from public;
revoke all on function private.team_is_eligible(uuid) from public;
revoke all on function private.team_is_eligible(uuid, uuid) from public;
revoke all on function private.entry_competed(uuid) from public;
revoke all on function private.bracket_entry_ids(uuid) from public;
revoke all on function private.snapshot_entry_roster(uuid) from public;
revoke all on function private.seed_order(integer) from public;
revoke all on function private.round_label(integer, integer) from public;
revoke all on function private.generate_split_playoffs(uuid, uuid, integer, boolean, text) from public;
revoke all on function private.roster_snapshot_immutable() from public;

revoke all on function public.staff_generate_split_playoffs(uuid, integer, boolean, text) from public;
grant execute on function public.staff_generate_split_playoffs(uuid, integer, boolean, text) to authenticated;

-- ---------- 15. backfill snapshots for already locked entries ----------
do $$ declare e record; begin
  for e in select id from public.tournament_entries where roster_locked_at is not null loop
    perform private.snapshot_entry_roster(e.id);
  end loop;
end $$;