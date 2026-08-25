import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { StatTile } from "@/components/eloshape/StatTile";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, riotRankLabel } from "@/lib/format";
import { getAdminOverview } from "@/lib/admin.functions";

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
        description="Anti-smurf eligibility reviews and player reports. Read-only foundation; resolution actions land next."
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
                              {riotRankLabel(review.profile?.riot_tier, review.profile?.riot_rank)} ·{" "}
                              {formatDate(review.created_at)}
                            </span>
                          </span>
                          <span className="eyebrow shrink-0 text-gold">{review.status}</span>
                        </div>
                        {review.reason ? (
                          <p className="mt-2 text-sm text-muted-foreground">{review.reason}</p>
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
                              {report.kind} · {report.reported?.display_name ?? "—"}
                            </span>
                            <span className="eyebrow mt-1 block">{formatDate(report.created_at)}</span>
                          </span>
                          <span className="eyebrow shrink-0 text-gold">{report.status}</span>
                        </div>
                        {report.reason ? (
                          <p className="mt-2 text-sm text-muted-foreground">{report.reason}</p>
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
          </>
        )}
      </PageContainer>
    </div>
  );
}
