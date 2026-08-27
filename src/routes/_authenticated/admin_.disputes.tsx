import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, ShieldAlert } from "lucide-react";
import { useState } from "react";
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
  dismissStaffMatchDispute,
  getStaffMatchDisputes,
  resolveStaffMatchDispute,
  type StaffMatchDispute,
} from "@/lib/match-result.functions";

export const Route = createFileRoute("/_authenticated/admin_/disputes")({
  head: () => ({
    meta: [
      { title: "Match disputes — EloShape Staff" },
      { name: "description", content: "Review contested EloShape tournament results." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MatchDisputesPage,
});

function MatchDisputesPage() {
  const fetchDisputes = useServerFn(getStaffMatchDisputes);
  const query = useQuery({
    queryKey: ["staff-match-disputes"],
    queryFn: () => fetchDisputes(),
    retry: false,
  });

  return (
    <div>
      <PageHeading
        eyebrow="Staff · Competition integrity"
        title="Match disputes"
        description="Review submitted scores, evidence and disagreements before an official result advances the bracket."
        aside={
          <Button asChild variant="outline">
            <Link to="/admin">Back to moderation console</Link>
          </Button>
        }
      />
      <PageContainer className="py-10">
        {query.isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        ) : query.error ? (
          <EmptyState
            title="Staff access required"
            description="This queue is limited to admin and moderator accounts."
          />
        ) : !query.data?.length ? (
          <EmptyState
            title="Dispute queue clear"
            description="Pending confirmations and contested match results will appear here."
          />
        ) : (
          <div className="space-y-5">
            {query.data.map((claim) => (
              <DisputeCard key={claim.id} claim={claim} />
            ))}
          </div>
        )}
      </PageContainer>
    </div>
  );
}

function DisputeCard({ claim }: { claim: StaffMatchDispute }) {
  const queryClient = useQueryClient();
  const resolve = useServerFn(resolveStaffMatchDispute);
  const dismiss = useServerFn(dismissStaffMatchDispute);
  const [scoreA, setScoreA] = useState(String(claim.scoreA));
  const [scoreB, setScoreB] = useState(String(claim.scoreB));
  const [note, setNote] = useState("");

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["staff-match-disputes"] });
    void queryClient.invalidateQueries({ queryKey: ["match-result", claim.matchId] });
    void queryClient.invalidateQueries({ queryKey: ["tournament-detail"] });
  };

  const resolveMutation = useMutation({
    mutationFn: () =>
      resolve({
        data: {
          claimId: claim.id,
          scoreA: Number(scoreA),
          scoreB: Number(scoreB),
          note: note.trim(),
        },
      }),
    onSuccess: (result) => {
      if (!result.ok) return toast.error(result.error);
      toast.success("Official result applied and bracket updated.");
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not resolve dispute."),
  });

  const dismissMutation = useMutation({
    mutationFn: () => dismiss({ data: { claimId: claim.id, note: note.trim() } }),
    onSuccess: (result) => {
      if (!result.ok) return toast.error(result.error);
      toast.success("Result claim dismissed. Participants may submit a new result.");
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not dismiss claim."),
  });

  const pending = resolveMutation.isPending || dismissMutation.isPending;

  return (
    <article className="bg-surface-gradient rounded-lg border border-border p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={claim.status === "disputed" ? "destructive" : "outline"}>
              {claim.status.replaceAll("_", " ")}
            </Badge>
            <span className="eyebrow">{claim.roundLabel}</span>
          </div>
          <Link
            to="/tournaments/$slug"
            params={{ slug: claim.tournament.slug }}
            className="mt-2 block text-lg font-black text-foreground hover:text-brand"
          >
            {claim.tournament.name}
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            {claim.entryA} vs {claim.entryB}
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/matches/$matchId" params={{ matchId: claim.matchId }}>
            Inspect match
          </Link>
        </Button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-border bg-background/40 p-4">
          <p className="eyebrow">Submitted result</p>
          <p className="tabular mt-2 text-3xl font-black text-foreground">
            {claim.scoreA}–{claim.scoreB}
          </p>
          {claim.reporterNote ? (
            <p className="mt-3 text-sm text-muted-foreground">Reporter: {claim.reporterNote}</p>
          ) : null}
          {claim.responderNote ? (
            <p className="mt-2 text-sm text-muted-foreground">Opponent: {claim.responderNote}</p>
          ) : null}
          {claim.evidenceUrl ? (
            <a
              href={claim.evidenceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-foreground hover:text-brand"
            >
              Open evidence <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </div>

        <div className="rounded-md border border-border bg-background/40 p-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-brand" />
            <p className="eyebrow">Staff ruling</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`score-a-${claim.id}`}>{claim.entryA}</Label>
              <Input
                id={`score-a-${claim.id}`}
                type="number"
                min={0}
                step={1}
                value={scoreA}
                onChange={(event) => setScoreA(event.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor={`score-b-${claim.id}`}>{claim.entryB}</Label>
              <Input
                id={`score-b-${claim.id}`}
                type="number"
                min={0}
                step={1}
                value={scoreB}
                onChange={(event) => setScoreB(event.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <div className="mt-4">
            <Label htmlFor={`resolution-${claim.id}`}>Resolution note</Label>
            <Textarea
              id={`resolution-${claim.id}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What evidence or rule determined the ruling?"
              className="mt-2 min-h-24"
              maxLength={1000}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              disabled={pending || note.trim().length < 3 || scoreA === "" || scoreB === ""}
              onClick={() => {
                if (
                  !window.confirm(
                    `Apply ${scoreA}–${scoreB} as the official result? This advances the bracket.`,
                  )
                )
                  return;
                resolveMutation.mutate();
              }}
            >
              Apply official result
            </Button>
            <Button
              variant="outline"
              disabled={pending || note.trim().length < 3}
              onClick={() => {
                if (!window.confirm("Dismiss this result claim without advancing the bracket?"))
                  return;
                dismissMutation.mutate();
              }}
            >
              Dismiss claim
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
