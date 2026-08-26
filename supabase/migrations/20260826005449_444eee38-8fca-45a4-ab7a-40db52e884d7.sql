create or replace function private.player_eligibility_reasons(p_profile uuid, p_tournament uuid)
returns text[] language plpgsql stable security definer set search_path = public, private as $$
declare pr record; ra record; t record; d record; v text[] := '{}'; v_min integer := 30;
begin
  if p_profile is null then return array['profile_missing']; end if;
  select * into pr from public.profiles where id = p_profile;
  if pr.id is null then return array['profile_missing']; end if;

  -- Always assign the tournament record so field access stays defined even for
  -- generic (tournament-agnostic) checks.
  select * into t from public.tournaments where p_tournament is not null and id = p_tournament;
  if t.id is not null then v_min := coalesce(t.min_account_level, 30); end if;

  if pr.eligibility <> 'eligible' then
    v := v || ('eligibility:' || pr.eligibility::text);
  end if;

  select * into ra from public.riot_accounts
    where profile_id = p_profile
    order by ownership_verified desc, data_verified desc, created_at asc
    limit 1;

  if ra.id is null then
    v := v || 'riot_account_missing';
  else
    if ra.solo_tier is null or not ra.data_verified then v := v || 'riot_rank_unverified'; end if;
    if coalesce(ra.account_level, 0) < v_min then v := v || 'account_level_below_minimum'; end if;
    if t.required_platform is not null and lower(coalesce(ra.platform,'')) <> lower(t.required_platform) then
      v := v || 'platform_mismatch';
    end if;
    if t.division_id is not null and ra.solo_tier is not null then
      select * into d from public.divisions where id = t.division_id;
      if d.id is not null and not (upper(ra.solo_tier) in (select upper(x) from unnest(d.riot_tiers) x)) then
        v := v || 'division_mismatch';
      end if;
    end if;
  end if;

  return v;
end $$;

revoke all on function private.player_eligibility_reasons(uuid, uuid) from public;