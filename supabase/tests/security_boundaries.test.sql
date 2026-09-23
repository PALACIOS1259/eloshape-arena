-- =============================================================
-- EloShape security boundary regression tests.
-- Run as database owner after all migrations.
-- =============================================================

do $$
declare
  v_count integer;
begin
  raise notice '--- EloShape security boundary tests ---';

  -- Public SECURITY DEFINER RPCs must never be callable anonymously.
  select count(*) into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('anon', p.oid, 'EXECUTE');

  if v_count <> 0 then
    raise exception 'FAIL security: % public SECURITY DEFINER functions are executable by anon.', v_count;
  end if;
  raise notice 'ok  anon cannot execute public SECURITY DEFINER RPCs';

  -- Every public SECURITY DEFINER function must pin an empty search_path.
  select count(*) into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and pg_get_functiondef(p.oid) not ilike '%SET search_path TO ''''%';

  if v_count <> 0 then
    raise exception 'FAIL security: % public SECURITY DEFINER functions have a non-empty search_path.', v_count;
  end if;
  raise notice 'ok  public SECURITY DEFINER RPCs pin an empty search_path';

  -- Every staff RPC exposed to authenticated users must authenticate the caller
  -- and perform the staff-role gate inside the function body.
  select count(*) into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname like 'staff\_%' escape '\'
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    and (
      pg_get_functiondef(p.oid) not ilike '%auth.uid()%'
      or pg_get_functiondef(p.oid) not ilike '%actor_is_staff%'
    );

  if v_count <> 0 then
    raise exception 'FAIL security: % authenticated staff RPCs are missing auth.uid()/actor_is_staff checks.', v_count;
  end if;
  raise notice 'ok  staff RPCs authenticate and authorize the caller';

  -- These tables are intentionally RPC-only. RLS is enabled and direct grants
  -- must remain absent for both browser roles.
  if has_table_privilege('anon', 'public.support_requests', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'public.support_requests', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'FAIL security: support_requests has direct browser-role table privileges.';
  end if;

  if has_table_privilege('anon', 'public.team_invites', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'public.team_invites', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'FAIL security: team_invites has direct browser-role table privileges.';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.support_requests'::regclass) then
    raise exception 'FAIL security: support_requests RLS is disabled.';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.team_invites'::regclass) then
    raise exception 'FAIL security: team_invites RLS is disabled.';
  end if;
  raise notice 'ok  RPC-only tables remain closed to direct browser access';

  raise notice '--- all security boundary tests passed ---';
end $$;
