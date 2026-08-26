/**
 * Trusted competition operations — SERVER ONLY.
 *
 * Every mutation goes through a `staff_*` database function that derives the
 * actor from the signed-in session (`auth.uid()`) and re-checks the admin /
 * moderator role inside the database transaction. The browser can never write
 * brackets, results, placements, qualifications, ledgers or split state.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { buildBracket, seedCompetitors, type BracketCompetitor } from "./bracket";

type Client = SupabaseClient<Database>;

export type SeriesConfig = { bestOf?: number; roundBestOf?: Record<number, number> };

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Lock rosters and close registration before a bracket is generated. */
export async function lockTournamentEntries(client: Client, tournamentId: string) {
  const { data, error } = await client.rpc("staff_lock_tournament_entries", {
    p_tournament: tournamentId,
  });
  fail(error);
  return data;
}

async function loadSeedableEntries(client: Client, tournamentId: string) {
  const { data, error } = await client
    .from("tournament_entries")
    .select(
      `id, seed, status,
       profile:profiles!tournament_entries_profile_id_fkey(handle, points_season, wins, tournaments_played),
       team:teams!tournament_entries_team_id_fkey(slug, points_season, wins)`,
    )
    .eq("tournament_id", tournamentId)
    .neq("status", "withdrawn");
  fail(error);

  return (data ?? []).map<BracketCompetitor>((entry) => ({
    entryId: entry.id,
    points: entry.team?.points_season ?? entry.profile?.points_season ?? 0,
    wins: entry.team?.wins ?? entry.profile?.wins ?? 0,
    tournamentsPlayed: entry.profile?.tournaments_played ?? 0,
    handle: (entry.team?.slug ?? entry.profile?.handle ?? entry.id).toLowerCase(),
  }));
}

/** Deterministic bracket generation. Idempotent: an existing bracket is kept. */
export async function generateTournamentBracket(
  client: Client,
  tournamentId: string,
  series: SeriesConfig = {},
) {
  const competitors = await loadSeedableEntries(client, tournamentId);
  if (competitors.length < 2) throw new Error("At least two locked entries are required.");

  const bracket = buildBracket(competitors, series);
  const { data, error } = await client.rpc("staff_create_bracket", {
    p_tournament: tournamentId,
    p_seeds: bracket.seeds.map((seed) => ({ entry_id: seed.entryId, seed: seed.seed })),
    p_matches: bracket.matches,
  });
  fail(error);
  return { result: data, size: bracket.size, rounds: bracket.rounds, byes: bracket.byes };
}

/** Authoritative result reporting: row-locked, first valid report wins. */
export async function reportMatchResult(
  client: Client,
  matchId: string,
  scoreA: number,
  scoreB: number,
) {
  const { data, error } = await client.rpc("staff_report_match_result", {
    p_match: matchId,
    p_score_a: scoreA,
    p_score_b: scoreB,
  });
  fail(error);
  return data;
}

/** Atomic, idempotent closure: derives placements and writes the ledgers once. */
export async function finalizeTournament(client: Client, tournamentId: string) {
  const { data, error } = await client.rpc("staff_finalize_tournament", {
    p_tournament: tournamentId,
  });
  fail(error);
  return data;
}

export async function replaceWithdrawnQualifier(client: Client, splitId: string, teamId: string) {
  const { data, error } = await client.rpc("staff_replace_withdrawn_qualifier", {
    p_split: splitId,
    p_team: teamId,
  });
  fail(error);
  return data;
}

export async function setSplitStatus(client: Client, splitId: string, status: string) {
  const { data, error } = await client.rpc("staff_set_split_status", {
    p_split: splitId,
    p_status: status,
  });
  fail(error);
  return data;
}

/**
 * Seed the playoffs from Semi-Split standings (never from qualification order),
 * create the playoff tournament and generate its bracket with the same engine.
 */
