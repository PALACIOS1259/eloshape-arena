-- =============================================================
-- EloShape: authenticated tournament registration/check-in
-- without requiring a service-role credential in the web runtime.
--
-- Security model:
-- - the caller never supplies a profile/user id;
-- - auth.uid() is authoritative;
-- - all eligibility, Riot, division, geography, capacity and timing checks run
--   inside PostgreSQL;
-- - tournament row locking serializes capacity-sensitive registration;
-- - direct player DML on tournament_entries is revoked.
-- =============================================================

create or replace function public.register_my_tournament(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile_id uuid;
  p record;
  t record;
  e record;
  v_count integer;
  v_reasons text[];
  v_entry_id uuid;
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  if nullif(btrim(p_slug), '') is null then raise exception 'tournament_not_found'; end if;

  v_profile_id := public.ensure_my_profile();

  select id, eligibility, division_id, city_id, province_id, country_id, region_id
    into p
    from public.profiles
   where id = v_profile_id and user_id = v_user;
  if p.id is null then raise exception 'profile_not_found'; end if;

  -- Lock the tournament row so capacity cannot be oversubscribed by concurrent
  -- registrations.
  select id, slug, name, status, mode, division_id, region_id,
         max_participants, registration_closes_at
    into t
    from public.tournaments
   where slug = p_slug
   for update;
  if t.id is null then raise exception 'tournament_not_found'; end if;

  if lower(coalesce(t.mode, 'solo')) <> 'solo' then
    raise exception 'team_registration_required';
  end if;
  if t.status <> 'registration_open'::public.tournament_status then
    raise exception 'registration_not_open';
  end if;
  if t.registration_closes_at is not null and t.registration_closes_at < now() then
    raise exception 'registration_closed';
  end if;

  -- This helper includes profile moderation state, verified Riot Solo Queue rank,
  -- account-level minimum, platform requirement and division compatibility.
  v_reasons := private.player_eligibility_reasons(v_profile_id, t.id);
  if array_length(v_reasons, 1) is not null then
    if 'riot_account_missing' = any(v_reasons) then raise exception 'riot_account_missing'; end if;
    if 'riot_rank_unverified' = any(v_reasons) then raise exception 'riot_rank_unverified'; end if;
    if 'account_level_below_minimum' = any(v_reasons) then raise exception 'account_level_below_minimum'; end if;
    if 'platform_mismatch' = any(v_reasons) then raise exception 'platform_mismatch'; end if;
    if 'division_mismatch' = any(v_reasons) then raise exception 'division_mismatch'; end if;
    if p.eligibility = 'suspended'::public.eligibility_status then raise exception 'account_suspended'; end if;
    if p.eligibility = 'rejected'::public.eligibility_status then raise exception 'eligibility_rejected'; end if;
    raise exception 'eligibility_pending_review';
  end if;

  if t.division_id is not null and t.division_id <> p.division_id then
    raise exception 'division_mismatch';
  end if;

  if t.region_id is not null and not (
    t.region_id = p.city_id or
    t.region_id = p.province_id or
    t.region_id = p.country_id or
    t.region_id = p.region_id
  ) then
    raise exception 'region_mismatch';
  end if;

  select id, status
    into e
    from public.tournament_entries
   where tournament_id = t.id and profile_id = v_profile_id
   for update;

  if e.id is not null and e.status <> 'withdrawn'::public.entry_status then
    raise exception 'already_registered';
  end if;

  select count(*)::integer
    into v_count
    from public.tournament_entries
   where tournament_id = t.id
     and status in ('registered'::public.entry_status, 'checked_in'::public.entry_status);

  if v_count >= t.max_participants then raise exception 'tournament_full'; end if;

  if e.id is null then
    insert into public.tournament_entries(
      tournament_id, profile_id, status, seed, placement, points_awarded, checked_in_at
    ) values (
      t.id, v_profile_id, 'registered'::public.entry_status, null, null, 0, null
    )
    returning id into v_entry_id;
  else
    update public.tournament_entries
       set status = 'registered'::public.entry_status,
           seed = null,
           placement = null,
           points_awarded = 0,
           checked_in_at = null
     where id = e.id
     returning id into v_entry_id;
  end if;

  update public.tournaments
     set participants_count = (
       select count(*)::integer
         from public.tournament_entries
        where tournament_id = t.id
          and status in ('registered'::public.entry_status, 'checked_in'::public.entry_status)
     )
   where id = t.id;

  return jsonb_build_object(
    'entry_id', v_entry_id,
    'status', 'registered',
    'tournament_slug', t.slug,
    'tournament_name', t.name
  );
end;
$$;

create or replace function public.check_in_my_tournament(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile_id uuid;
  t record;
  e record;
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  if nullif(btrim(p_slug), '') is null then raise exception 'tournament_not_found'; end if;

  v_profile_id := public.ensure_my_profile();

  select id, slug, status, starts_at, checkin_required
    into t
    from public.tournaments
   where slug = p_slug
   for update;
  if t.id is null then raise exception 'tournament_not_found'; end if;

  if t.checkin_required = false then
    raise exception 'checkin_not_required';
  end if;
  if now() < t.starts_at - interval '1 hour' then raise exception 'checkin_not_open'; end if;
  if now() > t.starts_at then raise exception 'checkin_closed'; end if;

  select id, status
    into e
    from public.tournament_entries
   where tournament_id = t.id and profile_id = v_profile_id
   for update;

  if e.id is null then raise exception 'not_registered'; end if;
  if e.status = 'checked_in'::public.entry_status then
    return jsonb_build_object('entry_id', e.id, 'status', 'checked_in');
  end if;
  if e.status <> 'registered'::public.entry_status then
    raise exception 'entry_not_checkin_eligible';
  end if;

  update public.tournament_entries
     set status = 'checked_in'::public.entry_status,
         checked_in_at = now()
   where id = e.id;

  return jsonb_build_object('entry_id', e.id, 'status', 'checked_in');
end;
$$;

-- The only player write path is now the two validated SECURITY DEFINER wrappers.
revoke insert, update, delete on public.tournament_entries from anon, authenticated;
revoke all on function public.register_my_tournament(text) from public, anon;
revoke all on function public.check_in_my_tournament(text) from public, anon;
grant execute on function public.register_my_tournament(text) to authenticated;
grant execute on function public.check_in_my_tournament(text) to authenticated;

comment on function public.register_my_tournament(text) is
  'Registers only auth.uid() after authoritative eligibility/geography/capacity checks; serialized with a tournament row lock.';
comment on function public.check_in_my_tournament(text) is
  'Checks in only auth.uid() during the configured one-hour pre-start window.';
