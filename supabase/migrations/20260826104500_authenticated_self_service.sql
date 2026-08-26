-- =============================================================
-- EloShape: authenticated self-service without exposing service_role
-- =============================================================

-- Riot account level was added after the original safe-column SELECT grant.
grant select (account_level, account_level_synced_at)
  on public.riot_accounts to authenticated;

-- Derived profile completion remains server-controlled.
create or replace function private.recalculate_profile_completion(p_profile uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
  v_riot_verified boolean := false;
  v_completion integer;
begin
  select handle, city_id, division_id
    into p
    from public.profiles
   where id = p_profile;

  if p.handle is null then return 0; end if;

  select coalesce(bool_or(data_verified), false)
    into v_riot_verified
    from public.riot_accounts
   where profile_id = p_profile;

  v_completion := round(((
      1
      + case when left(p.handle, 7) <> 'player_' then 1 else 0 end
      + case when p.city_id is not null then 1 else 0 end
      + case when v_riot_verified then 1 else 0 end
      + case when p.division_id is not null then 1 else 0 end
    )::numeric / 5) * 100)::integer;

  update public.profiles
     set profile_completion = v_completion
   where id = p_profile;

  return v_completion;
end;
$$;

revoke all on function private.recalculate_profile_completion(uuid) from public;
revoke all on function private.recalculate_profile_completion(uuid) from anon, authenticated;
grant execute on function private.recalculate_profile_completion(uuid) to service_role;

-- Safe profile provisioning wrapper. The caller supplies no user id.
create or replace function public.ensure_my_profile()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile uuid;
  v_email text;
  v_meta jsonb;
begin
  if v_user is null then raise exception 'unauthorized'; end if;

  select id into v_profile
    from public.profiles
   where user_id = v_user;

  if v_profile is not null then
    insert into public.user_roles(user_id, role)
    values (v_user, 'player')
    on conflict (user_id, role) do nothing;
    return v_profile;
  end if;

  select email, coalesce(raw_user_meta_data, '{}'::jsonb)
    into v_email, v_meta
    from auth.users
   where id = v_user;

  if not found then raise exception 'auth_user_not_found'; end if;

  return private.provision_profile(v_user, v_email, v_meta);
end;
$$;

revoke all on function public.ensure_my_profile() from public, anon;
grant execute on function public.ensure_my_profile() to authenticated;

create or replace function public.recalculate_my_profile_completion()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile uuid;
begin
  if v_user is null then raise exception 'unauthorized'; end if;

  select id into v_profile from public.profiles where user_id = v_user;
  if v_profile is null then v_profile := public.ensure_my_profile(); end if;

  return private.recalculate_profile_completion(v_profile);
end;
$$;

revoke all on function public.recalculate_my_profile_completion() from public, anon;
grant execute on function public.recalculate_my_profile_completion() to authenticated;

-- Location columns stay revoked from direct authenticated UPDATE. This wrapper
-- derives the profile from auth.uid(), validates the full geography chain, and
-- updates only the current user's location.
create or replace function public.update_my_location(p_city_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile uuid;
  loc record;
  v_result jsonb;
begin
  if v_user is null then raise exception 'unauthorized'; end if;

  v_profile := public.ensure_my_profile();

  select * into loc from private.resolve_location(p_city_id);
  if loc.city_id is null then raise exception 'unknown_city'; end if;

  update public.profiles
     set city_id = loc.city_id,
         province_id = loc.province_id,
         country_id = loc.country_id,
         region_id = loc.region_id
   where id = v_profile and user_id = v_user;

  if not found then raise exception 'profile_not_found'; end if;

  perform private.recalculate_profile_completion(v_profile);

  select jsonb_build_object(
    'city', c.name,
    'province', p.name,
    'country', co.name,
    'region', r.name
  )
    into v_result
    from public.regions c
    left join public.regions p on p.id = loc.province_id
    left join public.regions co on co.id = loc.country_id
    left join public.regions r on r.id = loc.region_id
   where c.id = loc.city_id;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

revoke all on function public.update_my_location(uuid) from public, anon;
grant execute on function public.update_my_location(uuid) to authenticated;

comment on function public.ensure_my_profile() is
  'Authenticated self-service wrapper. Derives auth.uid(); never accepts another user id.';
comment on function public.recalculate_my_profile_completion() is
  'Recomputes only the current authenticated player profile completion.';
comment on function public.update_my_location(uuid) is
  'Updates only the current authenticated player location after validating the full region chain.';
