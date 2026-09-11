import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Gavel,
  LockKeyhole,
  Play,
  ShieldCheck,
  Swords,
  Trophy,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BracketView, entryLabels, type BracketMatchRow } from "@/components/eloshape/BracketView";
import { EmptyState } from "@/components/eloshape/EmptyState";
import { StatusBadge } from "@/components/eloshape/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  advanceSplitStatus,
  buildSplitPlayoffs,
  closeTournament,
  correctCompletedMatchResult,
  generateBracket,
  getStaffSplits,
  getTournamentOps,
  lockEntries,
  recordMatchWalkover,
  submitMatchResult,
} from "@/lib/competition.functions";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const SPLIT_STAGES = [
  "upcoming",
  "qualifiers",
  "seeding",
  "playoffs",
  "semifinals",
  "final",
  "completed",
];
const NEXT_SPLIT_STAGE: Record<string, string | null> = {
  upcoming: "qualifiers",
  qualifiers: "seeding",
  seeding: "playoffs",
  playoffs: "semifinals",
  semifinals: "final",
  final: "completed",
  completed: null,
  cancelled: null,
};

type Result = { ok: boolean; error?: string };
type AdminView = "tournaments" | "splits";

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function useOp(invalidate: () => void) {
  return (label: string) => ({
    onSuccess: (result: Result) => {
      if (!result.ok) {
        toast.error(result.error ?? `${label} failed.`);
        return;
      }
      toast.success(`${label} done.`);
      invalidate();
    },
    onError: () => toast.error(`${label} failed.`),
  });
}

