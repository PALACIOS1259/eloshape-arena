create table if not exists public.match_result_claims (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches(id) on delete cascade,
  reporter_profile_id uuid not null references public.profiles(id) on delete restrict,
  reporter_entry_id uuid not null references public.tournament_entries(id) on delete restrict,
  score_a integer not null,
  score_b integer not null,
  evidence_url text,
  reporter_note text,
  status text not null default 'pending_confirmation' check (status in ('pending_confirmation','disputed','confirmed','resolved','dismissed')),
  responder_profile_id uuid references public.profiles(id) on delete set null,
  responder_note text,
  responded_at timestamptz,
  resolved_by_user_id uuid references auth.users(id) on delete set null,
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists match_result_claims_status_idx on public.match_result_claims(status, created_at);
create index if not exists match_result_claims_reporter_profile_id_idx on public.match_result_claims(reporter_profile_id);
create index if not exists match_result_claims_responder_profile_id_idx on public.match_result_claims(responder_profile_id);

alter table public.match_result_claims enable row level security;
revoke all on public.match_result_claims from anon, authenticated;
grant select on public.match_result_claims to authenticated;

create or replace function private.match_entry_for_profile(p_match uuid, p_profile uuid)
returns uuid
language sql
stable
security definer
set search_path = 'public', 'private'
as $$
  select e.id
  from public.matches m
  join public.tournament_entries e on e.id in (m.entry_a_id, m.entry_b_id)
  where m.id = p_match
    and (
      e.profile_id = p_profile
      or exists (
        select 1
        from public.tournament_roster_members trm
        where trm.entry_id = e.id
          and trm.profile_id = p_profile
          and trm.is_captain = true
      )
    )
  limit 1;
$$;

create or replace function private.match_score_valid(p_match uuid, p_score_a integer, p_score_b integer)
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select coalesce(
    p_score_a >= 0
    and p_score_b >= 0
    and p_score_a <> p_score_b
    and p_score_a + p_score_b <= m.best_of
    and greatest(p_score_a, p_score_b) = (m.best_of / 2) + 1,
    false
  )
  from public.matches m
  where m.id = p_match;
$$;

create or replace function private.apply_match_result_core(
  p_actor uuid,
  p_match uuid,
  p_score_a integer,
  p_score_b integer,
  p_audit_action text default 'match_result_reported'
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'private'
as $$
declare
  m record;
  t record;
  v_winner uuid;
  v_loser uuid;
  v_next_round integer;
  v_next_slot integer;
  v_has_next boolean := false;
  v_next_id uuid;
  v_next_a uuid;
  v_next_b uuid;
begin
  select * into m from public.matches where id = p_match for update;
  if not found then raise exception 'match_not_found'; end if;
  if m.status = 'completed' or m.winner_entry_id is not null then raise exception 'match_not_reportable'; end if;
  if m.status = 'cancelled' or m.is_bye then raise exception 'match_not_reportable'; end if;
  if m.entry_a_id is null or m.entry_b_id is null then raise exception 'match_not_reportable'; end if;

  select * into t from public.tournaments where id = m.tournament_id;
  if t.finalized_at is not null then raise exception 'tournament_finalized'; end if;
  if t.status not in ('live','registration_closed') then raise exception 'tournament_not_active'; end if;
  if not private.match_score_valid(p_match, p_score_a, p_score_b) then raise exception 'invalid_score'; end if;

  if p_score_a > p_score_b then
    v_winner := m.entry_a_id;
    v_loser := m.entry_b_id;
  else
    v_winner := m.entry_b_id;
    v_loser := m.entry_a_id;
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
  where tournament_id = m.tournament_id
    and round_index = v_next_round
    and bracket_slot = v_next_slot
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

  perform private.audit(
    p_actor,
    p_audit_action,
    'match',
    m.id,
    jsonb_build_object(
      'tournament_id', m.tournament_id,
      'round_index', m.round_index,
      'bracket_slot', m.bracket_slot,
      'score_a', p_score_a,
      'score_b', p_score_b,
      'winner_entry_id', v_winner
    )
  );

  return jsonb_build_object(
    'status', 'completed',
    'match_id', m.id,
    'winner_entry_id', v_winner,
    'advanced_to', case when not v_has_next then null else jsonb_build_object(
      'round_index', v_next_round,
      'bracket_slot', v_next_slot,
      'slot', case when m.bracket_slot % 2 = 0 then 'A' else 'B' end
    ) end
  );
end;
$$;

create or replace function private.report_match_result(p_actor uuid, p_match uuid, p_score_a integer, p_score_b integer)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'private'
as $$
begin
  if not private.actor_is_staff(p_actor) then raise exception 'forbidden'; end if;
  return private.apply_match_result_core(p_actor, p_match, p_score_a, p_score_b, 'match_result_reported');
end;
$$;

revoke all on function private.match_entry_for_profile(uuid, uuid) from public, anon, authenticated;
revoke all on function private.match_score_valid(uuid, integer, integer) from public, anon, authenticated;
revoke all on function private.apply_match_result_core(uuid, uuid, integer, integer, text) from public, anon, authenticated;
revoke all on function private.report_match_result(uuid, uuid, integer, integer) from public, anon, authenticated;

drop policy if exists "match result claims participant read" on public.match_result_claims;
create policy "match result claims participant read"
on public.match_result_claims for select to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role in ('admin','moderator')
  )
  or exists (
    select 1
    from public.profiles me
    join public.matches m on m.id = match_result_claims.match_id
    left join public.tournament_entries ea on ea.id = m.entry_a_id
    left join public.tournament_entries eb on eb.id = m.entry_b_id
    where me.user_id = auth.uid()
      and (
        ea.profile_id = me.id
        or eb.profile_id = me.id
        or exists (
          select 1 from public.tournament_roster_members trm
          where trm.profile_id = me.id
            and trm.is_captain = true
            and trm.entry_id in (m.entry_a_id, m.entry_b_id)
        )
      )
  )
);

