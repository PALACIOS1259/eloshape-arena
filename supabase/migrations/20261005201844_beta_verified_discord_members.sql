-- Private email approval plus verified OAuth ownership; never player metadata
-- or manually entered Discord IDs. No broad grants on Auth tables.
create function private.verified_beta_discord_snapshot()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if current_setting('role', true) is distinct from 'service_role' or auth.uid() is not null then
    raise exception 'Backend only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'enabled', (select enabled from private.beta_settings where singleton),
    'member_ids', (select coalesce(jsonb_agg(distinct i.provider_id), '[]'::jsonb)
      from private.beta_allowlist b
      join auth.users u on lower(btrim(u.email)) = b.email
      join public.profiles p on p.user_id = u.id
      join auth.identities i on i.user_id = u.id and i.provider = 'discord'
      where b.active and (b.expires_at is null or b.expires_at > now())
        and u.email_confirmed_at is not null and not coalesce(u.is_anonymous, false)
        and i.provider_id ~ '^[0-9]{17,20}$')
  );
end;
$$;
revoke all on function private.verified_beta_discord_snapshot() from public, anon, authenticated;
grant execute on function private.verified_beta_discord_snapshot() to service_role;
create or replace function public.get_beta_discord_members()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.verified_beta_discord_snapshot();
$$;
revoke all on function public.get_beta_discord_members() from public, anon, authenticated;
grant execute on function public.get_beta_discord_members() to service_role;

-- Show the verified identity to administrators without copying a snowflake.
create or replace function private.beta_admin_list()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.has_role('admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'enabled', (select enabled from private.beta_settings where singleton),
    'invitations', (select coalesce(jsonb_agg(
      (to_jsonb(b) - 'discord_id') || jsonb_build_object('discord_id', (
        select i.provider_id from auth.users u
        join auth.identities i on i.user_id = u.id and i.provider = 'discord'
        where lower(btrim(u.email)) = b.email and u.email_confirmed_at is not null
          and not coalesce(u.is_anonymous, false) and i.provider_id ~ '^[0-9]{17,20}$'
        order by i.created_at, i.id limit 1
      )) order by b.updated_at desc), '[]'::jsonb) from private.beta_allowlist b)
  );
end;
$$;
revoke all on function private.beta_admin_list() from public, anon;
grant execute on function private.beta_admin_list() to authenticated;
notify pgrst, 'reload schema';