function MatchReporter({
  matchId,
  bestOf,
  entryA,
  entryB,
  onDone,
}: {
  matchId: string;
  bestOf: number;
  entryA: { id: string; label: string };
  entryB: { id: string; label: string };
  onDone: () => void;
}) {
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [walkoverNote, setWalkoverNote] = useState("");
  const report = useServerFn(submitMatchResult);
  const walkover = useServerFn(recordMatchWalkover);

  const mutation = useMutation({
    mutationFn: () => report({ data: { matchId, scoreA: Number(scoreA), scoreB: Number(scoreB) } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Result recorded.");
      setScoreA("");
      setScoreB("");
      onDone();
    },
    onError: () => toast.error("Could not record the result."),
  });

  const walkoverMutation = useMutation({
    mutationFn: (winnerEntryId: string) =>
      walkover({ data: { matchId, winnerEntryId, note: walkoverNote } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Walkover recorded as a match win.");
      setWalkoverNote("");
      onDone();
    },
    onError: () => toast.error("Could not record the walkover."),
  });

  const parsedA = Number(scoreA);
  const parsedB = Number(scoreB);
  const winsRequired = Math.floor(bestOf / 2) + 1;
  const validSeriesScore =
    scoreA !== "" &&
    scoreB !== "" &&
    Number.isInteger(parsedA) &&
    Number.isInteger(parsedB) &&
    parsedA >= 0 &&
    parsedB >= 0 &&
    parsedA !== parsedB &&
    parsedA + parsedB <= bestOf &&
    Math.max(parsedA, parsedB) === winsRequired;
  const pending = mutation.isPending || walkoverMutation.isPending;

  const confirmWalkover = (entry: { id: string; label: string }) => {
    const confirmed = window.confirm(
      `Award this match to ${entry.label} by walkover? The team will advance and receive the normal match-win points.`,
    );
    if (confirmed) walkoverMutation.mutate(entry.id);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-background/40 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">Record match result</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Best of {bestOf} · first to {winsRequired} win{winsRequired === 1 ? "" : "s"}
            </p>
          </div>
          <Badge variant="outline">Competitive result</Badge>
        </div>

        <div className="grid gap-2">
          <label className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-3 rounded-md border border-border bg-card/60 px-3 py-2">
            <span className="min-w-0 truncate text-sm font-medium text-foreground">
              {entryA.label}
            </span>
            <Input
              aria-label={`Score for ${entryA.label}`}
              className="text-center"
              inputMode="numeric"
              placeholder="0"
              value={scoreA}
              onChange={(event) => setScoreA(event.target.value)}
            />
          </label>
          <label className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-3 rounded-md border border-border bg-card/60 px-3 py-2">
            <span className="min-w-0 truncate text-sm font-medium text-foreground">
              {entryB.label}
            </span>
            <Input
              aria-label={`Score for ${entryB.label}`}
              className="text-center"
              inputMode="numeric"
              placeholder="0"
              value={scoreB}
              onChange={(event) => setScoreB(event.target.value)}
            />
          </label>
        </div>

        {scoreA !== "" && scoreB !== "" && !validSeriesScore ? (
          <p className="mt-2 text-xs text-destructive">
            Enter a valid best-of-{bestOf} result. One team must reach {winsRequired} win
            {winsRequired === 1 ? "" : "s"}.
          </p>
        ) : null}

        <div className="mt-3 flex justify-end">
          <Button disabled={pending || !validSeriesScore} onClick={() => mutation.mutate()}>
            <ClipboardCheck />
            Save result
          </Button>
        </div>
      </div>

      <details className="group rounded-lg border border-border bg-background/20">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
          <span className="flex items-center gap-2">
            <Gavel className="size-4" />
            Administrative actions
          </span>
          <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
        </summary>
        <div className="border-t border-border p-4">
          <p className="text-sm font-semibold text-foreground">Declare walkover</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Use only for a documented no-show or administrative ruling. A walkover advances the
            winner and counts exactly like a played match win for EloShape points.
          </p>
          <Input
            aria-label="Walkover reason"
            className="mt-3"
            maxLength={1000}
            placeholder="Required reason, e.g. opponent no-show"
            value={walkoverNote}
            onChange={(event) => setWalkoverNote(event.target.value)}
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              disabled={pending || walkoverNote.trim().length < 3}
              onClick={() => confirmWalkover(entryA)}
            >
              Award W/O to {entryA.label}
            </Button>
            <Button
              variant="outline"
              disabled={pending || walkoverNote.trim().length < 3}
              onClick={() => confirmWalkover(entryB)}
            >
              Award W/O to {entryB.label}
            </Button>
          </div>
        </div>
      </details>
    </div>
  );
}

function CompletedMatchCorrection({
  match,
  entryA,
  entryB,
  onDone,
}: {
  match: BracketMatchRow;
  entryA: { id: string; label: string };
  entryB: { id: string; label: string };
  onDone: () => void;
}) {
  const [scoreA, setScoreA] = useState(String(match.score_a));
  const [scoreB, setScoreB] = useState(String(match.score_b));
  const [note, setNote] = useState("");
  const correct = useServerFn(correctCompletedMatchResult);

  const mutation = useMutation({
    mutationFn: () =>
      correct({
        data: {
          matchId: match.id,
          scoreA: Number(scoreA),
          scoreB: Number(scoreB),
          note,
        },
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        const message = result.error.includes("downstream_match_already_started")
          ? "The next-round match already has activity. This result cannot be changed safely."
          : result.error.includes("tournament_finalized")
            ? "Finalized tournaments cannot be corrected."
            : result.error;
        toast.error(message);
        return;
      }
      toast.success("Result corrected and added to the audit trail.");
      setNote("");
      onDone();
    },
    onError: () => toast.error("Could not correct the result."),
  });

  const parsedA = Number(scoreA);
  const parsedB = Number(scoreB);
  const scoresAreIntegers = Number.isInteger(parsedA) && Number.isInteger(parsedB);
  const winsRequired = Math.floor(match.best_of / 2) + 1;
  const validSeriesScore =
    scoresAreIntegers &&
    parsedA >= 0 &&
    parsedB >= 0 &&
    parsedA !== parsedB &&
    parsedA + parsedB <= match.best_of &&
    Math.max(parsedA, parsedB) === winsRequired;
  const changed = parsedA !== match.score_a || parsedB !== match.score_b;

  const confirmCorrection = () => {
    const newWinner = parsedA > parsedB ? entryA : entryB;
    const winnerChanges = newWinner.id !== match.winner_entry_id;
    const warning = winnerChanges
      ? ` This changes the winner to ${newWinner.label} and will replace the next-round entrant only if that match has not started.`
      : "";
    if (
      window.confirm(
        `Correct ${entryA.label} vs ${entryB.label} to ${parsedA}-${parsedB}?${warning} This change is audited.`,
      )
    ) {
      mutation.mutate();
    }
  };

  return (
    <details className="group rounded-lg border border-border bg-background/20">
      <summary className="grid cursor-pointer list-none gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {entryA.label} {match.score_a}–{match.score_b} {entryB.label}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {match.round_label} · Best of {match.best_of}
          </p>
        </div>
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          Edit result
          <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
        </span>
      </summary>
      <div className="border-t border-border p-4">
        <div className="mb-3 rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-muted-foreground">
          Corrections are audited. If changing the winner would conflict with activity in the next
          round, EloShape blocks the change automatically.
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">{entryA.label}</span>
            <Input
              aria-label={`Corrected score for ${entryA.label}`}
              inputMode="numeric"
              value={scoreA}
              onChange={(event) => setScoreA(event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">{entryB.label}</span>
            <Input
              aria-label={`Corrected score for ${entryB.label}`}
              inputMode="numeric"
              value={scoreB}
              onChange={(event) => setScoreB(event.target.value)}
            />
          </label>
        </div>
        <Input
          aria-label="Result correction reason"
          className="mt-3"
          maxLength={1000}
          placeholder="Required correction reason"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        {!validSeriesScore && scoreA !== "" && scoreB !== "" ? (
          <p className="mt-2 text-xs text-destructive">
            Enter a valid best-of-{match.best_of} result.
          </p>
        ) : null}
        <div className="mt-3 flex justify-end">
          <Button
            variant="outline"
            disabled={mutation.isPending || !validSeriesScore || !changed || note.trim().length < 3}
            onClick={confirmCorrection}
          >
            Save correction
          </Button>
        </div>
      </div>
    </details>
  );
}

function WorkflowStep({ label, state }: { label: string; state: "done" | "current" | "pending" }) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium",
        state === "done" && "border-emerald-500/25 bg-emerald-500/5 text-emerald-300",
        state === "current" && "border-primary/35 bg-primary/10 text-foreground",
        state === "pending" && "border-border bg-background/30 text-muted-foreground",
      )}
    >
      {state === "done" ? (
        <CheckCircle2 className="size-4 shrink-0" />
      ) : state === "current" ? (
        <CircleDot className="size-4 shrink-0" />
      ) : (
        <span className="size-4 shrink-0 rounded-full border border-border" />
      )}
      <span className="truncate">{label}</span>
    </div>
  );
}

