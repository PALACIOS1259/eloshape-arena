create or replace function public.staff_get_split_ops(p_split uuid)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'private'
as $function$
declare
  v_actor uuid := auth.uid();
  s record;
  v_qualifier_count integer := 0;
  v_finalized_count integer := 0;
  v_qualified_count integer := 0;
  v_qualifiers jsonb := '[]'::jsonb;
  v_qualifications jsonb := '[]'::jsonb;
  v_standings jsonb := '[]'::jsonb;
  v_replacements jsonb := '[]'::jsonb;
  v_playoff jsonb := null;
begin
  if v_actor is null or not private.actor_is_staff(v_actor) then
    raise exception 'forbidden';
  end if;

  select * into s
  from public.competitive_splits
  where id = p_split;

  if s.id is null then raise exception 'split_not_found'; end if;

  select count(*)::integer,
         count(*) filter (where t.finalized_at is not null and t.status = 'completed')::integer
    into v_qualifier_count, v_finalized_count
  from public.tournaments t
  where t.split_id = p_split and t.split_phase = 'qualifier';

  select count(*)::integer into v_qualified_count
  from public.split_qualifications q
  where q.split_id = p_split and q.status = 'qualified';

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'slug', t.slug,
      'name', t.name,
      'status', t.status,
      'qualifierIndex', t.qualifier_index,
      'startsAt', t.starts_at,
      'participantsCount', t.participants_count,
      'maxParticipants', t.max_participants,
      'entriesLockedAt', t.entries_locked_at,
      'bracketGeneratedAt', t.bracket_generated_at,
      'finalizedAt', t.finalized_at,
      'activeQualificationGrants', (
        select count(*) from public.split_qualifications q
        where q.qualified_from_tournament_id = t.id and q.status = 'qualified'
      )
    ) order by t.qualifier_index, t.starts_at
  ), '[]'::jsonb)
  into v_qualifiers
  from public.tournaments t
  where t.split_id = p_split and t.split_phase = 'qualifier';

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'teamId', tm.id,
      'teamSlug', tm.slug,
      'teamName', tm.name,
      'teamTag', tm.tag,
      'status', q.status,
      'qualificationPosition', q.qualification_position,
      'playoffSeed', q.playoff_seed,
      'qualifiedAt', q.qualified_at,
      'sourceTournamentId', qt.id,
      'sourceTournamentName', qt.name,
      'sourceQualifierIndex', qt.qualifier_index,
      'replacesTeamId', q.replaces_team_id,
      'replacesTeamName', replaced.name
    ) order by q.qualification_position, q.qualified_at
  ), '[]'::jsonb)
  into v_qualifications
  from public.split_qualifications q
  join public.teams tm on tm.id = q.team_id
  left join public.tournaments qt on qt.id = q.qualified_from_tournament_id
  left join public.teams replaced on replaced.id = q.replaces_team_id
  where q.split_id = p_split;

  select coalesce(jsonb_agg(to_jsonb(st) order by st.points desc, st.wins desc, st.tournaments_played desc, lower(st.team_name)), '[]'::jsonb)
  into v_standings
  from public.split_standings(p_split) st;

  select coalesce(jsonb_agg(to_jsonb(candidate) order by candidate.points desc, candidate.wins desc, candidate.tournaments_played desc, lower(candidate.team_name)), '[]'::jsonb)
  into v_replacements
  from public.split_standings(p_split) candidate
  where candidate.qualification_status is null
    and private.team_is_eligible(candidate.team_id);

  select jsonb_build_object(
    'id', t.id,
    'slug', t.slug,
    'name', t.name,
    'status', t.status,
    'participantsCount', t.participants_count,
    'entriesLockedAt', t.entries_locked_at,
    'bracketGeneratedAt', t.bracket_generated_at,
    'finalizedAt', t.finalized_at
  ) into v_playoff
  from public.tournaments t
  where t.split_id = p_split and t.split_phase = 'playoffs'
  order by t.created_at desc
  limit 1;

  return jsonb_build_object(
    'split', jsonb_build_object(
      'id', s.id,
      'slug', s.slug,
      'name', s.name,
      'status', s.status,
      'playoffSize', s.playoff_size,
      'qualificationSlotsPerQualifier', s.qualification_slots_per_qualifier,
      'startsAt', s.starts_at,
      'endsAt', s.ends_at,
      'disputeDeadlineAt', s.dispute_deadline_at,
      'playoffRevealAt', s.playoff_reveal_at
    ),
    'qualifiers', v_qualifiers,
    'qualifications', v_qualifications,
    'standings', v_standings,
    'replacementCandidates', v_replacements,
    'playoffTournament', v_playoff,
    'readiness', jsonb_build_object(
      'qualifierCount', v_qualifier_count,
      'finalizedQualifierCount', v_finalized_count,
      'allQualifiersFinalized', v_qualifier_count > 0 and v_qualifier_count = v_finalized_count,
      'qualifiedCount', v_qualified_count,
      'playoffSize', s.playoff_size,
      'fullPlayoffField', v_qualified_count = s.playoff_size,
      'canEnterSeeding', s.status = 'qualifiers' and v_qualifier_count > 0 and v_qualifier_count = v_finalized_count,
      'canGeneratePlayoffs', s.status in ('seeding','playoffs') and v_qualified_count = s.playoff_size,
      'canGenerateShortPlayoffs', s.status in ('seeding','playoffs') and v_qualified_count >= 2 and v_qualified_count < s.playoff_size
    )
  );
