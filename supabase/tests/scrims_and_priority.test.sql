-- Scrim lifecycle + qualifier priority regression test.
-- Everything runs in one transaction and rolls back.

begin;

do $$
declare
  v_run text := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_user_a uuid := gen_random_uuid();
  v_user_b uuid := gen_random_uuid();
  v_profile uuid;
  v_captain_a uuid;
  v_captain_b uuid;
  v_team_a uuid;
  v_team_b uuid;
  v_division uuid;
  v_region uuid;
  v_season uuid;
  v_split uuid;
  v_tournament uuid;
  v_scrim uuid;
  v_challenge uuid;
  v_result jsonb;
  v_before integer;
  v_after integer;
  j integer;
begin
  raise notice '--- scrims + qualifier priority tests ---';

  select id into v_division from public.divisions where code='gold' limit 1;
  select id into v_region from public.regions where slug='rosario' limit 1;
  select id into v_season from public.seasons order by starts_at desc limit 1;

  if v_division is null or v_region is null or v_season is null then
    raise exception 'FAIL fixture: base division/region/season missing';
  end if;

  insert into public.teams(slug,name,tag,division_id,city_id)
  values ('zscrim-'||v_run||'-a','Z Scrim A '||v_run,'ZA'||upper(substr(v_run,1,2)),v_division,v_region)
  returning id into v_team_a;

  insert into public.teams(slug,name,tag,division_id,city_id)
  values ('zscrim-'||v_run||'-b','Z Scrim B '||v_run,'ZB'||upper(substr(v_run,1,2)),v_division,v_region)
  returning id into v_team_b;

  for j in 1..5 loop
    insert into public.profiles(
      user_id,handle,display_name,division_id,city_id,eligibility,is_demo,profile_completion
    ) values (
      case when j=1 then v_user_a else null end,
      'zscrim-'||v_run||'-a-'||j,
      'Z Scrim A '||j,
      v_division,v_region,'eligible',true,100
    ) returning id into v_profile;
    if j=1 then v_captain_a := v_profile; end if;

    insert into public.riot_accounts(
      profile_id,riot_id,platform,solo_tier,solo_rank,verified,data_verified,
      ownership_verified,verification_method,account_level,account_level_synced_at
    ) values (
      v_profile,'ZS'||v_run||'A'||j||'#TST','la2','GOLD','IV',
      true,true,true,'qa',100,now()
    );

    insert into public.team_members(team_id,profile_id,role,is_captain,lane_role)
    values (
      v_team_a,v_profile,'player',j=1,
      case j when 1 then 'top' when 2 then 'jungle' when 3 then 'mid'
             when 4 then 'bot' else 'support' end
    );

    insert into public.profiles(
      user_id,handle,display_name,division_id,city_id,eligibility,is_demo,profile_completion
    ) values (
      case when j=1 then v_user_b else null end,
      'zscrim-'||v_run||'-b-'||j,
      'Z Scrim B '||j,
      v_division,v_region,'eligible',true,100
    ) returning id into v_profile;
    if j=1 then v_captain_b := v_profile; end if;

    insert into public.riot_accounts(
      profile_id,riot_id,platform,solo_tier,solo_rank,verified,data_verified,
      ownership_verified,verification_method,account_level,account_level_synced_at
    ) values (
      v_profile,'ZS'||v_run||'B'||j||'#TST','la2','GOLD','IV',
      true,true,true,'qa',100,now()
    );

    insert into public.team_members(team_id,profile_id,role,is_captain,lane_role)
    values (
      v_team_b,v_profile,'player',j=1,
      case j when 1 then 'top' when 2 then 'jungle' when 3 then 'mid'
             when 4 then 'bot' else 'support' end
    );
  end loop;

  update public.teams set captain_id=v_captain_a where id=v_team_a;
  update public.teams set captain_id=v_captain_b where id=v_team_b;

  insert into public.competitive_splits(
    season_id,slug,name,division_id,region_id,starts_at,ends_at,status,
    playoff_size,qualification_slots_per_qualifier
  ) values (
    v_season,'zscrim-'||v_run||'-split','Z Scrim Split '||v_run,
    v_division,v_region,now(),now()+interval '30 days','qualifiers',16,4
  ) returning id into v_split;

  insert into public.split_qualifications(
    split_id,team_id,qualification_position,status
  ) values (v_split,v_team_a,1,'qualified');

  insert into public.tournaments(
    slug,name,division_id,region_id,season_id,split_id,qualifier_index,split_phase,
    status,format,mode,max_participants,participants_count,starts_at,
    registration_closes_at,qualified_teams_registration_opens_at,
    checkin_required,required_roster_size,min_account_level,required_platform
  ) values (
    'zscrim-'||v_run||'-q2','Z Priority Qualifier '||v_run,
    v_division,v_region,v_season,v_split,2,'qualifier',
    'registration_open','single_elimination','team',16,0,now()+interval '7 days',
    now()+interval '6 days',now()+interval '2 days',
    true,5,30,'la2'
  ) returning id into v_tournament;

  perform set_config('request.jwt.claim.sub',v_user_a::text,true);
  begin
    perform public.register_my_team_tournament('zscrim-'||v_run||'-q2');
    raise exception 'FAIL priority: qualified team registered during protected window';
  exception when others then
    if sqlerrm not like '%qualified_priority_window%' then raise; end if;
  end;
  raise notice 'ok  qualified team blocked during priority window';

  perform set_config('request.jwt.claim.sub',v_user_b::text,true);
  v_result := public.register_my_team_tournament('zscrim-'||v_run||'-q2');
  if v_result->>'status' <> 'registered' then
    raise exception 'FAIL priority: unqualified team could not register';
  end if;
  raise notice 'ok  unqualified team gets priority access';

  update public.tournaments
  set qualified_teams_registration_opens_at=now()-interval '1 minute'
  where id=v_tournament;

  perform set_config('request.jwt.claim.sub',v_user_a::text,true);
  v_result := public.register_my_team_tournament('zscrim-'||v_run||'-q2');
  if v_result->>'status' <> 'registered' then
    raise exception 'FAIL priority: qualified team could not enter after gate opened';
  end if;
  raise notice 'ok  qualified team can enter later when capacity remains';

  select count(*) into v_before
  from public.team_ranking_points
  where team_id in (v_team_a,v_team_b);

  v_result := public.create_my_scrim(
    now()+interval '2 hours',now()+interval '4 hours',3,'QA scrim'
  );
  v_scrim := (v_result->>'id')::uuid;

  perform set_config('request.jwt.claim.sub',v_user_b::text,true);
  v_result := public.challenge_scrim(v_scrim);
  v_challenge := (v_result->>'id')::uuid;

  perform set_config('request.jwt.claim.sub',v_user_a::text,true);
  v_result := public.respond_scrim_challenge(v_challenge,true);
  if v_result->>'status' <> 'matched' then raise exception 'FAIL scrim match'; end if;

  perform set_config('request.jwt.claim.sub',v_user_b::text,true);
  v_result := public.report_my_scrim_result(v_scrim,2,1);
  if v_result->>'status' <> 'completed' then raise exception 'FAIL scrim result'; end if;

  if (select status from public.scrim_posts where id=v_scrim) <> 'completed' then
    raise exception 'FAIL scrim persistence';
  end if;

  select count(*) into v_after
  from public.team_ranking_points
  where team_id in (v_team_a,v_team_b);

  if v_after <> v_before then
    raise exception 'FAIL scrim: official ranking ledger changed';
  end if;
  raise notice 'ok  scrim lifecycle completes with zero ranking impact';

  perform set_config('request.jwt.claim.sub','',true);
  raise notice '--- all scrim + priority tests passed ---';
end $$;

rollback;
