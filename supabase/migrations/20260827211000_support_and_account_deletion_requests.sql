create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  profile_id uuid references public.profiles(id) on delete set null,
  category text not null check (category in ('support','bug','privacy','account_deletion')),
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open','in_review','resolved','closed')),
  staff_response text,
  resolved_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists support_requests_user_id_created_at_idx
  on public.support_requests(user_id, created_at desc);
create index if not exists support_requests_status_created_at_idx
  on public.support_requests(status, created_at asc);

alter table public.support_requests enable row level security;
revoke all on table public.support_requests from anon, authenticated;

create or replace function public.submit_my_support_request(
  p_category text,
  p_subject text,
  p_message text
) returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user uuid := auth.uid();
  v_profile uuid;
  v_id uuid;
  v_category text := lower(btrim(coalesce(p_category, '')));
  v_subject text := btrim(coalesce(p_subject, ''));
  v_message text := btrim(coalesce(p_message, ''));
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if v_category not in ('support','bug','privacy','account_deletion') then
    raise exception 'invalid_support_category';
  end if;
  if length(v_subject) < 3 or length(v_subject) > 120 then
    raise exception 'invalid_support_subject';
  end if;
  if length(v_message) < 10 or length(v_message) > 4000 then
    raise exception 'invalid_support_message';
  end if;

  select id into v_profile from public.profiles where user_id = v_user;

  insert into public.support_requests(user_id, profile_id, category, subject, message)
  values (v_user, v_profile, v_category, v_subject, v_message)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'status', 'open');
end;
$$;

create or replace function public.get_my_support_requests()
returns jsonb
language sql
stable
security definer
set search_path = public, private
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'category', r.category,
    'subject', r.subject,
    'message', r.message,
    'status', r.status,
    'staffResponse', r.staff_response,
    'createdAt', r.created_at,
    'updatedAt', r.updated_at,
    'resolvedAt', r.resolved_at
  ) order by r.created_at desc), '[]'::jsonb)
  from public.support_requests r
  where r.user_id = auth.uid();
$$;

create or replace function public.staff_list_support_requests()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null or not private.actor_is_staff(v_actor) then raise exception 'forbidden'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'category', r.category,
    'subject', r.subject,
    'message', r.message,
    'status', r.status,
    'staffResponse', r.staff_response,
    'createdAt', r.created_at,
    'updatedAt', r.updated_at,
    'resolvedAt', r.resolved_at,
    'profile', case when p.id is null then null else jsonb_build_object(
      'id', p.id,
      'handle', p.handle,
      'displayName', p.display_name
    ) end
  ) order by
    case r.status when 'open' then 0 when 'in_review' then 1 when 'resolved' then 2 else 3 end,
    r.created_at asc), '[]'::jsonb)
  into v_result
  from public.support_requests r
  left join public.profiles p on p.id = r.profile_id;

  return v_result;
end;
$$;

create or replace function public.staff_update_support_request(
  p_request uuid,
  p_status text,
  p_response text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_response text := nullif(btrim(coalesce(p_response, '')), '');
  v_row public.support_requests%rowtype;
begin
  if v_actor is null or not private.actor_is_staff(v_actor) then raise exception 'forbidden'; end if;
  if v_status not in ('open','in_review','resolved','closed') then raise exception 'invalid_support_status'; end if;
  if v_response is not null and length(v_response) > 2000 then raise exception 'support_response_too_long'; end if;

  update public.support_requests
  set status = v_status,
      staff_response = coalesce(v_response, staff_response),
      updated_at = now(),
      resolved_by_user_id = case when v_status in ('resolved','closed') then v_actor else null end,
      resolved_at = case when v_status in ('resolved','closed') then now() else null end
  where id = p_request
  returning * into v_row;

  if v_row.id is null then raise exception 'support_request_not_found'; end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'status', v_row.status,
    'staffResponse', v_row.staff_response,
    'updatedAt', v_row.updated_at,
    'resolvedAt', v_row.resolved_at
  );
end;
$$;

revoke all on function public.submit_my_support_request(text,text,text) from public, anon;
revoke all on function public.get_my_support_requests() from public, anon;
revoke all on function public.staff_list_support_requests() from public, anon;
revoke all on function public.staff_update_support_request(uuid,text,text) from public, anon;
grant execute on function public.submit_my_support_request(text,text,text) to authenticated;
grant execute on function public.get_my_support_requests() to authenticated;
grant execute on function public.staff_list_support_requests() to authenticated;
grant execute on function public.staff_update_support_request(uuid,text,text) to authenticated;
