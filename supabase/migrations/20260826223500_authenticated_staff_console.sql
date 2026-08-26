-- EloShape authenticated staff console
-- Removes the need for a service-role credential in the web runtime.

-- Staff may review Riot eligibility data, while players keep their existing
-- own-account read policy. PostgreSQL permissive SELECT policies are OR'ed.
drop policy if exists "riot accounts staff read" on public.riot_accounts;
create policy "riot accounts staff read"
on public.riot_accounts
for select
to authenticated
using (private.is_staff());

-- Manual eligibility decisions are performed through one narrow SECURITY
-- DEFINER RPC. The caller cannot choose the reviewer; auth.uid() is authoritative.
create or replace function public.staff_set_player_eligibility(
  p_profile uuid,
  p_status public.eligibility_status,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_handle text;
  v_reason text;
begin
  if v_actor is null or not private.actor_is_staff(v_actor) then
    raise exception 'forbidden';
  end if;

  if p_profile is null then
    raise exception 'profile_not_found';
  end if;

  v_reason := left(coalesce(nullif(btrim(p_reason), ''), 'Staff decision'), 200);

  update public.profiles
     set eligibility = p_status,
         updated_at = now()
   where id = p_profile
   returning handle into v_handle;

  if v_handle is null then
    raise exception 'profile_not_found';
  end if;

  insert into public.eligibility_reviews(
    profile_id,
    status,
    reason,
    reviewed_by
  ) values (
    p_profile,
    p_status,
    v_reason,
    v_actor
  );

  perform private.audit(
    v_actor,
    'eligibility_updated',
    'profile',
    p_profile,
    jsonb_build_object('status', p_status::text, 'reason', v_reason)
  );

  return jsonb_build_object(
    'id', p_profile,
    'handle', v_handle,
    'eligibility', p_status::text
  );
end;
$$;

revoke all on function public.staff_set_player_eligibility(uuid, public.eligibility_status, text)
  from public, anon;
grant execute on function public.staff_set_player_eligibility(uuid, public.eligibility_status, text)
  to authenticated;

comment on function public.staff_set_player_eligibility(uuid, public.eligibility_status, text) is
  'Manual staff eligibility decision for auth.uid(); reviewer identity is derived server-side.';
