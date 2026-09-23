-- Tighten scrim RPC privileges under Supabase's explicit anon default grants.
-- Public board reads use SECURITY INVOKER plus column-level SELECT/RLS.

drop policy if exists "Scrim posts public read" on public.scrim_posts;
create policy "Scrim posts public read"
on public.scrim_posts
for select
to anon, authenticated
using (true);

drop policy if exists "Scrim challenge state public read" on public.scrim_challenges;
create policy "Scrim challenge state public read"
on public.scrim_challenges
for select
to anon, authenticated
using (true);

grant select (
  id, team_id, starts_at, ends_at, best_of, note, status,
  opponent_team_id, score_team, score_opponent, winner_team_id
) on public.scrim_posts to anon, authenticated;

grant select (scrim_id, status)
on public.scrim_challenges to anon, authenticated;

alter function public.list_scrims() security invoker;

revoke execute on function public.get_my_scrim_hub() from anon;
revoke execute on function public.create_my_scrim(timestamptz,timestamptz,integer,text) from anon;
revoke execute on function public.challenge_scrim(uuid) from anon;
revoke execute on function public.respond_scrim_challenge(uuid,boolean) from anon;
revoke execute on function public.cancel_my_scrim(uuid) from anon;
revoke execute on function public.report_my_scrim_result(uuid,integer,integer) from anon;

revoke execute on function public.get_my_scrim_hub() from public;
revoke execute on function public.create_my_scrim(timestamptz,timestamptz,integer,text) from public;
revoke execute on function public.challenge_scrim(uuid) from public;
revoke execute on function public.respond_scrim_challenge(uuid,boolean) from public;
revoke execute on function public.cancel_my_scrim(uuid) from public;
revoke execute on function public.report_my_scrim_result(uuid,integer,integer) from public;

grant execute on function public.list_scrims() to anon, authenticated, service_role;
grant execute on function public.get_my_scrim_hub() to authenticated, service_role;
grant execute on function public.create_my_scrim(timestamptz,timestamptz,integer,text) to authenticated, service_role;
grant execute on function public.challenge_scrim(uuid) to authenticated, service_role;
grant execute on function public.respond_scrim_challenge(uuid,boolean) to authenticated, service_role;
grant execute on function public.cancel_my_scrim(uuid) to authenticated, service_role;
grant execute on function public.report_my_scrim_result(uuid,integer,integer) to authenticated, service_role;
