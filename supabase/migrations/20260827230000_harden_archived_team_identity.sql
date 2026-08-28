create or replace function public.archive_my_team()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile uuid;
  v_team uuid;
  v_name text;
  v_members integer := 0;
  v_invites integer := 0;
  v_withdrawn integer := 0;
  v_rows integer := 0;
  v_tournament uuid;
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  v_profile := public.ensure_my_profile();

  select t.id, t.name
    into v_team, v_name
    from public.teams t
    join public.team_members tm on tm.team_id = t.id
    where tm.profile_id = v_profile
      and tm.is_captain = true
      and t.captain_id = v_profile
      and t.archived_at is null
    limit 1
    for update of t;

  if v_team is null then raise exception 'team_captain_required'; end if;

  if exists (
    select 1
    from public.tournament_entries e
    join public.tournaments t on t.id = e.tournament_id
    where e.team_id = v_team
      and t.status not in ('completed', 'cancelled')
      and (e.status = 'checked_in' or t.status = 'live')
  ) then
    raise exception 'team_active_tournament';
  end if;

  for v_tournament in
    select distinct e.tournament_id
    from public.tournament_entries e
    join public.tournaments t on t.id = e.tournament_id
    where e.team_id = v_team
      and e.status = 'registered'
      and t.status in ('draft', 'registration_open', 'registration_closed')
  loop
    update public.tournament_entries
      set status = 'withdrawn'
      where tournament_id = v_tournament
        and team_id = v_team
        and status = 'registered';
    get diagnostics v_rows = row_count;
    v_withdrawn := v_withdrawn + v_rows;

    update public.tournaments t
      set participants_count = (
        select count(*)::integer
        from public.tournament_entries e
        where e.tournament_id = t.id
          and e.status in ('registered', 'checked_in')
      )
      where t.id = v_tournament;
  end loop;

  update public.team_invites
    set status = 'cancelled', responded_at = coalesce(responded_at, now())
    where team_id = v_team and status = 'pending';
  get diagnostics v_invites = row_count;

  select count(*)::integer into v_members
    from public.team_members where team_id = v_team;

  delete from public.team_members where team_id = v_team;

  update public.teams
    set archived_at = now(),
        archived_by_profile_id = v_profile,
        captain_id = null
    where id = v_team;

  perform private.audit(
    v_user,
    'team_archived',
    'team',
    v_team,
    jsonb_build_object(
      'name', v_name,
      'members_released', v_members,
      'invites_cancelled', v_invites,
      'registrations_withdrawn', v_withdrawn
    )
  );

  return jsonb_build_object(
    'ok', true,
    'teamId', v_team,
    'name', v_name,
    'membersReleased', v_members,
    'invitesCancelled', v_invites,
    'registrationsWithdrawn', v_withdrawn
  );
end;
$$;

create or replace function public.update_my_team(p_name text, p_tag text, p_bio text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile uuid;
  v_team uuid;
  v_name text := btrim(coalesce(p_name,''));
  v_tag text := upper(btrim(coalesce(p_tag,'')));
  v_bio text := nullif(btrim(coalesce(p_bio,'')),'');
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  if char_length(v_name) < 3 or char_length(v_name) > 40 then raise exception 'invalid_team_name'; end if;
  if v_tag !~ '^[A-Z0-9]{2,6}$' then raise exception 'invalid_team_tag'; end if;
  if v_bio is not null and char_length(v_bio) > 500 then raise exception 'team_bio_too_long'; end if;

  v_profile := public.ensure_my_profile();
  select id into v_team
    from public.teams
    where captain_id = v_profile and archived_at is null
    for update;
  if v_team is null then raise exception 'team_captain_required'; end if;

  if exists(
    select 1 from public.teams
    where id <> v_team and archived_at is null and lower(name) = lower(v_name)
  ) then raise exception 'team_name_taken'; end if;
  if exists(
    select 1 from public.teams
    where id <> v_team and archived_at is null and lower(tag) = lower(v_tag)
  ) then raise exception 'team_tag_taken'; end if;

  update public.teams set name = v_name, tag = v_tag, bio = v_bio where id = v_team;
  return jsonb_build_object('id', v_team, 'name', v_name, 'tag', v_tag, 'bio', v_bio);
end;
$$;
