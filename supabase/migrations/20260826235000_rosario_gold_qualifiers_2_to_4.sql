-- Complete the four-week Rosario Gold Semi-Split qualifier stage.
-- This migration is idempotent and resolves all foreign keys by stable slugs/codes.

do $$
declare
  v_split uuid;
  v_season uuid;
  v_division uuid;
  v_region uuid;
  v_rules text := 'First-come registration. Exactly 5 eligible Gold starters are required at registration and check-in. Riot data must be verified, every starter must meet account level 30+, and the team must be based in Rosario. Check-in opens 60 minutes before the event. The Top 4 teams secure a Semi-Split playoff slot; if a team is already qualified in a later qualifier, the slot passes to the next highest non-qualified finisher.';
begin
  select id into v_split from public.competitive_splits where slug = 'rosario-gold-semi-split-1-2026';
  select id into v_season from public.seasons where slug = 's1-2026';
  select id into v_division from public.divisions where code = 'gold';
  select id into v_region from public.regions where slug = 'rosario' and kind = 'city';

  if v_split is null or v_season is null or v_division is null or v_region is null then
    raise exception 'Rosario Gold Semi-Split dependencies are missing';
  end if;

  insert into public.tournaments(
    slug, name, subtitle, description, rules, division_id, region_id, season_id,
    status, format, mode, max_participants, participants_count, prize,
    registration_closes_at, starts_at, split_id, qualifier_index, split_phase,
    checkin_required, required_roster_size, min_account_level, required_platform
  ) values
    (
      'rosario-gold-open-qualifier-2-2026',
      'Rosario Gold Open Qualifier #2',
      'Semi-Split 1 · Week 2 · 5v5',
      'The second open qualifier of the Rosario Gold Semi-Split. Teams compete in a single-elimination bracket for EloShape points and playoff qualification.',
      v_rules, v_division, v_region, v_season,
      'registration_open', 'Single Elimination', 'team', 32, 0,
      'Top 4 qualify to Semi-Split Playoffs',
      '2026-09-12 21:00:00+00', '2026-09-12 22:00:00+00', v_split, 2, 'qualifier',
      true, 5, 30, 'LA2'
    ),
    (
      'rosario-gold-open-qualifier-3-2026',
      'Rosario Gold Open Qualifier #3',
      'Semi-Split 1 · Week 3 · 5v5',
      'The third open qualifier of the Rosario Gold Semi-Split. Teams compete in a single-elimination bracket for EloShape points and playoff qualification.',
      v_rules, v_division, v_region, v_season,
      'registration_open', 'Single Elimination', 'team', 32, 0,
      'Top 4 qualify to Semi-Split Playoffs',
      '2026-09-19 21:00:00+00', '2026-09-19 22:00:00+00', v_split, 3, 'qualifier',
      true, 5, 30, 'LA2'
    ),
    (
      'rosario-gold-open-qualifier-4-2026',
      'Rosario Gold Open Qualifier #4',
      'Semi-Split 1 · Week 4 · 5v5',
      'The fourth open qualifier of the Rosario Gold Semi-Split. Teams compete in a single-elimination bracket for EloShape points and playoff qualification.',
      v_rules, v_division, v_region, v_season,
      'registration_open', 'Single Elimination', 'team', 32, 0,
      'Top 4 qualify to Semi-Split Playoffs',
      '2026-09-26 21:00:00+00', '2026-09-26 22:00:00+00', v_split, 4, 'qualifier',
      true, 5, 30, 'LA2'
    )
  on conflict (slug) do update set
    name = excluded.name,
    subtitle = excluded.subtitle,
    description = excluded.description,
    rules = excluded.rules,
    division_id = excluded.division_id,
    region_id = excluded.region_id,
    season_id = excluded.season_id,
    format = excluded.format,
    mode = excluded.mode,
    max_participants = excluded.max_participants,
    prize = excluded.prize,
    registration_closes_at = excluded.registration_closes_at,
    starts_at = excluded.starts_at,
    split_id = excluded.split_id,
    qualifier_index = excluded.qualifier_index,
    split_phase = excluded.split_phase,
    checkin_required = excluded.checkin_required,
    required_roster_size = excluded.required_roster_size,
    min_account_level = excluded.min_account_level,
    required_platform = excluded.required_platform;
end $$;
