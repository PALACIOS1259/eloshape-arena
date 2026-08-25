/**
 * EloShape public read layer — SERVER ONLY.
 *
 * All reads go through the publishable (anon) client, so RLS public-read
 * policies are the single source of truth for what is exposed. Never import
 * this from a component; it is loaded inside server-function handlers.
 */
import { createPublicClient } from "./supabase-public.server";

const DIVISION_SELECT = "id, code, name, accent, sort_order, description, riot_tiers";
const REGION_SELECT = "id, name, slug, kind";

const PLAYER_CARD_SELECT = `
  id, handle, display_name, avatar_url, points_season, points_month, wins, losses,
  tournaments_played, rank_movement, riot_tier, riot_rank, eligibility,
  division:divisions!profiles_division_id_fkey(${DIVISION_SELECT}),
  city:regions!profiles_city_id_fkey(${REGION_SELECT}),
  province:regions!profiles_province_id_fkey(${REGION_SELECT}),
  country:regions!profiles_country_id_fkey(${REGION_SELECT}),
  region:regions!profiles_region_id_fkey(${REGION_SELECT})
`;

const TOURNAMENT_CARD_SELECT = `
  id, slug, name, subtitle, status, mode, format, prize, starts_at,
  registration_closes_at, participants_count, max_participants, banner_url,
  division:divisions!tournaments_division_id_fkey(${DIVISION_SELECT}),
  region:regions!tournaments_region_id_fkey(${REGION_SELECT})
`;

const TEAM_CARD_SELECT = `
  id, slug, name, tag, logo_url, wins, losses, championships, points_season,
  division:divisions!teams_division_id_fkey(${DIVISION_SELECT}),
  city:regions!teams_city_id_fkey(${REGION_SELECT})
`;

export type RankingPeriod = "season" | "month";

type QueryResult<T> = { data: T; error: { message: string } | null };

function unwrap<T>(res: QueryResult<T>): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** Same as `unwrap` but guarantees an array for list queries. */
function rows<T>(res: QueryResult<T[] | null>): T[] {
  return unwrap(res) ?? [];
}

/** Divisions, geography tree, active season and the configurable point rules. */
export async function loadDirectory() {
  const db = createPublicClient();
  const [divisions, regions, seasons, rules] = await Promise.all([
    db.from("divisions").select(DIVISION_SELECT).order("sort_order"),
    db.from("regions").select("id, name, slug, kind, parent_id").order("name"),
    db.from("seasons").select("*").order("starts_at", { ascending: false }),
    db.from("point_rules").select("*").order("sort_order"),
  ]);

  const seasonRows = rows(seasons);
  return {
    divisions: rows(divisions),
    regions: rows(regions),
    seasons: seasonRows,
    activeSeason: seasonRows.find((s) => s.is_active) ?? seasonRows[0] ?? null,
    pointRules: rows(rules),
  };
}

export async function loadHomeSnapshot() {
  const db = createPublicClient();
  const [upcoming, live, topPlayers, topTeams, playerCount, tournamentCount] = await Promise.all([
    db
      .from("tournaments")
      .select(TOURNAMENT_CARD_SELECT)
      .in("status", ["registration_open", "registration_closed"])
      .order("starts_at")
      .limit(3),
    db
      .from("tournaments")
      .select(TOURNAMENT_CARD_SELECT)
      .eq("status", "live")
      .order("starts_at")
      .limit(2),
    db
      .from("profiles")
      .select(PLAYER_CARD_SELECT)
      .order("points_season", { ascending: false })
      .limit(6),
    db.from("teams").select(TEAM_CARD_SELECT).order("points_season", { ascending: false }).limit(4),
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("tournaments").select("id", { count: "exact", head: true }),
  ]);

  return {
    upcoming: rows(upcoming),
    live: rows(live),
    topPlayers: rows(topPlayers),
    topTeams: rows(topTeams),
    stats: {
      players: playerCount.count ?? 0,
      tournaments: tournamentCount.count ?? 0,
    },
  };
}

export type TournamentFilters = {
  status?: string;
  divisionCode?: string;
  mode?: string;
};

export async function loadTournaments(filters: TournamentFilters) {
  const db = createPublicClient();
  let query = db
    .from("tournaments")
    .select(TOURNAMENT_CARD_SELECT)
    .neq("status", "draft")
    .order("starts_at");

  if (filters.status && filters.status !== "all")
    query = query.eq("status", filters.status as never);
  if (filters.mode && filters.mode !== "all") query = query.eq("mode", filters.mode as never);
  if (filters.divisionCode && filters.divisionCode !== "all") {
    const division = unwrap(
      await db.from("divisions").select("id").eq("code", filters.divisionCode).maybeSingle(),
    );
    if (!division) return [];
    query = query.eq("division_id", division.id);
  }

  return rows(await query);
}

