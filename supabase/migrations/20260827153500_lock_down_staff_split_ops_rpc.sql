-- Keep staff-only Semi-Split operations out of the anonymous API surface.
revoke execute on function public.staff_get_split_ops(uuid) from public;
revoke execute on function public.staff_get_split_ops(uuid) from anon;
grant execute on function public.staff_get_split_ops(uuid) to authenticated;
grant execute on function public.staff_get_split_ops(uuid) to service_role;
