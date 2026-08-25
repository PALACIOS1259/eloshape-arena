import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { DivisionBadge } from "@/components/eloshape/DivisionBadge";
import { EmptyState } from "@/components/eloshape/EmptyState";
import { StatTile } from "@/components/eloshape/StatTile";
import { StatusBadge } from "@/components/eloshape/StatusBadge";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatPoints, placementLabel, riotRankLabel, winRate } from "@/lib/format";
import { getMyDashboard } from "@/lib/me.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your dashboard — EloShape" },
      { name: "description", content: "Your EloShape division, points, entries and history." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const fetchDashboard = useServerFn(getMyDashboard);
  const navigate = useNavigate();
  const { data, isPending } = useQuery({
    queryKey: ["my-dashboard"],
    queryFn: () => fetchDashboard(),
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  if (isPending) {
    return (
      <PageContainer className="space-y-4 py-16">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
      </PageContainer>
    );
  }

  const profile = data?.profile ?? null;

  return (
    <div>
      <PageHeading
        eyebrow="Player area"
        title={profile ? profile.display_name : "Welcome to EloShape"}
        description={
          profile
            ? "Your division, points and tournament activity on the circuit."
            : "Your competitor profile is not set up yet. Profile creation and Riot account linking land in the next iteration."
        }
        aside={
          <Button variant="outline" onClick={signOut}>
            Sign out
          </Button>
        }
      />

      <PageContainer className="py-10">
        {profile ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <DivisionBadge division={profile.division} size="md" />
              <span className="text-sm text-muted-foreground">
                Riot (eligibility only): {riotRankLabel(profile.riot_tier, profile.riot_rank)}
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Season points" value={formatPoints(profile.points_season)} />
              <StatTile label="Month points" value={formatPoints(profile.points_month)} />
              <StatTile
                label="Record"
                value={`${profile.wins}-${profile.losses}`}
                hint={`${winRate(profile.wins, profile.losses)} win rate`}
              />
              <StatTile label="Profile completion" value={`${profile.profile_completion}%`} />
            </div>

            <div className="mt-10 grid gap-8 lg:grid-cols-2">
              <div className="min-w-0">
                <p className="eyebrow">Your entries</p>
                <div className="mt-3 space-y-3">
                  {data?.entries.length ? (
                    data.entries.map((entry) => (
                      <Link
                        key={entry.id}
                        to="/tournaments/$slug"
                        params={{ slug: entry.tournament?.slug ?? "" }}
                        className="bg-surface-gradient shadow-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border p-4 hover:border-brand/50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-foreground">
                            {entry.tournament?.name}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {formatDate(entry.tournament?.starts_at)} · {entry.status}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          {entry.tournament ? <StatusBadge status={entry.tournament.status} /> : null}
                          <span className="tabular mt-1 block text-xs text-gold">
                            {placementLabel(entry.placement)} · +{formatPoints(entry.points_awarded)}
                          </span>
                        </span>
                      </Link>
                    ))
                  ) : (
                    <EmptyState
                      title="No entries yet"
                      description="Register for an open bracket to start earning points."
                      action={
                        <Button asChild>
                          <Link to="/tournaments">Browse tournaments</Link>
                        </Button>
                      }
                    />
                  )}
                </div>
              </div>

              <div className="min-w-0">
                <p className="eyebrow">Recent points</p>
                <div className="bg-surface-gradient mt-3 overflow-hidden rounded-lg border border-border">
                  {data?.ledger.length ? (
                    data.ledger.map((row) => (
                      <div
                        key={row.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 last:border-0"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-foreground">
                            {row.tournament?.name ?? row.note ?? row.rule_code}
                          </span>
                          <span className="eyebrow mt-1 block">{formatDate(row.awarded_at)}</span>
                        </span>
                        <span className="tabular shrink-0 text-sm font-black text-gold">
                          +{formatPoints(row.points)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-6">
                      <EmptyState title="No points yet" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            title="No competitor profile linked to this account yet"
            description="Profile setup, Riot account linking and tournament registration are the next milestone. Meanwhile you can explore the circuit."
            action={
              <Button asChild>
                <Link to="/tournaments">Browse tournaments</Link>
              </Button>
            }
          />
        )}
      </PageContainer>
    </div>
  );
}
