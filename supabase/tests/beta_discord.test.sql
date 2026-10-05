-- Real OAuth ownership and approval/revocation boundaries; all fixtures roll back.
begin;
do $$
declare
  invited uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  unconfirmed uuid := gen_random_uuid();
  suffix text := replace(gen_random_uuid()::text, '-', '');
  oauth_id text := '1888888888888888881';
  forged_id text := '1888888888888888882';
  payload jsonb;
  metadata jsonb := '{"legal_acceptance":true,"accepted_terms_version":"2026-08-27","accepted_privacy_version":"2026-08-27"}';
begin
  update private.beta_settings set enabled = false;
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
  values (invited, 'invite-' || suffix || '@example.invalid',now(),metadata || jsonb_build_object('discord_id',forged_id)),
    (outsider, 'outside-' || suffix || '@example.invalid',now(),metadata),
    (unconfirmed, 'unconfirmed-' || suffix || '@example.invalid',null,metadata);
  insert into private.beta_allowlist(email,discord_id) values
    ('invite-' || suffix || '@example.invalid',forged_id),
    ('unconfirmed-' || suffix || '@example.invalid',null);
  insert into auth.identities(provider_id,user_id,identity_data,provider) values
    (oauth_id,invited,jsonb_build_object('sub',oauth_id),'discord'),
    ('1888888888888888883',outsider,'{"sub":"1888888888888888883"}','discord'),
    ('1888888888888888884',unconfirmed,'{"sub":"1888888888888888884"}','discord');
  update private.beta_settings set enabled = true;
  if has_function_privilege('anon','public.get_beta_discord_members()','EXECUTE')
    or has_function_privilege('authenticated','private.verified_beta_discord_snapshot()','EXECUTE') then
    raise exception 'FAIL: beta snapshot is public';
  end if;
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  execute 'set local role service_role';
  payload := public.get_beta_discord_members();
  execute 'reset role';
  if not (payload->'member_ids' @> jsonb_build_array(oauth_id)) or payload->>'enabled' <> 'true' then
    raise exception 'FAIL: approved verified member omitted';
  end if;
  if payload->'member_ids' @> jsonb_build_array(forged_id)
    or payload->'member_ids' @> '["1888888888888888883","1888888888888888884"]'::jsonb
    or payload ? 'email' then raise exception 'FAIL: unsafe beta snapshot'; end if;
  if payload->'member_ids' @> '["1888888888888888883"]'::jsonb
    or payload->'member_ids' @> '["1888888888888888884"]'::jsonb then
    raise exception 'FAIL: unapproved or unconfirmed member authorized';
  end if;
  update private.beta_allowlist set active=false where email='invite-' || suffix || '@example.invalid';
  execute 'set local role service_role'; payload := public.get_beta_discord_members(); execute 'reset role';
  if payload->'member_ids' @> jsonb_build_array(oauth_id) then raise exception 'FAIL: revoked member retained'; end if;
  update private.beta_allowlist set active=true,expires_at=now()-interval '1 minute' where email='invite-' || suffix || '@example.invalid';
  execute 'set local role service_role'; payload := public.get_beta_discord_members(); execute 'reset role';
  if payload->'member_ids' @> jsonb_build_array(oauth_id) then raise exception 'FAIL: expired member retained'; end if;
  update private.beta_allowlist set expires_at=null where email='invite-' || suffix || '@example.invalid';
  delete from auth.identities where user_id=invited and provider='discord';
  execute 'set local role service_role'; payload := public.get_beta_discord_members(); execute 'reset role';
  if payload->'member_ids' @> jsonb_build_array(oauth_id) then raise exception 'FAIL: unlink retained tester'; end if;
  update private.beta_settings set enabled=false;
  execute 'set local role service_role'; payload := public.get_beta_discord_members(); execute 'reset role';
  if payload->>'enabled' <> 'false' then raise exception 'FAIL: pause state lost'; end if;
  raise notice 'All verified beta Discord tests passed';
end;
$$;
rollback;
