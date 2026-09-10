import { cn } from "@/lib/utils";

export type BracketEntryLabel = {
  id: string;
  seed: number | null;
  label: string;
  tag?: string | null;
};

export type BracketMatchRow = {
  id: string;
  round_index: number;
  bracket_slot: number;
  round_label: string;
  best_of: number;
  status: string;
  entry_a_id: string | null;
  entry_b_id: string | null;
  score_a: number;
  score_b: number;
  winner_entry_id: string | null;
  is_bye: boolean;
  resolution_type?: string;
};

function Side({
  entry,
  score,
  isWinner,
  decided,
}: {
  entry: BracketEntryLabel | undefined;
  score: number;
  isWinner: boolean;
  decided: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-sm",
        decided && !isWinner && "text-muted-foreground",
        isWinner && "text-foreground",
      )}
    >
      <span className="w-6 shrink-0 text-xs font-semibold text-muted-foreground">
        {entry?.seed ? `#${entry.seed}` : "—"}
      </span>
      <span className={cn("truncate", isWinner && "font-semibold")}>
        {entry?.label ?? "TBD"}
        {entry?.tag ? (
          <span className="ml-1 text-xs text-muted-foreground">{entry.tag}</span>
        ) : null}
      </span>
      <span className={cn("text-xs font-semibold tabular-nums", isWinner && "text-gold")}>
        {decided ? score : ""}
      </span>
    </div>
  );
}

/** Read-only bracket rendered straight from zero-based (round, slot) coordinates. */
export function BracketView({
  matches,
  entries,
}: {
  matches: BracketMatchRow[];
  entries: BracketEntryLabel[];
}) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const rounds = [...new Set(matches.map((match) => match.round_index))].sort((a, b) => a - b);

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-4">
        {rounds.map((roundIndex) => {
          const roundMatches = matches
            .filter((match) => match.round_index === roundIndex)
            .sort((a, b) => a.bracket_slot - b.bracket_slot);
          return (
            <div key={roundIndex} className="w-72 shrink-0 space-y-3">
              <p className="eyebrow">{roundMatches[0]?.round_label ?? `Round ${roundIndex + 1}`}</p>
              {roundMatches.map((match) => {
                const decided = match.status === "completed";
                return (
                  <div
                    key={match.id}
                    className="bg-surface-gradient divide-y divide-border overflow-hidden rounded-lg border border-border"
                  >
                    <Side
                      entry={match.entry_a_id ? byId.get(match.entry_a_id) : undefined}
                      score={match.score_a}
                      isWinner={decided && match.winner_entry_id === match.entry_a_id}
                      decided={decided && !match.is_bye}
                    />
                    <Side
                      entry={match.entry_b_id ? byId.get(match.entry_b_id) : undefined}
                      score={match.score_b}
                      isWinner={decided && match.winner_entry_id === match.entry_b_id}
                      decided={decided && !match.is_bye}
                    />
                    <p className="px-3 py-1.5 text-[11px] tracking-wide text-muted-foreground uppercase">
                      {match.resolution_type === "walkover"
                        ? "Walkover — no match-win points"
                        : match.is_bye
                          ? "Bye — no points awarded"
                          : `Bo${match.best_of} · ${match.status}`}
                    </p>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function entryLabels(
  entries: {
    id: string;
    seed: number | null;
    profile?: { handle: string; display_name: string } | null;
    team?: { slug: string; name: string; tag: string } | null;
  }[],
): BracketEntryLabel[] {
  return entries.map((entry) => ({
    id: entry.id,
    seed: entry.seed,
    label: entry.team?.name ?? entry.profile?.display_name ?? "Unknown",
    tag: entry.team?.tag ?? null,
  }));
}
