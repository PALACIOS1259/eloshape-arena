create or replace function private.report_match_result(p_actor uuid, p_match uuid,
  p_score_a integer, p_score_b integer)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare m record; t record; v_needed integer; v_winner uuid; v_loser uuid;
  v_next_round integer; v_next_slot integer; nm record; v_has_next boolean := false;
  v_next_id uuid; v_next_a uuid; v_next_b uuid;
begin
  if not private.actor_is_staff(p_actor) then raise exception 'forbidden'; end if;

  select * into m from public.matches where id = p_match for update;
  if not found then raise exception 'match_not_found'; end if;
  if m.status = 'completed' or m.winner_entry_id is not null then
    raise exception 'match_not_reportable';
  end if;
  if m.status = 'cancelled' or m.is_bye then raise exception 'match_not_reportable'; end if;
  if m.entry_a_id is null or m.entry_b_id is null then raise exception 'match_not_reportable'; end if;

  select * into t from public.tournaments where id = m.tournament_id;
  if t.finalized_at is not null then raise exception 'tournament_finalized'; end if;
  if t.status not in ('live','registration_closed') then raise exception 'tournament_not_active'; end if;

  v_needed := (m.best_of / 2) + 1;
  if p_score_a < 0 or p_score_b < 0 then raise exception 'invalid_score'; end if;
  if p_score_a + p_score_b > m.best_of then raise exception 'invalid_score'; end if;
  if greatest(p_score_a, p_score_b) <> v_needed then raise exception 'invalid_score'; end if;
  if p_score_a = p_score_b then raise exception 'invalid_score'; end if;

  if p_score_a > p_score_b then
    v_winner := m.entry_a_id; v_loser := m.entry_b_id;
  else
    v_winner := m.entry_b_id; v_loser := m.entry_a_id;
  end if;

  update public.matches
    set score_a = p_score_a, score_b = p_score_b, winner_entry_id = v_winner, status = 'completed'
    where id = m.id;

  update public.tournament_entries
    set eliminated_in_round = m.round_index
    where id = v_loser and eliminated_in_round is null;

  v_next_round := m.round_index + 1;
  v_next_slot := m.bracket_slot / 2;
  select id, entry_a_id, entry_b_id into v_next_id, v_next_a, v_next_b
    from public.matches
    where tournament_id = m.tournament_id and round_index = v_next_round and bracket_slot = v_next_slot
    for update;
  v_has_next := found;

  if v_has_next then
    if m.bracket_slot % 2 = 0 then
      if v_next_a is not null and v_next_a <> v_winner then raise exception 'advancement_conflict'; end if;
      update public.matches set entry_a_id = v_winner where id = v_next_id;
    else
      if v_next_b is not null and v_next_b <> v_winner then raise exception 'advancement_conflict'; end if;
      update public.matches set entry_b_id = v_winner where id = v_next_id;
    end if;
  end if;

  perform private.audit(p_actor, 'match_result_reported', 'match', m.id,
    jsonb_build_object('tournament_id', m.tournament_id, 'round_index', m.round_index,
      'bracket_slot', m.bracket_slot, 'score_a', p_score_a, 'score_b', p_score_b,
      'winner_entry_id', v_winner));

  return jsonb_build_object('status','completed','match_id', m.id, 'winner_entry_id', v_winner,
    'advanced_to', case when not v_has_next then null else
      jsonb_build_object('round_index', v_next_round, 'bracket_slot', v_next_slot,
        'slot', case when m.bracket_slot % 2 = 0 then 'A' else 'B' end) end);
end $$;

revoke all on function private.report_match_result(uuid, uuid, integer, integer) from public;
