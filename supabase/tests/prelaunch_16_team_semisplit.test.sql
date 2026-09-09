-- EloShape pre-launch Semi-Split stress test.
-- Runs four 16-team qualifiers, verifies Top-4 pass-down, builds a full
-- 16-team playoff, completes it, asserts scoring, then rolls everything back.
-- Safe to run against a privileged QA database: no fixture data persists.

begin;

create temp table qa16_summary (
  qualifiers_finalized integer,
  qualified_total integer,
  passdown_verified boolean,
  playoff_teams integer,
  playoff_matches integer,
  playoff_byes integer,
  playoff_completed boolean,
  champion_points integer
) on commit drop;

do $$
declare
  v_actor uuid := gen_random_uuid();
  v_run text := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_season uuid;
  v_division uuid;
  v_split uuid;
  v_team uuid;
  v_profile uuid;
  v_teams uuid[] := array[]::uuid[];
  v_entries uuid[];
  v_order integer[];
  v_seeds jsonb;
  v_matches jsonb;
  v_res jsonb;
  v_qualifier uuid;
  v_playoff uuid;
  v_match record;
  v_champion_entry uuid;
  v_champion_points integer;
  q integer;
  i integer;
  j integer;
  r integer;
  slot integer;
  team_idx integer;
  v_a uuid;
  v_b uuid;
  v_count integer;
  v_passdown boolean := true;
