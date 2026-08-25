-- ENUMS
create type public.app_role as enum ('admin','moderator','player');
create type public.region_kind as enum ('region','country','province','city');
create type public.eligibility_status as enum ('eligible','pending_review','rejected','suspended');
create type public.tournament_status as enum ('draft','registration_open','registration_closed','live','completed','cancelled');
create type public.entry_status as enum ('registered','checked_in','withdrawn','disqualified');
create type public.match_status as enum ('scheduled','live','completed','cancelled');
create type public.report_status as enum ('open','reviewing','resolved','dismissed');

create or replace function public.set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql set search_path = public;

-- REGIONS
create table public.regions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  kind public.region_kind not null,
  parent_id uuid references public.regions(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select on public.regions to anon, authenticated;
grant all on public.regions to service_role;
alter table public.regions enable row level security;
create policy "regions public read" on public.regions for select using (true);

-- DIVISIONS
create table public.divisions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sort_order int not null default 0,
  riot_tiers text[] not null default '{}',
  accent text not null default 'silver',
  description text,
  created_at timestamptz not null default now()
);
grant select on public.divisions to anon, authenticated;
grant all on public.divisions to service_role;
alter table public.divisions enable row level security;
create policy "divisions public read" on public.divisions for select using (true);

-- SEASONS
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);
grant select on public.seasons to anon, authenticated;
grant all on public.seasons to service_role;
alter table public.seasons enable row level security;
create policy "seasons public read" on public.seasons for select using (true);

-- POINT RULES (configurable scoring)
create table public.point_rules (
  code text primary key,
  label text not null,
  points int not null,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);
grant select on public.point_rules to anon, authenticated;
grant all on public.point_rules to service_role;
alter table public.point_rules enable row level security;
create policy "point rules public read" on public.point_rules for select using (true);

-- PROFILES (player_profiles). user_id links to an auth user when the demo row is claimed.
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  handle text not null unique,
  display_name text not null,
  avatar_url text,
  bio text,
  riot_id text,
  riot_tier text,
  riot_rank text,
  division_id uuid references public.divisions(id) on delete set null,
  city_id uuid references public.regions(id) on delete set null,
  province_id uuid references public.regions(id) on delete set null,
  country_id uuid references public.regions(id) on delete set null,
  region_id uuid references public.regions(id) on delete set null,
  points_season int not null default 0,
  points_month int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  rank_movement int not null default 0,
  tournaments_played int not null default 0,
  eligibility public.eligibility_status not null default 'pending_review',
  profile_completion int not null default 40,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles public read" on public.profiles for select using (true);
create policy "profiles insert own" on public.profiles for insert to authenticated with check (auth.uid() = user_id);
create policy "profiles update own" on public.profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

-- USER ROLES
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "roles read own" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "roles admin write" on public.user_roles for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- RIOT ACCOUNTS
create table public.riot_accounts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  riot_id text not null,
  puuid text,
  platform text not null default 'LA2',
  solo_tier text,
  solo_rank text,
  solo_lp int,
  verified boolean not null default false,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (profile_id, riot_id)
);
grant select on public.riot_accounts to anon, authenticated;
grant insert, update, delete on public.riot_accounts to authenticated;
grant all on public.riot_accounts to service_role;
alter table public.riot_accounts enable row level security;
create policy "riot accounts public read" on public.riot_accounts for select using (true);
create policy "riot accounts manage own" on public.riot_accounts for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid()));

-- TEAMS
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tag text not null,
  logo_url text,
  bio text,
  division_id uuid references public.divisions(id) on delete set null,
  region_id uuid references public.regions(id) on delete set null,
  country_id uuid references public.regions(id) on delete set null,
  city_id uuid references public.regions(id) on delete set null,
  captain_id uuid references public.profiles(id) on delete set null,
  points_season int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  championships int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.teams to anon, authenticated;
grant insert, update on public.teams to authenticated;
grant all on public.teams to service_role;
alter table public.teams enable row level security;
create policy "teams public read" on public.teams for select using (true);
create policy "teams captain update" on public.teams for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = captain_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.profiles p where p.id = captain_id and p.user_id = auth.uid()));

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'Player',
  is_captain boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (team_id, profile_id)
);
grant select on public.team_members to anon, authenticated;
grant all on public.team_members to service_role;
alter table public.team_members enable row level security;
create policy "team members public read" on public.team_members for select using (true);

