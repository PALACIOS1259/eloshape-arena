-- Scrims + qualifier capacity protection.
-- Qualified teams may re-enter a later qualifier only after its configured
-- repeat-entry window opens. Scrims are practice-only and never award points.

alter table public.tournaments
  add column if not exists qualified_teams_registration_opens_at timestamptz;

comment on column public.tournaments.qualified_teams_registration_opens_at is
  'For split qualifiers, already-qualified teams cannot register before this time. Null means no special restriction.';

create table if not exists public.scrim_posts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by_profile_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  best_of integer not null default 3 check (best_of in (1,3,5)),
  note text,
  status text not null default 'open' check (status in ('open','matched','cancelled','completed')),
  opponent_team_id uuid references public.teams(id) on delete set null,
  score_team integer,
  score_opponent integer,
  winner_team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scrim_different_teams check (opponent_team_id is null or opponent_team_id <> team_id),
  constraint scrim_time_order check (ends_at is null or ends_at > starts_at),
  constraint scrim_note_length check (note is null or char_length(note) <= 240)
);

create index if not exists scrim_posts_status_start_idx
  on public.scrim_posts(status, starts_at);
create index if not exists scrim_posts_team_idx
  on public.scrim_posts(team_id, starts_at desc);

drop trigger if exists scrim_posts_updated_at on public.scrim_posts;
create trigger scrim_posts_updated_at
before update on public.scrim_posts
for each row execute function public.set_updated_at();

create table if not exists public.scrim_challenges (
  id uuid primary key default gen_random_uuid(),
  scrim_id uuid not null references public.scrim_posts(id) on delete cascade,
  challenger_team_id uuid not null references public.teams(id) on delete cascade,
  created_by_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(scrim_id, challenger_team_id)
);

create index if not exists scrim_challenges_scrim_status_idx
  on public.scrim_challenges(scrim_id, status);

drop trigger if exists scrim_challenges_updated_at on public.scrim_challenges;
create trigger scrim_challenges_updated_at
before update on public.scrim_challenges
for each row execute function public.set_updated_at();

alter table public.scrim_posts enable row level security;
alter table public.scrim_challenges enable row level security;

revoke all on public.scrim_posts from anon, authenticated;
revoke all on public.scrim_challenges from anon, authenticated;
grant all on public.scrim_posts to service_role;
grant all on public.scrim_challenges to service_role;

create or replace function public.list_scrims()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'startsAt', s.starts_at,
        'endsAt', s.ends_at,
        'bestOf', s.best_of,
        'note', s.note,
        'status', s.status,
        'scoreTeam', s.score_team,
        'scoreOpponent', s.score_opponent,
        'winnerTeamId', s.winner_team_id,
        'team', jsonb_build_object(
          'id', host.id,
          'slug', host.slug,
          'name', host.name,
          'tag', host.tag,
          'logoUrl', host.logo_url,
          'division', case when hd.id is null then null else jsonb_build_object(
            'code', hd.code, 'name', hd.name, 'accent', hd.accent
          ) end,
          'city', case when hr.id is null then null else jsonb_build_object(
            'id', hr.id, 'name', hr.name
          ) end
        ),
        'opponent', case when opp.id is null then null else jsonb_build_object(
          'id', opp.id,
          'slug', opp.slug,
          'name', opp.name,
          'tag', opp.tag,
          'logoUrl', opp.logo_url,
          'division', case when od.id is null then null else jsonb_build_object(
            'code', od.code, 'name', od.name, 'accent', od.accent
          ) end
        ) end,
        'challengeCount', (
          select count(*) from public.scrim_challenges c
          where c.scrim_id = s.id and c.status = 'pending'
        )
      )
      order by
        case s.status when 'open' then 0 when 'matched' then 1 when 'completed' then 2 else 3 end,
        s.starts_at asc
    ),
    '[]'::jsonb
  )
  from public.scrim_posts s
  join public.teams host on host.id = s.team_id
  left join public.divisions hd on hd.id = host.division_id
  left join public.regions hr on hr.id = host.city_id
  left join public.teams opp on opp.id = s.opponent_team_id
  left join public.divisions od on od.id = opp.division_id
  where s.status <> 'cancelled'
    and s.starts_at >= now() - interval '14 days';
$function$;

revoke all on function public.list_scrims() from public;
grant execute on function public.list_scrims() to anon, authenticated, service_role;