begin
  insert into public.user_roles(user_id, role) values (v_actor, 'admin');

  insert into public.seasons(slug, name, starts_at, ends_at, is_active)
  values ('qa16-' || v_run || '-season', 'QA16 Season ' || v_run, now() - interval '1 day', now() + interval '90 days', false)
  returning id into v_season;

  insert into public.divisions(code, name, sort_order, riot_tiers, accent)
  values (upper('Q' || substr(v_run, 1, 5)), 'QA16 Gold ' || v_run, 9999, array['GOLD'], 'gold')
  returning id into v_division;

  insert into public.competitive_splits(
    season_id, slug, name, division_id, starts_at, ends_at,
    status, playoff_size, qualification_slots_per_qualifier
  ) values (
    v_season, 'qa16-' || v_run || '-split', 'QA16 Semi-Split ' || v_run, v_division,
    now() - interval '1 hour', now() + interval '60 days',
    'qualifiers', 16, 4
  ) returning id into v_split;

  for i in 1..52 loop
    insert into public.teams(slug, name, tag, division_id)
    values (
      'qa16-' || v_run || '-team-' || lpad(i::text, 2, '0'),
      'QA16 ' || v_run || ' Team ' || lpad(i::text, 2, '0'),
      upper(substr(v_run, 1, 4)) || lpad(i::text, 2, '0'),
      v_division
    ) returning id into v_team;
    v_teams := array_append(v_teams, v_team);

    for j in 1..5 loop
      insert into public.profiles(handle, display_name, division_id, eligibility)
      values (
        'qa16-' || v_run || '-p-' || i || '-' || j,
        'QA16 ' || v_run || ' Player ' || i || '-' || j,
        v_division,
        'eligible'
      ) returning id into v_profile;

      insert into public.riot_accounts(
        profile_id, riot_id, platform, solo_tier, solo_rank,
        verified, data_verified, ownership_verified, verification_method,
        account_level, account_level_synced_at
      ) values (
        v_profile, 'QA16' || v_run || i || j || '#TST', 'la2', 'GOLD', 'IV',
        true, true, true, 'qa', 100, now()
      );

      insert into public.team_members(team_id, profile_id, role, is_captain)
      values (v_team, v_profile, 'player', j = 1);

      if j = 1 then
        update public.teams set captain_id = v_profile where id = v_team;
      end if;
    end loop;
  end loop;

  for q in 1..4 loop
    insert into public.tournaments(
      slug, name, division_id, season_id, split_id, qualifier_index,
      split_phase, status, format, mode, max_participants, participants_count,
      starts_at, checkin_required, required_roster_size, min_account_level, required_platform
    ) values (
      'qa16-' || v_run || '-qualifier-' || q, 'QA16 ' || v_run || ' Qualifier ' || q,
      v_division, v_season, v_split, q,
      'qualifier', 'registration_open', 'single_elimination', 'team', 16, 0,
      now() + (q || ' days')::interval, true, 5, 30, 'la2'
    ) returning id into v_qualifier;

    v_entries := array[]::uuid[];
    v_seeds := '[]'::jsonb;

    for i in 1..16 loop
      if q = 1 then
        team_idx := i;
      elsif i <= 4 then
        team_idx := i;
      else
        team_idx := 16 + ((q - 2) * 12) + (i - 4);
      end if;

      insert into public.tournament_entries(tournament_id, team_id, status, checked_in_at, seed)
      values (v_qualifier, v_teams[team_idx], 'checked_in', now(), i)
      returning id into v_a;

      v_entries := array_append(v_entries, v_a);
      v_seeds := v_seeds || jsonb_build_array(jsonb_build_object('entry_id', v_a, 'seed', i));
    end loop;

    v_res := private.lock_tournament_entries(v_actor, v_qualifier);
    if (v_res->>'entries')::int <> 16 or jsonb_array_length(v_res->'rejected') <> 0 then
      raise exception 'QA16 lock failed on qualifier %: %', q, v_res;
    end if;

    select count(*) into v_count from public.tournament_roster_members
    where tournament_id = v_qualifier;
    if v_count <> 80 then
      raise exception 'QA16 roster snapshot failed on qualifier %: % rows', q, v_count;
    end if;

    v_order := private.seed_order(16);
    v_matches := '[]'::jsonb;

    for slot in 0..7 loop
      v_a := v_entries[v_order[slot * 2 + 1]];
      v_b := v_entries[v_order[slot * 2 + 2]];
      v_matches := v_matches || jsonb_build_array(jsonb_build_object(
        'round_index', 0, 'bracket_slot', slot, 'round_label', private.round_label(0, 4),
        'best_of', 1, 'status', 'scheduled', 'entry_a_id', v_a, 'entry_b_id', v_b,
        'is_bye', false
      ));
    end loop;

    for r in 1..3 loop
      for slot in 0..((16 / (2 ^ (r + 1)))::int - 1) loop
        v_matches := v_matches || jsonb_build_array(jsonb_build_object(
          'round_index', r, 'bracket_slot', slot, 'round_label', private.round_label(r, 4),
          'best_of', 1, 'status', 'scheduled', 'is_bye', false
        ));
      end loop;
    end loop;

    v_res := private.create_bracket(v_actor, v_qualifier, v_seeds, v_matches);
    if v_res->>'status' <> 'generated' or (v_res->>'matches')::int <> 15 then
      raise exception 'QA16 bracket generation failed on qualifier %: %', q, v_res;
    end if;

    for r in 0..3 loop
      for v_match in
        select id, entry_a_id, entry_b_id, status from public.matches
        where tournament_id = v_qualifier and round_index = r order by bracket_slot
      loop
        if v_match.entry_a_id is null or v_match.entry_b_id is null then
          raise exception 'QA16 empty match in qualifier %, round %', q, r;
        end if;
        perform private.report_match_result(v_actor, v_match.id, 1, 0);
      end loop;
    end loop;

    v_res := private.finalize_tournament(v_actor, v_qualifier);
    if v_res->>'status' <> 'finalized' or (v_res->>'competitors')::int <> 16 then
      raise exception 'QA16 finalize failed on qualifier %: %', q, v_res;
    end if;
    if (v_res->'qualification'->>'assigned')::int <> 4 then
      raise exception 'QA16 qualification allocation failed on qualifier %: %', q, v_res->'qualification';
    end if;

    select count(*) into v_count from public.split_qualifications where split_id = v_split;
    if v_count <> q * 4 then
      raise exception 'QA16 qualification total after qualifier % is %, expected %', q, v_count, q * 4;
    end if;

    if q = 1 then
      select count(*) into v_count from public.split_qualifications
      where split_id = v_split and team_id = any(v_teams[1:4]);
      if v_count <> 4 then raise exception 'QA16 Q1 Top4 did not qualify as expected'; end if;
    else
      select count(*) into v_count from public.split_qualifications
      where split_id = v_split and qualified_from_tournament_id = v_qualifier
        and team_id = any(v_teams[1:4]);
      if v_count <> 0 then
        v_passdown := false;
        raise exception 'QA16 pass-down failed in Q%', q;
      end if;

      if q = 2 then
        select count(*) into v_count from public.split_qualifications
        where split_id = v_split and qualified_from_tournament_id = v_qualifier
          and team_id = any(v_teams[17:20]);
      elsif q = 3 then
        select count(*) into v_count from public.split_qualifications
        where split_id = v_split and qualified_from_tournament_id = v_qualifier
          and team_id = any(v_teams[29:32]);
      else
        select count(*) into v_count from public.split_qualifications
        where split_id = v_split and qualified_from_tournament_id = v_qualifier
          and team_id = any(v_teams[41:44]);
      end if;

      if v_count <> 4 then
        v_passdown := false;
        raise exception 'QA16 pass-down targets incorrect in Q%: found %', q, v_count;
      end if;
    end if;
  end loop;

  select count(*) into v_count from public.split_qualifications
  where split_id = v_split and status = 'qualified';
  if v_count <> 16 then raise exception 'QA16 final field is %, expected 16', v_count; end if;

  if exists (
    select 1 from public.split_qualifications where split_id = v_split
    group by team_id having count(*) > 1
  ) then raise exception 'QA16 duplicate qualified team detected'; end if;

  update public.competitive_splits set status = 'seeding' where id = v_split;
  v_res := private.generate_split_playoffs(v_actor, v_split, 1, false, null);
  if v_res->>'status' <> 'generated'
     or (v_res->>'teams')::int <> 16
     or (v_res->>'size')::int <> 16
     or (v_res->>'matches')::int <> 15
     or (v_res->>'byes')::int <> 0 then
    raise exception 'QA16 playoff generation failed: %', v_res;
  end if;

  v_playoff := (v_res->>'tournament_id')::uuid;

  select count(*) into v_count from public.split_qualifications
  where split_id = v_split and playoff_seed between 1 and 16;
  if v_count <> 16 then raise exception 'QA16 playoff seeds incomplete: %', v_count; end if;

  for r in 0..3 loop
    for v_match in
      select id, entry_a_id, entry_b_id, status from public.matches
      where tournament_id = v_playoff and round_index = r order by bracket_slot
    loop
      if v_match.entry_a_id is null or v_match.entry_b_id is null then
        raise exception 'QA16 empty playoff match in round %', r;
      end if;
      perform private.report_match_result(v_actor, v_match.id, 1, 0);
    end loop;
  end loop;

  v_res := private.finalize_tournament(v_actor, v_playoff);
  if v_res->>'status' <> 'finalized' or (v_res->>'competitors')::int <> 16 then
    raise exception 'QA16 playoff finalize failed: %', v_res;
  end if;

  v_champion_entry := (v_res->>'champion_entry_id')::uuid;
  select points_awarded into v_champion_points from public.tournament_entries
  where id = v_champion_entry;
  if v_champion_points <> 115 then
    raise exception 'QA16 playoff champion points %, expected 115', v_champion_points;
  end if;

  insert into qa16_summary values (
    4, 16, v_passdown,
    (select count(*) from public.tournament_entries where tournament_id = v_playoff),
    (select count(*) from public.matches where tournament_id = v_playoff),
    (select count(*) from public.matches where tournament_id = v_playoff and is_bye),
    (select status = 'completed' from public.tournaments where id = v_playoff),
    v_champion_points
  );
end $$;

select jsonb_build_object(
  'qualifiers_finalized', qualifiers_finalized,
  'qualified_total', qualified_total,
  'passdown_verified', passdown_verified,
  'playoff_teams', playoff_teams,
  'playoff_matches', playoff_matches,
  'playoff_byes', playoff_byes,
  'playoff_completed', playoff_completed,
  'champion_points', champion_points,
  'rollback', 'passed'
) as qa_result
from qa16_summary;

rollback;