-- TOURNAMENTS
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  subtitle text,
  description text,
  rules text,
  banner_url text,
  division_id uuid references public.divisions(id) on delete set null,
  region_id uuid references public.regions(id) on delete set null,
  season_id uuid references public.seasons(id) on delete set null,
  status public.tournament_status not null default 'registration_open',
  format text not null default 'Single elimination Bo1',
  mode text not null default 'solo',
  max_participants int not null default 32,
  participants_count int not null default 0,
  prize text,
  registration_closes_at timestamptz,
  starts_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.tournaments to anon, authenticated;
grant all on public.tournaments to service_role;
alter table public.tournaments enable row level security;
create policy "tournaments public read" on public.tournaments for select using (true);
create policy "tournaments admin write" on public.tournaments for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger tournaments_updated_at before update on public.tournaments for each row execute function public.set_updated_at();

create table public.tournament_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  status public.entry_status not null default 'registered',
  seed int,
  placement int,
  points_awarded int not null default 0,
  checked_in_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index tournament_entries_profile_uniq on public.tournament_entries(tournament_id, profile_id) where profile_id is not null;
grant select on public.tournament_entries to anon, authenticated;
grant insert, update, delete on public.tournament_entries to authenticated;
grant all on public.tournament_entries to service_role;
alter table public.tournament_entries enable row level security;
create policy "entries public read" on public.tournament_entries for select using (true);
create policy "entries manage own" on public.tournament_entries for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid()));

-- MATCHES
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_label text not null,
  round_index int not null default 1,
  bracket_slot int not null default 1,
  best_of int not null default 1,
  status public.match_status not null default 'scheduled',
  scheduled_at timestamptz,
  entry_a_id uuid references public.tournament_entries(id) on delete set null,
  entry_b_id uuid references public.tournament_entries(id) on delete set null,
  score_a int not null default 0,
  score_b int not null default 0,
  winner_entry_id uuid references public.tournament_entries(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select on public.matches to anon, authenticated;
grant all on public.matches to service_role;
alter table public.matches enable row level security;
create policy "matches public read" on public.matches for select using (true);
create policy "matches admin write" on public.matches for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  side text not null default 'a',
  champion text,
  kills int not null default 0,
  deaths int not null default 0,
  assists int not null default 0,
  is_win boolean not null default false,
  created_at timestamptz not null default now()
);
grant select on public.match_players to anon, authenticated;
grant all on public.match_players to service_role;
alter table public.match_players enable row level security;
create policy "match players public read" on public.match_players for select using (true);

-- RANKING POINTS
create table public.ranking_points (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tournament_id uuid references public.tournaments(id) on delete set null,
  season_id uuid references public.seasons(id) on delete set null,
  rule_code text references public.point_rules(code) on delete set null,
  points int not null,
  note text,
  awarded_at timestamptz not null default now()
);
grant select on public.ranking_points to anon, authenticated;
grant all on public.ranking_points to service_role;
alter table public.ranking_points enable row level security;
create policy "ranking points public read" on public.ranking_points for select using (true);
create policy "ranking points admin write" on public.ranking_points for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ACHIEVEMENTS
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  code text not null,
  title text not null,
  description text,
  tier text not null default 'bronze',
  earned_at timestamptz not null default now()
);
grant select on public.achievements to anon, authenticated;
grant all on public.achievements to service_role;
alter table public.achievements enable row level security;
create policy "achievements public read" on public.achievements for select using (true);

-- REPORTS
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_profile_id uuid references public.profiles(id) on delete set null,
  reported_profile_id uuid references public.profiles(id) on delete cascade,
  tournament_id uuid references public.tournaments(id) on delete set null,
  reason text not null,
  details text,
  status public.report_status not null default 'open',
  created_at timestamptz not null default now()
);
grant select, insert on public.reports to authenticated;
grant update, delete on public.reports to authenticated;
grant all on public.reports to service_role;
alter table public.reports enable row level security;
create policy "reports read own or staff" on public.reports for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'moderator')
    or exists (select 1 from public.profiles p where p.id = reporter_profile_id and p.user_id = auth.uid()));
create policy "reports insert own" on public.reports for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = reporter_profile_id and p.user_id = auth.uid()));
create policy "reports staff manage" on public.reports for update to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'moderator'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'moderator'));

-- ELIGIBILITY REVIEWS
create table public.eligibility_reviews (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status public.eligibility_status not null default 'pending_review',
  reason text,
  notes text,
  reviewed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.eligibility_reviews to authenticated;
grant all on public.eligibility_reviews to service_role;
alter table public.eligibility_reviews enable row level security;
create policy "eligibility staff read" on public.eligibility_reviews for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'moderator')
    or exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid()));