create or replace function public.get_my_scrim_hub()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_profile uuid;
  v_team record;
  v_incoming jsonb;
  v_outgoing jsonb;
  v_own jsonb;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  v_profile := public.ensure_my_profile();

  select t.id, t.slug, t.name, t.tag, t.captain_id,
         (t.captain_id = v_profile) as is_captain
  into v_team
  from public.team_members tm
  join public.teams t on t.id = tm.team_id
  where tm.profile_id = v_profile
  limit 1;

  if v_team.id is null then
    return jsonb_build_object(
      'profileId', v_profile,
      'team', null,
      'incomingChallenges', '[]'::jsonb,
      'outgoingChallenges', '[]'::jsonb,
      'ownScrims', '[]'::jsonb
    );
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'scrimId', c.scrim_id,
      'status', c.status,
      'createdAt', c.created_at,
      'challenger', jsonb_build_object(
        'id', challenger.id,
        'slug', challenger.slug,
        'name', challenger.name,
        'tag', challenger.tag
      )
    ) order by c.created_at desc
  ), '[]'::jsonb)
  into v_incoming
  from public.scrim_challenges c
  join public.scrim_posts s on s.id = c.scrim_id
  join public.teams challenger on challenger.id = c.challenger_team_id
  where s.team_id = v_team.id
    and c.status = 'pending';

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'scrimId', c.scrim_id,
      'status', c.status,
      'createdAt', c.created_at
    ) order by c.created_at desc
  ), '[]'::jsonb)
  into v_outgoing
  from public.scrim_challenges c
  where c.challenger_team_id = v_team.id
    and c.status in ('pending','accepted');

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'startsAt', s.starts_at,
      'bestOf', s.best_of,
      'status', s.status,
      'opponentTeamId', s.opponent_team_id,
      'scoreTeam', s.score_team,
      'scoreOpponent', s.score_opponent
    ) order by s.starts_at desc
  ), '[]'::jsonb)
  into v_own
  from public.scrim_posts s
  where s.team_id = v_team.id or s.opponent_team_id = v_team.id;

  return jsonb_build_object(
    'profileId', v_profile,
    'team', jsonb_build_object(
      'id', v_team.id,
      'slug', v_team.slug,
      'name', v_team.name,
      'tag', v_team.tag,
      'isCaptain', v_team.is_captain
    ),
    'incomingChallenges', v_incoming,
    'outgoingChallenges', v_outgoing,
    'ownScrims', v_own
  );
end;
$function$;

revoke all on function public.get_my_scrim_hub() from public;
grant execute on function public.get_my_scrim_hub() to authenticated;

