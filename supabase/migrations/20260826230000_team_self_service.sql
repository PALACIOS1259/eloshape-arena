-- EloShape team self-service + team tournament registration.
-- All player mutations derive auth.uid() and are exposed only through SECURITY DEFINER RPCs.

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  invited_profile_id uuid not null references public.profiles(id) on delete cascade,
  invited_by_profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'player' check (lower(role) in ('player', 'substitute')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

alter table public.team_invites enable row level security;

create unique index if not exists team_invites_pending_unique
  on public.team_invites(team_id, invited_profile_id)
  where status = 'pending';

create unique index if not exists team_members_one_team_per_profile
  on public.team_members(profile_id);

create unique index if not exists tournament_entries_team_uniq
  on public.tournament_entries(tournament_id, team_id)
  where team_id is not null;

create unique index if not exists teams_name_lower_unique
  on public.teams(lower(name));

create unique index if not exists teams_tag_lower_unique
  on public.teams(lower(tag));

-- Public team/team-member reads stay available, but all writes go through RPCs.
revoke insert, update, delete on public.teams from anon, authenticated;
revoke insert, update, delete on public.team_members from anon, authenticated;
revoke all on public.team_invites from anon, authenticated;
drop policy if exists "teams captain update" on public.teams;

create or replace function public.get_my_team_hub()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile uuid;
  v_team uuid;
  v_team_json jsonb;
  v_incoming jsonb := '[]'::jsonb;
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  v_profile := public.ensure_my_profile();

  select tm.team_id into v_team
  from public.team_members tm
  where tm.profile_id = v_profile
  limit 1;

  if v_team is not null then
    select jsonb_build_object(
      'id', t.id,
      'slug', t.slug,
      'name', t.name,
      'tag', t.tag,
      'bio', t.bio,
      'logoUrl', t.logo_url,
      'captainProfileId', t.captain_id,
      'isCaptain', t.captain_id = v_profile,
      'pointsSeason', t.points_season,
      'wins', t.wins,
      'losses', t.losses,
      'championships', t.championships,
      'division', case when d.id is null then null else jsonb_build_object('code', d.code, 'name', d.name, 'accent', d.accent) end,
      'city', case when city.id is null then null else jsonb_build_object('id', city.id, 'name', city.name) end,
      'members', coalesce((
        select jsonb_agg(jsonb_build_object(
          'profileId', p.id,
          'handle', p.handle,
          'displayName', p.display_name,
          'role', lower(tm2.role),
          'isCaptain', tm2.is_captain,
          'eligibility', p.eligibility,
          'riotTier', p.riot_tier,
          'riotRank', p.riot_rank,
          'accountLevel', ra.account_level,
          'riotVerified', coalesce(ra.data_verified, false)
        ) order by tm2.is_captain desc, tm2.joined_at asc)
        from public.team_members tm2
        join public.profiles p on p.id = tm2.profile_id
        left join lateral (
          select r.account_level, r.data_verified
          from public.riot_accounts r
          where r.profile_id = p.id
          order by r.data_verified desc, r.created_at asc
          limit 1
        ) ra on true
        where tm2.team_id = t.id
      ), '[]'::jsonb),
      'pendingInvites', case when t.captain_id = v_profile then coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', i.id,
          'profileId', target.id,
          'handle', target.handle,
          'displayName', target.display_name,
          'role', lower(i.role),
          'createdAt', i.created_at
        ) order by i.created_at desc)
        from public.team_invites i
        join public.profiles target on target.id = i.invited_profile_id
        where i.team_id = t.id and i.status = 'pending'
      ), '[]'::jsonb) else '[]'::jsonb end,
      'eligibility', private.team_eligibility(t.id, null, null)
    ) into v_team_json
    from public.teams t
    left join public.divisions d on d.id = t.division_id
    left join public.regions city on city.id = t.city_id
    where t.id = v_team;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'teamId', t.id,
    'teamSlug', t.slug,
    'teamName', t.name,
    'teamTag', t.tag,
    'role', lower(i.role),
    'invitedBy', inviter.display_name,
    'createdAt', i.created_at
  ) order by i.created_at desc), '[]'::jsonb)
  into v_incoming
  from public.team_invites i
  join public.teams t on t.id = i.team_id
  join public.profiles inviter on inviter.id = i.invited_by_profile_id
  where i.invited_profile_id = v_profile and i.status = 'pending';

  return jsonb_build_object(
    'profileId', v_profile,
    'team', v_team_json,
    'incomingInvites', v_incoming,
    'canCreateTeam', v_team is null
  );
