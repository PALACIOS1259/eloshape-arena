import { Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  ExternalLink,
  Swords,
  Trophy,
} from "lucide-react";

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

const ROUND_WIDTH = 304;
const ROUND_GAP = 72;
const MATCH_HEIGHT = 118;
const MATCH_PITCH = 142;

function humanStatus(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function matchMeta(match: BracketMatchRow) {
  if (match.resolution_type === "walkover") {
    return {
      label: "Walkover",
      detail: "Counts as a match win",
      tone: "text-gold",
    };
  }
  if (match.is_bye) {
    return {
      label: "Bye",
      detail: "Advances without match-win points",
      tone: "text-muted-foreground",
    };
  }
  if (match.status === "completed") {
    return {
      label: `Bo${match.best_of} complete`,
      detail: "Final result",
      tone: "text-primary",
    };
  }
  return {
    label: `Bo${match.best_of}`,
    detail: humanStatus(match.status),
    tone: "text-muted-foreground",
  };
}

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
        "grid grid-cols-[2rem_minmax(0,1fr)_2rem] items-center gap-2 px-3 py-2.5 transition-colors",
        isWinner && "bg-primary/8",
        decided && !isWinner && "text-muted-foreground/70",
      )}
    >
      <span
        className={cn(
          "grid size-6 place-items-center rounded-md border border-border bg-background/40 text-[10px] font-black tabular-nums text-muted-foreground",
          isWinner && "border-primary/25 bg-primary/10 text-primary",
        )}
      >
        {entry?.seed ? entry.seed : "–"}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block truncate text-sm font-semibold text-foreground",
            isWinner && "font-black",
            !entry && "text-muted-foreground",
          )}
        >
          {entry?.label ?? "TBD"}
        </span>
        <span className="mt-0.5 block truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {entry?.tag ? `[${entry.tag}]` : entry ? "EloShape team" : "Awaiting winner"}
        </span>
      </span>
      <span
        className={cn(
          "grid size-7 place-items-center rounded-md text-sm font-black tabular-nums text-muted-foreground",
          isWinner && "bg-gold/12 text-gold",
        )}
      >
        {decided ? score : "–"}
      </span>
    </div>
  );
}

function MatchCard({
  match,
  byId,
  isFinal,
  linkMatches,
}: {
  match: BracketMatchRow;
  byId: Map<string, BracketEntryLabel>;
  isFinal: boolean;
  linkMatches: boolean;
}) {
  const decided = match.status === "completed";
  const meta = matchMeta(match);
  const canOpen =
    linkMatches && !match.is_bye && Boolean(match.entry_a_id) && Boolean(match.entry_b_id);

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-surface-gradient shadow-card transition-all hover:border-primary/35 hover:shadow-lg",
        isFinal && "border-gold/35 shadow-lg",
      )}
      style={{ width: ROUND_WIDTH, minHeight: MATCH_HEIGHT }}
    >
      <div
        className={cn(
          "flex items-center justify-between border-b border-border/70 bg-background/25 px-3 py-1.5",
          isFinal && "bg-gold/5",
        )}
      >
        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          {isFinal ? <Trophy className="size-3 text-gold" /> : <Swords className="size-3" />}
          Match {match.bracket_slot + 1}
        </span>
        <span className={cn("text-[10px] font-bold uppercase tracking-wider", meta.tone)}>
          {meta.label}
        </span>
      </div>

      <div className="divide-y divide-border/70">
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
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/70 bg-background/20 px-3 py-1.5">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
          {decided ? (
            <CheckCircle2 className="size-3 shrink-0 text-primary" />
          ) : (
            <CircleDashed className="size-3 shrink-0" />
          )}
          <span className="truncate">{meta.detail}</span>
        </span>
        {canOpen ? (
          <Link
            to="/matches/$matchId"
            params={{ matchId: match.id }}
            className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-primary hover:text-primary/80"
          >
            Match <ExternalLink className="size-3" />
          </Link>
        ) : null}
      </div>
    </article>
  );
}

