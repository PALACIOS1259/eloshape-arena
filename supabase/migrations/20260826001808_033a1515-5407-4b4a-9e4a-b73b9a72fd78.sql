-- Staff-facing wrappers: identity comes from the signed-in session, never from input.
create or replace function public.staff_lock_tournament_entries(p_tournament uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not private.actor_is_staff(v_actor) then raise exception 'forbidden'; end if;
  return private.lock_tournament_entries(v_actor, p_tournament);
end $$;

create or replace function public.staff_create_bracket(p_tournament uuid, p_seeds jsonb, p_matches jsonb)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not private.actor_is_staff(v_actor) then raise exception 'forbidden'; end if;
  return private.create_bracket(v_actor, p_tournament, p_seeds, p_matches);
end $$;

create or replace function public.staff_report_match_result(p_match uuid, p_score_a integer, p_score_b integer)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not private.actor_is_staff(v_actor) then raise exception 'forbidden'; end if;
  return private.report_match_result(v_actor, p_match, p_score_a, p_score_b);
end $$;

create or replace function public.staff_finalize_tournament(p_tournament uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not private.actor_is_staff(v_actor) then raise exception 'forbidden'; end if;
  return private.finalize_tournament(v_actor, p_tournament);
end $$;

create or replace function public.staff_replace_withdrawn_qualifier(p_split uuid, p_team uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not private.actor_is_staff(v_actor) then raise exception 'forbidden'; end if;
  return private.replace_withdrawn_qualifier(v_actor, p_split, p_team);
end $$;

create or replace function public.staff_set_split_status(p_split uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not private.actor_is_staff(v_actor) then raise exception 'forbidden'; end if;
  return private.set_split_status(v_actor, p_split, p_status);
end $$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'public.staff_lock_tournament_entries(uuid)',
    'public.staff_create_bracket(uuid, jsonb, jsonb)',
    'public.staff_report_match_result(uuid, integer, integer)',
    'public.staff_finalize_tournament(uuid)',
    'public.staff_replace_withdrawn_qualifier(uuid, uuid)',
    'public.staff_set_split_status(uuid, text)'
  ]
  loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end $$;

-- Public standings stays read-only, but only the app roles may call it.
revoke all on function public.split_standings(uuid) from public;
grant execute on function public.split_standings(uuid) to anon, authenticated, service_role;