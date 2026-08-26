/**
 * EloShape bracket engine — PURE, deterministic, no I/O.
 *
 * Coordinates are ZERO-BASED: a match is identified by (round_index, bracket_slot).
 * The winner of (r, p) always advances to (r + 1, floor(p / 2)), taking slot A
 * when p is even and slot B when p is odd. No next-match foreign keys exist.
 */

export type BracketCompetitor = {
  entryId: string;
  /** Deterministic ranking inputs. */
  points: number;
  wins: number;
  tournamentsPlayed: number;
  /** Normalized identifier used only as the final tie-breaker. */
  handle: string;
};

export type SeededCompetitor = { entryId: string; seed: number };

export type BracketMatch = {
  round_index: number;
  bracket_slot: number;
  round_label: string;
  best_of: number;
  status: "scheduled" | "completed";
  entry_a_id: string | null;
  entry_b_id: string | null;
  score_a: number;
  score_b: number;
  winner_entry_id: string | null;
  is_bye: boolean;
};

export type GeneratedBracket = {
  size: number;
  rounds: number;
  byes: number;
  seeds: SeededCompetitor[];
  matches: BracketMatch[];
};

/** Smallest power of two greater than or equal to `n` (minimum 2). */
export function bracketSize(n: number): number {
  if (n <= 2) return 2;
  let size = 2;
  while (size < n) size *= 2;
  return size;
}

/**
 * Standard balanced seed distribution: slot order for a bracket of `size`.
 * Seed 1 always meets the lowest seed / bye; seed 2 sits on the opposite side.
 */
export function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const len = order.length * 2;
    const next: number[] = [];
    for (const seed of order) {
      next.push(seed);
      next.push(len + 1 - seed);
    }
    order = next;
  }
  return order;
}

/** Coordinate of the match a winner advances into. */
export function nextCoordinate(roundIndex: number, bracketSlot: number) {
  return {
    round_index: roundIndex + 1,
    bracket_slot: Math.floor(bracketSlot / 2),
    slot: bracketSlot % 2 === 0 ? ("A" as const) : ("B" as const),
  };
}

/** Deterministic seeding: points, wins, tournaments played, then handle. */
export function seedCompetitors(competitors: BracketCompetitor[]): SeededCompetitor[] {
  return [...competitors]
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.wins - a.wins ||
        b.tournamentsPlayed - a.tournamentsPlayed ||
        a.handle.localeCompare(b.handle, "en"),
    )
    .map((competitor, index) => ({ entryId: competitor.entryId, seed: index + 1 }));
}

export function roundLabel(roundIndex: number, rounds: number): string {
  const remaining = rounds - 1 - roundIndex;
  if (remaining === 0) return "Final";
  if (remaining === 1) return "Semifinal";
  if (remaining === 2) return "Quarterfinal";
  const teams = 2 ** (remaining + 1);
  return `Round of ${teams}`;
}

export type BracketOptions = {
  /** Default series length for every round. */
  bestOf?: number;
  /** Per-round override, indexed by round_index. Never hardcode globally. */
  roundBestOf?: Record<number, number>;
};

/**
 * Build every bracket coordinate for the given competitors.
 * Byes are assigned by seeding (highest seeds first) and auto-advanced,
 * explicitly flagged so they can never award match-win points.
 */
export function buildBracket(
  competitors: BracketCompetitor[] | SeededCompetitor[],
  options: BracketOptions = {},
): GeneratedBracket {
  const seeds: SeededCompetitor[] =
    competitors.length && "seed" in competitors[0]!
      ? [...(competitors as SeededCompetitor[])].sort((a, b) => a.seed - b.seed)
      : seedCompetitors(competitors as BracketCompetitor[]);

  if (seeds.length < 2) throw new Error("A bracket needs at least two competitors.");

  const size = bracketSize(seeds.length);
  const rounds = Math.log2(size);
  const order = seedOrder(size);
  const bySeed = new Map(seeds.map((entry) => [entry.seed, entry.entryId]));
  const bestOf = options.bestOf ?? 1;
  const seriesFor = (roundIndex: number) => options.roundBestOf?.[roundIndex] ?? bestOf;

  const matches: BracketMatch[] = [];
  for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
    const count = size / 2 ** (roundIndex + 1);
    for (let slot = 0; slot < count; slot += 1) {
      matches.push({
        round_index: roundIndex,
        bracket_slot: slot,
        round_label: roundLabel(roundIndex, rounds),
        best_of: seriesFor(roundIndex),
        status: "scheduled",
        entry_a_id: null,
        entry_b_id: null,
        score_a: 0,
        score_b: 0,
        winner_entry_id: null,
        is_bye: false,
      });
    }
  }

  const at = (roundIndex: number, slot: number) =>
    matches.find((m) => m.round_index === roundIndex && m.bracket_slot === slot)!;

  let byes = 0;
  const firstRoundCount = size / 2;
  for (let slot = 0; slot < firstRoundCount; slot += 1) {
    const match = at(0, slot);
    match.entry_a_id = bySeed.get(order[slot * 2]!) ?? null;
    match.entry_b_id = bySeed.get(order[slot * 2 + 1]!) ?? null;

    const present = match.entry_a_id ?? match.entry_b_id;
    if (match.entry_a_id && match.entry_b_id) continue;
    if (!present) continue;

    // Bye: never a competitive victory.
    byes += 1;
    match.is_bye = true;
    match.status = "completed";
    match.winner_entry_id = present;

    if (rounds > 1) {
      const next = nextCoordinate(0, slot);
      const nextMatch = at(next.round_index, next.bracket_slot);
      if (next.slot === "A") nextMatch.entry_a_id = present;
      else nextMatch.entry_b_id = present;
    }
  }

  return { size, rounds, byes, seeds, matches };
}
