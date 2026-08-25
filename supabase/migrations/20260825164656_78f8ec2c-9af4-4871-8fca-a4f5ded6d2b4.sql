-- =====================================================================
-- EloShape milestone: auth provisioning, permission hardening, Riot data
-- Additive and idempotent. No data is deleted.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. private schema (never exposed through the Data API)
-- ---------------------------------------------------------------------
create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. private.has_role — current user only, no caller-supplied user id
-- ---------------------------------------------------------------------
create or replace function private.has_role(_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = _role
  )
$$;

comment on function private.has_role(public.app_role) is
  'Role check for the CURRENT authenticated user only. Lives in the private schema so it is not reachable through PostgREST.';

revoke all on function private.has_role(public.app_role) from public;
grant execute on function private.has_role(public.app_role) to authenticated, service_role;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role in ('admin', 'moderator')
  )
$$;

revoke all on function private.is_staff() from public;
grant execute on function private.is_staff() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. Migrate every policy off public.has_role, then drop it
-- ---------------------------------------------------------------------
drop policy if exists "roles read own" on public.user_roles;
create policy "roles read own" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or private.has_role('admin'));

drop policy if exists "roles admin write" on public.user_roles;
create policy "roles admin write" on public.user_roles
  for all to authenticated
  using (private.has_role('admin'))
  with check (private.has_role('admin'));

drop policy if exists "tournaments admin write" on public.tournaments;
create policy "tournaments admin write" on public.tournaments
  for all to authenticated
  using (private.has_role('admin'))
  with check (private.has_role('admin'));

drop policy if exists "matches admin write" on public.matches;
create policy "matches admin write" on public.matches
  for all to authenticated
  using (private.has_role('admin'))
  with check (private.has_role('admin'));

drop policy if exists "ranking points admin write" on public.ranking_points;
create policy "ranking points admin write" on public.ranking_points
  for all to authenticated
  using (private.has_role('admin'))
  with check (private.has_role('admin'));

drop policy if exists "reports read own or staff" on public.reports;
create policy "reports read own or staff" on public.reports
  for select to authenticated
  using (
    private.is_staff()
    or exists (select 1 from public.profiles p
               where p.id = reports.reporter_profile_id and p.user_id = auth.uid())
  );

drop policy if exists "reports staff manage" on public.reports;
create policy "reports staff manage" on public.reports
  for update to authenticated
  using (private.is_staff())
  with check (private.is_staff());

drop policy if exists "eligibility staff read" on public.eligibility_reviews;
create policy "eligibility staff read" on public.eligibility_reviews
  for select to authenticated
  using (
    private.is_staff()
    or exists (select 1 from public.profiles p
               where p.id = eligibility_reviews.profile_id and p.user_id = auth.uid())
  );

drop policy if exists "eligibility staff write" on public.eligibility_reviews;
create policy "eligibility staff write" on public.eligibility_reviews
  for all to authenticated
  using (private.is_staff())
  with check (private.is_staff());

drop function if exists public.has_role(uuid, public.app_role);

-- ---------------------------------------------------------------------
-- 4. profiles: lock competitive columns, allow only identity edits
-- ---------------------------------------------------------------------
create unique index if not exists profiles_user_id_key
  on public.profiles (user_id) where user_id is not null;

drop policy if exists "profiles insert own" on public.profiles;

revoke insert, update, delete on public.profiles from authenticated;
revoke insert, update, delete on public.profiles from anon;
grant update (handle, display_name, avatar_url, bio) on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- ownership check stays; column grants decide WHAT may change
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.profiles is
  'EloShape player profile. Players may only update handle/display_name/avatar_url/bio (column grants). Points, division, riot_*, eligibility and location are written exclusively by trusted server logic (service role).';

-- ---------------------------------------------------------------------
-- 5. tournament_entries: no direct browser writes
-- ---------------------------------------------------------------------
drop policy if exists "entries manage own" on public.tournament_entries;
revoke insert, update, delete on public.tournament_entries from authenticated;
revoke insert, update, delete on public.tournament_entries from anon;
grant all on public.tournament_entries to service_role;

comment on table public.tournament_entries is
  'Registration rows. seed/placement/points_awarded/status are server-controlled; clients register through the registerForTournament server function.';

-- ---------------------------------------------------------------------
-- 6. teams: captains edit presentation only
-- ---------------------------------------------------------------------
revoke update on public.teams from authenticated;
grant update (name, tag, logo_url, bio) on public.teams to authenticated;
grant all on public.teams to service_role;

-- ---------------------------------------------------------------------
-- 7. ranking ledger / brackets: service-role writes only
-- ---------------------------------------------------------------------
revoke insert, update, delete on public.ranking_points from authenticated, anon;
revoke insert, update, delete on public.matches from authenticated, anon;
revoke insert, update, delete on public.match_players from authenticated, anon;
revoke insert, update, delete on public.tournaments from authenticated, anon;
grant all on public.ranking_points to service_role;
grant all on public.matches to service_role;
grant all on public.match_players to service_role;
grant all on public.tournaments to service_role;

-- ---------------------------------------------------------------------
-- 8. riot_accounts: private, server-written
-- ---------------------------------------------------------------------
alter table public.riot_accounts
  add column if not exists game_name text,
  add column if not exists tag_line text,
  add column if not exists wins integer not null default 0,
  add column if not exists losses integer not null default 0,
  add column if not exists queue_type text,
  add column if not exists data_verified boolean not null default false,
  add column if not exists ownership_verified boolean not null default false,
  add column if not exists verification_method text not null default 'none',
  add column if not exists last_sync_status text,
  add column if not exists last_sync_error_code text,
  add column if not exists updated_at timestamptz not null default now();