export async function loadTournamentDetail(slug: string) {
  const db = createPublicClient();
  const tournament = unwrap(
    await db
      .from("tournaments")
      .select(
        `${TOURNAMENT_CARD_SELECT}, description, rules, season:seasons!tournaments_season_id_fkey(name, slug)`,
      )
      .eq("slug", slug)
      .maybeSingle(),
  );
  if (!tournament) return null;

  const [entries, matches] = await Promise.all([
    db
      .from("tournament_entries")
      .select(
        `id, seed, placement, points_awarded, status,
         profile:profiles!tournament_entries_profile_id_fkey(id, handle, display_name, points_season, riot_tier, riot_rank, division:divisions!profiles_division_id_fkey(code, name)),
         team:teams!tournament_entries_team_id_fkey(id, slug, name, tag, points_season)`,
      )
      .eq("tournament_id", tournament.id)
      .order("placement", { ascending: true, nullsFirst: false })
      .order("seed", { ascending: true, nullsFirst: false }),
    db
      .from("matches")
      .select("*")
      .eq("tournament_id", tournament.id)
      .order("round_index")
      .order("bracket_slot"),
  ]);

  return { tournament, entries: rows(entries), matches: rows(matches) };
}

export type RankingFilters = {
  period: RankingPeriod;
  divisionCode?: string;
  regionSlug?: string;
  limit?: number;
};

const REGION_COLUMN: Record<string, string> = {
  city: "city_id",
  province: "province_id",
  country: "country_id",
  region: "region_id",
};

export async function loadRankings(filters: RankingFilters) {
  const db = createPublicClient();
  const orderColumn = filters.period === "month" ? "points_month" : "points_season";

  let query = db
    .from("profiles")
    .select(PLAYER_CARD_SELECT)
    .order(orderColumn, { ascending: false })
    .limit(filters.limit ?? 50);

  if (filters.divisionCode && filters.divisionCode !== "all") {
    const division = unwrap(
      await db.from("divisions").select("id").eq("code", filters.divisionCode).maybeSingle(),
    );
    if (!division) return [];
    query = query.eq("division_id", division.id);
  }

  if (filters.regionSlug && filters.regionSlug !== "all") {
    const region = unwrap(
      await db.from("regions").select("id, kind").eq("slug", filters.regionSlug).maybeSingle(),
    );
    if (!region) return [];
    const column = REGION_COLUMN[region.kind];
    if (column) query = query.eq(column as never, region.id);
  }

  return rows(await query);
}

export async function loadPlayer(handle: string) {
  const db = createPublicClient();
  const profile = unwrap(
    await db
      .from("profiles")
      .select(`${PLAYER_CARD_SELECT}, bio, profile_completion, created_at`)
      .eq("handle", handle)
      .maybeSingle(),
  );
  if (!profile) return null;

  const [ledger, achievements, teams, entries] = await Promise.all([
    db
      .from("ranking_points")
      .select(
        `id, points, note, awarded_at, rule_code,
         tournament:tournaments!ranking_points_tournament_id_fkey(slug, name, starts_at),
         rule:point_rules!ranking_points_rule_code_fkey(label)`,
      )
      .eq("profile_id", profile.id)
      .order("awarded_at", { ascending: false }),
    db.from("achievements").select("*").eq("profile_id", profile.id).order("earned_at", {
      ascending: false,
    }),
    db
      .from("team_members")
      .select(
        `role, is_captain, joined_at, team:teams!team_members_team_id_fkey(${TEAM_CARD_SELECT})`,
      )
      .eq("profile_id", profile.id),
    db
      .from("tournament_entries")
      .select(
        `id, placement, points_awarded, status,
         tournament:tournaments!tournament_entries_tournament_id_fkey(slug, name, starts_at, status, mode)`,
      )
      .eq("profile_id", profile.id),
  ]);

  return {
    profile,
    ledger: rows(ledger),
    achievements: rows(achievements),
    teams: rows(teams),
    entries: rows(entries),
  };
}

export async function loadTeam(slug: string) {
  const db = createPublicClient();
  const team = unwrap(
    await db
      .from("teams")
      .select(`${TEAM_CARD_SELECT}, bio, captain_id`)
      .eq("slug", slug)
      .maybeSingle(),
  );
  if (!team) return null;

  const [members, entries] = await Promise.all([
    db
      .from("team_members")
      .select(
        `id, role, is_captain, joined_at,
         profile:profiles!team_members_profile_id_fkey(id, handle, display_name, points_season, riot_tier, riot_rank, wins, losses, division:divisions!profiles_division_id_fkey(code, name))`,
      )
      .eq("team_id", team.id)
      .order("is_captain", { ascending: false }),
    db
      .from("tournament_entries")
      .select(
        `id, placement, points_awarded, status,
         tournament:tournaments!tournament_entries_tournament_id_fkey(slug, name, starts_at, status, mode)`,
      )
      .eq("team_id", team.id),
  ]);

  return { team, members: rows(members), entries: rows(entries) };
}

export async function loadTeams() {
  const db = createPublicClient();
  return rows(
    await db.from("teams").select(TEAM_CARD_SELECT).order("points_season", { ascending: false }),
  );
}
