import type { ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, Swords, Trophy, Users } from "lucide-react";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { StatusBadge } from "@/components/eloshape/StatusBadge";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { canonicalMetadata } from "@/lib/site-metadata";
import { splitsQuery } from "@/lib/split-queries";
import { cn } from "@/lib/utils";

const FORMAT_STEPS = [
  {
    number: "01",
    title: "4 Open Qualifiers",
    description: "Four unique playoff places are awarded from each qualifier.",
  },
  {
    number: "02",
    title: "16 Qualified Teams",
    description: "Repeat qualifiers pass their slot down to the next eligible team.",
  },
  {
    number: "03",
    title: "Qualifier Seeding",
    description: "Qualifier points order the playoff field from seed #1 to #16.",
  },
  {
    number: "04",
    title: "One Playoff Bracket",
    description: "Round of 16 through Grand Final in one single-elimination bracket.",
  },
] as const;

function stageLabel(status: string) {
  const labels: Record<string, string> = {
    upcoming: "Scheduled",
    qualifiers: "Open Qualifiers",
    seeding: "Seeding",
    playoffs: "16-Team Playoff",
    semifinals: "Semifinals",
    final: "Grand Final",
    completed: "Completed",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

export const Route = createFileRoute("/splits/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(splitsQuery()),
  head: () => {
    const canonical = canonicalMetadata("/splits");
    return {
      meta: [
        { title: "Semi-Splits — EloShape competitive calendar" },
        {
          name: "description",
          content:
            "Every EloShape Semi-Split: four Open Qualifiers, 16 unique qualified teams, qualifier-based seeding and one 16-team playoff bracket.",
        },
        { property: "og:title", content: "EloShape Semi-Splits" },
        {
          property: "og:description",
          content: "Qualifiers, standings and playoff brackets for each EloShape Semi-Split.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...canonical.meta,
      ],
      links: canonical.links,
    };
  },
  errorComponent: () => (
    <PageContainer className="py-16">
      <EmptyState title="Splits unavailable" description="Please try again in a moment." />
    </PageContainer>
  ),
  notFoundComponent: () => (
    <PageContainer className="py-16">
      <EmptyState title="Not found" />
    </PageContainer>
  ),
  component: SplitsPage,
});

function SplitsPage() {
  const { data: splits } = useSuspenseQuery(splitsQuery());
  const liveCount = splits.filter(
    (split) => !["upcoming", "completed"].includes(split.status),
  ).length;
  const completedCount = splits.filter((split) => split.status === "completed").length;

  return (
    <div>
      <PageHeading
        eyebrow="Competitive calendar"
        title="Semi-Splits"
        description="Four qualifiers build one 16-team playoff field. Qualifier points determine seeding; the playoff determines the champion."
        aside={
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <InlineMetric value={splits.length} label="splits" />
            <InlineMetric value={liveCount} label="active" accent />
            <InlineMetric value={completedCount} label="completed" />
          </div>
        }
      />

      <PageContainer className="py-7 sm:py-9">
        <section className="rounded-2xl border border-border/75 bg-gradient-to-br from-card/85 to-background/55 px-4 py-5 shadow-card sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">How the circuit works</p>
              <p className="mt-1 text-sm text-muted-foreground">
                One path from open qualifier to championship bracket.
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/rankings">View rankings</Link>
            </Button>
          </div>

          <div className="mt-5 grid gap-5 border-t border-border/60 pt-5 md:grid-cols-2 xl:grid-cols-4">
            {FORMAT_STEPS.map((step, index) => (
              <div key={step.number} className="relative pr-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black tabular-nums text-primary/50">
                    {step.number}
                  </span>
                  {index < FORMAT_STEPS.length - 1 ? (
                    <ChevronRight className="size-3.5 text-muted-foreground/40" />
                  ) : (
                    <Trophy className="size-3.5 text-gold" />
                  )}
                </div>
                <h2 className="mt-3 text-sm font-black text-foreground">{step.title}</h2>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Competition archive</p>
              <h2 className="mt-1 text-xl font-black text-foreground sm:text-2xl">
                Semi-Split calendar
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Open a split to inspect qualifiers, qualified teams, seeding and playoffs.
            </p>
          </div>

          {splits.length ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {splits.map((split) => (
                <Link
                  key={split.id}
                  to="/splits/$slug"
                  params={{ slug: split.slug }}
                  className="group relative overflow-hidden rounded-2xl border border-border/75 bg-gradient-to-br from-card/95 via-card/80 to-background/70 p-5 shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-primary/35 hover:shadow-xl"
                >
                  <div className="pointer-events-none absolute -right-14 -top-20 size-44 rounded-full bg-primary/[0.05] blur-3xl" />

                  <div className="relative flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{split.season?.name ?? "Season"}</Badge>
                        <StatusBadge status={split.status} />
                      </div>
                      <h3 className="mt-3 truncate text-xl font-black tracking-tight text-foreground transition-colors group-hover:text-primary">
                        {split.name}
                      </h3>
                      <p className="mt-1.5 inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarDays className="size-3.5" />
                        {formatDate(split.starts_at)} — {formatDate(split.ends_at)}
                      </p>
                    </div>

                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary">
                      <Swords className="size-4" />
                    </span>
                  </div>

                  <div className="relative mt-6 grid grid-cols-3 divide-x divide-border/60">
                    <SplitMetric
                      icon={<Users className="size-3.5" />}
                      label="Playoff field"
                      value={`${split.playoff_size}`}
                    />
                    <SplitMetric
                      icon={<Swords className="size-3.5" />}
                      label="Stage"
                      value={stageLabel(split.status)}
                    />
                    <SplitMetric
                      icon={<Trophy className="size-3.5" />}
                      label="Format"
                      value="Single elim."
                      gold
                    />
                  </div>

                  <div className="relative mt-5 flex items-center justify-between border-t border-border/60 pt-4 text-xs text-muted-foreground">
                    <span>4 qualifiers · 16 unique playoff places</span>
                    <ChevronRight className="size-4 transition-all group-hover:translate-x-1 group-hover:text-primary" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                title="No Semi-Splits yet"
                description="The first Semi-Split will appear here as soon as staff schedules it."
              />
            </div>
          )}
        </section>
      </PageContainer>
    </div>
  );
}

function InlineMetric({
  value,
  label,
  accent = false,
}: {
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <strong className={cn("font-black tabular-nums text-foreground", accent && "text-primary")}>
        {value}
      </strong>
      <span className="uppercase tracking-[0.09em]">{label}</span>
    </span>
  );
}

function SplitMetric({
  icon,
  label,
  value,
  gold = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  gold?: boolean;
}) {
  return (
    <div className="px-3 first:pl-0 last:pr-0">
      <p
        className={cn(
          "flex items-center gap-1.5 text-base font-black text-foreground",
          gold && "text-gold",
        )}
      >
        {icon}
        <span className="truncate">{value}</span>
      </p>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