create policy "eligibility staff write" on public.eligibility_reviews for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'moderator'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'moderator'));
create trigger eligibility_updated_at before update on public.eligibility_reviews for each row execute function public.set_updated_at();

-- ============ SEED DATA ============
insert into public.regions (slug, name, kind, parent_id) values ('las','LAS - Latin America South','region', null);
insert into public.regions (slug, name, kind, parent_id) values
 ('argentina','Argentina','country',(select id from public.regions where slug='las')),
 ('uruguay','Uruguay','country',(select id from public.regions where slug='las')),
 ('chile','Chile','country',(select id from public.regions where slug='las'));
insert into public.regions (slug, name, kind, parent_id) values
 ('santa-fe','Santa Fe','province',(select id from public.regions where slug='argentina')),
 ('buenos-aires','Buenos Aires','province',(select id from public.regions where slug='argentina')),
 ('cordoba','Cordoba','province',(select id from public.regions where slug='argentina')),
 ('mendoza','Mendoza','province',(select id from public.regions where slug='argentina')),
 ('montevideo-dep','Montevideo','province',(select id from public.regions where slug='uruguay')),
 ('santiago-rm','Region Metropolitana','province',(select id from public.regions where slug='chile'));
insert into public.regions (slug, name, kind, parent_id) values
 ('rosario','Rosario','city',(select id from public.regions where slug='santa-fe')),
 ('santa-fe-city','Santa Fe (city)','city',(select id from public.regions where slug='santa-fe')),
 ('caba','Buenos Aires (CABA)','city',(select id from public.regions where slug='buenos-aires')),
 ('cordoba-city','Cordoba','city',(select id from public.regions where slug='cordoba')),
 ('mendoza-city','Mendoza','city',(select id from public.regions where slug='mendoza')),
 ('montevideo','Montevideo','city',(select id from public.regions where slug='montevideo-dep')),
 ('santiago','Santiago','city',(select id from public.regions where slug='santiago-rm'));

insert into public.divisions (code, name, sort_order, riot_tiers, accent, description) values
 ('iron','Iron',1,'{IRON}','steel','Entry division for players climbing out of Iron. Learn structure, comms and the basics of competitive play.'),
 ('bronze','Bronze',2,'{BRONZE}','bronze','For Bronze Solo Queue players ready for their first organized brackets.'),
 ('silver','Silver',3,'{SILVER}','silver','The most contested division. Consistent fundamentals decide brackets here.'),
 ('gold','Gold',4,'{GOLD}','gold','Top MVP division. Gold Solo Queue players fighting for regional titles.');

insert into public.seasons (slug, name, starts_at, ends_at, is_active) values
 ('s1-2026','Season 1 - 2026','2026-06-01','2026-12-15', true),
 ('preseason-2026','Preseason 2026','2026-02-01','2026-05-31', false);

insert into public.point_rules (code, label, points, sort_order) values
 ('participation','Tournament participation',5,1),
 ('match_win','Match win',10,2),
 ('quarterfinal','Quarterfinal reached',15,3),
 ('semifinal','Semifinal reached',25,4),
 ('runner_up','Runner-up',40,5),
 ('champion','Champion',70,6);

-- Players
insert into public.profiles (handle, display_name, riot_id, riot_tier, riot_rank, division_id, city_id, province_id, country_id, region_id, points_season, points_month, wins, losses, rank_movement, eligibility, bio, tournaments_played, profile_completion, is_demo)
select v.handle, v.display_name, v.riot_id, v.tier, v.rk,
  (select id from public.divisions d where d.code = v.div),
  (select id from public.regions r where r.slug = v.city),
  (select id from public.regions r where r.slug = v.prov),
  (select id from public.regions r where r.slug = v.ctry),
  (select id from public.regions r where r.slug = v.reg),
  v.ps, v.pm, v.w, v.l, v.mv, v.elig::public.eligibility_status,
  'Amateur competitor grinding the EloShape circuit.', v.tp, v.pc, true
