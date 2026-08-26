-- Return tournament registration context even before the authenticated player/team has an entry.
-- This lets the client choose solo vs team registration without trusting a browser-supplied mode.
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
  v_mode text;
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  v_profile := public.ensure_my_profile();

  select id, mode, starts_at, checkin_required
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
    end if;
  else
    v_captain := true;
    select id, status, checked_in_at
    into e
    from public.tournament_entries
    where tournament_id = t.id and profile_id = v_profile;
  end if;

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
      'mode', v_mode,
      'isCaptain', v_captain
    );
  end if;

  return jsonb_build_object(
    'id', null,
    'status', null,
    'checkedInAt', null,
    'canCheckIn', false,
    'mode', v_mode,
    'isCaptain', v_captain
  );
end;
$$;

revoke all on function public.get_my_tournament_entry(text) from public, anon;
grant execute on function public.get_my_tournament_entry(text) to authenticated;