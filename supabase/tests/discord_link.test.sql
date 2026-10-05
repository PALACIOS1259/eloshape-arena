-- Transactional fixtures: no users or identities survive these checks.
begin;
do $$
declare
  linked uuid := gen_random_uuid();
  forged uuid := gen_random_uuid();
  linked_id text := '1999999999999999999';
  forged_id text := '1999999999999999998';
  payload jsonb;
  metadata jsonb := '{"legal_acceptance":true,"accepted_terms_version":"2026-08-27","accepted_privacy_version":"2026-08-27"}'::jsonb;
begin
  if has_function_privilege('anon', 'public.get_verified_discord_links()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.get_verified_discord_links()', 'EXECUTE') then
    raise exception 'FAIL: players can read the Discord snapshot';
  end if;
  if not has_function_privilege('service_role', 'public.get_verified_discord_links()', 'EXECUTE') then
    raise exception 'FAIL: backend cannot read the Discord snapshot';
  end if;
  insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data)
  values (linked, linked::text || '@example.invalid', now(), metadata),
    (forged, forged::text || '@example.invalid', now(), metadata || jsonb_build_object('discord_id', forged_id, 'sub', forged_id));
  insert into auth.identities(provider_id, user_id, identity_data, provider)
  values (linked_id, linked, jsonb_build_object('sub', linked_id), 'discord');
  execute 'set local role service_role';
  payload := public.get_verified_discord_links();
  execute 'reset role';
  if not (payload->'linked_member_ids' @> jsonb_build_array(linked_id)) then
    raise exception 'FAIL: verified OAuth identity is missing';
  end if;
  if payload->'linked_member_ids' @> jsonb_build_array(forged_id) then
    raise exception 'FAIL: editable metadata authorized a Discord role';
  end if;
  if payload->>'version' <> '1' or payload ? 'email' then raise exception 'FAIL: unsafe payload'; end if;
  delete from auth.identities where user_id = linked and provider = 'discord';
  execute 'set local role service_role';
  payload := public.get_verified_discord_links();
  execute 'reset role';
  if payload->'linked_member_ids' @> jsonb_build_array(linked_id) then
    raise exception 'FAIL: unlinking retained the role identity';
  end if;
end;
$$;
rollback;