from (values
 ('nocturne_ros','Nocturne','Nocturne#LAS','GOLD','II','gold','rosario','santa-fe','argentina','las',612,138,28,12,3,'eligible',9,100),
 ('mateo_kda','MateoKDA','MateoKDA#ROS','GOLD','IV','gold','rosario','santa-fe','argentina','las',488,96,26,20,1,'eligible',8,90),
 ('lucia_mid','LuciaMid','LuciaMid#LAS','SILVER','I','silver','rosario','santa-fe','argentina','las',579,124,25,14,4,'eligible',9,95),
 ('tobi_jgl','TobiJungla','TobiJungla#ARG','SILVER','III','silver','santa-fe-city','santa-fe','argentina','las',401,77,18,14,5,'eligible',7,85),
 ('bruno_adc','BrunoADC','BrunoADC#LAS','BRONZE','I','bronze','rosario','santa-fe','argentina','las',494,115,20,9,2,'eligible',8,90),
 ('agus_sup','AgusSupp','AgusSupp#SF','BRONZE','II','bronze','santa-fe-city','santa-fe','argentina','las',323,73,17,13,-1,'eligible',6,80),
 ('kevin_top','KevinTop','KevinTop#IRON','IRON','I','iron','rosario','santa-fe','argentina','las',307,71,14,11,4,'eligible',6,75),
 ('juli_iron','JuliIron','JuliIron#LAS','IRON','III','iron','santa-fe-city','santa-fe','argentina','las',207,38,10,20,-1,'eligible',5,60),
 ('nico_caba','NicoCABA','NicoCABA#LAS','GOLD','I','gold','caba','buenos-aires','argentina','las',645,126,31,13,1,'eligible',10,100),
 ('sofi_gg','SofiGG','SofiGG#BA','GOLD','III','gold','caba','buenos-aires','argentina','las',520,116,26,21,3,'eligible',9,95),
 ('dami_lux','DamiLux','DamiLux#BA','SILVER','II','silver','caba','buenos-aires','argentina','las',568,134,30,16,-2,'eligible',9,90),
 ('fran_yasuo','FranYasuo','FranYasuo#BA','SILVER','IV','silver','caba','buenos-aires','argentina','las',436,109,22,13,-1,'eligible',8,85),
 ('ceci_jinx','CeciJinx','CeciJinx#BA','BRONZE','III','bronze','caba','buenos-aires','argentina','las',414,96,18,14,2,'eligible',7,85),
 ('pipa_thresh','PipaThresh','PipaThresh#BA','BRONZE','IV','bronze','caba','buenos-aires','argentina','las',267,54,14,12,-3,'eligible',6,70),
 ('leo_cba','LeoCordoba','LeoCordoba#CBA','GOLD','IV','gold','cordoba-city','cordoba','argentina','las',354,85,17,15,5,'eligible',7,80),
 ('vale_cba','ValeCBA','ValeCBA#CBA','SILVER','I','silver','cordoba-city','cordoba','argentina','las',488,102,24,16,-3,'eligible',8,90),
 ('santi_mza','SantiMZA','SantiMZA#MZA','BRONZE','II','bronze','mendoza-city','mendoza','argentina','las',291,60,12,16,5,'eligible',6,75),
 ('luki_mza','LukiMZA','LukiMZA#MZA','IRON','II','iron','mendoza-city','mendoza','argentina','las',181,47,9,11,-3,'eligible',5,65),
 ('marto_uy','MartoUY','MartoUY#UY','GOLD','III','gold','montevideo','montevideo-dep','uruguay','las',527,117,28,10,-3,'eligible',9,95),
 ('pau_uy','PauUY','PauUY#UY','SILVER','III','silver','montevideo','montevideo-dep','uruguay','las',326,67,17,22,0,'eligible',6,75),
 ('cris_cl','CrisCL','CrisCL#CL','GOLD','II','gold','santiago','santiago-rm','chile','las',516,102,27,13,-2,'pending_review',9,90),
 ('jose_cl','JoseCL','JoseCL#CL','BRONZE','I','bronze','santiago','santiago-rm','chile','las',283,59,15,17,0,'eligible',6,70),
 ('nacho_cl','NachoCL','NachoCL#CL','IRON','IV','iron','santiago','santiago-rm','chile','las',179,26,6,18,-1,'suspended',5,55),
 ('emi_ros','EmiRosario','EmiRosario#ROS','SILVER','II','silver','rosario','santa-fe','argentina','las',392,88,20,14,-3,'eligible',7,85)
) as v(handle, display_name, riot_id, tier, rk, div, city, prov, ctry, reg, ps, pm, w, l, mv, elig, tp, pc);

insert into public.riot_accounts (profile_id, riot_id, solo_tier, solo_rank, solo_lp, verified, last_synced_at, platform)
select p.id, p.riot_id, p.riot_tier, p.riot_rank, 40 + (random()*59)::int, true, now() - interval '3 hours', 'LA2'
from public.profiles p;