create or replace function public.create_my_scrim(
  p_starts_at timestamptz,
  p_ends_at timestamptz default null,
  p_best_of integer default 3,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_profile uuid;
  v_team record;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  v_profile := public.ensure_my_profile();

  select t.* into v_team
  from public.teams t
  where t.captain_id = v_profile
  for update;

  if v_team.id is null then raise exception 'team_captain_required'; end if;
  if p_starts_at < now() + interval '10 minutes' then raise exception 'scrim_start_too_soon'; end if;
  if p_ends_at is not null and p_ends_at <= p_starts_at then raise exception 'invalid_scrim_window'; end if;
  if p_best_of not in (1,3,5) then raise exception 'invalid_best_of'; end if;
  if char_length(coalesce(p_note,'')) > 240 then raise exception 'scrim_note_too_long'; end if;

  insert into public.scrim_posts(
    team_id, created_by_profile_id, starts_at, ends_at, best_of, note
  ) values (
    v_team.id, v_profile, p_starts_at, p_ends_at, p_best_of, nullif(btrim(p_note), '')
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'status', 'open');
end;
$function$;

revoke all on function public.create_my_scrim(timestamptz,timestamptz,integer,text) from public;
grant execute on function public.create_my_scrim(timestamptz,timestamptz,integer,text) to authenticated;

create or replace function public.challenge_scrim(p_scrim uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_profile uuid;
  v_team record;
  v_scrim record;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  v_profile := public.ensure_my_profile();

  select t.* into v_team
  from public.teams t
  where t.captain_id = v_profile
  for update;
  if v_team.id is null then raise exception 'team_captain_required'; end if;

  select * into v_scrim from public.scrim_posts where id = p_scrim for update;
  if v_scrim.id is null then raise exception 'scrim_not_found'; end if;
  if v_scrim.status <> 'open' then raise exception 'scrim_not_open'; end if;
  if v_scrim.starts_at <= now() then raise exception 'scrim_already_started'; end if;
  if v_scrim.team_id = v_team.id then raise exception 'cannot_challenge_own_scrim'; end if;

  insert into public.scrim_challenges(scrim_id, challenger_team_id, created_by_profile_id, status)
  values (p_scrim, v_team.id, v_profile, 'pending')
  on conflict (scrim_id, challenger_team_id)
  do update set status = 'pending', created_by_profile_id = excluded.created_by_profile_id, updated_at = now()
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'status', 'pending');
end;
$function$;

revoke all on function public.challenge_scrim(uuid) from public;
grant execute on function public.challenge_scrim(uuid) to authenticated;

create or replace function public.respond_scrim_challenge(p_challenge uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_profile uuid;
  v_team record;
  v_challenge record;
  v_scrim record;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  v_profile := public.ensure_my_profile();

  select t.* into v_team
  from public.teams t
  where t.captain_id = v_profile
  for update;
  if v_team.id is null then raise exception 'team_captain_required'; end if;

  select * into v_challenge
  from public.scrim_challenges
  where id = p_challenge
  for update;
  if v_challenge.id is null then raise exception 'scrim_challenge_not_found'; end if;
  if v_challenge.status <> 'pending' then raise exception 'scrim_challenge_not_pending'; end if;

  select * into v_scrim
  from public.scrim_posts
  where id = v_challenge.scrim_id
  for update;
  if v_scrim.id is null then raise exception 'scrim_not_found'; end if;
  if v_scrim.team_id <> v_team.id then raise exception 'team_captain_required'; end if;
  if v_scrim.status <> 'open' then raise exception 'scrim_not_open'; end if;

  if not p_accept then
    update public.scrim_challenges set status = 'declined' where id = v_challenge.id;
    return jsonb_build_object('status', 'declined');
  end if;

  update public.scrim_challenges
  set status = case when id = v_challenge.id then 'accepted' else 'declined' end
  where scrim_id = v_scrim.id and status = 'pending';

  update public.scrim_posts
  set status = 'matched', opponent_team_id = v_challenge.challenger_team_id
  where id = v_scrim.id;

  return jsonb_build_object(
    'status', 'matched',
    'scrimId', v_scrim.id,
    'opponentTeamId', v_challenge.challenger_team_id
  );
end;
$function$;

revoke all on function public.respond_scrim_challenge(uuid,boolean) from public;
grant execute on function public.respond_scrim_challenge(uuid,boolean) to authenticated;

create or replace function public.cancel_my_scrim(p_scrim uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_profile uuid;
  v_team record;
  v_scrim record;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  v_profile := public.ensure_my_profile();

  select t.* into v_team from public.teams t where t.captain_id = v_profile for update;
  if v_team.id is null then raise exception 'team_captain_required'; end if;

  select * into v_scrim from public.scrim_posts where id = p_scrim for update;
  if v_scrim.id is null then raise exception 'scrim_not_found'; end if;
  if v_scrim.team_id <> v_team.id then raise exception 'team_captain_required'; end if;
  if v_scrim.status = 'completed' then raise exception 'scrim_completed'; end if;

  update public.scrim_posts set status = 'cancelled' where id = p_scrim;
  update public.scrim_challenges
    set status = 'cancelled'
    where scrim_id = p_scrim and status in ('pending','accepted');

  return jsonb_build_object('status', 'cancelled');
end;
$function$;

revoke all on function public.cancel_my_scrim(uuid) from public;
grant execute on function public.cancel_my_scrim(uuid) to authenticated;

create or replace function public.report_my_scrim_result(
  p_scrim uuid,
  p_score_team integer,
  p_score_opponent integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_profile uuid;
  v_team record;
  v_scrim record;
  v_needed integer;
  v_winner uuid;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  v_profile := public.ensure_my_profile();

  select t.* into v_team
  from public.teams t
  where t.captain_id = v_profile
  for update;
  if v_team.id is null then raise exception 'team_captain_required'; end if;

  select * into v_scrim from public.scrim_posts where id = p_scrim for update;
  if v_scrim.id is null then raise exception 'scrim_not_found'; end if;
  if v_scrim.status <> 'matched' then raise exception 'scrim_not_reportable'; end if;
  if v_team.id not in (v_scrim.team_id, v_scrim.opponent_team_id) then raise exception 'not_scrim_participant'; end if;

  v_needed := (v_scrim.best_of / 2) + 1;
  if p_score_team < 0 or p_score_opponent < 0 then raise exception 'invalid_scrim_score'; end if;
  if greatest(p_score_team, p_score_opponent) <> v_needed then raise exception 'invalid_scrim_score'; end if;
  if least(p_score_team, p_score_opponent) >= v_needed then raise exception 'invalid_scrim_score'; end if;
  if p_score_team = p_score_opponent then raise exception 'invalid_scrim_score'; end if;

  v_winner := case when p_score_team > p_score_opponent
    then v_scrim.team_id else v_scrim.opponent_team_id end;

  update public.scrim_posts
  set status = 'completed',
      score_team = p_score_team,
      score_opponent = p_score_opponent,
      winner_team_id = v_winner
  where id = p_scrim;

  return jsonb_build_object(
    'status', 'completed',
    'winnerTeamId', v_winner,
    'practiceOnly', true
  );
end;
$function$;

revoke all on function public.report_my_scrim_result(uuid,integer,integer) from public;
grant execute on function public.report_my_scrim_result(uuid,integer,integer) to authenticated;

-- Server-enforced qualifier capacity priority for already-qualified teams.
create or replace function public.register_my_team_tournament(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_profile uuid;
  tm record;
  t record;
  e record;
  loc record;
  v_elig jsonb;
  v_count integer;
  v_entry uuid;
  v_already_qualified boolean := false;
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  v_profile := public.ensure_my_profile();

  select * into tm
  from public.teams
  where captain_id = v_profile
  for update;
  if tm.id is null then raise exception 'team_captain_required'; end if;

  select * into t
  from public.tournaments
  where slug = p_slug
  for update;
  if t.id is null then raise exception 'tournament_not_found'; end if;
  if lower(coalesce(t.mode,'')) <> 'team' then raise exception 'solo_registration_required'; end if;
  if t.status <> 'registration_open'::public.tournament_status then raise exception 'registration_not_open'; end if;
  if t.registration_closes_at is not null and t.registration_closes_at < now() then raise exception 'registration_closed'; end if;

  if t.split_id is not null and t.split_phase = 'qualifier' then
    select exists(
      select 1
      from public.split_qualifications q
      where q.split_id = t.split_id
        and q.team_id = tm.id
        and q.status = 'qualified'
    ) into v_already_qualified;

    if v_already_qualified
       and t.qualified_teams_registration_opens_at is not null
       and now() < t.qualified_teams_registration_opens_at then
      raise exception 'qualified_priority_window:%', t.qualified_teams_registration_opens_at;
    end if;
  end if;

  v_elig := private.team_eligibility(tm.id, t.id, null);
  if not coalesce((v_elig->>'eligible')::boolean, false) then
    raise exception 'team_ineligible:%', v_elig::text;
  end if;

  if t.region_id is not null then
    select * into loc from private.resolve_location(tm.city_id);
    if loc.city_id is null
       or t.region_id not in (loc.city_id, loc.province_id, loc.country_id, loc.region_id) then
      raise exception 'region_mismatch';
    end if;
  end if;

  select * into e
  from public.tournament_entries
  where tournament_id = t.id and team_id = tm.id
  for update;
  if e.id is not null and e.status <> 'withdrawn'::public.entry_status then
    raise exception 'already_registered';
  end if;

  select count(*)::integer into v_count
  from public.tournament_entries
  where tournament_id = t.id
    and status in ('registered'::public.entry_status,'checked_in'::public.entry_status);
  if v_count >= t.max_participants then raise exception 'tournament_full'; end if;

  if e.id is null then
    insert into public.tournament_entries(tournament_id,team_id,status,points_awarded)
    values(t.id,tm.id,'registered'::public.entry_status,0)
    returning id into v_entry;
  else
    update public.tournament_entries
    set status='registered'::public.entry_status,
        seed=null,
        placement=null,
        points_awarded=0,
        checked_in_at=null,
        roster_locked_at=null,
        eliminated_in_round=null
    where id=e.id
    returning id into v_entry;
  end if;

  if t.division_id is not null then
    update public.teams set division_id=t.division_id where id=tm.id;
  end if;

  update public.tournaments
  set participants_count=(
    select count(*)
    from public.tournament_entries
    where tournament_id=t.id
      and status in ('registered'::public.entry_status,'checked_in'::public.entry_status)
  )
  where id=t.id;

  return jsonb_build_object(
    'entry_id',v_entry,
    'status','registered',
    'tournament_slug',t.slug,
    'tournament_name',t.name,
    'team_slug',tm.slug,
    'team_name',tm.name,
    'already_qualified',v_already_qualified
  );
end;
$function$;

revoke all on function public.register_my_team_tournament(text) from public;
grant execute on function public.register_my_team_tournament(text) to authenticated;

create or replace function public.get_my_tournament_entry(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_profile uuid;
  t record;
  e record;
  v_team uuid;
  v_captain boolean := false;
  v_can_check boolean := false;
  v_can_register boolean := false;
  v_already_qualified boolean := false;
  v_mode text;
  v_count integer := 0;
  v_gate text := 'closed';
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  v_profile := public.ensure_my_profile();

  select id, mode, starts_at, checkin_required, status, registration_closes_at,
         max_participants, split_id, split_phase, qualified_teams_registration_opens_at
  into t
  from public.tournaments
  where slug = p_slug;

  if t.id is null then return null; end if;
  v_mode := lower(coalesce(t.mode, 'solo'));

  if v_mode = 'team' then
    select tm.team_id, (team.captain_id = v_profile)
    into v_team, v_captain
    from public.team_members tm
    join public.teams team on team.id = tm.team_id
    where tm.profile_id = v_profile
    limit 1;

    if v_team is not null then
      select id, status, checked_in_at
      into e
      from public.tournament_entries
      where tournament_id = t.id and team_id = v_team;

      if t.split_id is not null and t.split_phase = 'qualifier' then
        select exists(
          select 1
          from public.split_qualifications q
          where q.split_id = t.split_id
            and q.team_id = v_team
            and q.status = 'qualified'
        ) into v_already_qualified;
      end if;
    end if;
  else
    v_captain := true;
    select id, status, checked_in_at
    into e
    from public.tournament_entries
    where tournament_id = t.id and profile_id = v_profile;
  end if;

  select count(*)::integer into v_count
  from public.tournament_entries
  where tournament_id = t.id
    and status in ('registered'::public.entry_status,'checked_in'::public.entry_status);

  if e.id is not null and e.status <> 'withdrawn'::public.entry_status then
    v_can_check := v_captain
      and t.checkin_required
      and e.status = 'registered'::public.entry_status
      and now() >= t.starts_at - interval '1 hour'
      and now() <= t.starts_at;

    return jsonb_build_object(
      'id', e.id,
      'status', e.status::text,
      'checkedInAt', e.checked_in_at,
      'canCheckIn', v_can_check,
      'canRegister', false,
      'registrationGate', 'already_registered',
      'qualifiedAlready', v_already_qualified,
      'repeatRegistrationOpensAt', t.qualified_teams_registration_opens_at,
      'mode', v_mode,
      'isCaptain', v_captain
    );
  end if;

  if t.status <> 'registration_open'::public.tournament_status
     or (t.registration_closes_at is not null and t.registration_closes_at < now()) then
    v_gate := 'closed';
  elsif v_mode = 'team' and not v_captain then
    v_gate := 'captain_required';
  elsif v_count >= t.max_participants then
    v_gate := 'full';
  elsif v_mode = 'team'
        and v_already_qualified
        and t.qualified_teams_registration_opens_at is not null
        and now() < t.qualified_teams_registration_opens_at then
    v_gate := 'priority_unqualified';
  else
    v_gate := 'open';
    v_can_register := true;
  end if;

  return jsonb_build_object(
    'id', null,
    'status', null,
    'checkedInAt', null,
    'canCheckIn', false,
    'canRegister', v_can_register,
    'registrationGate', v_gate,
    'qualifiedAlready', v_already_qualified,
    'repeatRegistrationOpensAt', t.qualified_teams_registration_opens_at,
    'mode', v_mode,
    'isCaptain', v_captain
  );
end;
$function$;

revoke all on function public.get_my_tournament_entry(text) from public;
grant execute on function public.get_my_tournament_entry(text) to authenticated;
