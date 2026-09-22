import type { ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, Swords, Trophy, Users } from "lucide-react";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { StatusBadge } from "@/components/eloshape/StatusBadge";
import { PageContainer } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { canonicalMetadata } from "@/lib/site-metadata";
import { splitsQuery } from "@/lib/split-queries";

const FORMAT_STEPS = [
  {
    number: "01",
    title: "4 Open Qualifiers",
    description:
      "Each qualifier awards four places to the highest-finishing eligible teams not already qualified. Repeat qualifiers pass their slots down.",
  },
  {
    number: "02",
    title: "16 Qualified Teams",
    description:
      "Four unique playoff places are locked after each qualifier until the 16-team field is complete.",
  },
  {
    number: "03",
    title: "Qualifier Seeding",
    description:
      "Points from qualifier events only determine seeds #1–16 and replacement priority.",
  },
  {
    number: "04",
    title: "One Playoff Bracket",
    description:
      "Round of 16 → Quarterfinals → Semifinals → Grand Final, all inside the same single-elimination bracket.",
  },
] as const;

function stageLabel(status: string) {
  const labels: Record<string, string> = {
    upcoming: "Scheduled",
    qualifiers: "Open Qualifiers",
    seeding: "Seeding",
    playoffs: "16-Team Playoff",
    semifinals: "Playoff · Semifinals",
    final: "Playoff · Grand Final",
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
      <section className="bg-hero relative overflow-hidden border-b border-border">
        <div className="absolute left-1/2 top-0 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
        <PageContainer className="relative py-10 sm:py-14">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">EloShape circuit</Badge>
                <Badge variant="secondary">5v5 competition</Badge>
              </div>
              <p className="eyebrow mt-5">Competitive calendar</p>
              <h1 className="mt-2 max-w-3xl text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                Semi-Splits
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Four qualifiers award four unique playoff places each. Qualifier points seed the
                16 qualified teams into one single-elimination bracket, from Round of 16 to Grand
                Final.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <HeroStat label="Semi-Splits" value={String(splits.length)} />
              <HeroStat label="Live now" value={String(liveCount)} />
              <HeroStat label="Completed" value={String(completedCount)} />
            </div>
          </div>
        </PageContainer>
      </section>

      <PageContainer className="py-8 sm:py-10">
        <section className="overflow-hidden rounded-2xl border border-border bg-surface-gradient shadow-card">
          <div className="border-b border-border px-5 py-4 sm:px-6">
            <p className="eyebrow">How the circuit works</p>
            <h2 className="mt-1 text-xl font-black text-foreground">
              One Semi-Split, one clear path
            </h2>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-4">
            {FORMAT_STEPS.map((step, index) => (
              <div
                key={step.number}
                className="relative border-b border-border p-5 last:border-b-0 md:even:border-l xl:border-b-0 xl:border-l xl:first:border-l-0"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-2xl font-black tabular-nums text-primary/45">
                    {step.number}
                  </span>
                  {index < FORMAT_STEPS.length - 1 ? (
                    <ChevronRight className="size-4 text-muted-foreground/50" />
                  ) : (
                    <Trophy className="size-4 text-gold" />
                  )}
                </div>
                <h3 className="mt-5 font-black text-foreground">{step.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Competition archive</p>
              <h2 className="mt-1 text-2xl font-black text-foreground">Semi-Split calendar</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Open a Semi-Split to follow all four qualifiers, the 16 locked playoff places, the
                qualifier seeding table and the full championship bracket.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/rankings">View rankings</Link>
            </Button>
          </div>

          {splits.length ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {splits.map((split) => (
                <Link
                  key={split.id}
                  to="/splits/$slug"
                  params={{ slug: split.slug }}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-surface-gradient p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg sm:p-6"
                >
                  <div className="absolute right-0 top-0 size-48 translate-x-16 -translate-y-20 rounded-full bg-primary/8 blur-3xl" />
                  <div className="relative">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{split.season?.name ?? "Season"}</Badge>
                          <StatusBadge status={split.status} />
                        </div>
                        <h3 className="mt-4 truncate text-2xl font-black tracking-tight text-foreground transition-colors group-hover:text-primary">
                          {split.name}
                        </h3>
                        <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarDays className="size-4" />
                          {formatDate(split.starts_at)} — {formatDate(split.ends_at)}
                        </p>
                      </div>
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/8 text-primary">
                        <Swords className="size-5" />
                      </span>
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-2">
                      <SplitMetric
                        icon={<Users className="size-3.5" />}
                        label="Playoff field"
                        value={`${split.playoff_size} teams`}
                      />
                      <SplitMetric
                        icon={<Swords className="size-3.5" />}
                        label="Current stage"
                        value={stageLabel(split.status)}
                      />
                      <SplitMetric
                        icon={<Trophy className="size-3.5" />}
                        label="Format"
                        value="Single elim."
                      />
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-border/70 pt-4 text-xs font-semibold text-muted-foreground">
                      <span>4 qualifiers · 16 qualified · one bracket</span>
                      <span className="inline-flex items-center gap-1 text-primary">
                        Open Semi-Split{" "}
                        <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
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

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/35 px-3 py-4 text-center">
      <p className="text-2xl font-black tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function SplitMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/25 p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {icon} {label}
      </p>
      <p className="mt-2 truncate text-sm font-black text-foreground">{value}</p>
    </div>
  );
}
