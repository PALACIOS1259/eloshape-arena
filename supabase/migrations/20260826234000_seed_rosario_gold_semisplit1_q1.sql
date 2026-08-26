-- Seed the first live Gold 5v5 Semi-Split and its Week 1 Open Qualifier.
-- References stable slugs/codes rather than generated UUIDs so the migration is portable.
with refs as (
  select
    (select id from public.seasons where is_active order by starts_at desc limit 1) as season_id,
    (select id from public.divisions where code = 'gold') as division_id,
    (select id from public.regions where slug = 'rosario' and kind = 'city') as region_id
), split_upsert as (
  insert into public.competitive_splits(
    season_id, slug, name, division_id, region_id, starts_at, ends_at, status,
    playoff_size, qualification_slots_per_qualifier, dispute_deadline_at, playoff_reveal_at
  )
  select
    season_id,
    'rosario-gold-semi-split-1-2026',
    'Rosario Gold Semi-Split 1',
    division_id,
    region_id,
    '2026-09-05 22:00:00+00',
    '2026-10-25 02:00:00+00',
    'qualifiers'::public.split_status,
    16,
    4,
    '2026-10-04 23:59:00-03',
    '2026-10-05 18:00:00-03'
  from refs
  on conflict (slug) do update set
    name = excluded.name,
    division_id = excluded.division_id,
    region_id = excluded.region_id,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    status = excluded.status,
    playoff_size = excluded.playoff_size,
    qualification_slots_per_qualifier = excluded.qualification_slots_per_qualifier,
    dispute_deadline_at = excluded.dispute_deadline_at,
    playoff_reveal_at = excluded.playoff_reveal_at,
    updated_at = now()
  returning id, season_id, division_id, region_id
)
insert into public.tournaments(
  slug, name, subtitle, description, rules,
  division_id, region_id, season_id, status, format, mode,
  max_participants, participants_count, prize,
  registration_closes_at, starts_at,
  split_id, qualifier_index, split_phase,
  checkin_required, required_roster_size, min_account_level, required_platform
)
select
  'rosario-gold-open-qualifier-1-2026',
  'Rosario Gold Open Qualifier #1',
  'Semi-Split 1 · Week 1 · 5v5',
  'The first open qualifier of the Rosario Gold Semi-Split. Teams compete in a single-elimination bracket for EloShape points and playoff qualification.',
  'First-come registration. Exactly 5 eligible Gold starters are required at registration and check-in. Riot data must be verified, every starter must meet account level 30+, and the team must be based in Rosario. Check-in opens 60 minutes before the event. The Top 4 teams secure a Semi-Split playoff slot; if a team is already qualified in a later qualifier, the slot passes to the next highest non-qualified finisher.',
  division_id,
  region_id,
  season_id,
  'registration_open'::public.tournament_status,
  'Single Elimination',
  'team',
  32,
  0,
  'Top 4 qualify to Semi-Split Playoffs',
  '2026-09-05 21:00:00+00',
  '2026-09-05 22:00:00+00',
  id,
  1,
  'qualifier',
  true,
  5,
  30,
  'LA2'
from split_upsert
on conflict (slug) do update set
  name = excluded.name,
  subtitle = excluded.subtitle,
  description = excluded.description,
  rules = excluded.rules,
  division_id = excluded.division_id,
  region_id = excluded.region_id,
  season_id = excluded.season_id,
  status = excluded.status,
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
  required_platform = excluded.required_platform,
  updated_at = now();