export async function generateSplitPlayoffs(
  client: Client,
  splitId: string,
  series: SeriesConfig = { bestOf: 3, roundBestOf: {} },
) {
  const split = await client
    .from("competitive_splits")
    .select("id, slug, name, season_id, division_id, region_id, playoff_size, status, ends_at")
    .eq("id", splitId)
    .maybeSingle();
  fail(split.error);
  if (!split.data) throw new Error("Split not found.");
  if (!["seeding", "playoffs"].includes(split.data.status)) {
    throw new Error("Playoffs can only be generated from the seeding window.");
  }

  const standings = await client.rpc("split_standings", { p_split: splitId });
  fail(standings.error);
  const qualified = (standings.data ?? []).filter((row) => row.qualification_status === "qualified");
  if (qualified.length < 2) throw new Error("Not enough qualified teams.");

  const playoffSlug = `${split.data.slug}-playoffs`;
  const existing = await client
    .from("tournaments")
    .select("id, slug, bracket_generated_at")
    .eq("slug", playoffSlug)
    .maybeSingle();

  let playoffId = existing.data?.id ?? null;
  if (!playoffId) {
    const created = await client
      .from("tournaments")
      .insert({
        slug: playoffSlug,
        name: `${split.data.name} — Playoffs`,
        subtitle: "16-team Playoff bracket",
        description:
          "Playoff bracket seeded from Semi-Split standings. Round of 16 and Quarterfinals in week 6, Semifinals in week 7, Grand Final in week 8.",
        division_id: split.data.division_id,
        region_id: split.data.region_id,
        season_id: split.data.season_id,
        split_id: splitId,
        split_phase: "playoffs",
        status: "registration_closed",
        format: "single_elimination",
        mode: "team",
        max_participants: split.data.playoff_size,
        participants_count: qualified.length,
        starts_at: split.data.ends_at,
        entries_locked_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    fail(created.error);
    playoffId = created.data!.id;
  }

  // Entries follow standings order, so seeds reflect competition performance.
  const seeded = seedCompetitors(
    qualified.map((row, index) => ({
      entryId: row.team_id,
      points: row.points,
      wins: row.wins,
      tournamentsPlayed: row.tournaments_played,
      handle: row.team_slug ?? String(index),
    })),
  );

  const entryIdByTeam = new Map<string, string>();
  for (const seed of seeded) {
    const existingEntry = await client
      .from("tournament_entries")
      .select("id")
      .eq("tournament_id", playoffId)
      .eq("team_id", seed.entryId)
      .maybeSingle();
    fail(existingEntry.error);

    if (existingEntry.data) {
      await client
        .from("tournament_entries")
        .update({ seed: seed.seed, roster_locked_at: new Date().toISOString() })
        .eq("id", existingEntry.data.id);
      entryIdByTeam.set(seed.entryId, existingEntry.data.id);
    } else {
      const created = await client
        .from("tournament_entries")
        .insert({
          tournament_id: playoffId,
          team_id: seed.entryId,
          status: "checked_in",
          seed: seed.seed,
          roster_locked_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      fail(created.error);
      entryIdByTeam.set(seed.entryId, created.data!.id);
    }


    await client
      .from("split_qualifications")
      .update({ playoff_seed: seed.seed })
      .eq("split_id", splitId)
      .eq("team_id", seed.entryId);
  }

  await client.rpc("staff_lock_tournament_entries", { p_tournament: playoffId });

  const bracket = buildBracket(
    seeded.map((seed) => ({ entryId: entryIdByTeam.get(seed.entryId)!, seed: seed.seed })),
    { bestOf: series.bestOf ?? 3, roundBestOf: series.roundBestOf ?? {} },
  );

  const created = await client.rpc("staff_create_bracket", {
    p_tournament: playoffId,
    p_seeds: bracket.seeds.map((seed) => ({ entry_id: seed.entryId, seed: seed.seed })),
    p_matches: bracket.matches,
  });
  fail(created.error);

  return {
    tournamentId: playoffId,
    slug: playoffSlug,
    teams: seeded.length,
    result: created.data,
  };
}

/** Staff view of a tournament's bracket, seeds and generated ledger. */
export async function loadTournamentOps(client: Client, tournamentId: string) {
  const [tournament, entries, matches, log] = await Promise.all([
    client
      .from("tournaments")
      .select(
        "id, slug, name, status, format, entries_locked_at, bracket_generated_at, finalized_at, split_id, qualifier_index",
      )
      .eq("id", tournamentId)
      .maybeSingle(),
    client
      .from("tournament_entries")
      .select(
        `id, seed, placement, points_awarded, status, eliminated_in_round,
         profile:profiles!tournament_entries_profile_id_fkey(handle, display_name),
         team:teams!tournament_entries_team_id_fkey(slug, name, tag)`,
      )
      .eq("tournament_id", tournamentId)
      .order("seed", { ascending: true, nullsFirst: false }),
    client
      .from("matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("round_index")
      .order("bracket_slot"),
    client
      .from("competition_audit_log")
      .select("*")
      .eq("entity_id", tournamentId)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  fail(tournament.error);
  return {
    tournament: tournament.data,
    entries: entries.data ?? [],
    matches: matches.data ?? [],
    auditLog: log.data ?? [],
  };
}
