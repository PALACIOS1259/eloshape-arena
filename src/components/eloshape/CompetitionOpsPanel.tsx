import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { BracketView, entryLabels } from "@/components/eloshape/BracketView";
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
  generateBracket,
  getStaffSplits,
  getTournamentOps,
  lockEntries,
  submitMatchResult,
} from "@/lib/competition.functions";
import { formatDate } from "@/lib/format";

const SPLIT_STAGES = ["qualifiers", "seeding", "playoffs", "semifinals", "final", "completed"];

type Result = { ok: boolean; error?: string };

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
  onDone,
}: {
  matchId: string;
  bestOf: number;
  onDone: () => void;
}) {
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const report = useServerFn(submitMatchResult);
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

  return (
    <div className="flex items-center gap-2">
      <Input
        aria-label="Score A"
        className="w-16"
        inputMode="numeric"
        value={scoreA}
        onChange={(event) => setScoreA(event.target.value)}
      />
      <span className="text-xs text-muted-foreground">Bo{bestOf}</span>
      <Input
        aria-label="Score B"
        className="w-16"
        inputMode="numeric"
        value={scoreB}
        onChange={(event) => setScoreB(event.target.value)}
      />
      <Button
        size="sm"
        disabled={mutation.isPending || scoreA === "" || scoreB === ""}
        onClick={() => mutation.mutate()}
      >
        Report
      </Button>
    </div>
  );
}