end;
$$;

create or replace function public.create_my_team(p_name text, p_tag text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile uuid;
  p record;
  v_name text := btrim(coalesce(p_name, ''));
  v_tag text := upper(btrim(coalesce(p_tag, '')));
  v_slug text;
  v_team uuid;
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  if char_length(v_name) < 3 or char_length(v_name) > 40 then raise exception 'invalid_team_name'; end if;
  if v_tag !~ '^[A-Z0-9]{2,6}$' then raise exception 'invalid_team_tag'; end if;

  v_profile := public.ensure_my_profile();
  if exists (select 1 from public.team_members where profile_id = v_profile) then
    raise exception 'already_on_team';
  end if;
  if exists (select 1 from public.teams where lower(name) = lower(v_name)) then raise exception 'team_name_taken'; end if;
  if exists (select 1 from public.teams where lower(tag) = lower(v_tag)) then raise exception 'team_tag_taken'; end if;

  select id, division_id, city_id, country_id, region_id into p
  from public.profiles where id = v_profile;

  v_slug := btrim(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), '-');
  if char_length(v_slug) < 3 then
    v_slug := 'team-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  elsif exists (select 1 from public.teams where slug = v_slug) then
    v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  end if;

  insert into public.teams(slug, name, tag, division_id, city_id, country_id, region_id, captain_id)
  values (v_slug, v_name, v_tag, p.division_id, p.city_id, p.country_id, p.region_id, v_profile)
  returning id into v_team;

  insert into public.team_members(team_id, profile_id, role, is_captain)
  values (v_team, v_profile, 'player', true);

  return jsonb_build_object('id', v_team, 'slug', v_slug, 'name', v_name, 'tag', v_tag);
exception when unique_violation then
  raise exception 'team_identity_taken';
end;
$$;