comment on column public.riot_accounts.verified is
  'LEGACY. Means only that Riot returned data for the Riot ID (same as data_verified). It NEVER means the EloShape user proved ownership; see ownership_verified (RSO).';
comment on column public.riot_accounts.data_verified is
  'Riot API returned data for this Riot ID.';
comment on column public.riot_accounts.ownership_verified is
  'TRUE only after Riot Sign On (RSO) proves the EloShape user owns this Riot account. Not available yet.';
comment on column public.riot_accounts.verification_method is
  'none | api_key_lookup | rso';

update public.riot_accounts
   set data_verified = verified,
       verification_method = case when verified then 'api_key_lookup' else 'none' end
 where data_verified is distinct from verified;

create unique index if not exists riot_accounts_puuid_key
  on public.riot_accounts (puuid) where puuid is not null;
create unique index if not exists riot_accounts_profile_id_key
  on public.riot_accounts (profile_id);

drop trigger if exists riot_accounts_updated_at on public.riot_accounts;
create trigger riot_accounts_updated_at before update on public.riot_accounts
  for each row execute function public.set_updated_at();

drop policy if exists "riot accounts public read" on public.riot_accounts;
drop policy if exists "riot accounts manage own" on public.riot_accounts;

revoke all on public.riot_accounts from anon;
revoke all on public.riot_accounts from authenticated;
-- own row only, and never the PUUID / raw error metadata
grant select (
  id, profile_id, riot_id, game_name, tag_line, platform,
  solo_tier, solo_rank, solo_lp, wins, losses, queue_type,
  data_verified, ownership_verified, verification_method,
  verified, last_synced_at, last_sync_status, created_at, updated_at
) on public.riot_accounts to authenticated;
grant all on public.riot_accounts to service_role;

create policy "riot accounts read own" on public.riot_accounts
  for select to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = riot_accounts.profile_id and p.user_id = auth.uid()));

comment on table public.riot_accounts is
  'Private Riot linkage. Never publicly readable; PUUID is server-only. All writes go through EloShape server functions using the service role.';

-- ---------------------------------------------------------------------
-- 9. Automatic profile + role provisioning for new auth users
-- ---------------------------------------------------------------------
create or replace function private.unique_player_handle(_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  base text := 'player_' || substr(replace(_user_id::text, '-', ''), 1, 10);
  candidate text := base;
  n integer := 0;
begin
  while exists (select 1 from public.profiles p where lower(p.handle) = lower(candidate)) loop
    n := n + 1;
    candidate := base || '_' || n::text;
  end loop;
  return candidate;
end;
$$;

revoke all on function private.unique_player_handle(uuid) from public;

create or replace function private.provision_profile(
  _user_id uuid,
  _email text,
  _meta jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_name text;
begin
  select p.id into v_profile_id from public.profiles p where p.user_id = _user_id;
  if v_profile_id is not null then
    insert into public.user_roles (user_id, role)
    values (_user_id, 'player')
    on conflict (user_id, role) do nothing;
    return v_profile_id;
  end if;

  v_name := coalesce(
    nullif(trim(coalesce(_meta->>'display_name', _meta->>'full_name', _meta->>'name', '')), ''),
    nullif(split_part(coalesce(_email, ''), '@', 1), ''),
    'Player'
  );

  insert into public.profiles (
    user_id, handle, display_name, eligibility, profile_completion, is_demo,
    points_season, points_month, wins, losses, rank_movement, tournaments_played
  )
  values (
    _user_id, private.unique_player_handle(_user_id), left(v_name, 40),
    'pending_review', 20, false, 0, 0, 0, 0, 0, 0
  )
  returning id into v_profile_id;

  insert into public.user_roles (user_id, role)
  values (_user_id, 'player')
  on conflict (user_id, role) do nothing;

  return v_profile_id;
end;
$$;

revoke all on function private.provision_profile(uuid, text, jsonb) from public;
grant execute on function private.provision_profile(uuid, text, jsonb) to service_role;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.provision_profile(new.id, new.email, coalesce(new.raw_user_meta_data, '{}'::jsonb));
  return new;
exception when others then
  -- never block sign-up; the server also provisions lazily on first authenticated call
  raise warning 'EloShape profile provisioning failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists eloshape_on_auth_user_created on auth.users;
create trigger eloshape_on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- Backfill: real auth users without a profile. Demo profiles (user_id null) untouched.
do $$
declare r record;
begin
  for r in select u.id, u.email, coalesce(u.raw_user_meta_data, '{}'::jsonb) as meta
             from auth.users u
             left join public.profiles p on p.user_id = u.id
            where p.id is null
  loop
    perform private.provision_profile(r.id, r.email, r.meta);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 10. Location integrity helper (server-side use only)
-- ---------------------------------------------------------------------
create or replace function private.resolve_location(_city_id uuid)
returns table (city_id uuid, province_id uuid, country_id uuid, region_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with city as (
    select r.id, r.parent_id from public.regions r where r.id = _city_id and r.kind = 'city'
  ),
  province as (
    select r.id, r.parent_id from public.regions r join city c on r.id = c.parent_id where r.kind = 'province'
  ),
  country as (
    select r.id, r.parent_id from public.regions r join province p on r.id = p.parent_id where r.kind = 'country'
  ),
  region as (
    select r.id from public.regions r join country c on r.id = c.parent_id where r.kind = 'region'
  )
  select (select id from city), (select id from province), (select id from country), (select id from region)
  where exists (select 1 from city)
$$;

revoke all on function private.resolve_location(uuid) from public;
grant execute on function private.resolve_location(uuid) to service_role;