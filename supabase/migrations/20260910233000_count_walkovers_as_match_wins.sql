-- Walkovers are competitive wins for EloShape scoring.
-- Automatic bracket byes still advance a team without awarding match-win points.
--
-- The walkover migration intentionally stores both byes and walkovers with
-- is_bye = true so existing bracket/advancement behavior remains safe. Scoring
-- must therefore use resolution_type instead of is_bye to distinguish them.

create or replace function private.finalize_tournament(p_actor uuid, p_tournament uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare t record; v_rounds integer; v_final record; v_champion uuid; e record;
  v_participation integer; v_match_win integer; v_phase text; v_phase_points integer;
  v_wins integer; v_placement integer; i integer; v_awarded integer := 0; v_qual jsonb;
begin
  if not private.actor_is_staff(p_actor) then raise exception 'forbidden'; end if;
  select * into t from public.tournaments where id = p_tournament for update;
  if t is null then raise exception 'tournament_not_found'; end if;
  if t.finalized_at is not null then
    return jsonb_build_object('status','already_finalized','tournament_id', t.id);
  end if;

  select coalesce(max(round_index) + 1, 0) into v_rounds from public.matches where tournament_id = t.id;
  if v_rounds = 0 then raise exception 'bracket_missing'; end if;

  select * into v_final from public.matches
    where tournament_id = t.id and round_index = v_rounds - 1 and bracket_slot = 0;
  if v_final is null or v_final.status <> 'completed' or v_final.winner_entry_id is null then
    raise exception 'final_not_completed';
  end if;
  if exists (select 1 from public.matches where tournament_id = t.id
             and status not in ('completed','cancelled') and entry_a_id is not null and entry_b_id is not null) then
    raise exception 'matches_pending';
  end if;
  v_champion := v_final.winner_entry_id;

  select points into v_participation from public.point_rules where code = 'participation';
  select points into v_match_win from public.point_rules where code = 'match_win';
  v_participation := coalesce(v_participation, 0);
  v_match_win := coalesce(v_match_win, 0);

  for e in
    select te.* from public.tournament_entries te
    where te.tournament_id = t.id and te.status <> 'withdrawn'
      and exists (select 1 from public.matches m where m.tournament_id = t.id
                  and (m.entry_a_id = te.id or m.entry_b_id = te.id))
  loop
    select count(*) into v_wins from public.matches m
      where m.tournament_id = t.id
        and m.status = 'completed'
        and m.resolution_type in ('played', 'walkover')
        and m.winner_entry_id = e.id;

    if e.id = v_champion then v_phase := 'champion'; v_placement := 1;
    elsif e.eliminated_in_round = v_rounds - 1 then v_phase := 'runner_up'; v_placement := 2;
    elsif e.eliminated_in_round = v_rounds - 2 then v_phase := 'semifinal'; v_placement := 3;
    elsif e.eliminated_in_round = v_rounds - 3 then v_phase := 'quarterfinal'; v_placement := 5;
    else v_phase := null; v_placement := 9;
    end if;

    v_phase_points := 0;
    if v_phase is not null then
      select coalesce(points, 0) into v_phase_points from public.point_rules where code = v_phase;
      v_phase_points := coalesce(v_phase_points, 0);
    end if;

    perform private.award_entry(e.id, 'participation', v_participation, 'participation',
      t.name || ' — participation');
    for i in 1..v_wins loop
      perform private.award_entry(e.id, 'match_win', v_match_win, 'match_win:' || i,
        t.name || ' — series win ' || i);
    end loop;
    if v_phase is not null then
      perform private.award_entry(e.id, v_phase, v_phase_points, 'phase:' || v_phase,
        t.name || ' — ' || v_phase);
    end if;

    update public.tournament_entries
      set placement = v_placement,
          points_awarded = v_participation + (v_wins * v_match_win) + v_phase_points
      where id = e.id;

    if e.profile_id is not null then perform private.recompute_profile_stats(e.profile_id); end if;
    if e.team_id is not null then
      perform private.recompute_team_stats(e.team_id);
      perform private.recompute_profile_stats(tm.profile_id) from public.team_members tm
        where tm.team_id = e.team_id;
    end if;
    v_awarded := v_awarded + 1;
  end loop;

  update public.tournaments
    set finalized_at = now(), status = 'completed'
    where id = t.id;

  v_qual := null;
  if t.split_id is not null and t.qualifier_index is not null then
    v_qual := private.assign_qualification_slots(p_actor, t.split_id, t.id);
  end if;

  perform private.audit(p_actor, 'tournament_finalized', 'tournament', t.id,
    jsonb_build_object('competitors', v_awarded, 'champion_entry_id', v_champion,
      'qualification', v_qual));

  return jsonb_build_object('status','finalized','competitors', v_awarded,
    'champion_entry_id', v_champion, 'qualification', v_qual);
end $$;

revoke all on function private.finalize_tournament(uuid, uuid) from public;
