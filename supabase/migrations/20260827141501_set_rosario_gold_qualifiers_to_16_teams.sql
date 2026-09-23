-- Rosario Gold Open Qualifiers are 16-team events.
-- Keep this as a forward correction instead of rewriting already-applied migrations.

do $$
declare
  v_split uuid;
  v_over_capacity integer;
begin
  select id into v_split
  from public.competitive_splits
  where slug = 'rosario-gold-semi-split-1-2026';

  if v_split is null then
    raise exception 'Rosario Gold Semi-Split not found';
  end if;

  select count(*) into v_over_capacity
  from public.tournaments
  where split_id = v_split
    and split_phase = 'qualifier'
    and qualifier_index between 1 and 4
    and participants_count > 16;

  if v_over_capacity > 0 then
    raise exception 'Cannot reduce qualifier capacity: one or more qualifiers already exceed 16 teams';
  end if;

  update public.tournaments
  set max_participants = 16
  where split_id = v_split
    and split_phase = 'qualifier'
    and qualifier_index between 1 and 4;
end $$;
