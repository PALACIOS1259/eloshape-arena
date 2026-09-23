-- Walkovers are competitive wins in Semi-Split qualifier standings.
-- True bracket byes still advance without affecting W/L.
--
-- finalize_tournament already awards walkover match-win points. Keeping the
-- standings W/L tiebreaker aligned avoids a split where points and win totals
-- disagree about the same competitive ruling.

create or replace function public.split_standings(p_split uuid)
returns table (
  team_id uuid,
  team_slug text,
  team_name text,
  team_tag text,
  logo_url text,
  division_code text,
  points integer,
  wins integer,
  losses integer,
  tournaments_played integer,
  qualification_status text,
  qualified_from text,
  qualification_position integer
)
language sql
stable
set search_path = ''
as $function$
  with qualifier_tournaments as (
    select t.id
    from public.tournaments t
    where t.split_id = p_split
      and t.split_phase = 'qualifier'
  ),
  base as (
    select tm.id as team_id, tm.slug, tm.name, tm.tag, tm.logo_url, d.code as division_code
    from public.teams tm
    left join public.divisions d on d.id = tm.division_id
    where exists (
      select 1
      from public.tournament_entries e
      join qualifier_tournaments qt on qt.id = e.tournament_id
      where e.team_id = tm.id
        and e.status <> 'withdrawn'
    )
  ),
  pts as (
    select trp.team_id, sum(trp.points)::int as p
    from public.team_ranking_points trp
    join qualifier_tournaments qt on qt.id = trp.tournament_id
    where trp.split_id = p_split
    group by trp.team_id
  ),
  res as (
    select e.team_id,
      count(*) filter (
        where m.status = 'completed'
          and m.resolution_type in ('played', 'walkover')
          and m.winner_entry_id = e.id
      )::int as w,
      count(*) filter (
        where m.status = 'completed'
          and m.resolution_type in ('played', 'walkover')
          and m.winner_entry_id is not null
          and m.winner_entry_id <> e.id
      )::int as l
    from public.tournament_entries e
    join qualifier_tournaments qt on qt.id = e.tournament_id
    join public.matches m
      on m.tournament_id = e.tournament_id
     and (m.entry_a_id = e.id or m.entry_b_id = e.id)
    where e.team_id is not null
    group by e.team_id
  ),
  tp as (
    select e.team_id, count(distinct e.tournament_id)::int as c
    from public.tournament_entries e
    join qualifier_tournaments qt on qt.id = e.tournament_id
    where e.team_id is not null
      and e.status <> 'withdrawn'
    group by e.team_id
  )
  select
    b.team_id,
    b.slug,
    b.name,
    b.tag,
    b.logo_url,
    b.division_code,
    coalesce(pts.p, 0),
    coalesce(res.w, 0),
    coalesce(res.l, 0),
    coalesce(tp.c, 0),
    q.status::text,
    source_tournament.name,
    q.qualification_position
  from base b
  left join pts on pts.team_id = b.team_id
  left join res on res.team_id = b.team_id
  left join tp on tp.team_id = b.team_id
  left join public.split_qualifications q
    on q.split_id = p_split
   and q.team_id = b.team_id
  left join public.tournaments source_tournament
    on source_tournament.id = q.qualified_from_tournament_id
  order by
    coalesce(pts.p, 0) desc,
    coalesce(res.w, 0) desc,
    coalesce(tp.c, 0) desc,
    lower(b.name) asc;
$function$;

revoke all on function public.split_standings(uuid) from public;
grant execute on function public.split_standings(uuid) to anon, authenticated, service_role;
