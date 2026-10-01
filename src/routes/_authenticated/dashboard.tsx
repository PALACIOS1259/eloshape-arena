import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight } from "lucide-react";

import { DivisionBadge } from "@/components/eloshape/DivisionBadge";
import { EmptyState } from "@/components/eloshape/EmptyState";
import { OnboardingChecklist } from "@/components/eloshape/OnboardingChecklist";
import { ProfileSettingsCard } from "@/components/eloshape/ProfileSettingsCard";
import { RiotAccountCard } from "@/components/eloshape/RiotAccountCard";
import { StatusBadge } from "@/components/eloshape/StatusBadge";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
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

const ELIGIBILITY_LABEL: Record<string, string> = {
  eligible: "Eligible to compete",
  pending_review: "Eligibility pending review",
  rejected: "Eligibility rejected",
  suspended: "Account suspended",
};

function DashboardPage() {
  const fetchDashboard = useServerFn(getMyDashboard);
  const navigate = useNavigate();
  const { data, isPending, error } = useQuery({
    queryKey: ["my-dashboard"],
    queryFn: () => fetchDashboard(),
    retry: false,
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

  if (error || !data) {
    const description =
      import.meta.env.DEV && error instanceof Error && error.message
        ? `Development error: ${error.message}`
        : "Your EloShape profile and history are safe. Please try again in a moment.";
    if (import.meta.env.DEV && error) console.error("[EloShape dashboard]", error);

    return (
      <PageContainer className="py-16">
        <EmptyState title="We couldn't load your dashboard" description={description} />
      </PageContainer>
    );
  }

  const { profile, riot, riotService, onboarding } = data;

  return (
    <div>
      <PageHeading
        eyebrow="Player area"
        title={profile.display_name}
        description="Your competition status, Riot eligibility, team readiness and official EloShape history."
        aside={
          <Button variant="outline" size="sm" onClick={signOut}>
            Sign out
          </Button>
        }
      />

      <PageContainer className="py-7 sm:py-9">
        <section className="flex flex-col gap-5 border-b border-border/60 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <DivisionBadge division={profile.division} size="md" />
            <Badge variant="outline" className="text-muted-foreground">
              {ELIGIBILITY_LABEL[profile.eligibility] ?? profile.eligibility}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Riot eligibility · {riotRankLabel(profile.riot_tier, profile.riot_rank)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-7 gap-y-4 sm:grid-cols-4">
            <Metric label="Season" value={formatPoints(profile.points_season)} accent />
            <Metric label="Month" value={formatPoints(profile.points_month)} />
            <Metric
              label="Record"
              value={`${profile.wins}-${profile.losses}`}
              detail={winRate(profile.wins, profile.losses)}
            />
            <Metric label="Profile" value={`${profile.profile_completion}%`} />
          </div>
        </section>

        <section className="mt-7 grid gap-5 lg:grid-cols-[0.9fr_1.35fr]">
          <OnboardingChecklist steps={onboarding} />
          <div className="space-y-5">
            <RiotAccountCard account={riot} service={riotService} />
            <ProfileSettingsCard profile={profile} />
          </div>
        </section>

        <section className="mt-9 grid gap-8 lg:grid-cols-2">
          <div className="min-w-0">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Competition</p>
                <h2 className="mt-1 text-xl font-black text-foreground">Your entries</h2>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link to="/tournaments">Browse events</Link>
              </Button>
            </div>

            {data.entries.length ? (
              <div className="mt-3 overflow-hidden border-y border-border/65 bg-card/15">
                {data.entries.map((entry) => (
                  <Link
                    key={entry.id}
                    to="/tournaments/$slug"
                    params={{ slug: entry.tournament?.slug ?? "" }}
                    className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border/60 px-4 py-4 transition-colors last:border-0 hover:bg-primary/[0.035]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                        {entry.tournament?.name}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {formatDate(entry.tournament?.starts_at)} · {entry.status}
                      </span>
                    </span>
                    <span className="flex items-center gap-3 text-right">
                      <span>
                        {entry.tournament ? <StatusBadge status={entry.tournament.status} /> : null}
                        <span className="tabular mt-1 block text-[11px] text-gold">
                          {placementLabel(entry.placement)} · +{formatPoints(entry.points_awarded)}
                        </span>
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-3">
                <EmptyState
                  title="No entries yet"
                  description="Register for an open bracket to start earning points."
                  action={
                    <Button asChild>
                      <Link to="/tournaments">Browse tournaments</Link>
                    </Button>
                  }
                />
              </div>
            )}
          </div>

          <div className="min-w-0">
            <p className="eyebrow">Scoring</p>
            <h2 className="mt-1 text-xl font-black text-foreground">Recent points</h2>

            {data.ledger.length ? (
              <div className="mt-3 divide-y divide-border/55 border-y border-border/65 bg-card/15">
                {data.ledger.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {row.tournament?.name ?? row.note ?? row.rule_code}
                      </span>
                      <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                        {formatDate(row.awarded_at)}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-sm font-black text-gold">
                      +{formatPoints(row.points)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3">
                <EmptyState title="No points yet" />
              </div>
            )}
          </div>
        </section>
      </PageContainer>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string;
  value: string;
  detail?: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className={`truncate text-lg font-black ${accent ? "text-gold" : "text-foreground"}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
        {label}
        {detail ? ` · ${detail}` : ""}
      </p>
    </div>
  );
}
