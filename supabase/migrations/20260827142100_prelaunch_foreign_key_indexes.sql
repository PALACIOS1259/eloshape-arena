-- Cover foreign keys used by teams, rankings and split replacement lookups before public traffic.

create index if not exists achievements_profile_id_idx
  on public.achievements(profile_id);

create index if not exists ranking_points_rule_code_idx
  on public.ranking_points(rule_code);

create index if not exists split_qualifications_replaces_team_id_idx
  on public.split_qualifications(replaces_team_id);

create index if not exists team_invites_invited_by_profile_id_idx
  on public.team_invites(invited_by_profile_id);

create index if not exists team_invites_invited_profile_id_idx
  on public.team_invites(invited_profile_id);

create index if not exists team_ranking_points_rule_code_idx
  on public.team_ranking_points(rule_code);

create index if not exists team_ranking_points_season_id_idx
  on public.team_ranking_points(season_id);

create index if not exists team_ranking_points_split_id_idx
  on public.team_ranking_points(split_id);

create index if not exists team_ranking_points_tournament_id_idx
  on public.team_ranking_points(tournament_id);

create index if not exists teams_captain_id_idx
  on public.teams(captain_id);

create index if not exists teams_city_id_idx
  on public.teams(city_id);

create index if not exists teams_country_id_idx
  on public.teams(country_id);

create index if not exists teams_division_id_idx
  on public.teams(division_id);

create index if not exists teams_region_id_idx
  on public.teams(region_id);