function TournamentOps({ tournamentId }: { tournamentId: string }) {
  const queryClient = useQueryClient();
  const fetchOps = useServerFn(getTournamentOps);
  const lock = useServerFn(lockEntries);
  const bracket = useServerFn(generateBracket);
  const close = useServerFn(closeTournament);
  const [bestOf, setBestOf] = useState(1);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["tournament-ops", tournamentId] });
    void queryClient.invalidateQueries({ queryKey: ["staff-splits"] });
  };
  const handlers = useOp(invalidate);

  const { data, isPending } = useQuery({
    queryKey: ["tournament-ops", tournamentId],
    queryFn: () => fetchOps({ data: { tournamentId } }),
    retry: false,
  });

  const lockMutation = useMutation({
    mutationFn: () => lock({ data: { tournamentId } }),
    ...handlers("Roster lock"),
  });
  const bracketMutation = useMutation({
    mutationFn: () => bracket({ data: { tournamentId, bestOf } }),
    ...handlers("Bracket generation"),
  });
  const closeMutation = useMutation({
    mutationFn: () => close({ data: { tournamentId } }),
    ...handlers("Tournament finalization"),
  });

  if (isPending) return <Skeleton className="h-56 w-full" />;
  if (!data?.tournament) return <EmptyState title="Tournament not found" />;

  const t = data.tournament;
  const labels = entryLabels(data.entries);
  const byId = new Map(labels.map((entry) => [entry.id, entry.label]));
  const readyMatches = data.matches.filter(
    (match) =>
      match.status !== "completed" &&
      !match.is_bye &&
      Boolean(match.entry_a_id && match.entry_b_id),
  );
  const waitingMatches = data.matches.filter(
    (match) =>
      match.status !== "completed" && !match.is_bye && !(match.entry_a_id && match.entry_b_id),
  );
  const correctableMatches = data.matches.filter(
    (match) =>
      match.status === "completed" &&
      !match.is_bye &&
      match.resolution_type === "played" &&
      match.entry_a_id &&
      match.entry_b_id,
  );
  const competitiveCompleted = data.matches.filter(
    (match) =>
      match.status === "completed" &&
      (match.resolution_type === "played" || match.resolution_type === "walkover"),
  ).length;
  const finalRound = data.matches.reduce((max, match) => Math.max(max, match.round_index), -1);
  const finalMatch = data.matches.find(
    (match) => match.round_index === finalRound && match.bracket_slot === 0,
  );
  const finalComplete = Boolean(
    finalMatch && finalMatch.status === "completed" && finalMatch.winner_entry_id,
  );
  const pending = lockMutation.isPending || bracketMutation.isPending || closeMutation.isPending;

  const workflowCurrent = t.finalized_at
    ? 4
    : !t.entries_locked_at
      ? 0
      : !t.bracket_generated_at
        ? 1
        : !finalComplete
          ? 2
          : 3;
  const workflow = ["Registration", "Bracket setup", "Run matches", "Finalize", "Complete"];

  const confirmLock = () => {
    if (
      window.confirm(
        "Lock checked-in eligible rosters? This creates the tournament roster snapshot used for the bracket and scoring.",
      )
    ) {
      lockMutation.mutate();
    }
  };

  const confirmFinalize = () => {
    if (
      window.confirm(
        "Finalize this tournament and award all EloShape points? After finalization, completed results become read-only.",
      )
    ) {
      closeMutation.mutate();
    }
  };

  return (
    <div className="space-y-6 border-t border-border bg-background/15 p-4 sm:p-6">
      <section>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-foreground">Tournament workspace</p>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              EloShape only shows the action that matters for the tournament's current stage.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={t.status} />
            <Badge variant="outline">{data.entries.length} entrants</Badge>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-5">
          {workflow.map((label, index) => (
            <WorkflowStep
              key={label}
              label={label}
              state={
                index < workflowCurrent ? "done" : index === workflowCurrent ? "current" : "pending"
              }
            />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-primary/20 bg-primary/5 p-4 sm:p-5">
        {!t.entries_locked_at ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="eyebrow text-primary">Next action</p>
              <h3 className="mt-1 text-base font-semibold text-foreground">
                Lock tournament rosters
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Freeze the checked-in eligible rosters before creating the bracket. This prevents
                live team changes from changing tournament eligibility.
              </p>
            </div>
            <Button disabled={pending} onClick={confirmLock}>
              <LockKeyhole />
              Lock rosters
            </Button>
          </div>
        ) : !t.bracket_generated_at ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="eyebrow text-primary">Next action</p>
              <h3 className="mt-1 text-base font-semibold text-foreground">Generate the bracket</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Rosters are locked. Choose the series format and EloShape will seed the bracket from
                the locked field.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Bracket best-of format"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none focus:ring-1 focus:ring-ring"
                value={bestOf}
                onChange={(event) => setBestOf(Number(event.target.value))}
              >
                <option value={1}>Best of 1</option>
                <option value={3}>Best of 3</option>
              </select>
              <Button disabled={pending} onClick={() => bracketMutation.mutate()}>
                <Swords />
                Generate bracket
              </Button>
            </div>
          </div>
        ) : !finalComplete ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="eyebrow text-primary">Tournament live</p>
              <h3 className="mt-1 text-base font-semibold text-foreground">
                Run the ready matches
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {competitiveCompleted} competitive result{competitiveCompleted === 1 ? "" : "s"}{" "}
                recorded · {readyMatches.length} ready now · {waitingMatches.length} waiting on an
                earlier round.
              </p>
            </div>
            <Badge variant={readyMatches.length ? "default" : "outline"}>
              {readyMatches.length
                ? `${readyMatches.length} need action`
                : "Waiting for bracket progression"}
            </Badge>
          </div>
        ) : !t.finalized_at ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="eyebrow text-primary">Final complete</p>
              <h3 className="mt-1 text-base font-semibold text-foreground">
                Finalize and award points
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                The champion is decided. Finalization calculates placements, match wins, phase
                rewards and qualification results.
              </p>
            </div>
            <Button disabled={pending} onClick={confirmFinalize}>
              <Trophy />
              Finalize tournament
            </Button>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" />
            <div>
              <p className="font-semibold text-foreground">Tournament finalized</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Points and placements are locked. Finalized {formatDate(t.finalized_at)}.
              </p>
            </div>
          </div>
        )}
      </section>

      {data.matches.length ? (
        <>
          <details className="group rounded-lg border border-border bg-surface-gradient" open>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Bracket overview</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.matches.length} total match slot{data.matches.length === 1 ? "" : "s"}
                </p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
            </summary>
            <div className="border-t border-border p-3 sm:p-4">
              <BracketView matches={data.matches} entries={labels} />
            </div>
          </details>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Matches requiring action</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ready matches appear first. Waiting matches unlock automatically as winners
                  advance.
                </p>
              </div>
              <Badge variant={readyMatches.length ? "default" : "outline"}>
                {readyMatches.length} ready
              </Badge>
            </div>

            {readyMatches.length ? (
              <div className="space-y-3">
                {readyMatches.map((match) => {
                  const entryA = {
                    id: match.entry_a_id!,
                    label: byId.get(match.entry_a_id!) ?? "Team A",
                  };
                  const entryB = {
                    id: match.entry_b_id!,
                    label: byId.get(match.entry_b_id!) ?? "Team B",
                  };
                  return (
                    <div
                      key={match.id}
                      className="rounded-lg border border-border bg-surface-gradient p-4 sm:p-5"
                    >
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="eyebrow">
                            {match.round_label} · Match {match.bracket_slot + 1}
                          </p>
                          <h4 className="mt-1 text-base font-semibold text-foreground">
                            {entryA.label} <span className="text-muted-foreground">vs</span>{" "}
                            {entryB.label}
                          </h4>
                        </div>
                        <Badge variant="outline">Bo{match.best_of}</Badge>
                      </div>
                      <MatchReporter
                        matchId={match.id}
                        bestOf={match.best_of}
                        entryA={entryA}
                        entryB={entryB}
                        onDone={invalidate}
                      />
                    </div>
                  );
                })}
              </div>
            ) : t.bracket_generated_at && !t.finalized_at ? (
              <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
                No match needs a result right now.
              </div>
            ) : null}

            {waitingMatches.length ? (
              <details className="group mt-3 rounded-lg border border-border bg-background/20">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm text-muted-foreground">
                  <span>{waitingMatches.length} waiting on earlier rounds</span>
                  <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
                </summary>
                <div className="border-t border-border">
                  {waitingMatches.map((match) => (
                    <div
                      key={match.id}
                      className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {match.round_label} · Match {match.bracket_slot + 1}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {byId.get(match.entry_a_id ?? "") ?? "TBD"} vs{" "}
                          {byId.get(match.entry_b_id ?? "") ?? "TBD"}
                        </p>
                      </div>
                      <Badge variant="outline">Waiting</Badge>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </section>

          {correctableMatches.length ? (
            <section>
              <div className="mb-3">
                <p className="text-sm font-semibold text-foreground">Completed results</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Open a match only when a submitted result must be corrected.
                </p>
              </div>
              {t.finalized_at ? (
                <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                  This tournament is finalized. Results are read-only.
                </div>
              ) : (
                <div className="space-y-2">
                  {correctableMatches.map((match) => {
                    const entryA = {
                      id: match.entry_a_id!,
                      label: byId.get(match.entry_a_id!) ?? "Team A",
                    };
                    const entryB = {
                      id: match.entry_b_id!,
                      label: byId.get(match.entry_b_id!) ?? "Team B",
                    };
                    return (
                      <CompletedMatchCorrection
                        key={match.id}
                        match={match}
                        entryA={entryA}
                        entryB={entryB}
                        onDone={invalidate}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}
        </>
      ) : (
        <EmptyState
          title="No bracket yet"
          description="Lock rosters first, then generate the bracket."
        />
      )}

      {data.auditLog.length ? (
        <details className="group rounded-lg border border-border bg-background/20">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ShieldCheck className="size-4" />
              Audit trail ({data.auditLog.length})
            </span>
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
          </summary>
          <div className="border-t border-border">
            {data.auditLog.map((entry) => (
              <div
                key={entry.id}
                className="grid gap-1 border-b border-border px-4 py-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <span className="text-sm font-medium text-foreground">
                  {humanize(entry.action)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(entry.created_at)}
                </span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function TournamentStageLabel({
  tournament,
}: {
  tournament: {
    entries_locked_at: string | null;
    bracket_generated_at: string | null;
    finalized_at: string | null;
    status: string;
  };
}) {
  if (tournament.finalized_at) return <Badge>Complete</Badge>;
  if (!tournament.entries_locked_at)
    return <Badge variant="outline">Registration / check-in</Badge>;
  if (!tournament.bracket_generated_at) return <Badge variant="outline">Needs bracket</Badge>;
  return <Badge variant="outline">Tournament running</Badge>;
}

function SplitStageRail({ current }: { current: string }) {
  const currentIndex = SPLIT_STAGES.indexOf(current);
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {SPLIT_STAGES.filter((stage) => stage !== "upcoming" || current === "upcoming").map(
        (stage) => {
          const index = SPLIT_STAGES.indexOf(stage);
          const active = stage === current;
          const complete = currentIndex >= 0 && index < currentIndex;
          return (
            <span
              key={stage}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                active && "border-primary/40 bg-primary/10 text-foreground",
                complete && "border-emerald-500/20 bg-emerald-500/5 text-emerald-300",
                !active && !complete && "border-border text-muted-foreground",
              )}
            >
              {humanize(stage)}
            </span>
          );
        },
      )}
    </div>
  );
}

/** Staff-only competition operations: clear tournament workspaces and guided Semi-Split controls. */
export function CompetitionOpsPanel() {
  const queryClient = useQueryClient();
  const fetchSplits = useServerFn(getStaffSplits);
  const advance = useServerFn(advanceSplitStatus);
  const playoffs = useServerFn(buildSplitPlayoffs);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<AdminView>("tournaments");

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["staff-splits"] });
  const handlers = useOp(invalidate);

  const { data, isPending } = useQuery({
    queryKey: ["staff-splits"],
    queryFn: () => fetchSplits(),
    retry: false,
  });

  const stageMutation = useMutation({
    mutationFn: (input: { splitId: string; status: string }) => advance({ data: input }),
    ...handlers("Stage change"),
  });
  const playoffMutation = useMutation({
    mutationFn: (input: { splitId: string; allowShortField?: boolean; reason?: string }) =>
      playoffs({ data: { bestOf: 3, ...input } }),
    ...handlers("Playoff generation"),
  });

  if (isPending) return <Skeleton className="h-64 w-full" />;
  if (!data) return <EmptyState title="Staff access required" />;

  const activeTournaments = data.tournaments.filter(
    (tournament) => !tournament.finalized_at,
  ).length;
  const completedTournaments = data.tournaments.length - activeTournaments;
  const activeSplits = data.splits.filter(
    (split) => !["completed", "cancelled"].includes(split.status),
  ).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface-gradient p-4">
          <p className="eyebrow">Active tournaments</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{activeTournaments}</p>
          <p className="mt-1 text-xs text-muted-foreground">Need monitoring or progression</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-gradient p-4">
          <p className="eyebrow">Completed</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{completedTournaments}</p>
          <p className="mt-1 text-xs text-muted-foreground">Finalized tournaments in this list</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-gradient p-4">
          <p className="eyebrow">Active Semi-Splits</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{activeSplits}</p>
          <p className="mt-1 text-xs text-muted-foreground">Circuit stages still in progress</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        <Button
          size="sm"
          variant={view === "tournaments" ? "default" : "ghost"}
          onClick={() => setView("tournaments")}
        >
          <Swords />
          Tournaments
        </Button>
        <Button
          size="sm"
          variant={view === "splits" ? "default" : "ghost"}
          onClick={() => setView("splits")}
        >
          <Trophy />
          Semi-Splits
        </Button>
      </div>

      {view === "tournaments" ? (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Tournament operations</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Open one tournament at a time. The workspace guides you from roster lock to final
              scoring.
            </p>
          </div>

          {data.tournaments.length ? (
            <div className="overflow-hidden rounded-lg border border-border bg-surface-gradient">
              {data.tournaments.map((tournament) => {
                const isSelected = selected === tournament.id;
                return (
                  <div key={tournament.id} className="border-b border-border last:border-0">
                    <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {tournament.name}
                          </p>
                          {tournament.qualifier_index ? (
                            <Badge variant="outline">Qualifier #{tournament.qualifier_index}</Badge>
                          ) : null}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{tournament.participants_count} entrants</span>
                          <span aria-hidden="true">·</span>
                          <span>{humanize(tournament.status)}</span>
                          <TournamentStageLabel tournament={tournament} />
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={isSelected ? "secondary" : "outline"}
                        onClick={() => setSelected(isSelected ? null : tournament.id)}
                      >
                        {isSelected ? "Close workspace" : "Open workspace"}
                        <ChevronRight
                          className={cn("transition-transform", isSelected && "rotate-90")}
                        />
                      </Button>
                    </div>
                    {isSelected ? <TournamentOps tournamentId={tournament.id} /> : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No tournaments" />
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Semi-Split progression</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Only the next valid stage is offered. Playoff generation is separated from stage
              progression so it is harder to click the wrong action.
            </p>
          </div>

          {data.splits.length ? (
            <div className="space-y-3">
              {data.splits.map((split) => {
                const nextStage = NEXT_SPLIT_STAGE[split.status] ?? null;
                const isSeeding = split.status === "seeding";
                return (
                  <div
                    key={split.id}
                    className="rounded-lg border border-border bg-surface-gradient p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {split.name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(split.starts_at)} — {formatDate(split.ends_at)} ·{" "}
                          {split.playoff_size} playoff slots
                        </p>
                      </div>
                      <StatusBadge status={split.status} />
                    </div>

                    <SplitStageRail current={split.status} />

                    <div className="mt-4 rounded-lg border border-border bg-background/30 p-4">
                      {isSeeding ? (
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              Build the playoff field
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                              Generate the {split.playoff_size}-team playoff bracket from qualified
                              teams before moving the split into playoffs.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              disabled={playoffMutation.isPending}
                              onClick={() => playoffMutation.mutate({ splitId: split.id })}
                            >
                              <Play />
                              Generate playoffs ({split.playoff_size})
                            </Button>
                            <details className="group">
                              <summary className="list-none">
                                <Button asChild variant="outline">
                                  <span>
                                    <AlertTriangle />
                                    Short-field override
                                  </span>
                                </Button>
                              </summary>
                              <div className="mt-3 max-w-xl rounded-md border border-amber-500/25 bg-amber-500/5 p-3">
                                <p className="text-xs leading-relaxed text-muted-foreground">
                                  Emergency only. EloShape requires a written reason before creating
                                  playoffs with fewer than {split.playoff_size} qualified teams.
                                </p>
                                <Button
                                  className="mt-3"
                                  size="sm"
                                  variant="outline"
                                  disabled={playoffMutation.isPending}
                                  onClick={() => {
                                    const reason = window.prompt(
                                      `Reason for generating playoffs with fewer than ${split.playoff_size} qualified teams?`,
                                    );
                                    if (!reason?.trim()) return;
                                    playoffMutation.mutate({
                                      splitId: split.id,
                                      allowShortField: true,
                                      reason: reason.trim(),
                                    });
                                  }}
                                >
                                  Confirm short-field generation
                                </Button>
                              </div>
                            </details>
                          </div>
                        </div>
                      ) : nextStage ? (
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              Next stage: {humanize(nextStage)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Advance only after the current stage's tournament work and reviews are
                              complete.
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            disabled={stageMutation.isPending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Advance ${split.name} from ${humanize(split.status)} to ${humanize(nextStage)}?`,
                                )
                              ) {
                                stageMutation.mutate({ splitId: split.id, status: nextStage });
                              }
                            }}
                          >
                            Advance to {humanize(nextStage)}
                            <ChevronRight />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" />
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {split.status === "cancelled" ? "Split cancelled" : "Split complete"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              No stage action is available.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No Semi-Splits" />
          )}
        </div>
      )}
    </div>
  );
}
