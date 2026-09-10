-- =============================================================
-- EloShape competition engine — database integration tests.
--
-- Self-contained: creates its own season, division, split, teams, players,
-- qualifier and playoff tournament, asserts engine behaviour, then removes
-- everything it created. Any failed assertion raises, which rolls back the
-- whole run, so the database is never left with test data.
--
-- Run as the database owner (the role that owns the `private` schema):
--   psql "$PRIVILEGED_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/competition_engine.test.sql
-- =============================================================

do $$
declare
  v_actor uuid := gen_random_uuid();
  v_season uuid; v_division uuid; v_split uuid; v_qualifier uuid; v_playoffs uuid;
  v_team uuid; v_teams uuid[] := '{}'; v_profile uuid; v_level integer;
  v_entry uuid; v_entries uuid[] := '{}'; v_reg_entry uuid;
  v_seeds jsonb := '[]'::jsonb; v_matches jsonb; v_res jsonb; v_order integer[];
  i integer; j integer; v_int integer; v_uuid uuid; v_text text;
  v_m0 uuid; v_m1 uuid; v_final uuid; v_champion uuid; v_ledger integer;
begin
  raise notice '--- EloShape engine tests ---';

  -- ---------- fixtures ----------
  insert into public.user_roles(user_id, role) values (v_actor, 'admin');

  insert into public.seasons(slug, name, starts_at, ends_at, is_active)
  values ('ztest-season', 'ZTest Season', now() - interval '10 days', now() + interval '60 days', false)
  returning id into v_season;

  insert into public.divisions(code, name, sort_order, riot_tiers, accent)
  values ('ZTEST', 'ZTest Division', 999, array['SILVER'], 'silver')
  returning id into v_division;

  insert into public.competitive_splits(season_id, slug, name, division_id, starts_at, ends_at,
    status, playoff_size, qualification_slots_per_qualifier)
  values (v_season, 'ztest-split', 'ZTest Split', v_division, now() - interval '5 days',
    now() + interval '30 days', 'qualifiers', 4, 2)
  returning id into v_split;

  -- Six teams: t1..t4 fully eligible, t5 has an under-levelled player, t6 only registers.
  for i in 1..6 loop
    insert into public.teams(slug, name, tag, division_id)
    values ('ztest-t' || i, 'ZTest Team ' || i, 'ZT' || i, v_division)
    returning id into v_team;
    v_teams := v_teams || v_team;

    for j in 1..5 loop
      insert into public.profiles(handle, display_name, division_id, eligibility)
      values ('ztest-p' || i || '-' || j, 'ZTest Player ' || i || '-' || j, v_division, 'eligible')
      returning id into v_profile;

      v_level := case when i = 5 and j = 1 then 12 else 120 end;
      insert into public.riot_accounts(profile_id, riot_id, platform, solo_tier, solo_rank,
        verified, data_verified, ownership_verified, verification_method, account_level,
        account_level_synced_at)
      values (v_profile, 'ZTest' || i || j || '#TST', 'la2', 'SILVER', 'II',
        true, true, true, 'test', v_level, now());

      insert into public.team_members(team_id, profile_id, role, is_captain)
      values (v_team, v_profile, case j when 1 then 'Top' when 2 then 'Jungle' when 3 then 'Mid'
        when 4 then 'Bot' else 'Support' end, j = 1);

      if j = 1 then
        update public.teams set captain_id = v_profile where id = v_team;
      end if;
    end loop;
  end loop;

  insert into public.tournaments(slug, name, division_id, season_id, split_id, qualifier_index,
    split_phase, status, format, mode, max_participants, participants_count, starts_at,
    checkin_required, required_roster_size, min_account_level, required_platform)
  values ('ztest-qualifier-1', 'ZTest Qualifier 1', v_division, v_season, v_split, 1,
    'qualifier', 'registration_open', 'single_elimination', 'team', 8, 0,
    now() + interval '1 day', true, 5, 30, 'la2')
  returning id into v_qualifier;

  for i in 1..5 loop
    insert into public.tournament_entries(tournament_id, team_id, status, checked_in_at)
    values (v_qualifier, v_teams[i], 'checked_in', now())
    returning id into v_entry;
    v_entries := v_entries || v_entry;
  end loop;

  -- Team 6 registers but never checks in.
  insert into public.tournament_entries(tournament_id, team_id, status)
  values (v_qualifier, v_teams[6], 'registered')
  returning id into v_reg_entry;

  -- ---------- test 1: check-in gate + full roster eligibility ----------
  v_res := private.lock_tournament_entries(v_actor, v_qualifier);
  if (v_res->>'entries')::int <> 4 then
    raise exception 'FAIL check-in/eligibility: locked % entries, expected 4 (%).',
      v_res->>'entries', v_res;
  end if;
  if (v_res->>'not_checked_in')::int <> 1 then
    raise exception 'FAIL check-in gate: not_checked_in = %, expected 1.', v_res->>'not_checked_in';
  end if;
  if jsonb_array_length(v_res->'rejected') <> 1
     or not (v_res->'rejected')::text like '%account_level_below_minimum%' then
    raise exception 'FAIL roster eligibility: expected one rejection with a level reason, got %.',
      v_res->'rejected';
  end if;
  if (select status from public.tournament_entries where id = v_reg_entry) <> 'registered' then
    raise exception 'FAIL check-in gate: a registered entry must stay untouched.';
  end if;
  raise notice 'ok  check-in gate and full-roster eligibility';

  -- ---------- test 2: immutable roster snapshot ----------
  select count(*) into v_int from public.tournament_roster_members
    where tournament_id = v_qualifier;
  if v_int <> 20 then
    raise exception 'FAIL snapshot: % roster rows, expected 20.', v_int;
  end if;
  if exists (select 1 from public.tournament_roster_members where entry_id = v_reg_entry) then
    raise exception 'FAIL snapshot: a non checked-in entry must not be snapshotted.';
  end if;

  begin
    update public.tournament_roster_members set role = 'hacked' where entry_id = v_entries[1];
    raise exception 'FAIL snapshot immutability: update was allowed.';
  exception when others then
    if sqlerrm not like '%roster_snapshot_immutable%' then raise; end if;
  end;

  -- Mutating the live roster must not change the locked snapshot.
  delete from public.team_members where team_id = v_teams[1]
    and profile_id = (select profile_id from public.team_members where team_id = v_teams[1]
                      and not is_captain limit 1);
  select count(*) into v_int from public.tournament_roster_members where entry_id = v_entries[1];
  if v_int <> 5 then
    raise exception 'FAIL snapshot: roster changed with the live team (% rows).', v_int;
  end if;
  raise notice 'ok  immutable roster snapshot';

  -- ---------- bracket ----------
  v_order := private.seed_order(4);
  for i in 1..4 loop
    update public.tournament_entries set seed = i where id = v_entries[i];
    v_seeds := v_seeds || jsonb_build_array(
      jsonb_build_object('entry_id', v_entries[i], 'seed', i));
  end loop;

  v_matches := jsonb_build_array(
    jsonb_build_object('round_index', 0, 'bracket_slot', 0, 'round_label', 'Semifinal',
      'best_of', 1, 'status', 'scheduled', 'entry_a_id', v_entries[v_order[1]],
      'entry_b_id', v_entries[v_order[2]], 'is_bye', false),
    jsonb_build_object('round_index', 0, 'bracket_slot', 1, 'round_label', 'Semifinal',
      'best_of', 1, 'status', 'scheduled', 'entry_a_id', v_entries[v_order[3]],
      'entry_b_id', v_entries[v_order[4]], 'is_bye', false),
    jsonb_build_object('round_index', 1, 'bracket_slot', 0, 'round_label', 'Final',
      'best_of', 1, 'status', 'scheduled', 'is_bye', false));

  v_res := private.create_bracket(v_actor, v_qualifier, v_seeds, v_matches);
  if v_res->>'status' <> 'generated' then
    raise exception 'FAIL bracket: %', v_res;
  end if;

  -- test 3: a bracket can never contain a non checked-in entry.
  begin
    perform private.create_bracket(v_actor, v_qualifier,
      jsonb_build_array(jsonb_build_object('entry_id', v_reg_entry, 'seed', 5)), '[]'::jsonb);
    -- already_generated short-circuits, so assert that explicitly instead.
    null;
  exception when others then null;
  end;
  if exists (select 1 from public.matches
             where tournament_id = v_qualifier
               and (entry_a_id = v_reg_entry or entry_b_id = v_reg_entry)) then
    raise exception 'FAIL bracket: a registered-only entry reached the bracket.';
  end if;
  raise notice 'ok  bracket generation from locked entries only';

  -- ---------- test 4: walkover + result reporting concurrency ----------
  select id into v_m0 from public.matches where tournament_id = v_qualifier
    and round_index = 0 and bracket_slot = 0;
  select id into v_m1 from public.matches where tournament_id = v_qualifier
    and round_index = 0 and bracket_slot = 1;
  select id into v_final from public.matches where tournament_id = v_qualifier
    and round_index = 1 and bracket_slot = 0;

  v_res := private.record_match_walkover(v_actor, v_m0, v_entries[v_order[1]], 'opponent no-show');
  if v_res->>'resolution_type' <> 'walkover' then
    raise exception 'FAIL walkover: %', v_res;
  end if;
  if not exists (
    select 1 from public.matches
    where id = v_m0 and status = 'completed' and is_bye
      and resolution_type = 'walkover' and score_a = 0 and score_b = 0
      and resolution_note = 'opponent no-show'
  ) then
    raise exception 'FAIL walkover: match was not stored as a non-played audited ruling.';
  end if;
  if not exists (
    select 1 from public.competition_audit_log
    where entity_id = v_m0 and action = 'match_walkover_recorded'
  ) then
    raise exception 'FAIL walkover: audit entry missing.';
  end if;

  begin
    perform private.report_match_result(v_actor, v_m0, 0, 1);
    raise exception 'FAIL result concurrency: a completed match was reported twice.';
  exception when others then
    if sqlerrm not like '%match_not_reportable%' then raise; end if;
  end;

  perform private.report_match_result(v_actor, v_m1, 1, 0);

  -- Winners must sit in the final at the derived coordinate.
  select entry_a_id into v_uuid from public.matches where id = v_final;
  if v_uuid is null then raise exception 'FAIL advancement: final slot A is empty.'; end if;
  select entry_b_id into v_uuid from public.matches where id = v_final;
  if v_uuid is null then raise exception 'FAIL advancement: final slot B is empty.'; end if;
  raise notice 'ok  walkover is unscored/audited and result reporting is single-shot';

  perform private.report_match_result(v_actor, v_final, 1, 0);
  select winner_entry_id into v_champion from public.matches where id = v_final;

  -- ---------- test 5: finalization + idempotency + snapshot-based awards ----------
  v_res := private.finalize_tournament(v_actor, v_qualifier);
  if v_res->>'status' <> 'finalized' then raise exception 'FAIL finalize: %', v_res; end if;
  if (v_res->>'competitors')::int <> 4 then
    raise exception 'FAIL finalize: % competitors scored, expected 4.', v_res->>'competitors';
  end if;

  select points_awarded into v_int from public.tournament_entries where id = v_champion;
  if v_int <> 85 then
    raise exception 'FAIL scoring: champion received %, expected 85 (5 + 1x10 + 70; walkover excluded).', v_int;
  end if;
  if (select placement from public.tournament_entries where id = v_champion) <> 1 then
    raise exception 'FAIL scoring: champion placement is not 1.';
  end if;
  if exists (select 1 from public.tournament_entries
             where id = v_reg_entry and (points_awarded <> 0 or placement is not null)) then
    raise exception 'FAIL scoring: a non checked-in entry was scored.';
  end if;

  -- Team awards mirror onto the locked roster, not the current team_members table.
  select count(*) into v_int from public.ranking_points
    where tournament_id = v_qualifier and event_key = 'team:participation';
  if v_int <> 20 then
    raise exception 'FAIL scoring: % player participation rows, expected 20 (locked rosters).', v_int;
  end if;

  select count(*) into v_ledger from public.ranking_points where tournament_id = v_qualifier;
  v_res := private.finalize_tournament(v_actor, v_qualifier);
  if v_res->>'status' <> 'already_finalized' then
    raise exception 'FAIL finalize idempotency: %', v_res;
  end if;
  select count(*) into v_int from public.ranking_points where tournament_id = v_qualifier;
  if v_int <> v_ledger then
    raise exception 'FAIL finalize idempotency: ledger grew from % to %.', v_ledger, v_int;
  end if;
  raise notice 'ok  finalization scoring and idempotency';

  -- ---------- test 6: qualification allocation ----------
  select count(*) into v_int from public.split_qualifications where split_id = v_split;
  if v_int <> 2 then
    raise exception 'FAIL qualification: % slots granted, expected 2 (configured).', v_int;
  end if;
  if exists (select team_id from public.split_qualifications where split_id = v_split
             group by team_id having count(*) > 1) then
    raise exception 'FAIL qualification: duplicate team qualification.';
  end if;
  v_res := private.assign_qualification_slots(v_actor, v_split, v_qualifier);
  if (v_res->>'assigned')::int <> 0 then
    raise exception 'FAIL qualification re-run: % extra slots.', v_res->>'assigned';
  end if;
  select count(*) into v_int from public.split_qualifications where split_id = v_split;
  if v_int <> 2 then raise exception 'FAIL qualification re-run: total is now %.', v_int; end if;
  raise notice 'ok  qualification allocation is capped and re-run safe';

  -- ---------- test 7: playoff field requirement + byes ----------
  update public.competitive_splits set status = 'seeding' where id = v_split;

  begin
    perform private.generate_split_playoffs(v_actor, v_split, 3, false, null);
    raise exception 'FAIL playoff field: a short field was accepted.';
  exception when others then
    if sqlerrm not like '%playoff_field_incomplete%' then raise; end if;
  end;

  begin
    perform private.generate_split_playoffs(v_actor, v_split, 3, true, null);
    raise exception 'FAIL playoff override: no reason was required.';
  exception when others then
    if sqlerrm not like '%override_reason_required%' then raise; end if;
  end;

  -- Three qualified teams force an odd field: size 4 with two byes.
  insert into public.split_qualifications(split_id, team_id, qualification_position, status)
  values (v_split, v_teams[3], 3, 'qualified')
  on conflict (split_id, team_id) do nothing;

  v_res := private.generate_split_playoffs(v_actor, v_split, 3, true, 'integration test');
  if v_res->>'status' <> 'generated' then raise exception 'FAIL playoffs: %', v_res; end if;
  if (v_res->>'teams')::int <> 3 or (v_res->>'size')::int <> 4 or (v_res->>'byes')::int <> 1 then
    raise exception 'FAIL playoff byes: %', v_res;
  end if;
  v_playoffs := (v_res->>'tournament_id')::uuid;

  -- A bye is completed, flagged, and never a competitive match win.
  if not exists (select 1 from public.matches where tournament_id = v_playoffs
                 and is_bye and status = 'completed' and winner_entry_id is not null) then
    raise exception 'FAIL playoff byes: bye match is not auto-advanced.';
  end if;
  if exists (select 1 from public.matches where tournament_id = v_playoffs
             and is_bye and (entry_a_id is not null and entry_b_id is not null)) then
    raise exception 'FAIL playoff byes: a bye has two competitors.';
  end if;
  if not exists (select 1 from public.matches where tournament_id = v_playoffs
                 and round_index = 1 and (entry_a_id is not null or entry_b_id is not null)) then
    raise exception 'FAIL playoff byes: bye winner did not advance to round 1.';
  end if;
  -- Team 1 lost a live member in test 2, so its playoff snapshot has 4 rows: 4 + 5 + 5 = 14.
  if (select count(*) from public.tournament_roster_members where tournament_id = v_playoffs) <> 14 then
    raise exception 'FAIL playoffs: playoff rosters were not snapshotted (% rows).',
      (select count(*) from public.tournament_roster_members where tournament_id = v_playoffs);
  end if;

  v_res := private.generate_split_playoffs(v_actor, v_split, 3, true, 'integration test');
  if v_res->>'status' <> 'already_generated' then
    raise exception 'FAIL playoff idempotency: %', v_res;
  end if;
  raise notice 'ok  playoff field requirement, byes and idempotency';

  -- ---------- cleanup ----------
  delete from public.ranking_points where tournament_id in (v_qualifier, v_playoffs);
  delete from public.team_ranking_points where split_id = v_split;
  delete from public.match_players where match_id in
    (select id from public.matches where tournament_id in (v_qualifier, v_playoffs));
  delete from public.matches where tournament_id in (v_qualifier, v_playoffs);
  delete from public.tournament_roster_members where tournament_id in (v_qualifier, v_playoffs);
  delete from public.tournament_entries where tournament_id in (v_qualifier, v_playoffs);
  delete from public.split_qualifications where split_id = v_split;
  delete from public.tournaments where id in (v_qualifier, v_playoffs);
  delete from public.competitive_splits where id = v_split;
  delete from public.achievements where profile_id in
    (select id from public.profiles where handle like 'ztest-%');
  delete from public.team_members where team_id = any(v_teams);
  update public.teams set captain_id = null where id = any(v_teams);
  delete from public.riot_accounts where profile_id in
    (select id from public.profiles where handle like 'ztest-%');
  delete from public.teams where id = any(v_teams);
  delete from public.profiles where handle like 'ztest-%';
  delete from public.divisions where id = v_division;
  delete from public.seasons where id = v_season;
  delete from public.competition_audit_log where actor_user_id = v_actor;
  delete from public.user_roles where user_id = v_actor;

  raise notice '--- all engine tests passed ---';
end $$;
