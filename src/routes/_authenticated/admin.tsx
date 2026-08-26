import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { CompetitionOpsPanel } from "@/components/eloshape/CompetitionOpsPanel";
import { DivisionBadge } from "@/components/eloshape/DivisionBadge";
import { EmptyState } from "@/components/eloshape/EmptyState";
import { StatTile } from "@/components/eloshape/StatTile";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, riotRankLabel } from "@/lib/format";
import { getAdminOverview, setPlayerEligibility } from "@/lib/admin.functions";


export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Staff console — EloShape" },
      { name: "description", content: "Moderation queues and circuit health for EloShape staff." },
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

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {(["eligible", "pending_review", "rejected", "suspended"] as Decision[]).map((status) => (
        <Button
          key={status}
          size="sm"
          variant={status === "eligible" ? "default" : "outline"}
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(status)}
        >
          {status.replace("_", " ")}
        </Button>
      ))}
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

  return (
    <div>
      <PageHeading
        eyebrow="Staff"
        title="Moderation console"
        description="Anti-smurf eligibility reviews, Riot account checks and player reports. Eligibility is a manual staff decision."
      />

      <PageContainer className="py-10">
        {isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : error ? (
          <EmptyState
            title="Staff access required"
            description="This console is limited to accounts with the admin or moderator role."
          />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile label="Players" value={data.counts.players} />
              <StatTile label="Teams" value={data.counts.teams} />
              <StatTile label="Tournaments" value={data.counts.tournaments} />
            </div>

            <div className="mt-10 grid gap-8 lg:grid-cols-2">
              <div className="min-w-0">
                <p className="eyebrow">Eligibility reviews</p>
                <div className="bg-surface-gradient mt-3 overflow-hidden rounded-lg border border-border">
                  {data.reviews.length ? (
                    data.reviews.map((review) => (
                      <div key={review.id} className="border-b border-border p-4 last:border-0">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-foreground">
                              {review.profile?.display_name ?? "Unknown player"}
                            </span>
                            <span className="eyebrow mt-1 block">
                              {riotRankLabel(review.profile?.riot_tier, review.profile?.riot_rank)}{" "}
                              · {formatDate(review.created_at)}
                            </span>
                          </span>
                          <span className="eyebrow shrink-0 text-gold">{review.status}</span>
                        </div>
                        {review.reason ? (
                          <p className="mt-2 text-sm text-muted-foreground">{review.reason}</p>
                        ) : null}
                        {review.profile ? (
                          <EligibilityActions profileId={review.profile.id} />
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="p-6">
                      <EmptyState title="Queue clear" />
                    </div>
                  )}
                </div>
              </div>

              <div className="min-w-0">
                <p className="eyebrow">Reports</p>
                <div className="bg-surface-gradient mt-3 overflow-hidden rounded-lg border border-border">
                  {data.reports.length ? (
                    data.reports.map((report) => (
                      <div key={report.id} className="border-b border-border p-4 last:border-0">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-foreground">
                              {report.reason} · {report.reported?.display_name ?? "—"}
                            </span>
                            <span className="eyebrow mt-1 block">
                              {formatDate(report.created_at)}
                            </span>
                          </span>
                          <span className="eyebrow shrink-0 text-gold">{report.status}</span>
                        </div>
                        {report.details ? (
                          <p className="mt-2 text-sm text-muted-foreground">{report.details}</p>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="p-6">
                      <EmptyState title="No open reports" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-10">
              <p className="eyebrow">Linked Riot accounts (eligibility data only)</p>
              <div className="bg-surface-gradient mt-3 overflow-hidden rounded-lg border border-border">
                {data.riotAccounts.length ? (
                  data.riotAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="grid gap-3 border-b border-border p-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                    >
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {account.profile?.display_name ?? "Unknown player"} · {account.riot_id}
                        </span>
                        <span className="eyebrow mt-1 block">
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
                  <div className="p-6">
                    <EmptyState title="No linked Riot accounts yet" />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </PageContainer>
    </div>
  );
}
