do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

revoke all on function private.has_role(app_role) from public, anon, authenticated;
grant execute on function private.has_role(app_role) to authenticated;
revoke all on function private.is_staff() from public, anon, authenticated;
grant execute on function private.is_staff() to authenticated;
