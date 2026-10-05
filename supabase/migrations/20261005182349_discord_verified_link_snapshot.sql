-- Discord ownership comes exclusively from Auth's verified OAuth identity.
-- No user-editable metadata or player-supplied snowflakes authorize roles.
-- service_role cannot directly SELECT auth.identities. Keep that read in a
-- private, narrowly scoped function rather than granting access to Auth tables.
create function private.verified_discord_link_snapshot()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if current_setting('role', true) is distinct from 'service_role' or auth.uid() is not null then
    raise exception 'Backend only' using errcode = '42501';
  end if;
  return (select jsonb_build_object(
    'version', 1,
    'linked_member_ids', coalesce(jsonb_agg(distinct i.provider_id), '[]'::jsonb)
  )
  from auth.identities i
  join public.profiles p on p.user_id = i.user_id
  where i.provider = 'discord' and i.provider_id ~ '^[0-9]{17,20}$');
end;
$$;
revoke all on function private.verified_discord_link_snapshot() from public, anon, authenticated;
grant execute on function private.verified_discord_link_snapshot() to service_role;

create function public.get_verified_discord_links()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.verified_discord_link_snapshot();
$$;
revoke all on function public.get_verified_discord_links() from public, anon, authenticated;
grant execute on function public.get_verified_discord_links() to service_role;
notify pgrst, 'reload schema';
