-- Real authorization tests; no fixtures survive the transaction.
begin;
do $$
declare
  invited uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  unconfirmed uuid := gen_random_uuid();
  admin_user uuid := gen_random_uuid();
  suffix text := replace(gen_random_uuid()::text, '-', '');
  invited_email text;
  metadata jsonb := '{"legal_acceptance":true,"accepted_terms_version":"2026-08-27","accepted_privacy_version":"2026-08-27","beta_access":true}'::jsonb;
begin
  update private.beta_settings set enabled = false;
  invited_email := 'beta-' || suffix || '@example.invalid';
  insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data)
  values (invited, invited_email, now(), metadata),
    (outsider, 'outsider-' || suffix || '@example.invalid', now(), metadata),
    (unconfirmed, 'unconfirmed-' || suffix || '@example.invalid', null, metadata),
    (admin_user, 'admin-' || suffix || '@example.invalid', now(), metadata);
  insert into public.user_roles(user_id, role) values (admin_user,'admin') on conflict do nothing;
  insert into private.beta_allowlist(email, discord_id) values
    (invited_email, '100000000000000001'),
    ('unconfirmed-' || suffix || '@example.invalid', '100000000000000002');
  update private.beta_settings set enabled = true;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', outsider, 'role', 'authenticated')::text, true);
  if private.beta_allowed() then raise exception 'FAIL: editable metadata granted beta access'; end if;
  perform set_config('request.path', '/rpc/ensure_my_profile', true);
  begin
    perform private.enforce_beta_api();
    raise exception 'FAIL: outsider bypassed API gate';
  exception when sqlstate 'PT403' then null;
  end;
  begin
    perform public.beta_admin_list();
    raise exception 'FAIL: outsider read invitation list';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.beta_admin_save('forged@example.invalid', true);
    raise exception 'FAIL: outsider granted an invitation';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.path', '/rpc/get_beta_access', true);
  perform private.enforce_beta_api();
  if (public.get_beta_access()->>'allowed')::boolean then
    raise exception 'FAIL: public status authorized outsider';
  end if;
  execute 'set local role authenticated';
  if exists(select 1 from public.profiles) then raise exception 'FAIL: outsider bypassed restrictive RLS'; end if;
  execute 'reset role';

  perform set_config('request.jwt.claims', jsonb_build_object('sub', unconfirmed, 'role', 'authenticated')::text, true);
  if private.beta_allowed() then raise exception 'FAIL: unconfirmed email received access'; end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', invited, 'role', 'authenticated')::text, true);
  if not private.beta_allowed() then raise exception 'FAIL: confirmed invited user was denied'; end if;
  perform set_config('request.path', '/profiles', true);
  perform private.enforce_beta_api();
  execute 'set local role authenticated';
  if not exists(select 1 from public.profiles where user_id = invited) then
    raise exception 'FAIL: invitation did not preserve normal RLS access';
  end if;
  execute 'reset role';
  update private.beta_allowlist set active = false where email = invited_email;
  if private.beta_allowed() then raise exception 'FAIL: revoked invitation remains valid'; end if;
  update private.beta_allowlist set active = true, expires_at = now() - interval '1 minute' where email = invited_email;
  if private.beta_allowed() then raise exception 'FAIL: expired invitation remains valid'; end if;
  update private.beta_allowlist set expires_at = null where email = invited_email;

  begin
    insert into auth.users(id,email,raw_user_meta_data)
    values(gen_random_uuid(),'blocked-' || suffix || '@example.invalid', metadata);
    raise exception 'FAIL: non-invited signup succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'beta_invitation_required' then raise; end if;
  end;
  insert into private.beta_allowlist(email) values ('new-' || suffix || '@example.invalid');
  insert into auth.users(id,email,raw_user_meta_data)
  values(gen_random_uuid(), 'NEW-' || suffix || '@example.invalid', metadata);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', admin_user, 'role', 'authenticated')::text, true);
  if not private.beta_allowed() then raise exception 'FAIL: staff recovery access denied'; end if;
  perform public.beta_admin_save('case-' || suffix || '@EXAMPLE.INVALID', true, '100000000000000003');
  if not exists(select 1 from private.beta_allowlist where email = 'case-' || suffix || '@example.invalid') then
    raise exception 'FAIL: emails were not normalized';
  end if;

  if has_function_privilege('authenticated','public.get_beta_discord_members()','execute')
    or has_function_privilege('anon','public.get_beta_discord_members()','execute') then
    raise exception 'FAIL: Discord snapshot exposed to browser roles';
  end if;
  if has_table_privilege('authenticated','private.beta_allowlist','select')
    or has_table_privilege('anon','private.beta_allowlist','select') then
    raise exception 'FAIL: private invitations exposed';
  end if;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform private.enforce_beta_api();
  execute 'set local role service_role';
  if not (public.get_beta_discord_members()->'member_ids') @> '["100000000000000001"]'::jsonb then
    raise exception 'FAIL: bot snapshot omitted approved member';
  end if;
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.path', '/profiles', true);
  begin
    perform private.enforce_beta_api();
    raise exception 'FAIL: anonymous caller bypassed API gate';
  exception when sqlstate 'PT403' then null;
  end;
  update private.beta_settings set enabled = false;
  perform private.enforce_beta_api();
  raise notice 'All closed beta tests passed';
end;
$$;
rollback;
