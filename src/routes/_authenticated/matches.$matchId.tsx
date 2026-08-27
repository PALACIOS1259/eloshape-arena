import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  getMyMatchResult,
  respondMyMatchResult,
  submitMyMatchResult,
  type MatchEntrySummary,
  type MatchResultState,
} from "@/lib/match-result.functions";

export const Route = createFileRoute("/_authenticated/matches/$matchId")({
  head: () => ({
    meta: [
      { title: "Match result — EloShape" },
      { name: "description", content: "Submit, confirm or dispute an EloShape tournament result." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MatchResultPage,
});

function MatchResultPage() {
  const { matchId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchState = useServerFn(getMyMatchResult);
  const submitResult = useServerFn(submitMyMatchResult);
  const respondResult = useServerFn(respondMyMatchResult);

  const query = useQuery({
    queryKey: ["match-result", matchId],
    queryFn: () => fetchState({ data: { matchId } }),
    retry: false,
  });

  const [scoreA, setScoreA] = useState("0");
  const [scoreB, setScoreB] = useState("0");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [reportNote, setReportNote] = useState("");
  const [disputeNote, setDisputeNote] = useState("");

  useEffect(() => {
    const claim = query.data?.claim;
    if (!claim) return;
    setScoreA(String(claim.scoreA));
    setScoreB(String(claim.scoreB));
    setEvidenceUrl(claim.evidenceUrl ?? "");
    setReportNote(claim.reporterNote ?? "");
  }, [query.data?.claim]);

  const updateState = (state: MatchResultState) => {
    queryClient.setQueryData(["match-result", matchId], state);
    void queryClient.invalidateQueries({ queryKey: ["tournament-detail"] });
  };

  const submitMutation = useMutation({
    mutationFn: () =>
      submitResult({
        data: {
          matchId,
          scoreA: Number(scoreA),
          scoreB: Number(scoreB),
          evidenceUrl,
          note: reportNote,
        },
      }),
    onSuccess: (result) => {
      if (!result.ok) return toast.error(result.error);
      updateState(result.state);
      toast.success("Result submitted. Waiting for opponent confirmation.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not submit result."),
  });

  const responseMutation = useMutation({
    mutationFn: (input: { confirm: boolean; note?: string }) =>
      respondResult({ data: { matchId, ...input } }),
    onSuccess: (result, variables) => {
      if (!result.ok) return toast.error(result.error);
      updateState(result.state);
      toast.success(variables.confirm ? "Result confirmed." : "Dispute opened for Staff review.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not respond."),
  });

  if (query.isPending) {
    return (
      <PageContainer className="py-16">
        <Skeleton className="h-64 w-full" />
      </PageContainer>
    );
  }

  if (query.error || !query.data) {
    return (
      <PageContainer className="py-16">
        <EmptyState
          title="Participant access required"
          description="Only a participating solo player, the locked team captain, or EloShape Staff can access result controls for this match."
        />
      </PageContainer>
    );
  }

  const state = query.data;
  const claim = state.claim;
  const isReporter = Boolean(claim && state.myEntryId && claim.reporterEntryId === state.myEntryId);
  const official = state.match.status === "completed" && Boolean(state.match.winnerEntryId);

  return (
    <div>
      <PageHeading
        eyebrow={`${state.match.roundLabel} · Best of ${state.match.bestOf}`}
        title="Match result"
        description={`${state.entryA?.name ?? "TBD"} vs ${state.entryB?.name ?? "TBD"}`}
        aside={
          <Button asChild variant="outline">
            <Link to="/tournaments/$slug" params={{ slug: state.tournament.slug }}>
              Back to tournament
            </Link>
          </Button>
        }
      />

      <PageContainer className="space-y-8 py-10">
        <section className="bg-surface-gradient rounded-lg border border-border p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">{state.tournament.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {state.tournament.mode === "team"
                  ? "Only the locked team captain can submit or answer a result."
                  : "Each participating player can submit or answer the result."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{state.match.status}</Badge>
              {claim ? <ClaimBadge status={claim.status} /> : null}
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
            <EntryCard
              entry={state.entryA}
              score={official ? state.match.scoreA : claim?.scoreA}
              mine={state.myEntryId === state.entryA?.id}
              winner={official && state.match.winnerEntryId === state.entryA?.id}
            />
            <div className="text-center text-xs font-black uppercase tracking-widest text-muted-foreground">VS</div>
            <EntryCard
              entry={state.entryB}
              score={official ? state.match.scoreB : claim?.scoreB}
              mine={state.myEntryId === state.entryB?.id}
              winner={official && state.match.winnerEntryId === state.entryB?.id}
            />
          </div>
        </section>

        {official ? (
          <section className="rounded-lg border border-success/30 bg-success/10 p-5">
            <p className="font-black text-success">Official result confirmed</p>
            <p className="mt-2 text-sm text-muted-foreground">
              The bracket has been updated with the official score {state.match.scoreA}–{state.match.scoreB}.
            </p>
            {claim?.resolutionNote ? (
              <p className="mt-3 text-sm text-muted-foreground">Staff note: {claim.resolutionNote}</p>
            ) : null}
          </section>
        ) : null}

        {!official && claim?.status === "disputed" ? (
          <section className="rounded-lg border border-destructive/30 bg-destructive/10 p-5">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div>
                <p className="font-black text-foreground">Result disputed — bracket paused</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  EloShape Staff must review this match before a winner advances.
                </p>
                {claim.responderNote ? (
                  <p className="mt-3 text-sm text-muted-foreground">Dispute: {claim.responderNote}</p>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {!official && claim?.status === "pending_confirmation" && isReporter ? (
          <section className="rounded-lg border border-gold/30 bg-gold/10 p-5">
            <p className="font-black text-foreground">Waiting for opponent confirmation</p>
            <p className="mt-2 text-sm text-muted-foreground">
              You may update your submitted score while the opponent has not answered it.
            </p>
          </section>
        ) : null}

        {claim ? <SubmittedEvidence claim={claim} /> : null}

        {!official && state.canRespond && claim ? (
          <section className="bg-surface-gradient rounded-lg border border-border p-6 shadow-card">
            <p className="eyebrow">Opponent submitted a result</p>
            <h2 className="mt-2 text-xl font-black text-foreground">
              Confirm {claim.scoreA}–{claim.scoreB}?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Confirming immediately makes this the official result and advances the bracket. If the score is wrong, explain the disagreement and open a dispute.
            </p>
            <div className="mt-5">
              <Label htmlFor="disputeNote">Dispute explanation</Label>
              <Textarea
                id="disputeNote"
                value={disputeNote}
                onChange={(event) => setDisputeNote(event.target.value)}
                placeholder="Only required if you dispute the submitted result."
                className="mt-2 min-h-24"
                maxLength={1000}
              />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                disabled={responseMutation.isPending}
                onClick={() => responseMutation.mutate({ confirm: true, note: "Confirmed by opponent" })}
              >
                Confirm result
              </Button>
              <Button
                variant="destructive"
                disabled={responseMutation.isPending || disputeNote.trim().length < 3}
                onClick={() => responseMutation.mutate({ confirm: false, note: disputeNote.trim() })}
              >
                Dispute result
              </Button>
            </div>
          </section>
        ) : null}

        {!official && state.canSubmit ? (
          <section className="bg-surface-gradient rounded-lg border border-border p-6 shadow-card">
            <p className="eyebrow">{claim?.status === "dismissed" ? "Submit a new claim" : isReporter ? "Update result" : "Report result"}</p>
            <h2 className="mt-2 text-xl font-black text-foreground">Enter the series score</h2>
            {claim?.status === "dismissed" && claim.resolutionNote ? (
              <p className="mt-2 rounded-md border border-border p-3 text-sm text-muted-foreground">
                Previous claim dismissed by Staff: {claim.resolutionNote}
              </p>
            ) : null}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="scoreA">{state.entryA?.name ?? "Entry A"}</Label>
                <Input
                  id="scoreA"
                  type="number"
                  min={0}
                  max={state.match.bestOf}
                  step={1}
                  value={scoreA}
                  onChange={(event) => setScoreA(event.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="scoreB">{state.entryB?.name ?? "Entry B"}</Label>
                <Input
                  id="scoreB"
                  type="number"
                  min={0}
                  max={state.match.bestOf}
                  step={1}
                  value={scoreB}
                  onChange={(event) => setScoreB(event.target.value)}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="mt-4">
              <Label htmlFor="evidence">Evidence link (optional)</Label>
              <Input
                id="evidence"
                type="url"
                value={evidenceUrl}
                onChange={(event) => setEvidenceUrl(event.target.value)}
                placeholder="https://... screenshot or match evidence"
                className="mt-2"
                maxLength={500}
              />
            </div>

            <div className="mt-4">
              <Label htmlFor="reportNote">Result note (optional)</Label>
              <Textarea
                id="reportNote"
                value={reportNote}
                onChange={(event) => setReportNote(event.target.value)}
                placeholder="Anything Staff or the opponent should know."
                className="mt-2 min-h-24"
                maxLength={1000}
              />
            </div>

            <Button
              className="mt-5"
              disabled={submitMutation.isPending || scoreA === "" || scoreB === ""}
              onClick={() => submitMutation.mutate()}
            >
              {submitMutation.isPending ? "Submitting…" : isReporter ? "Update submitted result" : "Submit result"}
            </Button>
          </section>
        ) : null}

        {state.isStaff && !state.myEntryId && !official ? (
          <section className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
            Staff can inspect this match here. Use the{" "}
            <Link to="/admin/disputes" className="font-semibold text-foreground hover:text-brand">
              Match disputes queue
            </Link>{" "}
            to resolve contested results.
          </section>
        ) : null}
      </PageContainer>
    </div>
  );
}

function EntryCard({
  entry,
  score,
  mine,
  winner,
}: {
  entry: MatchEntrySummary | null;
  score?: number | null;
  mine: boolean;
  winner: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${mine ? "border-brand/50 bg-brand/5" : "border-border bg-background/40"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={`truncate font-black ${winner ? "text-brand" : "text-foreground"}`}>
            {entry?.name ?? "TBD"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {mine ? <Badge variant="outline">Your entry</Badge> : null}
            {winner ? <Badge>Winner</Badge> : null}
          </div>
        </div>
        <span className="tabular text-3xl font-black text-foreground">{score ?? "–"}</span>
      </div>
    </div>
  );
}

function ClaimBadge({ status }: { status: MatchResultState["claim"] extends infer _T ? string : never }) {
  const variant = status === "disputed" ? "destructive" : status === "confirmed" || status === "resolved" ? "default" : "outline";
  return <Badge variant={variant}>{status.replaceAll("_", " ")}</Badge>;
}

function SubmittedEvidence({ claim }: { claim: NonNullable<MatchResultState["claim"]> }) {
  if (!claim.reporterNote && !claim.evidenceUrl && !claim.responderNote && !claim.resolutionNote) return null;
  return (
    <section className="bg-surface-gradient rounded-lg border border-border p-5">
      <p className="eyebrow">Result record</p>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
        {claim.reporterNote ? <p>Reporter: {claim.reporterNote}</p> : null}
        {claim.responderNote ? <p>Opponent: {claim.responderNote}</p> : null}
        {claim.resolutionNote ? <p>Staff: {claim.resolutionNote}</p> : null}
        {claim.evidenceUrl ? (
          <a
            href={claim.evidenceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-brand"
          >
            Open submitted evidence <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>
    </section>
  );
}
