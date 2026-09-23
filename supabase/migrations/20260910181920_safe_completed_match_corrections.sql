-- Staff may correct a completed played result before tournament finalization.
-- Winner changes are allowed only while the derived next-round match is still
-- untouched, so the bracket can be repaired without rewriting played history.
create or replace function private.correct_completed_match_result(
  p_actor uuid,
  p_match uuid,
  p_score_a integer,
  p_score_b integer,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'private'
as $$
declare
  m record;
  t record;
  n record;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_old_winner uuid;
  v_old_loser uuid;
  v_new_winner uuid;
  v_new_loser uuid;
  v_winner_changed boolean;
  v_next_round integer;
  v_next_slot integer;
  v_next_id uuid;
  v_has_next boolean := false;
begin
  if not private.actor_is_staff(p_actor) then raise exception 'forbidden'; end if;
  if v_note is null or length(v_note) < 3 or length(v_note) > 1000 then
    raise exception 'correction_note_required';
  end if;

  select * into m from public.matches where id = p_match for update;
  if not found then raise exception 'match_not_found'; end if;
  if m.status <> 'completed'
     or m.winner_entry_id is null
     or m.entry_a_id is null
     or m.entry_b_id is null
     or m.is_bye
     or m.resolution_type <> 'played' then
    raise exception 'match_not_correctable';
  end if;

  select * into t from public.tournaments where id = m.tournament_id for update;
  if not found then raise exception 'tournament_not_found'; end if;
  if t.finalized_at is not null then raise exception 'tournament_finalized'; end if;
  if t.status not in ('live', 'registration_closed') then
    raise exception 'tournament_not_active';
  end if;
  if not private.match_score_valid(p_match, p_score_a, p_score_b) then
    raise exception 'invalid_score';
  end if;
  if m.score_a = p_score_a and m.score_b = p_score_b then
    raise exception 'result_unchanged';
  end if;

  v_old_winner := m.winner_entry_id;
  v_old_loser := case when v_old_winner = m.entry_a_id then m.entry_b_id else m.entry_a_id end;
  if p_score_a > p_score_b then
    v_new_winner := m.entry_a_id;
    v_new_loser := m.entry_b_id;
  else
    v_new_winner := m.entry_b_id;
    v_new_loser := m.entry_a_id;
  end if;
  v_winner_changed := v_new_winner <> v_old_winner;

  if v_winner_changed then
    v_next_round := m.round_index + 1;
    v_next_slot := m.bracket_slot / 2;
    select * into n
    from public.matches
    where tournament_id = m.tournament_id
      and round_index = v_next_round
      and bracket_slot = v_next_slot
    for update;
    v_has_next := found;

    if v_has_next then
      v_next_id := n.id;
      if m.bracket_slot % 2 = 0 then
        if n.entry_a_id is distinct from v_old_winner then
          raise exception 'advancement_conflict';
        end if;
      elsif n.entry_b_id is distinct from v_old_winner then
        raise exception 'advancement_conflict';
      end if;

      if n.status <> 'scheduled'
         or n.winner_entry_id is not null
         or n.score_a <> 0
         or n.score_b <> 0
         or n.is_bye
         or exists (
           select 1
           from public.match_result_claims c
           where c.match_id = n.id and c.status <> 'dismissed'
         )
         or exists (
           select 1 from public.match_players mp where mp.match_id = n.id
         ) then
        raise exception 'downstream_match_already_started';
      end if;

      if m.bracket_slot % 2 = 0 then
        update public.matches set entry_a_id = v_new_winner where id = n.id;
      else
        update public.matches set entry_b_id = v_new_winner where id = n.id;
      end if;
    end if;

    -- Lock both entry rows and verify the stored elimination state before
    -- reversing it. Any drift blocks the correction instead of guessing.
    perform 1
    from public.tournament_entries
    where id in (v_old_winner, v_old_loser)
    order by id
    for update;

    if (select eliminated_in_round from public.tournament_entries where id = v_old_winner) is not null
       or (select eliminated_in_round from public.tournament_entries where id = v_old_loser)
          is distinct from m.round_index then
      raise exception 'elimination_state_conflict';
    end if;

    update public.tournament_entries
    set eliminated_in_round = null
    where id = v_old_loser;

    update public.tournament_entries
    set eliminated_in_round = m.round_index
    where id = v_old_winner;

    update public.match_players
    set is_win = case
      when side = 'a' then v_new_winner = m.entry_a_id
      when side = 'b' then v_new_winner = m.entry_b_id
      else false
    end
    where match_id = m.id;
  end if;

  update public.matches
  set score_a = p_score_a,
      score_b = p_score_b,
      winner_entry_id = v_new_winner,
      resolution_note = v_note,
      resolved_by_user_id = p_actor,
      resolved_at = now()
  where id = m.id;

  update public.match_result_claims
  set score_a = p_score_a,
      score_b = p_score_b,
      status = 'resolved',
      resolved_by_user_id = p_actor,
      resolution_note = 'Corrected by staff: ' || v_note,
      resolved_at = now(),
      updated_at = now()
  where match_id = m.id and status in ('confirmed', 'resolved');

  update public.reports
  set status = 'resolved'
  where tournament_id = m.tournament_id
    and reason = 'match_result_dispute'
    and details like '%' || m.id::text || '%'
    and status in ('open', 'reviewing');

  perform private.audit(
    p_actor,
    'match_result_corrected',
    'match',
    m.id,
    jsonb_build_object(
      'tournament_id', m.tournament_id,
      'round_index', m.round_index,
      'bracket_slot', m.bracket_slot,
      'old_score_a', m.score_a,
      'old_score_b', m.score_b,
      'new_score_a', p_score_a,
      'new_score_b', p_score_b,
      'old_winner_entry_id', v_old_winner,
      'old_loser_entry_id', v_old_loser,
      'new_winner_entry_id', v_new_winner,
      'new_loser_entry_id', v_new_loser,
      'winner_changed', v_winner_changed,
      'downstream_match_id', v_next_id,
      'reason', v_note
    )
  );

  return jsonb_build_object(
    'status', 'corrected',
    'match_id', m.id,
    'winner_entry_id', v_new_winner,
    'winner_changed', v_winner_changed,
    'downstream_match_id', v_next_id
  );
end;
$$;

create or replace function public.staff_correct_match_result(
  p_match uuid,
  p_score_a integer,
  p_score_b integer,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not private.actor_is_staff(v_actor) then raise exception 'forbidden'; end if;
  return private.correct_completed_match_result(
    v_actor,
    p_match,
    p_score_a,
    p_score_b,
    p_note
  );
end;
$$;

revoke all on function private.correct_completed_match_result(uuid, uuid, integer, integer, text)
  from public, anon, authenticated;
revoke all on function public.staff_correct_match_result(uuid, integer, integer, text)
  from public, anon;
grant execute on function public.staff_correct_match_result(uuid, integer, integer, text)
  to authenticated, service_role;

comment on function public.staff_correct_match_result(uuid, integer, integer, text) is
  'Audited staff-only correction for a completed played result. Winner changes are blocked after downstream activity.';
