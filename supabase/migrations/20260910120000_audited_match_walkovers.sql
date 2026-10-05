-- Staff may advance a team after a documented no-show without recording a
-- played series or awarding match-win points. is_bye remains the existing
-- scoring exclusion flag; resolution_type distinguishes true byes from rulings.
alter table public.matches
  add column if not exists resolution_type text not null default 'played',
  add column if not exists resolution_note text,
  add column if not exists resolved_by_user_id uuid,
  add column if not exists resolved_at timestamptz;

update public.matches
set resolution_type = 'bye'
where is_bye and resolution_type = 'played';

do $$
begin
  alter table public.matches
    add constraint matches_resolution_type_check
    check (resolution_type in ('played', 'bye', 'walkover'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.matches
    add constraint matches_resolution_consistency_check
    check (
      (resolution_type = 'played' and not is_bye)
      or (resolution_type in ('bye', 'walkover') and is_bye)
    );
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.matches
    add constraint matches_walkover_note_check
    check (
      resolution_type <> 'walkover'
      or length(trim(coalesce(resolution_note, ''))) between 3 and 1000
    );
exception when duplicate_object then null;
end $$;

create or replace function private.normalize_match_resolution()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.resolution_type = 'walkover' then
    new.is_bye := true;
    new.score_a := 0;
    new.score_b := 0;
  elsif new.is_bye then
    new.resolution_type := 'bye';
  else
    new.resolution_type := 'played';
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_match_resolution on public.matches;
create trigger normalize_match_resolution
before insert or update of is_bye, resolution_type on public.matches
for each row execute function private.normalize_match_resolution();

create or replace function private.record_match_walkover(
  p_actor uuid,
  p_match uuid,
  p_winner_entry uuid,
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
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_loser uuid;
  v_next_round integer;
  v_next_slot integer;
  v_next_id uuid;
  v_next_a uuid;
  v_next_b uuid;
  v_has_next boolean := false;
begin
  if not private.actor_is_staff(p_actor) then raise exception 'forbidden'; end if;
  if v_note is null or length(v_note) < 3 or length(v_note) > 1000 then
    raise exception 'resolution_note_required';
  end if;

  select * into m from public.matches where id = p_match for update;
  if not found then raise exception 'match_not_found'; end if;
  if m.status not in ('scheduled', 'live') or m.winner_entry_id is not null or m.is_bye then
    raise exception 'match_not_reportable';
  end if;
  if m.entry_a_id is null or m.entry_b_id is null then raise exception 'match_not_reportable'; end if;
  if p_winner_entry not in (m.entry_a_id, m.entry_b_id) then raise exception 'invalid_winner'; end if;

  select * into t from public.tournaments where id = m.tournament_id for update;
  if not found then raise exception 'tournament_not_found'; end if;
  if t.finalized_at is not null then raise exception 'tournament_finalized'; end if;
  if t.status not in ('live', 'registration_closed') then raise exception 'tournament_not_active'; end if;

  v_loser := case when p_winner_entry = m.entry_a_id then m.entry_b_id else m.entry_a_id end;

  update public.matches
  set score_a = 0,
      score_b = 0,
      winner_entry_id = p_winner_entry,
      status = 'completed',
      is_bye = true,
      resolution_type = 'walkover',
      resolution_note = v_note,
      resolved_by_user_id = p_actor,
      resolved_at = now()
  where id = m.id;

  update public.tournament_entries
  set eliminated_in_round = m.round_index
  where id = v_loser and eliminated_in_round is null;

  v_next_round := m.round_index + 1;
  v_next_slot := m.bracket_slot / 2;
  select id, entry_a_id, entry_b_id
  into v_next_id, v_next_a, v_next_b
  from public.matches
  where tournament_id = m.tournament_id
    and round_index = v_next_round
    and bracket_slot = v_next_slot
  for update;
  v_has_next := found;

  if v_has_next then
    if m.bracket_slot % 2 = 0 then
      if v_next_a is not null and v_next_a <> p_winner_entry then
        raise exception 'advancement_conflict';
      end if;
      update public.matches set entry_a_id = p_winner_entry where id = v_next_id;
    else
      if v_next_b is not null and v_next_b <> p_winner_entry then
        raise exception 'advancement_conflict';
      end if;
      update public.matches set entry_b_id = p_winner_entry where id = v_next_id;
    end if;
  end if;

  update public.match_result_claims
  set status = 'dismissed',
      resolved_by_user_id = p_actor,
      resolution_note = 'Superseded by walkover ruling: ' || v_note,
      resolved_at = now(),
      updated_at = now()
  where match_id = m.id and status in ('pending_confirmation', 'disputed');

  update public.reports
  set status = 'dismissed'
  where tournament_id = m.tournament_id
    and reason = 'match_result_dispute'
    and details like '%' || m.id::text || '%'
    and status in ('open', 'reviewing');

  perform private.audit(
    p_actor,
    'match_walkover_recorded',
    'match',
    m.id,
    jsonb_build_object(
      'tournament_id', m.tournament_id,
      'round_index', m.round_index,
      'bracket_slot', m.bracket_slot,
      'winner_entry_id', p_winner_entry,
      'loser_entry_id', v_loser,
      'reason', v_note
    )
  );

  return jsonb_build_object(
    'status', 'completed',
    'resolution_type', 'walkover',
    'match_id', m.id,
    'winner_entry_id', p_winner_entry,
    'advanced_to', case when not v_has_next then null else jsonb_build_object(
      'round_index', v_next_round,
      'bracket_slot', v_next_slot,
      'slot', case when m.bracket_slot % 2 = 0 then 'A' else 'B' end
    ) end
  );
end;
$$;

create or replace function public.staff_record_match_walkover(
  p_match uuid,
  p_winner_entry uuid,
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
  return private.record_match_walkover(v_actor, p_match, p_winner_entry, p_note);
end;
$$;

revoke all on function private.normalize_match_resolution() from public;
revoke all on function private.record_match_walkover(uuid, uuid, uuid, text) from public;
revoke all on function public.staff_record_match_walkover(uuid, uuid, text) from public, anon;
grant execute on function public.staff_record_match_walkover(uuid, uuid, text) to authenticated, service_role;
