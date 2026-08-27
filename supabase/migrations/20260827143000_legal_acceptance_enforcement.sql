create table if not exists public.legal_acceptances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now()
);

alter table public.legal_acceptances enable row level security;
revoke all on public.legal_acceptances from anon, authenticated;
grant select on public.legal_acceptances to authenticated;

drop policy if exists "legal acceptance read own" on public.legal_acceptances;
create policy "legal acceptance read own"
on public.legal_acceptances for select to authenticated
using (user_id = auth.uid());

create or replace function private.require_current_legal_acceptance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'legal_acceptance', 'false') <> 'true'
     or coalesce(new.raw_user_meta_data ->> 'accepted_terms_version', '') <> '2026-08-27'
     or coalesce(new.raw_user_meta_data ->> 'accepted_privacy_version', '') <> '2026-08-27' then
    raise exception 'legal_acceptance_required';
  end if;
  return new;
end;
$$;

create or replace function private.record_legal_acceptance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.legal_acceptances(user_id, terms_version, privacy_version, accepted_at)
  values (
    new.id,
    new.raw_user_meta_data ->> 'accepted_terms_version',
    new.raw_user_meta_data ->> 'accepted_privacy_version',
    now()
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.require_current_legal_acceptance() from public, anon, authenticated;
revoke all on function private.record_legal_acceptance() from public, anon, authenticated;

drop trigger if exists eloshape_require_legal_acceptance on auth.users;
create trigger eloshape_require_legal_acceptance
before insert on auth.users
for each row execute function private.require_current_legal_acceptance();

drop trigger if exists eloshape_record_legal_acceptance on auth.users;
create trigger eloshape_record_legal_acceptance
after insert on auth.users
for each row execute function private.record_legal_acceptance();
