-- Normalize public event statuses before launch.
-- Keep historical/test records instead of deleting them, but only expose active circuit events for registration.

update public.tournaments
set status = 'registration_open', updated_at = now()
where slug = 'rosario-gold-open-qualifier-4-2026'
  and participants_count = 0
  and status = 'registration_closed';

update public.tournaments
set status = 'registration_closed', updated_at = now()
where slug = 'rosario-open-silver-8'
  and participants_count = 0
  and status = 'registration_open';
