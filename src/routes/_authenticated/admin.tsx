import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  ChevronRight,
  CircleAlert,
  Gavel,
  LifeBuoy,
  ShieldCheck,
  Swords,
  UserCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { CompetitionOpsPanel } from "@/components/eloshape/CompetitionOpsPanel";
import { DivisionBadge } from "@/components/eloshape/DivisionBadge";
import { EmptyState } from "@/components/eloshape/EmptyState";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, riotRankLabel } from "@/lib/format";
import { getAdminOverview, setPlayerEligibility } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin control center — EloShape" },
      {
        name: "description",
        content: "EloShape staff operations, moderation and competition control.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Decision = "eligible" | "pending_review" | "rejected" | "suspended";

function EligibilityActions({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient();
  const decide = useServerFn(setPlayerEligibility);
  const mutation = useMutation({
    mutationFn: (status: Decision) =>
      decide({ data: { profileId, status, reason: `Staff set ${status}` } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Eligibility set to ${result.profile.eligibility}.`);
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: () => toast.error("Could not update eligibility."),
  });

  const decideWithConfirmation = (status: Decision) => {
    if (status === "eligible") {
      mutation.mutate(status);
      return;
    }
    const confirmed = window.confirm(
      `Set this player's competitive eligibility to “${status.replace("_", " ")}”?`,
    );
    if (confirmed) mutation.mutate(status);
  };

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button
        size="sm"
        disabled={mutation.isPending}
        onClick={() => decideWithConfirmation("eligible")}
      >
        <UserCheck />
        Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={mutation.isPending}
        onClick={() => decideWithConfirmation("pending_review")}
      >
        Keep pending
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={mutation.isPending}
        onClick={() => decideWithConfirmation("rejected")}
      >
        Reject
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={mutation.isPending}
        onClick={() => decideWithConfirmation("suspended")}
      >
        Suspend
      </Button>
    </div>
  );
}

function QueueCard({
  icon,
  title,
  description,
  count,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  count?: number;
  action: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-card/80 to-background/45 p-4 transition-colors hover:border-primary/25 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
          {icon}
        </span>
        {count != null ? <Badge variant={count ? "default" : "outline"}>{count}</Badge> : null}
      </div>
      <h2 className="mt-4 text-sm font-black text-foreground">{title}</h2>
      <p className="mt-1 min-h-10 text-xs leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-4">{action}</div>
    </div>
  );
}

function AdminPage() {
  const fetchOverview = useServerFn(getAdminOverview);
  const { data, isPending, error } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview(),
    retry: false,
  });

  const queuedCount = data
    ? data.counts.reviews + data.counts.reports + data.counts.disputes + data.counts.support
    : 0;

  return (
    <div>
      <PageHeading
        eyebrow="EloShape staff"
        title="Admin control center"
        description="Review what needs attention first, then open the dedicated workspace for the task you want to complete."
        aside={
          <Button asChild variant="outline">
            <Link to="/dashboard">Player dashboard</Link>
          </Button>
        }
      />

      <PageContainer className="py-8 sm:py-10">
        {isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full" />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Skeleton className="h-44 w-full" />
              <Skeleton className="h-44 w-full" />
              <Skeleton className="h-44 w-full" />
              <Skeleton className="h-44 w-full" />
            </div>
          </div>
        ) : error ? (
          <EmptyState
            title="Staff access required"
            description="This console is limited to accounts with the admin or moderator role."
          />
        ) : data ? (
          <>
            <section className="border-b border-border/60 pb-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">System overview</p>
                  <h2 className="mt-1 text-xl font-black text-foreground">
                    What needs your attention
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Start with queues that have pending work. Routine data and technical controls
                    stay out of the way until you need them.
                  </p>
                </div>
                <Badge variant={queuedCount ? "default" : "outline"}>
                  {queuedCount} queued item{queuedCount === 1 ? "" : "s"}
                </Badge>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3">
                <AdminMetric label="Players" value={data.counts.players} />
                <AdminMetric label="Teams" value={data.counts.teams} />
                <AdminMetric label="Tournaments" value={data.counts.tournaments} />
              </div>
            </section>

            <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <QueueCard
                icon={<UserCheck className="size-4" />}
                title="Eligibility reviews"
                description="Approve, reject or hold players that require a manual competitive eligibility decision."
                count={data.counts.reviews}
                action={
                  <Button
                    asChild
                    className="w-full"
                    variant={data.counts.reviews ? "default" : "outline"}
                  >
                    <a href="#eligibility">
                      Review players
                      <ChevronRight />
                    </a>
                  </Button>
                }
              />
              <QueueCard
                icon={<Gavel className="size-4" />}
                title="Match disputes"
                description="Resolve conflicting match submissions and competitive result disputes."
                count={data.counts.disputes}
                action={
                  <Button
                    asChild
                    className="w-full"
                    variant={data.counts.disputes ? "default" : "outline"}
                  >
                    <Link to="/admin/disputes">
                      Open disputes
                      <ChevronRight />
                    </Link>
                  </Button>
                }
              />
              <QueueCard
                icon={<LifeBuoy className="size-4" />}
                title="Support queue"
                description="Read player support requests and respond without mixing them with tournament controls."
                count={data.counts.support}
                action={
                  <Button
                    asChild
                    className="w-full"
                    variant={data.counts.support ? "default" : "outline"}
                  >
                    <Link to="/admin/support">
                      Open support
                      <ChevronRight />
                    </Link>
                  </Button>
                }
              />
              <QueueCard
                icon={<Swords className="size-4" />}
                title="Competition operations"
                description="Lock rosters, create brackets, report results, award walkovers and finalize tournaments."
                action={
                  <Button asChild className="w-full" variant="outline">
                    <a href="#competition">
                      Manage tournaments
                      <ChevronRight />
                    </a>
                  </Button>
                }
              />
            </section>

            <section id="eligibility" className="mt-10 scroll-mt-24">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">Eligibility</p>
                  <h2 className="mt-1 text-xl font-black text-foreground">
                    Players waiting for review
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    This is the action queue. Once a decision is made, the player leaves this list
                    and the decision remains available in history below.
                  </p>
                </div>
                <Badge variant={data.counts.reviews ? "default" : "outline"}>
                  {data.counts.reviews} pending
                </Badge>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-border/70 bg-card/35">
                {data.reviews.length ? (
                  data.reviews.map((review) => (
                    <div
                      key={review.id}
                      className="border-b border-border p-4 last:border-0 sm:p-5"
                    >
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-semibold text-foreground">
                              {review.profile?.display_name ?? "Unknown player"}
                            </span>
                            <Badge variant="outline">{review.status.replace("_", " ")}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {riotRankLabel(review.profile?.riot_tier, review.profile?.riot_rank)} ·
                            submitted {formatDate(review.created_at)}
                          </p>
                          {review.reason ? (
                            <div className="mt-3 border-l-2 border-primary/25 pl-3">
                              <p className="text-xs font-bold text-foreground">Review reason</p>
                              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                {review.reason}
                              </p>
                            </div>
                          ) : null}
                        </div>
                        <CircleAlert className="size-5 text-primary" />
                      </div>
                      {review.profile ? <EligibilityActions profileId={review.profile.id} /> : null}
                    </div>
                  ))
                ) : (
                  <div className="p-8">
                    <EmptyState
                      title="Eligibility queue clear"
                      description="No player currently requires a manual decision."
                    />
                  </div>
                )}
              </div>

              <details className="group mt-4 border-t border-border/60">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4">
                  <div className="flex items-center gap-3">
                    <Activity className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Eligibility decision history
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Recent completed staff decisions · read-only
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <div className="border-t border-border">
                  {data.reviewHistory.length ? (
                    data.reviewHistory.map((review) => (
                      <div
                        key={review.id}
                        className="grid gap-2 border-b border-border p-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {review.profile?.display_name ??
                              review.profile?.handle ??
                              "Unknown player"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDate(review.created_at)}
                            {review.reason ? ` · ${review.reason}` : ""}
                          </p>
                        </div>
                        <Badge variant="outline">{review.status.replace("_", " ")}</Badge>
                      </div>
                    ))
                  ) : (
                    <div className="p-6">
                      <EmptyState title="No completed decisions yet" />
                    </div>
                  )}
                </div>
              </details>
            </section>

            {data.reports.length ? (
              <section className="mt-10">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="eyebrow">Reports</p>
                    <h2 className="mt-1 text-lg font-semibold text-foreground">
                      Active moderation reports
                    </h2>
                  </div>
                  <Badge>{data.counts.reports}</Badge>
                </div>
                <div className="mt-4 overflow-hidden rounded-2xl border border-border/70 bg-card/35">
                  {data.reports.map((report) => (
                    <div
                      key={report.id}
                      className="grid gap-3 border-b border-border p-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {report.reason} · {report.reported?.display_name ?? "No reported player"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(report.created_at)}
                        </p>
                        {report.details ? (
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {report.details}
                          </p>
                        ) : null}
                      </div>
                      <Badge variant="outline">{report.status}</Badge>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section id="competition" className="mt-12 scroll-mt-24">
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Competition</p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">
                    Tournament control room
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Guided operations for rosters, brackets, match results, walkovers, corrections,
                    scoring and Semi-Split progression.
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link to="/admin/splits">
                    Advanced split view
                    <ChevronRight />
                  </Link>
                </Button>
              </div>
              <CompetitionOpsPanel />
            </section>

            <section className="mt-10">
              <details className="group border-t border-border/60">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 sm:py-5">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-background/40 text-muted-foreground">
                      <Activity className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Riot account reference
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {data.riotAccounts.length} linked account
                        {data.riotAccounts.length === 1 ? "" : "s"} · reference data only
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <div className="border-t border-border">
                  {data.riotAccounts.length ? (
                    data.riotAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="grid gap-3 border-b border-border p-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:p-5"
                      >
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-foreground">
                            {account.profile?.display_name ?? "Unknown player"} · {account.riot_id}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {riotRankLabel(account.solo_tier, account.solo_rank)}
                            {account.solo_lp != null ? ` · ${account.solo_lp} LP` : ""} ·{" "}
                            {account.platform.toUpperCase()} · synced{" "}
                            {formatDate(account.last_synced_at)}
                          </span>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {account.profile?.division ? (
                              <DivisionBadge division={account.profile.division} />
                            ) : null}
                            <Badge variant={account.data_verified ? "default" : "outline"}>
                              {account.data_verified ? "Riot data verified" : "Unverified data"}
                            </Badge>
                            <Badge variant="outline">
                              {account.ownership_verified
                                ? "Ownership verified"
                                : "Ownership unverified"}
                            </Badge>
                            <Badge variant="outline">{account.profile?.eligibility}</Badge>
                          </div>
                        </div>
                        {account.profile ? (
                          <EligibilityActions profileId={account.profile.id} />
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="p-8">
                      <EmptyState title="No linked Riot accounts yet" />
                    </div>
                  )}
                </div>
              </details>
            </section>

            <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4" />
              Competition and moderation actions remain server-validated and audited.
            </div>
          </>
        ) : null}
      </PageContainer>
    </div>
  );
}

function AdminMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xl font-black tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