/** Read-only tournament tree rendered from zero-based (round, slot) coordinates. */
export function BracketView({
  matches,
  entries,
  linkMatches = false,
}: {
  matches: BracketMatchRow[];
  entries: BracketEntryLabel[];
  linkMatches?: boolean;
}) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const rounds = [...new Set(matches.map((match) => match.round_index))].sort((a, b) => a - b);
  const roundMatches = rounds.map((roundIndex) =>
    matches
      .filter((match) => match.round_index === roundIndex)
      .sort((a, b) => a.bracket_slot - b.bracket_slot),
  );
  const maxMatches = Math.max(...roundMatches.map((round) => round.length), 1);
  const boardHeight = Math.max(360, maxMatches * MATCH_PITCH);
  const boardWidth = rounds.length * ROUND_WIDTH + Math.max(0, rounds.length - 1) * ROUND_GAP;
  const finalMatch = roundMatches.at(-1)?.[0];
  const champion = finalMatch?.winner_entry_id ? byId.get(finalMatch.winner_entry_id) : undefined;

  const centerY = (roundPosition: number, matchPosition: number) => {
    const count = roundMatches[roundPosition]?.length || 1;
    return ((matchPosition + 0.5) * boardHeight) / count;
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-background/20 shadow-card">
      <div className="flex flex-col gap-4 border-b border-border bg-surface-gradient px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow">Championship tree</span>
            <span className="rounded-md border border-border bg-background/35 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {entries.length} teams
            </span>
            <span className="rounded-md border border-border bg-background/35 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Single elimination
            </span>
          </div>
          <h3 className="mt-2 text-lg font-black text-foreground">Road to the championship</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Follow each matchup from the opening round to the final. Scroll sideways on smaller
            screens.
          </p>
        </div>

        {champion ? (
          <div className="flex items-center gap-3 rounded-xl border border-gold/30 bg-gold/8 px-3 py-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-gold/12 text-gold">
              <Trophy className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gold">
                Champion
              </p>
              <p className="max-w-44 truncate text-sm font-black text-foreground">
                {champion.label}
              </p>
            </div>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 self-start rounded-lg border border-border bg-background/30 px-3 py-2 text-xs font-semibold text-muted-foreground">
            <CircleDashed className="size-3.5" /> Championship in progress
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-max px-5 pb-6 pt-5">
          <div className="mb-4 flex" style={{ width: boardWidth }}>
            {rounds.map((roundIndex, position) => {
              const currentRound = roundMatches[position] ?? [];
              const label = currentRound[0]?.round_label ?? `Round ${roundIndex + 1}`;
              const isFinal = position === rounds.length - 1;
              return (
                <div
                  key={roundIndex}
                  className="shrink-0"
                  style={{
                    width: ROUND_WIDTH,
                    marginRight: position === rounds.length - 1 ? 0 : ROUND_GAP,
                  }}
                >
                  <div
                    className={cn(
                      "flex items-center justify-between rounded-lg border border-border bg-background/30 px-3 py-2",
                      isFinal && "border-gold/30 bg-gold/5",
                    )}
                  >
                    <div>
                      <p
                        className={cn(
                          "text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground",
                          isFinal && "text-gold",
                        )}
                      >
                        {isFinal ? "Championship" : `Round ${position + 1}`}
                      </p>
                      <p className="mt-0.5 text-sm font-black text-foreground">{label}</p>
                    </div>
                    <span className="rounded-md border border-border bg-background/40 px-2 py-1 text-[10px] font-bold tabular-nums text-muted-foreground">
                      {currentRound.length} {currentRound.length === 1 ? "match" : "matches"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="relative rounded-xl border border-border/70 bg-[radial-gradient(circle_at_center,hsl(var(--border)/0.24)_1px,transparent_1px)] [background-size:20px_20px]"
            style={{ width: boardWidth, height: boardHeight }}
          >
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 size-full overflow-visible text-border"
              width={boardWidth}
              height={boardHeight}
              viewBox={`0 0 ${boardWidth} ${boardHeight}`}
              fill="none"
            >
              {roundMatches.slice(0, -1).flatMap((round, roundPosition) => {
                const nextRound = roundMatches[roundPosition + 1] ?? [];
                return round.map((match, matchPosition) => {
                  const nextPosition = Math.min(
                    Math.floor(matchPosition / 2),
                    Math.max(0, nextRound.length - 1),
                  );
                  const x1 = roundPosition * (ROUND_WIDTH + ROUND_GAP) + ROUND_WIDTH;
                  const x2 = (roundPosition + 1) * (ROUND_WIDTH + ROUND_GAP);
                  const middleX = x1 + ROUND_GAP / 2;
                  const y1 = centerY(roundPosition, matchPosition);
                  const y2 = centerY(roundPosition + 1, nextPosition);
                  return (
                    <path
                      key={`${match.id}-connector`}
                      d={`M ${x1} ${y1} H ${middleX} V ${y2} H ${x2}`}
                      stroke="currentColor"
                      strokeWidth="1.5"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                });
              })}
            </svg>

            {roundMatches.flatMap((round, roundPosition) =>
              round.map((match, matchPosition) => {
                const left = roundPosition * (ROUND_WIDTH + ROUND_GAP);
                const top = centerY(roundPosition, matchPosition);
                const isFinal = roundPosition === roundMatches.length - 1;
                return (
                  <div
                    key={match.id}
                    className="absolute"
                    style={{
                      left,
                      top,
                      width: ROUND_WIDTH,
                      transform: "translateY(-50%)",
                    }}
                  >
                    <MatchCard
                      match={match}
                      byId={byId}
                      isFinal={isFinal}
                      linkMatches={linkMatches}
                    />
                  </div>
                );
              }),
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" /> Completed / winner
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full border border-border" /> Pending
            </span>
            <span className="inline-flex items-center gap-1.5 text-gold">
              <Trophy className="size-3" /> Championship match
            </span>
            <span className="ml-auto inline-flex items-center gap-1 text-muted-foreground">
              Progress flows left to right <ChevronRight className="size-3" />
            </span>
          </div>
        </div>
      </div>
    </section>
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
