-- League position assignments are separate from roster status.
-- team_members.role remains the Starter/Substitute control used by tournament eligibility.

alter table public.team_members
  add column if not exists lane_role text;

alter table public.team_members
  drop constraint if exists team_members_lane_role_check;

alter table public.team_members
  add constraint team_members_lane_role_check
  check (lane_role is null or lane_role in ('top', 'jungle', 'mid', 'bot', 'support'));

create or replace function public.update_my_team_member_lane_role(p_handle text, p_lane_role text)
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
  v_lane_role text := nullif(lower(btrim(coalesce(p_lane_role, ''))), '');
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  if v_lane_role is not null and v_lane_role not in ('top', 'jungle', 'mid', 'bot', 'support') then
    raise exception 'invalid_lane_role';
  end if;

  v_captain := public.ensure_my_profile();
  select id into v_team from public.teams where captain_id = v_captain for update;
  if v_team is null then raise exception 'team_captain_required'; end if;

  select p.id into v_target
  from public.profiles p
  join public.team_members tm on tm.profile_id = p.id
  where tm.team_id = v_team
    and lower(p.handle) = lower(btrim(coalesce(p_handle, '')));

  if v_target is null then raise exception 'team_member_not_found'; end if;

  if exists (
    select 1
    from public.tournament_entries e
    join public.tournaments t on t.id = e.tournament_id
    where e.team_id = v_team
      and e.status = 'checked_in'::public.entry_status
      and t.status not in ('completed'::public.tournament_status, 'cancelled'::public.tournament_status)
  ) then
    raise exception 'roster_locked_for_tournament';
  end if;

  update public.team_members
  set lane_role = v_lane_role
  where team_id = v_team and profile_id = v_target;

  return jsonb_build_object(
    'profileId', v_target,
    'laneRole', v_lane_role,
    'status', 'updated'
  );
end;
$$;

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
          'laneRole', tm2.lane_role,
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

revoke all on function public.update_my_team_member_lane_role(text, text) from public, anon;
grant execute on function public.update_my_team_member_lane_role(text, text) to authenticated;

revoke all on function public.get_my_team_hub() from public, anon;
grant execute on function public.get_my_team_hub() to authenticated;