-- Teams
insert into public.teams (slug, name, tag, division_id, region_id, country_id, city_id, captain_id, points_season, wins, losses, championships, bio) values
 ('rosario-rift','Rosario Rift','RSR',(select id from public.divisions where code='silver'),(select id from public.regions where slug='las'),(select id from public.regions where slug='argentina'),(select id from public.regions where slug='rosario'),(select id from public.profiles where handle='lucia_mid'),1240,34,12,2,'Amateur roster from Rosario, built around fast mid-jungle tempo.'),
 ('litoral-esports','Litoral Esports','LIT',(select id from public.divisions where code='bronze'),(select id from public.regions where slug='las'),(select id from public.regions where slug='argentina'),(select id from public.regions where slug='santa-fe-city'),(select id from public.profiles where handle='agus_sup'),860,22,18,1,'Santa Fe based project focused on developing Bronze talent.'),
 ('caba-collective','CABA Collective','CBC',(select id from public.divisions where code='gold'),(select id from public.regions where slug='las'),(select id from public.regions where slug='argentina'),(select id from public.regions where slug='caba'),(select id from public.profiles where handle='nico_caba'),1510,41,15,3,'Capital based Gold division contenders.'),
 ('andes-academy','Andes Academy','AND',(select id from public.divisions where code='iron'),(select id from public.regions where slug='las'),(select id from public.regions where slug='chile'),(select id from public.regions where slug='santiago'),(select id from public.profiles where handle='jose_cl'),540,15,19,0,'Development squad for first-time competitors.');

insert into public.team_members (team_id, profile_id, role, is_captain)
select t.id, p.id, v.role, v.cap from (values
 ('rosario-rift','lucia_mid','Mid',true),
 ('rosario-rift','nocturne_ros','Top',false),
 ('rosario-rift','tobi_jgl','Jungle',false),
 ('rosario-rift','bruno_adc','Bot',false),
 ('rosario-rift','emi_ros','Support',false),
 ('litoral-esports','agus_sup','Support',true),
 ('litoral-esports','kevin_top','Top',false),
 ('litoral-esports','juli_iron','Jungle',false),
 ('litoral-esports','mateo_kda','Mid',false),
 ('litoral-esports','santi_mza','Bot',false),
 ('caba-collective','nico_caba','Mid',true),
 ('caba-collective','sofi_gg','Top',false),
 ('caba-collective','dami_lux','Support',false),
 ('caba-collective','fran_yasuo','Jungle',false),
 ('caba-collective','ceci_jinx','Bot',false),
 ('andes-academy','jose_cl','Top',true),
 ('andes-academy','nacho_cl','Jungle',false),
 ('andes-academy','cris_cl','Mid',false),
 ('andes-academy','pau_uy','Bot',false),
 ('andes-academy','marto_uy','Support',false)
) as v(team, handle, role, cap)
join public.teams t on t.slug = v.team
join public.profiles p on p.handle = v.handle;

-- Tournaments
insert into public.tournaments (slug, name, subtitle, description, rules, division_id, region_id, season_id, status, format, mode, max_participants, participants_count, prize, registration_closes_at, starts_at)
select v.slug, v.name, v.subtitle, v.descr, v.rules,
 (select id from public.divisions where code=v.div),
 (select id from public.regions where slug=v.reg),
 (select id from public.seasons where slug='s1-2026'),
 v.status::public.tournament_status, v.format, v.mode, v.maxp, v.pc, v.prize, v.rclose::timestamptz, v.starts::timestamptz
