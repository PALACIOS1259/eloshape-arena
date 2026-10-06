-- Admins can inspect registration and confirmation without entering Auth Studio.
-- The player-facing APIs never expose Auth users or invite emails.
create or replace function private.beta_admin_list()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.has_role('admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'enabled', (select enabled from private.beta_settings where singleton),
    'invitations', (
      select coalesce(jsonb_agg(
        (to_jsonb(b) - 'discord_id') || jsonb_build_object(
          'user_id', u.id,
          'email_confirmed_at', u.email_confirmed_at,
          'discord_id', (
            select i.provider_id from auth.identities i
            where i.user_id = u.id and i.provider = 'discord'
              and u.email_confirmed_at is not null
              and i.provider_id ~ '^[0-9]{17,20}$'
            order by i.created_at, i.id limit 1
          )
        ) order by b.updated_at desc), '[]'::jsonb)
      from private.beta_allowlist b
      left join auth.users u on lower(btrim(u.email)) = b.email
        and not coalesce(u.is_anonymous, false)
    )
  );
end;
$$;
revoke all on function private.beta_admin_list() from public, anon;
grant execute on function private.beta_admin_list() to authenticated;
notify pgrst, 'reload schema';
