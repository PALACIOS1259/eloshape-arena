import { describe, expect, it } from "vitest";

import {
  bracketSize,
  buildBracket,
  nextCoordinate,
  seedCompetitors,
  seedOrder,
  type BracketCompetitor,
} from "./bracket";

function field(n: number): BracketCompetitor[] {
  return Array.from({ length: n }, (_, i) => ({
    entryId: `e${i + 1}`,
    points: (n - i) * 10,
    wins: n - i,
    tournamentsPlayed: 3,
    handle: `team-${String(i + 1).padStart(2, "0")}`,
  }));
}

describe("bracketSize", () => {
  it("uses the smallest power of two >= N", () => {
    expect(bracketSize(2)).toBe(2);
    expect(bracketSize(8)).toBe(8);
    expect(bracketSize(13)).toBe(16);
    expect(bracketSize(16)).toBe(16);
    expect(bracketSize(19)).toBe(32);
  });
});

describe("seedOrder", () => {
  it("produces standard balanced distribution", () => {
    expect(seedOrder(2)).toEqual([1, 2]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(seedOrder(16)).toHaveLength(16);
    expect(new Set(seedOrder(16)).size).toBe(16);
  });

  it("keeps seed 1 and seed 2 in opposite halves", () => {
    for (const size of [4, 8, 16, 32]) {
      const order = seedOrder(size);
      const one = order.indexOf(1);
      const two = order.indexOf(2);
      expect(one < size / 2).toBe(true);
      expect(two >= size / 2).toBe(true);
    }
  });
});

describe("seedCompetitors", () => {
  it("is deterministic and falls back to handle", () => {
    const tied: BracketCompetitor[] = [
      { entryId: "b", points: 10, wins: 1, tournamentsPlayed: 1, handle: "zeta" },
      { entryId: "a", points: 10, wins: 1, tournamentsPlayed: 1, handle: "alpha" },
    ];
    expect(seedCompetitors(tied).map((s) => s.entryId)).toEqual(["a", "b"]);
    expect(seedCompetitors(tied)).toEqual(seedCompetitors(tied));
  });
});

describe("buildBracket", () => {
  it.each([
    [2, 2, 1, 0],
    [4, 4, 2, 0],
    [8, 8, 3, 0],
    [13, 16, 4, 3],
    [16, 16, 4, 0],
  ])("field of %i -> size %i", (entrants, size, rounds, byes) => {
    const bracket = buildBracket(field(entrants), { bestOf: 3 });
    expect(bracket.size).toBe(size);
    expect(bracket.rounds).toBe(rounds);
    expect(bracket.byes).toBe(byes);
    expect(bracket.matches).toHaveLength(size - 1);

    const coords = new Set(bracket.matches.map((m) => `${m.round_index}:${m.bracket_slot}`));
    expect(coords.size).toBe(bracket.matches.length);
    expect(Math.min(...bracket.matches.map((m) => m.round_index))).toBe(0);
    expect(Math.min(...bracket.matches.map((m) => m.bracket_slot))).toBe(0);
  });

  it("gives seed 1 the lowest opponent or a bye", () => {
    const bracket = buildBracket(field(13));
    const first = bracket.matches.find((m) => m.round_index === 0 && m.bracket_slot === 0)!;
    expect(first.entry_a_id).toBe("e1");
    expect(first.entry_b_id).toBeNull();
    expect(first.is_bye).toBe(true);
  });

  it("assigns byes to the highest seeds deterministically", () => {
    const bracket = buildBracket(field(13));
    const byeWinners = bracket.matches
      .filter((m) => m.is_bye)
      .map((m) => m.winner_entry_id)
      .sort();
    expect(byeWinners).toEqual(["e1", "e2", "e3"]);
    expect(buildBracket(field(13))).toEqual(bracket);
  });

  it("auto-advances byes without a played series", () => {
    const bracket = buildBracket(field(13));
    const bye = bracket.matches.find((m) => m.is_bye)!;
    expect(bye.status).toBe("completed");
    expect(bye.score_a).toBe(0);
    expect(bye.score_b).toBe(0);
    const next = nextCoordinate(bye.round_index, bye.bracket_slot);
    const nextMatch = bracket.matches.find(
      (m) => m.round_index === next.round_index && m.bracket_slot === next.bracket_slot,
    )!;
    expect(next.slot === "A" ? nextMatch.entry_a_id : nextMatch.entry_b_id).toBe(
      bye.winner_entry_id,
    );
  });

  it("supports per-round series length", () => {
    const bracket = buildBracket(field(16), { bestOf: 1, roundBestOf: { 2: 3, 3: 5 } });
    expect(bracket.matches.find((m) => m.round_index === 0)!.best_of).toBe(1);
    expect(bracket.matches.find((m) => m.round_index === 2)!.best_of).toBe(3);
    expect(bracket.matches.find((m) => m.round_index === 3)!.best_of).toBe(5);
  });
});

describe("advancement coordinates", () => {
  it("maps (0,p) -> (1, floor(p/2)) with alternating slots", () => {
    expect(nextCoordinate(0, 0)).toEqual({ round_index: 1, bracket_slot: 0, slot: "A" });
    expect(nextCoordinate(0, 1)).toEqual({ round_index: 1, bracket_slot: 0, slot: "B" });
    expect(nextCoordinate(0, 2)).toEqual({ round_index: 1, bracket_slot: 1, slot: "A" });
    expect(nextCoordinate(0, 3)).toEqual({ round_index: 1, bracket_slot: 1, slot: "B" });
    expect(nextCoordinate(3, 1)).toEqual({ round_index: 4, bracket_slot: 0, slot: "B" });
  });
});
