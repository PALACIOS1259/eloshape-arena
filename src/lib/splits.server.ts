/**
 * Semi-Split public read layer — SERVER ONLY.
 *
 * Reads go through the publishable (anon) client, so public RLS policies are
 * the single source of truth for what is exposed. Playoff seeds stay hidden
 * until the split's `playoff_reveal_at` timestamp has passed.
 */
import { createPublicClient } from "./supabase-public.server";

const SPLIT_SELECT = `
  id, slug, name, status, starts_at, ends_at, playoff_size,
  dispute_deadline_at, playoff_reveal_at,
  season:seasons!competitive_splits_season_id_fkey(id, name, slug, is_active),
  division:divisions!competitive_splits_division_id_fkey(id, code, name, accent),
  region:regions!competitive_splits_region_id_fkey(id, name, slug, kind)
`;

const SPLIT_TOURNAMENT_SELECT = `
  id, slug, name, subtitle, status, mode, format, prize, starts_at,
  registration_closes_at, participants_count, max_participants,
  qualifier_index, split_phase, entries_locked_at, bracket_generated_at, finalized_at
`;

export async function loadSplits() {
  const db = createPublicClient();
  const { data, error } = await db
    .from("competitive_splits")
    .select(SPLIT_SELECT)
    .order("starts_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadSplitDetail(slug: string) {
  const db = createPublicClient();
  const split = await db
    .from("competitive_splits")
    .select(SPLIT_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (split.error) throw new Error(split.error.message);
  if (!split.data) return null;

  const [tournaments, standings, qualifications] = await Promise.all([
    db
      .from("tournaments")
      .select(SPLIT_TOURNAMENT_SELECT)
      .eq("split_id", split.data.id)
      .order("qualifier_index", { ascending: true, nullsFirst: false })
      .order("starts_at"),
    db.rpc("split_standings", { p_split: split.data.id }),
    db
      .from("split_qualifications")
      .select(
        `id, status, qualification_position, playoff_seed, qualified_at,
         team:teams!split_qualifications_team_id_fkey(id, slug, name, tag, logo_url),
         replaces:teams!split_qualifications_replaces_team_id_fkey(id, slug, name, tag),
         qualified_from:tournaments!split_qualifications_qualified_from_tournament_id_fkey(slug, name, qualifier_index)`,
      )
      .eq("split_id", split.data.id)
      .order("qualification_position"),
  ]);

  if (standings.error) throw new Error(standings.error.message);
  if (qualifications.error) throw new Error(qualifications.error.message);

  const revealAt = split.data.playoff_reveal_at;
  const seedsRevealed = !revealAt || new Date(revealAt).getTime() <= Date.now();

  return {
    split: split.data,
    seedsRevealed,
    tournaments: tournaments.data ?? [],
    standings: standings.data ?? [],
    // Seeds are withheld from the public payload before the reveal moment.
    qualifications: (qualifications.data ?? []).map((row) => ({
      ...row,
      playoff_seed: seedsRevealed ? row.playoff_seed : null,
    })),
  };
}

/** Bracket for one tournament, grouped by zero-based round index. */
export async function loadTournamentBracket(slug: string) {
  const db = createPublicClient();
  const tournament = await db
    .from("tournaments")
    .select("id, slug, name, status, bracket_generated_at, finalized_at")
    .eq("slug", slug)
    .maybeSingle();
  if (tournament.error) throw new Error(tournament.error.message);
  if (!tournament.data) return null;

  const [matches, entries] = await Promise.all([
    db
      .from("matches")
      .select("*")
      .eq("tournament_id", tournament.data.id)
      .order("round_index")
      .order("bracket_slot"),
    db
      .from("tournament_entries")
      .select(
        `id, seed, placement, status,
         profile:profiles!tournament_entries_profile_id_fkey(handle, display_name),
         team:teams!tournament_entries_team_id_fkey(slug, name, tag)`,
      )
      .eq("tournament_id", tournament.data.id),
  ]);
  if (matches.error) throw new Error(matches.error.message);
  if (entries.error) throw new Error(entries.error.message);

  return { tournament: tournament.data, matches: matches.data ?? [], entries: entries.data ?? [] };
}