end;
$function$;

revoke all on function public.staff_get_split_ops(uuid) from public;
grant execute on function public.staff_get_split_ops(uuid) to authenticated;

create or replace function private.set_split_status(p_actor uuid, p_split uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'private'
as $function$
declare
  s record;
  v_allowed text[];
  v_qualifiers integer := 0;
  v_pending integer := 0;
begin
  if not private.actor_is_staff(p_actor) then raise exception 'forbidden'; end if;

  select * into s from public.competitive_splits where id = p_split for update;
  if s.id is null then raise exception 'split_not_found'; end if;

  v_allowed := case s.status
    when 'upcoming' then array['qualifiers','cancelled']
    when 'qualifiers' then array['seeding','cancelled']
    when 'seeding' then array['playoffs','cancelled']
    when 'playoffs' then array['semifinals','cancelled']
    when 'semifinals' then array['final','cancelled']
    when 'final' then array['completed','cancelled']
    else array[]::text[] end;

  if not (p_status = any(v_allowed)) then raise exception 'invalid_transition'; end if;

  if s.status = 'qualifiers' and p_status = 'seeding' then
    select count(*)::integer,
           count(*) filter (where finalized_at is null or status <> 'completed')::integer
      into v_qualifiers, v_pending
    from public.tournaments
    where split_id = p_split and split_phase = 'qualifier';

    if v_qualifiers = 0 then raise exception 'qualifiers_missing'; end if;
    if v_pending > 0 then raise exception 'qualifiers_not_finalized: % remaining', v_pending; end if;
  end if;

  if s.status = 'seeding' and p_status = 'playoffs' then
    if not exists (
      select 1 from public.tournaments
      where split_id = p_split and split_phase = 'playoffs' and bracket_generated_at is not null
    ) then
      raise exception 'playoffs_not_generated';
    end if;
  end if;

  if s.status = 'final' and p_status = 'completed' then
    if exists (
      select 1 from public.tournaments
      where split_id = p_split and split_phase = 'playoffs' and finalized_at is null
    ) then
      raise exception 'playoff_not_finalized';
    end if;
  end if;

  update public.competitive_splits set status = p_status::public.split_status where id = p_split;
  perform private.audit(p_actor, 'split_status_changed', 'split', p_split,
    jsonb_build_object('from', s.status, 'to', p_status));
  return jsonb_build_object('status', p_status);
end;
$function$;
