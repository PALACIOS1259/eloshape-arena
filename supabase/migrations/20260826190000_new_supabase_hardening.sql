-- EloShape own-Supabase hardening applied during migration from Lovable Cloud.
-- This file is additive/idempotent and records the post-bootstrap changes that
-- should exist on future environments.

-- Public standings are read-only; caller privileges/RLS are sufficient.
alter function public.split_standings(uuid) security invoker;
revoke all on function public.split_standings(uuid) from public;
grant execute on function public.split_standings(uuid) to anon, authenticated, service_role;

-- Staff playoff generation is never anonymous.
revoke all on function public.staff_generate_split_playoffs(uuid, integer, boolean, text) from public, anon;
grant execute on function public.staff_generate_split_playoffs(uuid, integer, boolean, text) to authenticated, service_role;

-- Frequent FK / ownership query indexes.
create index if not exists regions_parent_id_idx on public.regions(parent_id);
create index if not exists profiles_division_id_idx on public.profiles(division_id);
create index if not exists profiles_city_id_idx on public.profiles(city_id);
create index if not exists profiles_province_id_idx on public.profiles(province_id);
create index if not exists profiles_country_id_idx on public.profiles(country_id);
create index if not exists profiles_region_id_idx on public.profiles(region_id);
create index if not exists team_members_profile_id_idx on public.team_members(profile_id);
create index if not exists tournament_entries_profile_id_idx on public.tournament_entries(profile_id);
create index if not exists tournament_entries_team_id_idx on public.tournament_entries(team_id);
create index if not exists matches_entry_a_id_idx on public.matches(entry_a_id);
create index if not exists matches_entry_b_id_idx on public.matches(entry_b_id);
create index if not exists matches_winner_entry_id_idx on public.matches(winner_entry_id);
create index if not exists match_players_match_id_idx on public.match_players(match_id);
create index if not exists match_players_profile_id_idx on public.match_players(profile_id);
create index if not exists ranking_points_tournament_id_idx on public.ranking_points(tournament_id);
create index if not exists ranking_points_season_id_idx on public.ranking_points(season_id);
create index if not exists eligibility_reviews_profile_id_idx on public.eligibility_reviews(profile_id);
create index if not exists reports_reporter_profile_id_idx on public.reports(reporter_profile_id);
create index if not exists reports_reported_profile_id_idx on public.reports(reported_profile_id);
create index if not exists reports_tournament_id_idx on public.reports(tournament_id);
create index if not exists competitive_splits_season_id_idx on public.competitive_splits(season_id);
create index if not exists competitive_splits_division_id_idx on public.competitive_splits(division_id);
create index if not exists competitive_splits_region_id_idx on public.competitive_splits(region_id);
create index if not exists split_qualifications_team_id_idx on public.split_qualifications(team_id);
create index if not exists split_qualifications_source_tournament_idx on public.split_qualifications(qualified_from_tournament_id);
create index if not exists tournament_roster_members_team_id_idx on public.tournament_roster_members(team_id);
create index if not exists tournaments_division_id_idx on public.tournaments(division_id);
create index if not exists tournaments_region_id_idx on public.tournaments(region_id);
create index if not exists tournaments_season_id_idx on public.tournaments(season_id);

-- Cache auth.uid() once per statement inside hot RLS policies.
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "teams captain update" on public.teams;
create policy "teams captain update" on public.teams for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = captain_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.profiles p where p.id = captain_id and p.user_id = (select auth.uid())));

drop policy if exists "roles read own" on public.user_roles;
create policy "roles read own" on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or private.has_role('admin'));

drop policy if exists "reports insert own" on public.reports;
create policy "reports insert own" on public.reports for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = reporter_profile_id and p.user_id = (select auth.uid())));

drop policy if exists "reports read own or staff" on public.reports;
create policy "reports read own or staff" on public.reports for select to authenticated
  using (private.is_staff() or exists (select 1 from public.profiles p where p.id = reports.reporter_profile_id and p.user_id = (select auth.uid())));

drop policy if exists "eligibility staff read" on public.eligibility_reviews;
create policy "eligibility staff read" on public.eligibility_reviews for select to authenticated
  using (private.is_staff() or exists (select 1 from public.profiles p where p.id = eligibility_reviews.profile_id and p.user_id = (select auth.uid())));

drop policy if exists "riot accounts read own" on public.riot_accounts;
create policy "riot accounts read own" on public.riot_accounts for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = riot_accounts.profile_id and p.user_id = (select auth.uid())));