from (values
 ('rosario-open-silver-8','Rosario Open - Silver','Weekly city circuit - Season 1','A weekly single-elimination bracket for Silver division players registered in Rosario and the Santa Fe province. Matches are Bo1 until semifinals.','1. Riot Solo Queue rank must be Silver at registration.
2. Check-in opens 60 minutes before start and closes 15 minutes before.
3. Bo1 until semifinals, Bo3 from semifinals onward.
4. Tournament code lobbies only. Screenshots of results are mandatory.
5. Smurfing, account sharing and toxicity result in immediate disqualification and an eligibility review.','silver','rosario','registration_open','Single elimination Bo1 / Bo3 finals','solo',32,26,'2400 EloShape points pool','2026-08-29 20:00+00','2026-08-30 22:00+00'),
 ('argentina-gold-cup','Argentina Gold Cup','National monthly championship','The national Gold division championship. Sixty-four players, single elimination, Bo3 from quarterfinals. The champion earns the monthly Argentina crown.','1. Gold Solo Queue rank required and verified.
2. Eligibility review passed before the bracket is drawn.
3. Bo1 rounds of 64 and 32, Bo3 from quarterfinals.
4. No account sharing. Random spot checks apply.','gold','argentina','registration_open','Single elimination Bo3 finals','solo',64,48,'National title + 5000 points pool','2026-09-04 20:00+00','2026-09-06 21:00+00'),
 ('santa-fe-bronze-league','Santa Fe Bronze League','Provincial league - Week 4','Provincial Bronze league played across four weekly stages. Points accumulate toward the monthly provincial leaderboard.','1. Bronze Solo Queue rank required.
2. Weekly stages, points accumulate over four weeks.
3. Two no-shows removes the player from the league.','bronze','santa-fe','live','Swiss 4 rounds','solo',32,32,'Provincial league title','2026-08-22 20:00+00','2026-08-24 21:00+00'),
 ('las-iron-gauntlet','LAS Iron Gauntlet','Regional entry-level open','The regional entry point for Iron division players across LAS. Designed as a first competitive experience with coaching debriefs after elimination.','1. Iron Solo Queue rank required.
2. All players receive a post-elimination review.
3. Respectful comms are enforced strictly.','iron','las','registration_open','Single elimination Bo1','solo',64,37,'1500 points pool + coaching sessions','2026-09-11 20:00+00','2026-09-13 21:00+00'),
 ('rosario-silver-invitational-july','Rosario Silver Invitational','Completed - July stage','Invitational bracket for the top sixteen Silver players of the Rosario circuit. Completed in July.','1. Invite only, based on the monthly Rosario leaderboard.
2. Bo3 throughout.','silver','rosario','completed','Single elimination Bo3','solo',16,16,'Rosario July title','2026-07-18 20:00+00','2026-07-19 21:00+00'),
 ('caba-team-clash-gold','CABA Team Clash','5v5 team bracket','Five-versus-five team bracket for Gold division rosters based in Buenos Aires. Teams must field the same five players registered at check-in.','1. Five registered players plus one substitute.
2. All players must be Gold in Solo Queue.
3. Rosters lock at check-in.','gold','caba','registration_closed','Team single elimination Bo3','team',8,8,'CABA team title','2026-08-26 20:00+00','2026-08-31 21:00+00')
) as v(slug,name,subtitle,descr,rules,div,reg,status,format,mode,maxp,pc,prize,rclose,starts);

-- Entries: completed invitational (16 -> full results)
insert into public.tournament_entries (tournament_id, profile_id, status, seed, placement, points_awarded, checked_in_at)
select (select id from public.tournaments where slug='rosario-silver-invitational-july'), p.id, 'checked_in'::public.entry_status, v.seed, v.place, v.pts, '2026-07-19 20:30+00'
from (values
 ('lucia_mid',1,1,100),('emi_ros',2,2,70),('dami_lux',3,3,50),('fran_yasuo',4,4,50),
 ('tobi_jgl',5,5,30),('vale_cba',6,6,30),('pau_uy',7,7,30),('nocturne_ros',8,8,30),
 ('mateo_kda',9,9,15),('sofi_gg',10,10,15),('nico_caba',11,11,15),('leo_cba',12,12,15),
 ('bruno_adc',13,13,5),('agus_sup',14,14,5),('ceci_jinx',15,15,5),('kevin_top',16,16,5)
) as v(handle,seed,place,pts)
join public.profiles p on p.handle = v.handle;

-- Entries: open Rosario silver (registration open)
insert into public.tournament_entries (tournament_id, profile_id, status, seed)
select (select id from public.tournaments where slug='rosario-open-silver-8'), p.id,
  case when row_number() over (order by p.points_season desc) <= 6 then 'checked_in'::public.entry_status else 'registered'::public.entry_status end,
  row_number() over (order by p.points_season desc)
from public.profiles p where p.handle in ('lucia_mid','emi_ros','tobi_jgl','dami_lux','fran_yasuo','vale_cba','pau_uy','nocturne_ros','mateo_kda','bruno_adc');

insert into public.tournament_entries (tournament_id, profile_id, status, seed)
select (select id from public.tournaments where slug='argentina-gold-cup'), p.id, 'registered'::public.entry_status,
  row_number() over (order by p.points_season desc)
from public.profiles p join public.divisions d on d.id = p.division_id where d.code='gold';

insert into public.tournament_entries (tournament_id, profile_id, status, seed)
select (select id from public.tournaments where slug='las-iron-gauntlet'), p.id, 'registered'::public.entry_status,
  row_number() over (order by p.points_season desc)
from public.profiles p join public.divisions d on d.id = p.division_id where d.code='iron';

insert into public.tournament_entries (tournament_id, profile_id, status, seed, checked_in_at)
select (select id from public.tournaments where slug='santa-fe-bronze-league'), p.id, 'checked_in'::public.entry_status,
  row_number() over (order by p.points_season desc), now() - interval '2 days'
from public.profiles p join public.divisions d on d.id = p.division_id where d.code='bronze';

-- Matches for the completed invitational
insert into public.matches (tournament_id, round_label, round_index, bracket_slot, best_of, status, scheduled_at, entry_a_id, entry_b_id, score_a, score_b, winner_entry_id)
select t.id, v.round, v.ridx, v.slot, 3, 'completed'::public.match_status, v.sched::timestamptz, ea.id, eb.id, v.sa, v.sb,
  case when v.sa > v.sb then ea.id else eb.id end
from (values
 ('Quarterfinal',1,1,'lucia_mid','nocturne_ros',2,0,'2026-07-19 21:00+00'),
 ('Quarterfinal',1,2,'dami_lux','vale_cba',2,1,'2026-07-19 21:00+00'),
 ('Quarterfinal',1,3,'fran_yasuo','pau_uy',2,0,'2026-07-19 21:45+00'),
 ('Quarterfinal',1,4,'emi_ros','tobi_jgl',2,1,'2026-07-19 21:45+00'),
 ('Semifinal',2,1,'lucia_mid','dami_lux',2,1,'2026-07-19 22:30+00'),
 ('Semifinal',2,2,'emi_ros','fran_yasuo',2,0,'2026-07-19 22:30+00'),
 ('Final',3,1,'lucia_mid','emi_ros',3,1,'2026-07-19 23:30+00')
) as v(round,ridx,slot,ha,hb,sa,sb,sched)
join public.tournaments t on t.slug='rosario-silver-invitational-july'
join public.profiles pa on pa.handle=v.ha
join public.profiles pb on pb.handle=v.hb
join public.tournament_entries ea on ea.tournament_id=t.id and ea.profile_id=pa.id
join public.tournament_entries eb on eb.tournament_id=t.id and eb.profile_id=pb.id;

-- Upcoming matches for the live bronze league
insert into public.matches (tournament_id, round_label, round_index, bracket_slot, best_of, status, scheduled_at, entry_a_id, entry_b_id)
select t.id, 'Round 4', 4, v.slot, 1, 'scheduled'::public.match_status, v.sched::timestamptz, ea.id, eb.id
from (values
 (1,'bruno_adc','ceci_jinx','2026-08-26 22:00+00'),
 (2,'agus_sup','pipa_thresh','2026-08-26 22:00+00'),
 (3,'santi_mza','jose_cl','2026-08-26 22:45+00')
) as v(slot,ha,hb,sched)
join public.tournaments t on t.slug='santa-fe-bronze-league'
join public.profiles pa on pa.handle=v.ha
join public.profiles pb on pb.handle=v.hb
join public.tournament_entries ea on ea.tournament_id=t.id and ea.profile_id=pa.id
join public.tournament_entries eb on eb.tournament_id=t.id and eb.profile_id=pb.id;

-- Match players (recent match stats)
insert into public.match_players (match_id, profile_id, side, champion, kills, deaths, assists, is_win)
select m.id, p.id, v.side, v.champ, v.k, v.d, v.a, v.win
from (values
 ('Final','lucia_mid','a','Orianna',9,3,11,true),
 ('Final','emi_ros','b','Ahri',5,7,6,false),
 ('Semifinal','lucia_mid','a','Syndra',11,4,8,true),
 ('Semifinal','dami_lux','b','Lux',6,8,9,false),
 ('Quarterfinal','lucia_mid','a','Orianna',8,2,10,true),
 ('Quarterfinal','nocturne_ros','b','Camille',3,7,4,false)
) as v(round,handle,side,champ,k,d,a,win)
join public.tournaments t on t.slug='rosario-silver-invitational-july'
join public.matches m on m.tournament_id=t.id and m.round_label=v.round and m.bracket_slot=1
join public.profiles p on p.handle=v.handle;

-- Ranking points ledger from the completed invitational
insert into public.ranking_points (profile_id, tournament_id, season_id, rule_code, points, note, awarded_at)
select p.id, t.id, s.id, 'participation', 5, 'Rosario Silver Invitational - participation', '2026-07-19 20:30+00'
from public.tournament_entries e
join public.tournaments t on t.id=e.tournament_id and t.slug='rosario-silver-invitational-july'
join public.profiles p on p.id=e.profile_id
join public.seasons s on s.slug='s1-2026';

insert into public.ranking_points (profile_id, tournament_id, season_id, rule_code, points, note, awarded_at)
select p.id, t.id, s.id, v.rule, v.pts, v.note, '2026-07-19 23:59+00'
from (values
 ('lucia_mid','champion',70,'Rosario Silver Invitational - champion'),
 ('emi_ros','runner_up',40,'Rosario Silver Invitational - runner-up'),
 ('dami_lux','semifinal',25,'Rosario Silver Invitational - semifinal'),
 ('fran_yasuo','semifinal',25,'Rosario Silver Invitational - semifinal'),
 ('nocturne_ros','quarterfinal',15,'Rosario Silver Invitational - quarterfinal'),
 ('vale_cba','quarterfinal',15,'Rosario Silver Invitational - quarterfinal'),
 ('pau_uy','quarterfinal',15,'Rosario Silver Invitational - quarterfinal'),
 ('tobi_jgl','quarterfinal',15,'Rosario Silver Invitational - quarterfinal')
) as v(handle,rule,pts,note)
join public.profiles p on p.handle=v.handle
join public.tournaments t on t.slug='rosario-silver-invitational-july'
join public.seasons s on s.slug='s1-2026';

insert into public.achievements (profile_id, code, title, description, tier, earned_at)
select p.id, v.code, v.title, v.descr, v.tier, v.earned::timestamptz
from (values
 ('lucia_mid','city_champion','Rosario City Champion','Won the Rosario Silver Invitational.','gold','2026-07-19 23:59+00'),
 ('lucia_mid','first_blood_title','First Title','Won a first EloShape tournament.','silver','2026-07-19 23:59+00'),
 ('emi_ros','finalist','Finalist','Reached an EloShape final.','silver','2026-07-19 23:59+00'),
 ('nocturne_ros','streak_5','Five in a Row','Won five consecutive tournament matches.','gold','2026-08-02 23:00+00'),
 ('nico_caba','province_leader','Province Leader','Held the top Buenos Aires ranking for a month.','gold','2026-08-01 12:00+00'),
 ('kevin_top','first_tournament','First Step','Completed a first EloShape tournament.','bronze','2026-06-14 23:00+00'),
 ('tobi_jgl','quarterfinalist','Quarterfinalist','Reached a quarterfinal.','bronze','2026-07-19 22:00+00')
) as v(handle,code,title,descr,tier,earned)
join public.profiles p on p.handle=v.handle;

insert into public.eligibility_reviews (profile_id, status, reason, notes)
select p.id, v.st::public.eligibility_status, v.reason, v.notes
from (values
 ('cris_cl','pending_review','Rank mismatch','Account created 3 weeks ago with a 78% win rate. Awaiting match history verification.'),
 ('nacho_cl','suspended','Suspected smurf','Confirmed second account of a Platinum player. Suspended pending appeal.'),
 ('luki_mza','eligible','Routine check','Verified Iron II, history consistent. Cleared.')
) as v(handle,st,reason,notes)
join public.profiles p on p.handle=v.handle;

insert into public.reports (reporter_profile_id, reported_profile_id, tournament_id, reason, details, status)
select rp.id, tp.id, t.id, v.reason, v.details, v.st::public.report_status
from (values
 ('lucia_mid','cris_cl','argentina-gold-cup','Suspected smurf','Opponent had clearly higher mechanical level than the division allows.','open'),
 ('bruno_adc','nacho_cl','santa-fe-bronze-league','Toxic behaviour','Repeated harassment in lobby chat.','reviewing'),
 ('emi_ros','nacho_cl','rosario-open-silver-8','Account sharing','Different summoner played the second game of the series.','resolved')
) as v(reporter,reported,tslug,reason,details,st)
join public.profiles rp on rp.handle=v.reporter
join public.profiles tp on tp.handle=v.reported
join public.tournaments t on t.slug=v.tslug;

update public.tournaments t set participants_count = (select count(*) from public.tournament_entries e where e.tournament_id=t.id)
where exists (select 1 from public.tournament_entries e where e.tournament_id=t.id);