function TournamentOps({ tournamentId }: { tournamentId: string }) {
  const queryClient = useQueryClient();
  const fetchOps = useServerFn(getTournamentOps);
  const lock = useServerFn(lockEntries);
  const bracket = useServerFn(generateBracket);
  const close = useServerFn(closeTournament);

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
    mutationFn: (bestOf: number) => bracket({ data: { tournamentId, bestOf } }),
    ...handlers("Bracket generation"),
  });
  const closeMutation = useMutation({
    mutationFn: () => close({ data: { tournamentId } }),
    ...handlers("Tournament closure"),
  });

  if (isPending) return <Skeleton className="h-32 w-full" />;
  if (!data?.tournament) return <EmptyState title="Tournament not found" />;

  const t = data.tournament;
  const pending = lockMutation.isPending || bracketMutation.isPending || closeMutation.isPending;

  return (
    <div className="mt-4 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={t.status} />
        <Badge variant="outline">
          {t.entries_locked_at ? `Locked ${formatDate(t.entries_locked_at)}` : "Rosters open"}
        </Badge>
        <Badge variant="outline">
          {t.bracket_generated_at ? "Bracket generated" : "No bracket"}
        </Badge>
        <Badge variant={t.finalized_at ? "default" : "outline"}>
          {t.finalized_at ? `Finalized ${formatDate(t.finalized_at)}` : "Not finalized"}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => lockMutation.mutate()}
        >
          Lock rosters
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => bracketMutation.mutate(1)}
        >
          Generate bracket (Bo1)
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => bracketMutation.mutate(3)}
        >
          Generate bracket (Bo3)
        </Button>
        <Button size="sm" disabled={pending} onClick={() => closeMutation.mutate()}>
          Close &amp; score
        </Button>
      </div>

      {data.matches.length ? (
        <>
          <BracketView matches={data.matches} entries={entryLabels(data.entries)} />
          <div className="bg-surface-gradient overflow-hidden rounded-lg border border-border">
            {data.matches
              .filter((match) => match.status !== "completed" && !match.is_bye)
              .map((match) => {
                const labels = entryLabels(data.entries);
                const byId = new Map(labels.map((entry) => [entry.id, entry.label]));
                const ready = match.entry_a_id && match.entry_b_id;
                return (
                  <div
                    key={match.id}
                    className="grid gap-3 border-b border-border p-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {match.round_label} · R{match.round_index}S{match.bracket_slot}
                      </p>
                      <p className="eyebrow mt-1">
                        {byId.get(match.entry_a_id ?? "") ?? "TBD"} vs{" "}
                        {byId.get(match.entry_b_id ?? "") ?? "TBD"}
                      </p>
                    </div>
                    {ready ? (
                      <MatchReporter
                        matchId={match.id}
                        bestOf={match.best_of}
                        onDone={invalidate}
                      />
                    ) : (
                      <span className="eyebrow">Waiting on earlier round</span>
                    )}
                  </div>
                );
              })}
          </div>
        </>
      ) : (
        <EmptyState title="No bracket yet" description="Lock rosters, then generate the bracket." />
      )}

      {data.auditLog.length ? (
        <div>
          <p className="eyebrow">Audit trail</p>
          <div className="bg-surface-gradient mt-2 overflow-hidden rounded-lg border border-border">
            {data.auditLog.map((entry) => (
              <p key={entry.id} className="border-b border-border p-3 text-xs last:border-0">
                <span className="font-semibold text-foreground">{entry.action}</span>{" "}
                <span className="text-muted-foreground">{formatDate(entry.created_at)}</span>
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Staff-only competition operations: locks, brackets, results, closure, splits. */
export function CompetitionOpsPanel() {
  const queryClient = useQueryClient();
  const fetchSplits = useServerFn(getStaffSplits);
  const advance = useServerFn(advanceSplitStatus);
  const playoffs = useServerFn(buildSplitPlayoffs);
  const [selected, setSelected] = useState<string | null>(null);

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

  if (isPending) return <Skeleton className="h-48 w-full" />;
  if (!data) return <EmptyState title="Staff access required" />;

  return (
    <div className="space-y-10">
      <div>
        <p className="eyebrow">Semi-Splits</p>
        <div className="bg-surface-gradient mt-3 overflow-hidden rounded-lg border border-border">
          {data.splits.length ? (
            data.splits.map((split) => (
              <div key={split.id} className="border-b border-border p-4 last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{split.name}</p>
                    <p className="eyebrow mt-1">
                      {formatDate(split.starts_at)} — {formatDate(split.ends_at)} ·{" "}
                      {split.playoff_size} playoff slots
                    </p>
                  </div>
                  <StatusBadge status={split.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SPLIT_STAGES.map((stage) => (
                    <Button
                      key={stage}
                      size="sm"
                      variant="outline"
                      disabled={stageMutation.isPending || stage === split.status}
                      onClick={() => stageMutation.mutate({ splitId: split.id, status: stage })}
                    >
                      {stage}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    disabled={playoffMutation.isPending}
                    onClick={() => playoffMutation.mutate({ splitId: split.id })}
                  >
                    Seed playoffs ({split.playoff_size})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={playoffMutation.isPending}
                    onClick={() => {
                      const reason = window.prompt(
                        `The playoff field must have ${split.playoff_size} qualified teams. Reason for seeding a short field?`,
                      );
                      if (!reason?.trim()) return;
                      playoffMutation.mutate({
                        splitId: split.id,
                        allowShortField: true,
                        reason: reason.trim(),
                      });
                    }}
                  >
                    Seed short field…
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6">
              <EmptyState title="No Semi-Splits" />
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="eyebrow">Tournament operations</p>
        <div className="bg-surface-gradient mt-3 overflow-hidden rounded-lg border border-border">
          {data.tournaments.map((tournament) => (
            <div key={tournament.id} className="border-b border-border p-4 last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {tournament.name}
                    {tournament.qualifier_index
                      ? ` · Qualifier #${tournament.qualifier_index}`
                      : ""}
                  </p>
                  <p className="eyebrow mt-1">
                    {tournament.participants_count} entrants ·{" "}
                    {tournament.finalized_at ? "finalized" : tournament.status}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={selected === tournament.id ? "default" : "outline"}
                  onClick={() => setSelected(selected === tournament.id ? null : tournament.id)}
                >
                  {selected === tournament.id ? "Hide" : "Manage"}
                </Button>
              </div>
              {selected === tournament.id ? <TournamentOps tournamentId={tournament.id} /> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
