import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, CircleAlert, Trophy, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { StatusBadge } from "@/components/eloshape/StatusBadge";
import { StatTile } from "@/components/eloshape/StatTile";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  advanceSplitStatus,
  buildSplitPlayoffs,
  getStaffSplits,
  replaceQualifier,
} from "@/lib/competition.functions";
import { formatDate } from "@/lib/format";
import { getStaffSplitOps, type StaffSplitOps } from "@/lib/split-ops.functions";

export const Route = createFileRoute("/_authenticated/admin_/splits")({
  head: () => ({
    meta: [
      { title: "Semi-Split operations — EloShape Staff" },
      {
        name: "description",
        content:
          "Finalize qualifier stages, manage qualification replacements and seed EloShape playoffs.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SplitOperationsPage,
});

type OperationResult = { ok: boolean; error?: string };

function SplitOperationsPage() {
  const fetchSplits = useServerFn(getStaffSplits);
  const [selectedSplitId, setSelectedSplitId] = useState<string | null>(null);
  const splitsQuery = useQuery({
    queryKey: ["staff-splits"],
    queryFn: () => fetchSplits(),
    retry: false,
  });

  const selected =
    selectedSplitId ??
    splitsQuery.data?.splits.find((split) => split.status !== "completed")?.id ??
    null;

  return (
    <div>
      <PageHeading
        eyebrow="Staff · Circuit operations"
        title="Semi-Split operations"
        description="Finalize Open Qualifiers, verify Top 4 grants, handle withdrawals and replacements, then seed the playoff bracket from split standings."
        aside={
          <Button asChild variant="outline">
            <Link to="/admin">Back to moderation console</Link>
          </Button>
        }
      />

      <PageContainer className="py-10">
        {splitsQuery.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : splitsQuery.error || !splitsQuery.data ? (
          <EmptyState
            title="Staff access required"
            description="This page is limited to admin and moderator accounts."
          />
        ) : !splitsQuery.data.splits.length ? (
          <EmptyState title="No Semi-Splits configured" />
        ) : (
          <div className="space-y-8">
            <section>
              <p className="eyebrow">Select Semi-Split</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {splitsQuery.data.splits.map((split) => (
                  <Button
                    key={split.id}
                    size="sm"
                    variant={selected === split.id ? "default" : "outline"}
                    onClick={() => setSelectedSplitId(split.id)}
                  >
                    {split.name}
                  </Button>
                ))}
              </div>
            </section>

            {selected ? <SplitWorkspace splitId={selected} /> : null}
          </div>
        )}
      </PageContainer>
    </div>
  );
}

function SplitWorkspace({ splitId }: { splitId: string }) {
  const queryClient = useQueryClient();
  const fetchOps = useServerFn(getStaffSplitOps);
  const advance = useServerFn(advanceSplitStatus);
  const playoffs = useServerFn(buildSplitPlayoffs);
  const replace = useServerFn(replaceQualifier);

  const query = useQuery({
    queryKey: ["staff-split-ops", splitId],
    queryFn: () => fetchOps({ data: { splitId } }),
    retry: false,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["staff-split-ops", splitId] });
    void queryClient.invalidateQueries({ queryKey: ["staff-splits"] });
  };

  const stageMutation = useMutation({
    mutationFn: (status: string) => advance({ data: { splitId, status } }),
    onSuccess: (result: OperationResult) => {
      if (!result.ok) {
        toast.error(friendlyOperationError(result.error));

        return;
      }
      toast.success("Semi-Split stage updated.");
      invalidate();
    },
    onError: () => toast.error("Could not update the Semi-Split stage."),
  });

  const playoffMutation = useMutation({
    mutationFn: (input: { allowShortField?: boolean; reason?: string }) =>
      playoffs({ data: { splitId, bestOf: 3, ...input } }),
    onSuccess: (result: OperationResult) => {
      if (!result.ok) {
        toast.error(friendlyOperationError(result.error));

        return;
      }
      toast.success("Playoff bracket generated from split standings.");
      invalidate();
    },
    onError: () => toast.error("Could not generate playoffs."),
  });

  const replacementMutation = useMutation({
    mutationFn: (teamId: string) => replace({ data: { splitId, teamId } }),
    onSuccess: (result: OperationResult) => {
      if (!result.ok) {
        toast.error(friendlyOperationError(result.error));

        return;
      }
      toast.success("Qualification replacement processed.");
      invalidate();
    },
    onError: () => toast.error("Could not process the replacement."),
  });

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.error || !query.data) {
    return <EmptyState title="Could not load Semi-Split operations" />;
  }

  const ops = query.data;
  const r = ops.readiness;
  const nextStage = nextManualStage(ops.split.status);

  return (
    <div className="space-y-10">
      <section className="bg-surface-gradient rounded-lg border border-border p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={ops.split.status} />
              <Badge variant="outline">
                Top {ops.split.qualificationSlotsPerQualifier} / qualifier
              </Badge>
              <Badge variant="outline">{ops.split.playoffSize}-team playoffs</Badge>
            </div>
            <h2 className="mt-3 text-2xl font-black text-foreground">{ops.split.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatDate(ops.split.startsAt)} — {formatDate(ops.split.endsAt)}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/splits/$slug" params={{ slug: ops.split.slug }}>
              Public Semi-Split page
            </Link>
          </Button>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Qualifiers finalized"
          value={`${r.finalizedQualifierCount}/${r.qualifierCount}`}
          icon={
            r.allQualifiersFinalized ? (
              <CheckCircle2 className="size-5" />
            ) : (
              <CircleAlert className="size-5" />
            )
          }
        />
        <StatTile
          label="Qualified"
          value={`${r.qualifiedCount}/${r.playoffSize}`}
          icon={<Users className="size-5" />}
        />
        <StatTile label="Replacement queue" value={ops.replacementCandidates.length} />
        <StatTile
          label="Playoff bracket"
          value={ops.playoffTournament?.bracketGeneratedAt ? "Generated" : "Not generated"}
          icon={<Trophy className="size-5" />}
        />
      </div>

      <StageActions
        ops={ops}
        stagePending={stageMutation.isPending}
        playoffPending={playoffMutation.isPending}
        onStage={(status) => stageMutation.mutate(status)}
        onFullPlayoffs={() => playoffMutation.mutate({})}
        onShortPlayoffs={() => {
          const reason = window.prompt(
            `Only ${r.qualifiedCount}/${r.playoffSize} teams are qualified. Enter the audited reason for a short playoff field:`,
          );
          if (!reason?.trim()) return;
          playoffMutation.mutate({ allowShortField: true, reason: reason.trim() });
        }}
        nextStage={nextStage}
      />

      <QualifierReadiness qualifiers={ops.qualifiers} />

      <Qualifications
        ops={ops}
        replacing={replacementMutation.isPending}
        onReplace={(teamId, teamName) => {
          if (
            !window.confirm(
              `Mark ${teamName} as withdrawn and replace them with the highest-ranked eligible non-qualified team?`,
            )
          ) {
            return;
          }
          replacementMutation.mutate(teamId);
        }}
      />

      <Standings standings={ops.standings} replacementCandidates={ops.replacementCandidates} />
    </div>
  );
}

function StageActions({
  ops,
  stagePending,
  playoffPending,
  onStage,
  onFullPlayoffs,
  onShortPlayoffs,
  nextStage,
}: {
  ops: StaffSplitOps;
  stagePending: boolean;
  playoffPending: boolean;
  onStage: (status: string) => void;
  onFullPlayoffs: () => void;
  onShortPlayoffs: () => void;
  nextStage: string | null;
}) {
  const r = ops.readiness;
  return (
    <section className="bg-surface-gradient rounded-lg border border-border p-5">
      <p className="eyebrow">Stage controls</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {ops.split.status === "qualifiers" ? (
          <Button disabled={!r.canEnterSeeding || stagePending} onClick={() => onStage("seeding")}>
            {r.canEnterSeeding
              ? "Close qualifier stage → Seeding"
              : `Finalize all qualifiers first (${r.finalizedQualifierCount}/${r.qualifierCount})`}
          </Button>
        ) : null}

        {ops.split.status === "seeding" && !ops.playoffTournament?.bracketGeneratedAt ? (
          <>
            <Button disabled={!r.canGeneratePlayoffs || playoffPending} onClick={onFullPlayoffs}>
              Generate {r.playoffSize}-team playoffs
            </Button>
            {r.canGenerateShortPlayoffs ? (
              <Button variant="outline" disabled={playoffPending} onClick={onShortPlayoffs}>
                Generate short field…
              </Button>
            ) : null}
          </>
        ) : null}

        {nextStage && ops.split.status !== "qualifiers" && ops.split.status !== "seeding" ? (
          <Button variant="outline" disabled={stagePending} onClick={() => onStage(nextStage)}>
            Advance to {nextStage}
          </Button>
        ) : null}

        <Button asChild variant="outline">
          <Link to="/admin">Open tournament operations</Link>
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Finalizing each qualifier in Tournament Operations automatically awards qualification slots
        to the highest finishing eligible teams that are not already qualified.
      </p>
    </section>
  );
}

function QualifierReadiness({ qualifiers }: { qualifiers: StaffSplitOps["qualifiers"] }) {
  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Stage 1</p>
          <h3 className="mt-1 text-xl font-black text-foreground">Open Qualifiers</h3>
        </div>
        <span className="text-sm text-muted-foreground">
          Finalize → Top 4 grants happen atomically
        </span>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {qualifiers.map((qualifier) => (
          <article
            key={qualifier.id}
            className="bg-surface-gradient rounded-lg border border-border p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Qualifier #{qualifier.qualifierIndex}</p>
                <Link
                  to="/tournaments/$slug"
                  params={{ slug: qualifier.slug }}
                  className="mt-1 block font-bold text-foreground hover:text-brand"
                >
                  {qualifier.name}
                </Link>
              </div>
              <StatusBadge status={qualifier.status} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <Metric
                label="Teams"
                value={`${qualifier.participantsCount}/${qualifier.maxParticipants ?? "∞"}`}
              />
              <Metric label="Top 4 active" value={qualifier.activeQualificationGrants} />
              <Metric label="Finalized" value={qualifier.finalizedAt ? "Yes" : "No"} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant={qualifier.entriesLockedAt ? "default" : "outline"}>
                {qualifier.entriesLockedAt ? "Rosters locked" : "Rosters open"}
              </Badge>
              <Badge variant={qualifier.bracketGeneratedAt ? "default" : "outline"}>
                {qualifier.bracketGeneratedAt ? "Bracket generated" : "No bracket"}
              </Badge>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Qualifications({
  ops,
  replacing,
  onReplace,
}: {
  ops: StaffSplitOps;
  replacing: boolean;
  onReplace: (teamId: string, teamName: string) => void;
}) {
  const replaceWindow = ops.split.status === "qualifiers" || ops.split.status === "seeding";
  const active = ops.qualifications.filter((qualification) => qualification.status === "qualified");

  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Playoff field</p>
          <h3 className="mt-1 text-xl font-black text-foreground">Qualified teams</h3>
        </div>
        <span className="text-sm text-muted-foreground">
          {active.length}/{ops.split.playoffSize} active
        </span>
      </div>

      {!ops.qualifications.length ? (
        <div className="mt-4">
          <EmptyState title="No qualification slots awarded yet" />
        </div>
      ) : (
        <div className="bg-surface-gradient mt-4 overflow-hidden rounded-lg border border-border">
          {ops.qualifications.map((qualification) => (
            <div
              key={qualification.id}
              className="grid gap-3 border-b border-border p-4 last:border-0 lg:grid-cols-[3rem_minmax(0,1fr)_auto] lg:items-center"
            >
              <span className="tabular text-lg font-black text-muted-foreground">
                #{qualification.qualificationPosition}
              </span>
              <div className="min-w-0">
                <Link
                  to="/teams/$slug"
                  params={{ slug: qualification.teamSlug }}
                  className="font-semibold text-foreground hover:text-brand"
                >
                  [{qualification.teamTag}] {qualification.teamName}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {qualification.sourceQualifierIndex
                    ? `Qualified from Open Qualifier #${qualification.sourceQualifierIndex}`
                    : qualification.replacesTeamName
                      ? `Replacement for ${qualification.replacesTeamName}`
                      : "Replacement / staff assignment"}
                  {qualification.playoffSeed ? ` · playoff seed #${qualification.playoffSeed}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <Badge variant={qualification.status === "qualified" ? "default" : "outline"}>
                  {qualification.status}
                </Badge>
                {qualification.status === "qualified" && replaceWindow ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={replacing}
                    onClick={() => onReplace(qualification.teamId, qualification.teamName)}
                  >
                    Replace withdrawn…
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Standings({
  standings,
  replacementCandidates,
}: {
  standings: StaffSplitOps["standings"];
  replacementCandidates: StaffSplitOps["replacementCandidates"];
}) {
  const replacementIds = new Set(replacementCandidates.map((candidate) => candidate.team_id));
  return (
    <section>
      <p className="eyebrow">Replacement order</p>
      <h3 className="mt-1 text-xl font-black text-foreground">Split standings</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        If a qualified team withdraws, the highest-ranked eligible non-qualified team is selected
        automatically.
      </p>
      {!standings.length ? (
        <div className="mt-4">
          <EmptyState title="No teams have competed yet" />
        </div>
      ) : (
        <div className="bg-surface-gradient mt-4 overflow-hidden rounded-lg border border-border">
          {standings.map((team, index) => (
            <div
              key={team.team_id}
              className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 last:border-0"
            >
              <span className="tabular font-black text-muted-foreground">{index + 1}</span>
              <div className="min-w-0">
                <Link
                  to="/teams/$slug"
                  params={{ slug: team.team_slug }}
                  className="truncate text-sm font-semibold text-foreground hover:text-brand"
                >
                  [{team.team_tag}] {team.team_name}
                </Link>
                <p className="eyebrow mt-1">
                  {team.wins}-{team.losses} · {team.tournaments_played} tournaments
                </p>
              </div>
              <div className="text-right">
                <p className="tabular font-black text-foreground">{team.points} pts</p>
                {team.qualification_status ? (
                  <Badge className="mt-1" variant="outline">
                    {team.qualification_status}
                  </Badge>
                ) : replacementIds.has(team.team_id) ? (
                  <Badge className="mt-1" variant="outline">
                    replacement queue
                  </Badge>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-bold text-foreground">{value}</p>
    </div>
  );
}

function nextManualStage(status: string) {
  if (status === "playoffs") return "semifinals";
  if (status === "semifinals") return "final";
  if (status === "final") return "completed";
  return null;
}

function friendlyOperationError(error?: string) {
  const text = error ?? "Operation failed.";
  if (text.includes("qualifiers_not_finalized"))
    return "All Open Qualifiers must be finalized before seeding.";
  if (text.includes("qualifiers_missing")) return "This Semi-Split has no Open Qualifiers.";
  if (text.includes("playoff_field_incomplete")) return "The playoff field is not complete yet.";
  if (text.includes("playoff_field_too_small")) return "At least two qualified teams are required.";
  if (text.includes("playoffs_not_generated"))
    return "Generate the playoff bracket before entering the Playoffs stage.";
  if (text.includes("playoff_not_finalized"))
    return "Finalize the playoff tournament before completing the Semi-Split.";
  if (text.includes("replacement_window_closed"))
    return "Qualification replacements are closed for this stage.";
  if (text.includes("qualification_not_found"))
    return "That team no longer has an active qualification slot.";
  if (text.includes("invalid_transition"))
    return "That Semi-Split stage transition is not allowed.";
  return text;
}
