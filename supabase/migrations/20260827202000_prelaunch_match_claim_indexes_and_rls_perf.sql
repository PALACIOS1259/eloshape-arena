create index if not exists match_result_claims_reporter_entry_id_idx
  on public.match_result_claims(reporter_entry_id);

create index if not exists match_result_claims_resolved_by_user_id_idx
  on public.match_result_claims(resolved_by_user_id);

drop policy if exists "legal acceptance read own" on public.legal_acceptances;
create policy "legal acceptance read own"
  on public.legal_acceptances
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "match result claims participant read" on public.match_result_claims;
create policy "match result claims participant read"
  on public.match_result_claims
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role = any (array['admin'::public.app_role, 'moderator'::public.app_role])
    )
    or exists (
      select 1
      from public.profiles me
      join public.matches m on m.id = match_result_claims.match_id
      left join public.tournament_entries ea on ea.id = m.entry_a_id
      left join public.tournament_entries eb on eb.id = m.entry_b_id
      where me.user_id = (select auth.uid())
        and (
          ea.profile_id = me.id
          or eb.profile_id = me.id
          or exists (
            select 1
            from public.tournament_roster_members trm
            where trm.profile_id = me.id
              and trm.is_captain = true
              and trm.entry_id = any (array[m.entry_a_id, m.entry_b_id])
          )
        )
    )
  );
