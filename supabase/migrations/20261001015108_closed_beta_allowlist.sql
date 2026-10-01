-- Disabled initially: add real invitations before enabling closed beta.
create table private.beta_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false
);
insert into private.beta_settings(singleton, enabled) values (true, false);

create table private.beta_allowlist (
  email text primary key check (email = lower(btrim(email)) and position('@' in email) > 1),
  discord_id text unique check (discord_id ~ '^[0-9]{17,20}$'),
  active boolean not null default true,
  expires_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table private.beta_settings enable row level security;
alter table private.beta_allowlist enable row level security;
revoke all on private.beta_settings, private.beta_allowlist from public, anon, authenticated;
grant select on private.beta_settings, private.beta_allowlist to service_role;

create function private.beta_allowed()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid() and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous, false)
      and (
        exists (select 1 from public.user_roles r where r.user_id = u.id and r.role in ('admin','moderator'))
        or exists (
          select 1 from private.beta_allowlist b
          where b.email = lower(btrim(u.email)) and b.active
            and (b.expires_at is null or b.expires_at > now())
        )
      )
  );
$$;

create function private.beta_data_allowed()
returns boolean language sql stable security definer set search_path = '' as $$
  select not coalesce((select enabled from private.beta_settings where singleton), true)
    or private.beta_allowed();
$$;

create function private.beta_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'enabled', coalesce((select enabled from private.beta_settings where singleton), true),
    'allowed', private.beta_allowed()
  );
$$;

revoke all on function private.beta_allowed(), private.beta_data_allowed(), private.beta_status() from public;
grant usage on schema private to anon, authenticated, service_role;
grant execute on function private.beta_data_allowed(), private.beta_status() to anon, authenticated, service_role;
grant execute on function private.beta_allowed() to authenticated, service_role;

-- The anonymous RPC reveals only state and the verified caller's own access.
create function public.get_beta_access()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.beta_status();
$$;
revoke all on function public.get_beta_access() from public;
grant execute on function public.get_beta_access() to anon, authenticated, service_role;

create function private.enforce_beta_api()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() = 'service_role'
    or not coalesce((select enabled from private.beta_settings where singleton), true)
    or ltrim(coalesce(current_setting('request.path', true), ''), '/') = 'rpc/get_beta_access'
    or private.beta_allowed() then
    return;
  end if;
  raise sqlstate 'PT403' using message = 'beta_access_required';
end;
$$;
revoke all on function private.enforce_beta_api() from public;
grant execute on function private.enforce_beta_api() to anon, authenticated, service_role;

-- Do not replace another project's pre-request security hook silently.
do $$
declare existing text;
begin
  select split_part(setting, '=', 2) into existing
  from pg_roles r, unnest(r.rolconfig) setting
  where r.rolname = 'authenticator' and setting like 'pgrst.db_pre_request=%';
  if existing is not null and existing <> 'private.enforce_beta_api' then
    raise exception 'Integrate existing Data API pre-request hook before applying beta gate';
  end if;
end;
$$;
alter role authenticator set pgrst.db_pre_request = 'private.enforce_beta_api';
notify pgrst, 'reload config';

-- An additional restrictive policy preserves every existing ownership/staff rule.
-- This also protects table reads outside PostgREST (e.g. future Realtime use).
do $$
declare t record;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p') and c.relrowsecurity
  loop
    execute format('create policy beta_access_gate on public.%I as restrictive for all to anon, authenticated using ((select private.beta_data_allowed())) with check ((select private.beta_data_allowed()))', t.relname);
  end loop;
end;
$$;

-- Auth signup is a separate API: enforce invitations before any user is inserted.
create function private.enforce_beta_signup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((select enabled from private.beta_settings where singleton), true)
    and not exists (
      select 1 from private.beta_allowlist b
      where b.email = lower(btrim(new.email)) and b.active
        and (b.expires_at is null or b.expires_at > now())
    ) then
    raise exception 'beta_invitation_required' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_beta_signup() from public, anon, authenticated;
create trigger enforce_beta_signup before insert on auth.users
  for each row execute function private.enforce_beta_signup();

create function private.beta_admin_list()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.has_role('admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'enabled', (select enabled from private.beta_settings where singleton),
    'invitations', (select coalesce(jsonb_agg(to_jsonb(b) order by b.updated_at desc), '[]'::jsonb) from private.beta_allowlist b)
  );
end;
$$;

create function private.beta_admin_save(p_email text, p_active boolean, p_discord_id text, p_expires_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.has_role('admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into private.beta_allowlist(email, active, discord_id, expires_at, updated_by)
  values (lower(btrim(p_email)), p_active, nullif(btrim(p_discord_id), ''), p_expires_at, auth.uid())
  on conflict(email) do update set active = excluded.active, discord_id = excluded.discord_id,
    expires_at = excluded.expires_at, updated_by = excluded.updated_by, updated_at = now();
end;
$$;

create function private.beta_admin_set_enabled(p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.has_role('admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update private.beta_settings set enabled = p_enabled where singleton;
end;
$$;
revoke all on function private.beta_admin_list(), private.beta_admin_save(text,boolean,text,timestamptz), private.beta_admin_set_enabled(boolean) from public, anon;
grant execute on function private.beta_admin_list(), private.beta_admin_save(text,boolean,text,timestamptz), private.beta_admin_set_enabled(boolean) to authenticated;

create function public.beta_admin_list()
returns jsonb language sql security invoker set search_path = '' as $$ select private.beta_admin_list(); $$;
create function public.beta_admin_save(p_email text, p_active boolean, p_discord_id text default null, p_expires_at timestamptz default null)
returns void language sql security invoker set search_path = '' as $$ select private.beta_admin_save(p_email,p_active,p_discord_id,p_expires_at); $$;
create function public.beta_admin_set_enabled(p_enabled boolean)
returns void language sql security invoker set search_path = '' as $$ select private.beta_admin_set_enabled(p_enabled); $$;
revoke all on function public.beta_admin_list(), public.beta_admin_save(text,boolean,text,timestamptz), public.beta_admin_set_enabled(boolean) from public, anon;
grant execute on function public.beta_admin_list(), public.beta_admin_save(text,boolean,text,timestamptz), public.beta_admin_set_enabled(boolean) to authenticated;

-- Backend-only snapshot for the Discord bot. No email addresses are returned.
create function public.get_beta_discord_members()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'enabled', (select enabled from private.beta_settings where singleton),
    'member_ids', (select coalesce(jsonb_agg(discord_id), '[]'::jsonb)
      from private.beta_allowlist where active and discord_id is not null
        and (expires_at is null or expires_at > now()))
  );
$$;
revoke all on function public.get_beta_discord_members() from public, anon, authenticated;
grant execute on function public.get_beta_discord_members() to service_role;
notify pgrst, 'reload schema';
