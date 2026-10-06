-- Synthetic users only in staging/local; every change rolls back.
begin;
do $$
declare
  admin_id uuid := gen_random_uuid();
  tester_id uuid := gen_random_uuid();
  suffix text := replace(gen_random_uuid()::text, '-', '');
  tester_email text := 'confirm-' || suffix || '@example.invalid';
  pending_email text := 'unregistered-' || suffix || '@example.invalid';
  row_data jsonb;
  payload jsonb;
  metadata jsonb := '{"legal_acceptance":true,"accepted_terms_version":"2026-08-27","accepted_privacy_version":"2026-08-27"}';
begin
  update private.beta_settings set enabled = false;
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
    (admin_id,'admin-confirm-' || suffix || '@example.invalid',now(),metadata),
    (tester_id,tester_email,null,metadata);
  insert into public.user_roles(user_id,role) values(admin_id,'admin') on conflict do nothing;
  insert into private.beta_allowlist(email) values(tester_email),(pending_email);
  update private.beta_settings set enabled = true;
  if has_function_privilege('anon','public.beta_admin_list()','EXECUTE') then
    raise exception 'FAIL: anonymous invitation inspection';
  end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',tester_id,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  begin
    perform public.beta_admin_list();
    raise exception 'FAIL: tester can inspect Auth accounts';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  payload := public.beta_admin_list();
  execute 'reset role';
  select value into row_data from jsonb_array_elements(payload->'invitations') where value->>'email'=tester_email;
  if row_data->>'user_id' is distinct from tester_id::text or row_data->>'email_confirmed_at' is not null then
    raise exception 'FAIL: registered unconfirmed account status';
  end if;
  select value into row_data from jsonb_array_elements(payload->'invitations') where value->>'email'=pending_email;
  if row_data->>'user_id' is not null then raise exception 'FAIL: unregistered account invented'; end if;
  update auth.users set email_confirmed_at=now() where id=tester_id;
  execute 'set local role authenticated'; payload := public.beta_admin_list(); execute 'reset role';
  select value into row_data from jsonb_array_elements(payload->'invitations') where value->>'email'=tester_email;
  if row_data->>'email_confirmed_at' is null then raise exception 'FAIL: confirmed status missing'; end if;
  if payload::text like '%encrypted_password%' then raise exception 'FAIL: sensitive Auth fields exposed'; end if;
  raise notice 'All beta email admin tests passed';
end;
$$;
rollback;
