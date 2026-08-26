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

import { buildBracket, type BracketCompetitor } from "./bracket";

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
  const tournament = await client
    .from("tournaments")
    .select("id, checkin_required")
    .eq("id", tournamentId)
    .maybeSingle();
  fail(tournament.error);
  if (!tournament.data) throw new Error("Tournament not found.");
  const checkinRequired = tournament.data.checkin_required !== false;

  const { data, error } = await client
    .from("tournament_entries")
    .select(
      `id, seed, status, roster_locked_at,
       profile:profiles!tournament_entries_profile_id_fkey(handle, points_season, wins, tournaments_played),
       team:teams!tournament_entries_team_id_fkey(slug, points_season, wins)`,
    )
    .eq("tournament_id", tournamentId)
    .not("roster_locked_at", "is", null)
    .in("status", checkinRequired ? ["checked_in"] : ["checked_in", "registered"]);
  fail(error);

  return (data ?? []).map<BracketCompetitor>((entry) => ({
    entryId: entry.id,
    points: entry.team?.points_season ?? entry.profile?.points_season ?? 0,
    wins: entry.team?.wins ?? entry.profile?.wins ?? 0,
    tournamentsPlayed: entry.profile?.tournaments_played ?? 0,
    handle: (entry.team?.slug ?? entry.profile?.handle ?? entry.id).toLowerCase(),
  }));
}

export async function generateTournamentBracket(
  client: Client,
  tournamentId: string,
  series: SeriesConfig = {},
) {
  const competitors = await loadSeedableEntries(client, tournamentId);
  if (competitors.length < 2) {
    throw new Error("At least two checked-in entries with locked rosters are required.");
  }

  const bracket = buildBracket(competitors, series);
  const { data, error } = await client.rpc("staff_create_bracket", {
    p_tournament: tournamentId,
    p_seeds: bracket.seeds.map((seed) => ({ entry_id: seed.entryId, seed: seed.seed })),
    p_matches: bracket.matches,
  });
  fail(error);
  return { result: data, size: bracket.size, rounds: bracket.rounds, byes: bracket.byes };
}

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

export async function generateSplitPlayoffs(
  client: Client,
  splitId: string,
  options: { bestOf?: number; allowShortField?: boolean; reason?: string } = {},
) {
  const { data, error } = await client.rpc("staff_generate_split_playoffs", {
    p_split: splitId,
    p_best_of: options.bestOf ?? 3,
    p_allow_short_field: options.allowShortField ?? false,
    ...(options.reason ? { p_reason: options.reason } : {}),
  });
  fail(error);
  return data;
}

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
