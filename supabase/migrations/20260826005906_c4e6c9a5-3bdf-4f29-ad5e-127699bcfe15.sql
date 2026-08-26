create or replace function private.assign_qualification_slots(p_actor uuid, p_split uuid,
  p_tournament uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare v_rec record; v_assigned integer := 0; v_next_pos integer; v_slots integer;
  v_used integer := 0; v_id uuid; v_skipped jsonb := '[]'::jsonb; v_elig jsonb;
begin
  -- Serialize all qualification writes for this split, whatever tournament closes.
  perform pg_advisory_xact_lock(hashtextextended('split_qualification:' || p_split::text, 0));

  select coalesce(qualification_slots_per_qualifier, 4) into v_slots
    from public.competitive_splits where id = p_split;
  v_slots := coalesce(v_slots, 4);

  -- Slots are per qualifier: whatever this tournament already granted counts.
  select count(*) into v_used from public.split_qualifications
    where split_id = p_split and qualified_from_tournament_id = p_tournament;

  select coalesce(max(qualification_position), 0) into v_next_pos
    from public.split_qualifications where split_id = p_split;

  for v_rec in
    select e.id as entry_id, e.team_id, e.placement from public.tournament_entries e
    where e.tournament_id = p_tournament and e.team_id is not null
      and private.entry_competed(e.id)
    order by e.placement asc nulls last, e.seed asc nulls last, e.created_at asc
  loop
    exit when v_used + v_assigned >= v_slots;
    if exists (select 1 from public.split_qualifications q
               where q.split_id = p_split and q.team_id = v_rec.team_id) then
      continue;
    end if;

    v_elig := private.team_eligibility(v_rec.team_id, p_tournament, v_rec.entry_id);
    if not coalesce((v_elig->>'eligible')::boolean, false) then
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'team_id', v_rec.team_id, 'reasons', v_elig->'reasons'));
      continue;
    end if;

    insert into public.split_qualifications(split_id, team_id, qualified_from_tournament_id,
      qualification_position, status)
    values (p_split, v_rec.team_id, p_tournament, v_next_pos + 1, 'qualified')
    on conflict (split_id, team_id) do nothing
    returning id into v_id;

    if v_id is null then continue; end if;

    v_next_pos := v_next_pos + 1;
    v_assigned := v_assigned + 1;
    v_id := null;

    perform private.audit(p_actor, 'qualification_assigned', 'team', v_rec.team_id,
      jsonb_build_object('split_id', p_split, 'tournament_id', p_tournament,
        'placement', v_rec.placement, 'qualification_position', v_next_pos));
  end loop;

  return jsonb_build_object('assigned', v_assigned, 'slots', v_slots,
    'already_granted', v_used, 'skipped', v_skipped);
end $$;

revoke all on function private.assign_qualification_slots(uuid, uuid, uuid) from public;