create or replace function public.update_my_team(p_name text, p_tag text, p_bio text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile uuid;
  v_team uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_tag text := upper(btrim(coalesce(p_tag, '')));
  v_bio text := nullif(btrim(coalesce(p_bio, '')), '');
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  if char_length(v_name) < 3 or char_length(v_name) > 40 then raise exception 'invalid_team_name'; end if;
  if v_tag !~ '^[A-Z0-9]{2,6}$' then raise exception 'invalid_team_tag'; end if;
  if v_bio is not null and char_length(v_bio) > 500 then raise exception 'team_bio_too_long'; end if;

  v_profile := public.ensure_my_profile();
  select id into v_team from public.teams where captain_id = v_profile for update;
  if v_team is null then raise exception 'team_captain_required'; end if;

  if exists (select 1 from public.teams where id <> v_team and lower(name) = lower(v_name)) then raise exception 'team_name_taken'; end if;
  if exists (select 1 from public.teams where id <> v_team and lower(tag) = lower(v_tag)) then raise exception 'team_tag_taken'; end if;

  update public.teams set name = v_name, tag = v_tag, bio = v_bio where id = v_team;
  return jsonb_build_object('id', v_team, 'name', v_name, 'tag', v_tag, 'bio', v_bio);
end;
$$;

create or replace function public.invite_my_team_member(p_handle text, p_role text default 'player')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_captain uuid;
  v_team uuid;
  v_target uuid;
  v_role text := lower(btrim(coalesce(p_role, 'player')));
  v_invite uuid;
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  if v_role not in ('player', 'substitute') then raise exception 'invalid_team_role'; end if;
  v_captain := public.ensure_my_profile();
  select id into v_team from public.teams where captain_id = v_captain for update;
  if v_team is null then raise exception 'team_captain_required'; end if;

  select id into v_target from public.profiles where lower(handle) = lower(btrim(coalesce(p_handle, '')));
  if v_target is null then raise exception 'player_not_found'; end if;
  if v_target = v_captain then raise exception 'cannot_invite_self'; end if;
  if exists (select 1 from public.team_members where profile_id = v_target) then raise exception 'player_already_on_team'; end if;
  if exists (select 1 from public.team_invites where team_id = v_team and invited_profile_id = v_target and status = 'pending') then
    raise exception 'invite_already_pending';
  end if;

  insert into public.team_invites(team_id, invited_profile_id, invited_by_profile_id, role)
  values (v_team, v_target, v_captain, v_role)
  returning id into v_invite;

  return jsonb_build_object('id', v_invite, 'profileId', v_target, 'role', v_role, 'status', 'pending');
end;
$$;

create or replace function public.respond_my_team_invite(p_invite_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile uuid;
  i record;
  v_active integer;
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  v_profile := public.ensure_my_profile();

  select * into i from public.team_invites where id = p_invite_id for update;
  if i.id is null or i.invited_profile_id <> v_profile then raise exception 'invite_not_found'; end if;
  if i.status <> 'pending' then raise exception 'invite_not_pending'; end if;

  if not coalesce(p_accept, false) then
    update public.team_invites set status = 'declined', responded_at = now() where id = i.id;
    return jsonb_build_object('id', i.id, 'status', 'declined');
  end if;

  perform 1 from public.teams where id = i.team_id for update;
  if exists (select 1 from public.team_members where profile_id = v_profile) then raise exception 'already_on_team'; end if;

  if lower(i.role) = 'player' then
    select count(*)::integer into v_active from public.team_members
    where team_id = i.team_id and lower(coalesce(role, 'player')) <> 'substitute';
    if v_active >= 5 then raise exception 'starting_roster_full'; end if;
  end if;

  insert into public.team_members(team_id, profile_id, role, is_captain)
  values (i.team_id, v_profile, lower(i.role), false);

  update public.team_invites set status = 'accepted', responded_at = now() where id = i.id;
  update public.team_invites set status = 'cancelled', responded_at = now()
  where invited_profile_id = v_profile and status = 'pending' and id <> i.id;

  return jsonb_build_object('id', i.id, 'status', 'accepted', 'teamId', i.team_id);
end;
$$;

create or replace function public.cancel_my_team_invite(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile uuid;
  i record;
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  v_profile := public.ensure_my_profile();
  select i.* into i from public.team_invites i join public.teams t on t.id=i.team_id
  where i.id=p_invite_id and t.captain_id=v_profile for update;
  if i.id is null then raise exception 'invite_not_found'; end if;
  if i.status <> 'pending' then raise exception 'invite_not_pending'; end if;
  update public.team_invites set status='cancelled', responded_at=now() where id=i.id;
  return jsonb_build_object('id', i.id, 'status', 'cancelled');
end;
$$;

create or replace function public.remove_my_team_member(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_captain uuid;
  v_team uuid;
  v_target uuid;
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  v_captain := public.ensure_my_profile();
  select id into v_team from public.teams where captain_id=v_captain for update;
  if v_team is null then raise exception 'team_captain_required'; end if;
  select p.id into v_target from public.profiles p join public.team_members tm on tm.profile_id=p.id
  where tm.team_id=v_team and lower(p.handle)=lower(btrim(coalesce(p_handle,'')));
  if v_target is null then raise exception 'team_member_not_found'; end if;
  if v_target = v_captain then raise exception 'cannot_remove_captain'; end if;
  delete from public.team_members where team_id=v_team and profile_id=v_target;
  return jsonb_build_object('profileId', v_target, 'status', 'removed');
end;
$$;

create or replace function public.leave_my_team()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile uuid;
  v_team uuid;
  v_captain uuid;
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  v_profile := public.ensure_my_profile();
  select tm.team_id, t.captain_id into v_team, v_captain
  from public.team_members tm join public.teams t on t.id=tm.team_id
  where tm.profile_id=v_profile for update of t;
  if v_team is null then raise exception 'not_on_team'; end if;
  if v_captain = v_profile then raise exception 'captain_cannot_leave'; end if;
  delete from public.team_members where team_id=v_team and profile_id=v_profile;
  return jsonb_build_object('teamId', v_team, 'status', 'left');
end;
$$;

-- Tighten roster semantics: team-mode competition requires exactly the configured number of active players.
create or replace function private.team_eligibility(p_team uuid, p_tournament uuid, p_entry uuid default null)
returns jsonb
language plpgsql
stable security definer
set search_path = 'public', 'private'
as $$
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
    select exists (select 1 from public.tournament_roster_members where entry_id = p_entry) into v_snapshot;
  end if;

  for m in
    select rm.profile_id from public.tournament_roster_members rm
      where v_snapshot and rm.entry_id = p_entry and not rm.is_substitute
    union all
    select member.profile_id from public.team_members member
      where not v_snapshot and member.team_id = p_team
        and lower(coalesce(member.role, 'player')) <> 'substitute'
  loop
    v_count := v_count + 1;
    r := private.player_eligibility_reasons(m.profile_id, p_tournament);
    if array_length(r, 1) is not null then
      v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('profile_id', m.profile_id, 'reasons', to_jsonb(r)));
    end if;
  end loop;

  if v_count < v_required then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('roster', 'incomplete', 'required', v_required, 'active', v_count));
  elsif v_count > v_required then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('roster', 'too_many_active', 'required', v_required, 'active', v_count));
  end if;

  return jsonb_build_object('eligible', jsonb_array_length(v_reasons)=0,
    'active_players', v_count, 'snapshot', v_snapshot, 'reasons', v_reasons);
end;
$$;

create or replace function public.register_my_team_tournament(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  v_profile := public.ensure_my_profile();
  select * into tm from public.teams where captain_id=v_profile for update;
  if tm.id is null then raise exception 'team_captain_required'; end if;

  select * into t from public.tournaments where slug=p_slug for update;
  if t.id is null then raise exception 'tournament_not_found'; end if;
  if lower(coalesce(t.mode,'')) <> 'team' then raise exception 'solo_registration_required'; end if;
  if t.status <> 'registration_open'::public.tournament_status then raise exception 'registration_not_open'; end if;
  if t.registration_closes_at is not null and t.registration_closes_at < now() then raise exception 'registration_closed'; end if;

  v_elig := private.team_eligibility(tm.id, t.id, null);
  if not coalesce((v_elig->>'eligible')::boolean, false) then raise exception 'team_ineligible:%', v_elig::text; end if;

  if t.region_id is not null then
    select * into loc from private.resolve_location(tm.city_id);
    if loc.city_id is null or t.region_id not in (loc.city_id, loc.province_id, loc.country_id, loc.region_id) then
      raise exception 'region_mismatch';
    end if;
  end if;

  select * into e from public.tournament_entries where tournament_id=t.id and team_id=tm.id for update;
  if e.id is not null and e.status <> 'withdrawn'::public.entry_status then raise exception 'already_registered'; end if;

  select count(*)::integer into v_count from public.tournament_entries
  where tournament_id=t.id and status in ('registered'::public.entry_status,'checked_in'::public.entry_status);
  if v_count >= t.max_participants then raise exception 'tournament_full'; end if;

  if e.id is null then
    insert into public.tournament_entries(tournament_id,team_id,status,points_awarded)
    values(t.id,tm.id,'registered'::public.entry_status,0) returning id into v_entry;
  else
    update public.tournament_entries set status='registered'::public.entry_status, seed=null, placement=null,
      points_awarded=0, checked_in_at=null, roster_locked_at=null, eliminated_in_round=null
    where id=e.id returning id into v_entry;
  end if;

  if t.division_id is not null then update public.teams set division_id=t.division_id where id=tm.id; end if;
  update public.tournaments set participants_count=(select count(*) from public.tournament_entries
    where tournament_id=t.id and status in ('registered'::public.entry_status,'checked_in'::public.entry_status)) where id=t.id;

  return jsonb_build_object('entry_id',v_entry,'status','registered','tournament_slug',t.slug,'tournament_name',t.name,'team_slug',tm.slug,'team_name',tm.name);
end;
$$;

create or replace function public.check_in_my_team_tournament(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile uuid;
  tm record;
  t record;
  e record;
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  v_profile := public.ensure_my_profile();
  select * into tm from public.teams where captain_id=v_profile;
  if tm.id is null then raise exception 'team_captain_required'; end if;
  select * into t from public.tournaments where slug=p_slug for update;
  if t.id is null then raise exception 'tournament_not_found'; end if;
  if lower(coalesce(t.mode,'')) <> 'team' then raise exception 'solo_registration_required'; end if;
  if not t.checkin_required then raise exception 'checkin_not_required'; end if;
  if now() < t.starts_at - interval '1 hour' then raise exception 'checkin_not_open'; end if;
  if now() > t.starts_at then raise exception 'checkin_closed'; end if;
  select * into e from public.tournament_entries where tournament_id=t.id and team_id=tm.id for update;
  if e.id is null then raise exception 'not_registered'; end if;
  if e.status='checked_in'::public.entry_status then return jsonb_build_object('entry_id',e.id,'status','checked_in'); end if;
  if e.status<>'registered'::public.entry_status then raise exception 'entry_not_checkin_eligible'; end if;
  update public.tournament_entries set status='checked_in'::public.entry_status, checked_in_at=now() where id=e.id;
  return jsonb_build_object('entry_id',e.id,'status','checked_in');
end;
$$;

create or replace function public.get_my_tournament_entry(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile uuid;
  t record;
  e record;
  v_team uuid;
  v_captain boolean := false;
  v_can_check boolean := false;
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  v_profile := public.ensure_my_profile();
  select id, mode, starts_at, checkin_required into t from public.tournaments where slug=p_slug;
  if t.id is null then return null; end if;

  if lower(coalesce(t.mode,'solo'))='team' then
    select tm.team_id, (team.captain_id=v_profile) into v_team, v_captain
    from public.team_members tm join public.teams team on team.id=tm.team_id
    where tm.profile_id=v_profile limit 1;
    if v_team is null then return null; end if;
    select id,status,checked_in_at into e from public.tournament_entries
    where tournament_id=t.id and team_id=v_team;
  else
    v_captain := true;
    select id,status,checked_in_at into e from public.tournament_entries
    where tournament_id=t.id and profile_id=v_profile;
  end if;

  if e.id is null or e.status='withdrawn'::public.entry_status then return null; end if;
  v_can_check := v_captain and t.checkin_required and e.status='registered'::public.entry_status
    and now() >= t.starts_at - interval '1 hour' and now() <= t.starts_at;

  return jsonb_build_object('id',e.id,'status',e.status::text,'checkedInAt',e.checked_in_at,
    'canCheckIn',v_can_check,'mode',lower(coalesce(t.mode,'solo')),'isCaptain',v_captain);
end;
$$;

revoke all on function public.get_my_team_hub() from public, anon;
revoke all on function public.create_my_team(text,text) from public, anon;
revoke all on function public.update_my_team(text,text,text) from public, anon;
revoke all on function public.invite_my_team_member(text,text) from public, anon;
revoke all on function public.respond_my_team_invite(uuid,boolean) from public, anon;
revoke all on function public.cancel_my_team_invite(uuid) from public, anon;
revoke all on function public.remove_my_team_member(text) from public, anon;
revoke all on function public.leave_my_team() from public, anon;
revoke all on function public.register_my_team_tournament(text) from public, anon;
revoke all on function public.check_in_my_team_tournament(text) from public, anon;
revoke all on function public.get_my_tournament_entry(text) from public, anon;

grant execute on function public.get_my_team_hub() to authenticated;
grant execute on function public.create_my_team(text,text) to authenticated;
grant execute on function public.update_my_team(text,text,text) to authenticated;
grant execute on function public.invite_my_team_member(text,text) to authenticated;
grant execute on function public.respond_my_team_invite(uuid,boolean) to authenticated;
grant execute on function public.cancel_my_team_invite(uuid) to authenticated;
grant execute on function public.remove_my_team_member(text) to authenticated;
grant execute on function public.leave_my_team() to authenticated;
grant execute on function public.register_my_team_tournament(text) to authenticated;
grant execute on function public.check_in_my_team_tournament(text) to authenticated;
grant execute on function public.get_my_tournament_entry(text) to authenticated;
