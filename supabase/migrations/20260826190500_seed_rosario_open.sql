insert into public.tournaments (
  slug, name, subtitle, description, rules,
  division_id, region_id, season_id,
  status, format, mode, max_participants, participants_count, prize,
  registration_closes_at, starts_at,
  checkin_required, required_roster_size, min_account_level, required_platform
)
select
  'rosario-open-silver-8',
  'Rosario Open - Silver',
  'Weekly city circuit - Season 1',
  'A weekly single-elimination bracket for Silver division players registered in Rosario and the Santa Fe province. Matches are Bo1 until semifinals.',
  '1. Riot Solo Queue rank must be Silver at registration.\n2. Check-in opens 60 minutes before start.\n3. Bo1 until semifinals, Bo3 from semifinals onward.\n4. Tournament code lobbies only; screenshots of results are mandatory.\n5. Smurfing, account sharing and toxicity result in disqualification and an eligibility review.',
  d.id, r.id, s.id,
  'registration_open'::public.tournament_status,
  'Single elimination Bo1 / Bo3 finals',
  'solo',
  32,
  0,
  '2400 EloShape points pool',
  '2026-08-30T21:00:00Z'::timestamptz,
  '2026-08-30T22:00:00Z'::timestamptz,
  true,
  1,
  30,
  'LA2'
from public.divisions d
cross join public.regions r
cross join public.seasons s
where d.code = 'silver' and r.slug = 'rosario' and s.slug = 's1-2026'
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
  checkin_required = excluded.checkin_required,
  required_roster_size = excluded.required_roster_size,
  min_account_level = excluded.min_account_level,
  required_platform = excluded.required_platform;
