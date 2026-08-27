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

  select jsonb_build_object('id',e.id,'name',coalesce(tm.name,p.display_name,'TBD'),'teamSlug',tm.slug,'playerHandle',p.handle)
  into v_entry_a
  from public.tournament_entries e left join public.teams tm on tm.id=e.team_id left join public.profiles p on p.id=e.profile_id
  where e.id=m.entry_a_id;

  select jsonb_build_object('id',e.id,'name',coalesce(tm.name,p.display_name,'TBD'),'teamSlug',tm.slug,'playerHandle',p.handle)
  into v_entry_b
  from public.tournament_entries e left join public.teams tm on tm.id=e.team_id left join public.profiles p on p.id=e.profile_id
  where e.id=m.entry_b_id;

  return jsonb_build_object(
    'match',jsonb_build_object('id',m.id,'roundLabel',m.round_label,'roundIndex',m.round_index,'bracketSlot',m.bracket_slot,'bestOf',m.best_of,'status',m.status::text,'scoreA',m.score_a,'scoreB',m.score_b,'winnerEntryId',m.winner_entry_id,'isBye',m.is_bye),
    'tournament',jsonb_build_object('id',t.id,'slug',t.slug,'name',t.name,'mode',t.mode,'status',t.status::text),
    'entryA',v_entry_a,'entryB',v_entry_b,'myEntryId',v_entry,'isStaff',v_staff,
    'claim',case when c.id is null then null else jsonb_build_object('id',c.id,'reporterEntryId',c.reporter_entry_id,'scoreA',c.score_a,'scoreB',c.score_b,'evidenceUrl',c.evidence_url,'reporterNote',c.reporter_note,'status',c.status,'responderNote',c.responder_note,'respondedAt',c.responded_at,'resolutionNote',c.resolution_note,'resolvedAt',c.resolved_at,'createdAt',c.created_at,'updatedAt',c.updated_at) end,
    'canSubmit',v_entry is not null and m.status in ('scheduled','live') and not m.is_bye and m.winner_entry_id is null and (c.id is null or c.status='dismissed' or (c.status='pending_confirmation' and c.reporter_entry_id=v_entry)),
    'canRespond',v_entry is not null and c.id is not null and c.status='pending_confirmation' and c.reporter_entry_id<>v_entry
  );
end;
$$;

create or replace function public.submit_my_match_result(p_match uuid,p_score_a integer,p_score_b integer,p_evidence_url text default null,p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid(); v_profile uuid; v_entry uuid; m record; t record; c record; v_claim uuid;
  v_evidence text := nullif(trim(coalesce(p_evidence_url,'')),'');
  v_note text := nullif(trim(coalesce(p_note,'')),'');
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  v_profile:=public.ensure_my_profile();
  v_entry:=private.match_entry_for_profile(p_match,v_profile);
  if v_entry is null then raise exception 'not_match_participant'; end if;
  select * into m from public.matches where id=p_match for update;
  if not found then raise exception 'match_not_found'; end if;
  if m.status not in ('scheduled','live') or m.is_bye or m.winner_entry_id is not null or m.entry_a_id is null or m.entry_b_id is null then raise exception 'match_not_reportable'; end if;
  select * into t from public.tournaments where id=m.tournament_id;
  if t.finalized_at is not null or t.status not in ('live','registration_closed') then raise exception 'tournament_not_active'; end if;
  if not private.match_score_valid(p_match,p_score_a,p_score_b) then raise exception 'invalid_score'; end if;
  if v_evidence is not null and (length(v_evidence)>500 or v_evidence !~* '^https?://') then raise exception 'invalid_evidence_url'; end if;
  if v_note is not null and length(v_note)>1000 then raise exception 'note_too_long'; end if;

  select * into c from public.match_result_claims where match_id=p_match for update;
  if found then
    if c.status='dismissed' then
      update public.match_result_claims set reporter_profile_id=v_profile,reporter_entry_id=v_entry,score_a=p_score_a,score_b=p_score_b,evidence_url=v_evidence,reporter_note=v_note,status='pending_confirmation',responder_profile_id=null,responder_note=null,responded_at=null,resolved_by_user_id=null,resolution_note=null,resolved_at=null,updated_at=now() where id=c.id returning id into v_claim;
    elsif c.status='pending_confirmation' and c.reporter_entry_id=v_entry then
      update public.match_result_claims set score_a=p_score_a,score_b=p_score_b,evidence_url=v_evidence,reporter_note=v_note,updated_at=now() where id=c.id returning id into v_claim;
    else
      raise exception 'result_claim_already_exists';
    end if;
  else
    insert into public.match_result_claims(match_id,reporter_profile_id,reporter_entry_id,score_a,score_b,evidence_url,reporter_note)
    values(p_match,v_profile,v_entry,p_score_a,p_score_b,v_evidence,v_note) returning id into v_claim;
  end if;
  perform private.audit(v_user,'match_result_claim_submitted','match_result_claim',v_claim,jsonb_build_object('match_id',p_match,'score_a',p_score_a,'score_b',p_score_b,'entry_id',v_entry));
  return public.get_my_match_result(p_match);
end;
$$;

revoke all on function public.get_my_match_result(uuid) from public, anon;
revoke all on function public.submit_my_match_result(uuid,integer,integer,text,text) from public, anon;
grant execute on function public.get_my_match_result(uuid) to authenticated;
grant execute on function public.submit_my_match_result(uuid,integer,integer,text,text) to authenticated;