create or replace function public.get_my_match_result(p_match uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile uuid;
  v_entry uuid;
  v_staff boolean := false;
  m record;
  t record;
  c record;
  v_entry_a jsonb;
  v_entry_b jsonb;
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  v_profile := public.ensure_my_profile();
  v_staff := private.actor_is_staff(v_user);
  v_entry := private.match_entry_for_profile(p_match, v_profile);
  if v_entry is null and not v_staff then raise exception 'forbidden'; end if;

  select * into m from public.matches where id = p_match;
  if not found then raise exception 'match_not_found'; end if;
  select id, slug, name, mode, status into t from public.tournaments where id = m.tournament_id;
  select * into c from public.match_result_claims where match_id = p_match;

  select jsonb_build_object(
    'id', e.id,
    'name', coalesce(tm.name, p.display_name, 'TBD'),
    'teamSlug', tm.slug,
    'playerHandle', p.handle
  ) into v_entry_a
  from public.tournament_entries e
  left join public.teams tm on tm.id = e.team_id
  left join public.profiles p on p.id = e.profile_id
  where e.id = m.entry_a_id;

  select jsonb_build_object(
    'id', e.id,
    'name', coalesce(tm.name, p.display_name, 'TBD'),
    'teamSlug', tm.slug,
    'playerHandle', p.handle
  ) into v_entry_b
  from public.tournament_entries e
  left join public.teams tm on tm.id = e.team_id
  left join public.profiles p on p.id = e.profile_id
  where e.id = m.entry_b_id;

  return jsonb_build_object(
    'match', jsonb_build_object(
      'id', m.id,
      'roundLabel', m.round_label,
      'roundIndex', m.round_index,
      'bracketSlot', m.bracket_slot,
      'bestOf', m.best_of,
      'status', m.status::text,
      'scoreA', m.score_a,
      'scoreB', m.score_b,
      'winnerEntryId', m.winner_entry_id,
      'isBye', m.is_bye
    ),
    'tournament', jsonb_build_object('id', t.id, 'slug', t.slug, 'name', t.name, 'mode', t.mode, 'status', t.status::text),
    'entryA', v_entry_a,
    'entryB', v_entry_b,
    'myEntryId', v_entry,
    'isStaff', v_staff,
    'claim', case when c.id is null then null else jsonb_build_object(
      'id', c.id,
      'reporterEntryId', c.reporter_entry_id,
      'scoreA', c.score_a,
      'scoreB', c.score_b,
      'evidenceUrl', c.evidence_url,
      'reporterNote', c.reporter_note,
      'status', c.status,
      'responderNote', c.responder_note,
      'respondedAt', c.responded_at,
      'resolutionNote', c.resolution_note,
      'resolvedAt', c.resolved_at,
      'createdAt', c.created_at,
      'updatedAt', c.updated_at
    ) end,
    'canSubmit', v_entry is not null and m.status in ('scheduled','live') and not m.is_bye and m.winner_entry_id is null
      and (c.id is null or (c.status = 'pending_confirmation' and c.reporter_entry_id = v_entry)),
    'canRespond', v_entry is not null and c.id is not null and c.status = 'pending_confirmation' and c.reporter_entry_id <> v_entry
  );
end;
$$;

create or replace function public.submit_my_match_result(
  p_match uuid,
  p_score_a integer,
  p_score_b integer,
  p_evidence_url text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile uuid;
  v_entry uuid;
  m record;
  t record;
  c record;
  v_claim uuid;
  v_evidence text := nullif(trim(coalesce(p_evidence_url,'')), '');
  v_note text := nullif(trim(coalesce(p_note,'')), '');
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  v_profile := public.ensure_my_profile();
  v_entry := private.match_entry_for_profile(p_match, v_profile);
  if v_entry is null then raise exception 'not_match_participant'; end if;

  select * into m from public.matches where id = p_match for update;
  if not found then raise exception 'match_not_found'; end if;
  if m.status not in ('scheduled','live') or m.is_bye or m.winner_entry_id is not null or m.entry_a_id is null or m.entry_b_id is null then raise exception 'match_not_reportable'; end if;
  select * into t from public.tournaments where id = m.tournament_id;
  if t.finalized_at is not null or t.status not in ('live','registration_closed') then raise exception 'tournament_not_active'; end if;
  if not private.match_score_valid(p_match, p_score_a, p_score_b) then raise exception 'invalid_score'; end if;
  if v_evidence is not null and (length(v_evidence) > 500 or v_evidence !~* '^https?://') then raise exception 'invalid_evidence_url'; end if;
  if v_note is not null and length(v_note) > 1000 then raise exception 'note_too_long'; end if;

  select * into c from public.match_result_claims where match_id = p_match for update;
  if found then
    if c.status <> 'pending_confirmation' or c.reporter_entry_id <> v_entry then raise exception 'result_claim_already_exists'; end if;
    update public.match_result_claims
      set score_a = p_score_a, score_b = p_score_b, evidence_url = v_evidence, reporter_note = v_note, updated_at = now()
      where id = c.id
      returning id into v_claim;
  else
    insert into public.match_result_claims(match_id, reporter_profile_id, reporter_entry_id, score_a, score_b, evidence_url, reporter_note)
    values (p_match, v_profile, v_entry, p_score_a, p_score_b, v_evidence, v_note)
    returning id into v_claim;
  end if;

  perform private.audit(v_user, 'match_result_claim_submitted', 'match_result_claim', v_claim,
    jsonb_build_object('match_id', p_match, 'score_a', p_score_a, 'score_b', p_score_b, 'entry_id', v_entry));

  return public.get_my_match_result(p_match);
end;
$$;

create or replace function public.respond_my_match_result(
  p_match uuid,
  p_confirm boolean,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile uuid;
  v_entry uuid;
  c record;
  m record;
  v_note text := nullif(trim(coalesce(p_note,'')), '');
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  v_profile := public.ensure_my_profile();
  v_entry := private.match_entry_for_profile(p_match, v_profile);
  if v_entry is null then raise exception 'not_match_participant'; end if;
  if v_note is not null and length(v_note) > 1000 then raise exception 'note_too_long'; end if;

  select * into c from public.match_result_claims where match_id = p_match for update;
  if not found then raise exception 'result_claim_not_found'; end if;
  if c.status <> 'pending_confirmation' then raise exception 'result_claim_not_pending'; end if;
  if c.reporter_entry_id = v_entry then raise exception 'opponent_confirmation_required'; end if;

  select * into m from public.matches where id = p_match for update;
  if p_confirm then
    perform private.apply_match_result_core(v_user, p_match, c.score_a, c.score_b, 'match_result_confirmed');
    update public.match_result_claims
      set status = 'confirmed', responder_profile_id = v_profile, responder_note = v_note, responded_at = now(), resolved_at = now(), updated_at = now()
      where id = c.id;
    perform private.audit(v_user, 'match_result_claim_confirmed', 'match_result_claim', c.id, jsonb_build_object('match_id', p_match));
  else
    if v_note is null or length(v_note) < 3 then raise exception 'dispute_note_required'; end if;
    update public.match_result_claims
      set status = 'disputed', responder_profile_id = v_profile, responder_note = v_note, responded_at = now(), updated_at = now()
      where id = c.id;
    insert into public.reports(reporter_profile_id, tournament_id, reason, details, status)
    values (v_profile, m.tournament_id, 'match_result_dispute', 'Match ' || p_match::text || ': ' || v_note, 'open');
    perform private.audit(v_user, 'match_result_claim_disputed', 'match_result_claim', c.id, jsonb_build_object('match_id', p_match));
  end if;

  return public.get_my_match_result(p_match);
end;
$$;

create or replace function public.staff_list_match_disputes()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  result jsonb;
begin
  if v_user is null or not private.actor_is_staff(v_user) then raise exception 'forbidden'; end if;
  select coalesce(jsonb_agg(x.obj order by x.priority, x.created_at), '[]'::jsonb) into result
  from (
    select
      case when c.status = 'disputed' then 0 else 1 end as priority,
      c.created_at,
      jsonb_build_object(
        'id', c.id,
        'matchId', c.match_id,
        'status', c.status,
        'scoreA', c.score_a,
        'scoreB', c.score_b,
        'evidenceUrl', c.evidence_url,
        'reporterNote', c.reporter_note,
        'responderNote', c.responder_note,
        'createdAt', c.created_at,
        'respondedAt', c.responded_at,
        'tournament', jsonb_build_object('id', t.id, 'slug', t.slug, 'name', t.name),
        'roundLabel', m.round_label,
        'entryA', coalesce(ta.name, pa.display_name, 'TBD'),
        'entryB', coalesce(tb.name, pb.display_name, 'TBD')
      ) as obj
    from public.match_result_claims c
    join public.matches m on m.id = c.match_id
    join public.tournaments t on t.id = m.tournament_id
    left join public.tournament_entries ea on ea.id = m.entry_a_id
    left join public.teams ta on ta.id = ea.team_id
    left join public.profiles pa on pa.id = ea.profile_id
    left join public.tournament_entries eb on eb.id = m.entry_b_id
    left join public.teams tb on tb.id = eb.team_id
    left join public.profiles pb on pb.id = eb.profile_id
    where c.status in ('pending_confirmation','disputed')
  ) x;
  return result;
end;
$$;

create or replace function public.staff_resolve_match_dispute(
  p_claim uuid,
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
  v_user uuid := auth.uid();
  c record;
  v_note text := nullif(trim(coalesce(p_note,'')), '');
begin
  if v_user is null or not private.actor_is_staff(v_user) then raise exception 'forbidden'; end if;
  if v_note is null or length(v_note) < 3 or length(v_note) > 1000 then raise exception 'resolution_note_required'; end if;
  select * into c from public.match_result_claims where id = p_claim for update;
  if not found then raise exception 'result_claim_not_found'; end if;
  if c.status not in ('disputed','pending_confirmation') then raise exception 'result_claim_not_resolvable'; end if;
  perform private.apply_match_result_core(v_user, c.match_id, p_score_a, p_score_b, 'match_result_staff_resolved');
  update public.match_result_claims
    set status = 'resolved', resolved_by_user_id = v_user, resolution_note = v_note, resolved_at = now(), updated_at = now()
    where id = c.id;
  update public.reports
    set status = 'resolved'
    where tournament_id = (select tournament_id from public.matches where id = c.match_id)
      and reason = 'match_result_dispute'
      and details like '%' || c.match_id::text || '%'
      and status in ('open','reviewing');
  perform private.audit(v_user, 'match_result_claim_staff_resolved', 'match_result_claim', c.id,
    jsonb_build_object('match_id', c.match_id, 'score_a', p_score_a, 'score_b', p_score_b, 'note', v_note));
  return public.get_my_match_result(c.match_id);
end;
$$;

create or replace function public.staff_dismiss_match_dispute(p_claim uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  c record;
  v_note text := nullif(trim(coalesce(p_note,'')), '');
begin
  if v_user is null or not private.actor_is_staff(v_user) then raise exception 'forbidden'; end if;
  if v_note is null or length(v_note) < 3 or length(v_note) > 1000 then raise exception 'resolution_note_required'; end if;
  select * into c from public.match_result_claims where id = p_claim for update;
  if not found then raise exception 'result_claim_not_found'; end if;
  if c.status not in ('disputed','pending_confirmation') then raise exception 'result_claim_not_resolvable'; end if;
  update public.match_result_claims
    set status = 'dismissed', resolved_by_user_id = v_user, resolution_note = v_note, resolved_at = now(), updated_at = now()
    where id = c.id;
  update public.reports
    set status = 'dismissed'
    where tournament_id = (select tournament_id from public.matches where id = c.match_id)
      and reason = 'match_result_dispute'
      and details like '%' || c.match_id::text || '%'
      and status in ('open','reviewing');
  perform private.audit(v_user, 'match_result_claim_staff_dismissed', 'match_result_claim', c.id,
    jsonb_build_object('match_id', c.match_id, 'note', v_note));
  return public.get_my_match_result(c.match_id);
end;
$$;

revoke all on function public.get_my_match_result(uuid) from public, anon;
revoke all on function public.submit_my_match_result(uuid, integer, integer, text, text) from public, anon;
revoke all on function public.respond_my_match_result(uuid, boolean, text) from public, anon;
revoke all on function public.staff_list_match_disputes() from public, anon;
revoke all on function public.staff_resolve_match_dispute(uuid, integer, integer, text) from public, anon;
revoke all on function public.staff_dismiss_match_dispute(uuid, text) from public, anon;

grant execute on function public.get_my_match_result(uuid) to authenticated;
grant execute on function public.submit_my_match_result(uuid, integer, integer, text, text) to authenticated;
grant execute on function public.respond_my_match_result(uuid, boolean, text) to authenticated;
grant execute on function public.staff_list_match_disputes() to authenticated;
grant execute on function public.staff_resolve_match_dispute(uuid, integer, integer, text) to authenticated;
grant execute on function public.staff_dismiss_match_dispute(uuid, text) to authenticated;
