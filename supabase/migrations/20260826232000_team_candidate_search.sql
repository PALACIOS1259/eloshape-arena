-- Secure captain-facing player discovery for team invitations.
-- Returns public competitive profile data only; no email, PUUID or private auth data.

create or replace function public.search_my_team_candidates(
  p_query text default '',
  p_limit integer default 12
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile uuid;
  v_team record;
  v_query text := lower(btrim(coalesce(p_query, '')));
  v_limit integer := greatest(1, least(coalesce(p_limit, 12), 25));
  v_result jsonb;
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  v_profile := public.ensure_my_profile();

  select t.id, t.division_id
  into v_team
  from public.teams t
  where t.captain_id = v_profile;

  if v_team.id is null then raise exception 'team_captain_required'; end if;

  select coalesce(jsonb_agg(candidate order by (candidate->>'ready')::boolean desc, candidate->>'displayName'), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'profileId', p.id,
      'handle', p.handle,
      'displayName', p.display_name,
      'eligibility', p.eligibility,
      'riotTier', ra.solo_tier,
      'riotRank', ra.solo_rank,
      'accountLevel', ra.account_level,
      'riotVerified', coalesce(ra.data_verified, false),
      'divisionCode', d.code,
      'divisionName', d.name,
      'cityName', city.name,
      'ready', (
        p.eligibility = 'eligible'
        and coalesce(ra.data_verified, false)
        and coalesce(ra.account_level, 0) >= 30
        and p.division_id is not distinct from v_team.division_id
      )
    ) as candidate
    from public.profiles p
    left join public.divisions d on d.id = p.division_id
    left join public.regions city on city.id = p.city_id
    left join lateral (
      select r.solo_tier, r.solo_rank, r.account_level, r.data_verified
      from public.riot_accounts r
      where r.profile_id = p.id
      order by r.data_verified desc, r.created_at asc
      limit 1
    ) ra on true
    where p.id <> v_profile
      and not p.is_demo
      and not exists (select 1 from public.team_members tm where tm.profile_id = p.id)
      and not exists (
        select 1 from public.team_invites i
        where i.team_id = v_team.id and i.invited_profile_id = p.id and i.status = 'pending'
      )
      and (
        v_query = ''
        or lower(p.handle) like '%' || v_query || '%'
        or lower(p.display_name) like '%' || v_query || '%'
      )
    order by
      (p.eligibility = 'eligible'
       and coalesce(ra.data_verified, false)
       and coalesce(ra.account_level, 0) >= 30
       and p.division_id is not distinct from v_team.division_id) desc,
      p.display_name asc
    limit v_limit
  ) q;

  return v_result;
end;
$$;

revoke all on function public.search_my_team_candidates(text, integer) from public, anon;
grant execute on function public.search_my_team_candidates(text, integer) to authenticated;
