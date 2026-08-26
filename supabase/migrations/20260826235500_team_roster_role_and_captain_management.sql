create or replace function public.update_my_team_member_role(p_handle text, p_role text)
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
  v_role text := lower(btrim(coalesce(p_role,'')));
  v_current text;
  v_starters integer;
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  if v_role not in ('player','substitute') then raise exception 'invalid_team_role'; end if;

  v_captain := public.ensure_my_profile();
  select id into v_team from public.teams where captain_id = v_captain for update;
  if v_team is null then raise exception 'team_captain_required'; end if;

  select p.id, lower(tm.role)
  into v_target, v_current
  from public.profiles p
  join public.team_members tm on tm.profile_id = p.id
  where tm.team_id = v_team
    and lower(p.handle) = lower(btrim(coalesce(p_handle,'')));

  if v_target is null then raise exception 'team_member_not_found'; end if;
  if v_target = v_captain and v_role = 'substitute' then raise exception 'captain_must_be_starter'; end if;
  if v_current = v_role then
    return jsonb_build_object('profileId',v_target,'role',v_role,'status','unchanged');
  end if;

  if v_role = 'player' then
    select count(*)::integer into v_starters
    from public.team_members
    where team_id = v_team and lower(coalesce(role,'player')) <> 'substitute';
    if v_starters >= 5 then raise exception 'starting_roster_full'; end if;
  end if;

  if exists (
    select 1
    from public.tournament_entries e
    join public.tournaments t on t.id = e.tournament_id
    where e.team_id = v_team
      and e.status = 'checked_in'::public.entry_status
      and t.status not in ('completed'::public.tournament_status,'cancelled'::public.tournament_status)
  ) then
    raise exception 'roster_locked_for_tournament';
  end if;

  update public.team_members
  set role = v_role
  where team_id = v_team and profile_id = v_target;

  return jsonb_build_object('profileId',v_target,'role',v_role,'status','updated');
end;
$$;

create or replace function public.transfer_my_team_captain(p_handle text)
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
  select id into v_team from public.teams where captain_id = v_captain for update;
  if v_team is null then raise exception 'team_captain_required'; end if;

  select p.id into v_target
  from public.profiles p
  join public.team_members tm on tm.profile_id = p.id
  where tm.team_id = v_team
    and lower(p.handle) = lower(btrim(coalesce(p_handle,'')));

  if v_target is null then raise exception 'team_member_not_found'; end if;
  if v_target = v_captain then raise exception 'already_team_captain'; end if;

  if exists (
    select 1
    from public.tournament_entries e
    join public.tournaments t on t.id = e.tournament_id
    where e.team_id = v_team
      and e.status = 'checked_in'::public.entry_status
      and t.status not in ('completed'::public.tournament_status,'cancelled'::public.tournament_status)
  ) then
    raise exception 'roster_locked_for_tournament';
  end if;

  update public.team_members
  set role = 'player', is_captain = false
  where team_id = v_team and profile_id = v_captain;

  update public.team_members
  set role = 'player', is_captain = true
  where team_id = v_team and profile_id = v_target;

  update public.teams set captain_id = v_target where id = v_team;

  return jsonb_build_object('teamId',v_team,'captainProfileId',v_target,'status','transferred');
end;
$$;

revoke all on function public.update_my_team_member_role(text,text) from public, anon;
revoke all on function public.transfer_my_team_captain(text) from public, anon;
grant execute on function public.update_my_team_member_role(text,text) to authenticated;
grant execute on function public.transfer_my_team_captain(text) to authenticated;
