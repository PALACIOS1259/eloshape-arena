import type { ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CalendarDays, CheckCircle2, ChevronRight, Swords, Trophy, Users } from "lucide-react";

import { BracketView, entryLabels } from "@/components/eloshape/BracketView";
import { EmptyState } from "@/components/eloshape/EmptyState";
import { SectionHeader } from "@/components/eloshape/SectionHeader";
import { StatusBadge } from "@/components/eloshape/StatusBadge";
import { PageContainer } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime, formatPoints } from "@/lib/format";
import { canonicalMetadata } from "@/lib/site-metadata";
import { bracketQuery, splitDetailQuery } from "@/lib/split-queries";
import { cn } from "@/lib/utils";

const DISPLAY_STAGES = [
  { label: "Scheduled" },
  { label: "4 Qualifiers" },
  { label: "Qualified + Seeding" },
  { label: "16-Team Playoff" },
  { label: "Champion" },
] as const;

function displayStageIndex(status: string) {
  if (status === "upcoming") return 0;
  if (status === "qualifiers") return 1;
  if (status === "seeding") return 2;
  if (["playoffs", "semifinals", "final"].includes(status)) return 3;
  if (status === "completed") return 4;
  return 0;
}

function displayStageLabel(status: string) {
  if (status === "semifinals") return "Playoff · Semifinals";
  if (status === "final") return "Playoff · Grand Final";
  return DISPLAY_STAGES[displayStageIndex(status)]?.label ?? status;
}

export const Route = createFileRoute("/splits/$slug")({
  loader: async ({ context, params }) => {
    const split = await context.queryClient.ensureQueryData(splitDetailQuery(params.slug));
    if (!split) throw notFound();
    return split;
  },
  head: ({ loaderData }) => {
    const name = loaderData?.split.name ?? "Semi-Split";
    const description = `Standings, qualifier results and the playoff bracket for ${name} on EloShape.`;
    const canonical = loaderData?.split.slug
      ? canonicalMetadata(`/splits/${encodeURIComponent(loaderData.split.slug)}`)
      : canonicalMetadata("/splits");
    return {
      meta: [
        { title: `${name} — EloShape Semi-Split` },
        { name: "description", content: description },
        { property: "og:title", content: `${name} — EloShape` },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...canonical.meta,
      ],
      links: canonical.links,
    };
  },
  errorComponent: () => (
    <PageContainer className="py-16">
      <EmptyState title="Split unavailable" description="Please try again in a moment." />
    </PageContainer>
  ),
  notFoundComponent: () => (
    <PageContainer className="py-16">
      <EmptyState title="Split not found" description="This Semi-Split does not exist." />
    </PageContainer>
  ),
  component: SplitPage,
});

function PlayoffBracket({ slug }: { slug: string }) {
  const { data } = useSuspenseQuery(bracketQuery(slug));
  if (!data || !data.matches.length) {
    return (
      <EmptyState
        title="Bracket not generated yet"
        description="The playoff bracket is published once seeding closes."
      />
    );
  }
  return <BracketView matches={data.matches} entries={entryLabels(data.entries)} />;
}

function SplitPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(splitDetailQuery(slug));
  if (!data) return null;

  const { split, standings, qualifications, tournaments, seedsRevealed } = data;
  const qualifiers = tournaments
    .filter((tournament) => tournament.qualifier_index != null)
    .sort((a, b) => (a.qualifier_index ?? 0) - (b.qualifier_index ?? 0));
  const playoffs = tournaments.find((tournament) => tournament.split_phase === "playoffs");
  const qualifiedCount = qualifications.filter(
    (qualification) => qualification.status === "qualified",
  ).length;
  const currentStageIndex = displayStageIndex(split.status);
  const podium = standings.slice(0, 3);

  return (
    <div>
      <section className="bg-hero relative overflow-hidden border-b border-border">
        <div className="absolute right-0 top-0 size-[30rem] translate-x-1/3 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
        <PageContainer className="relative py-9 sm:py-12">
          <Button asChild size="sm" variant="ghost" className="mb-6 -ml-3">
            <Link to="/splits">← All Semi-Splits</Link>
          </Button>

          <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={split.status} />
                {split.division ? <Badge variant="outline">{split.division.name}</Badge> : null}
                {split.region ? <Badge variant="outline">{split.region.name}</Badge> : null}
              </div>
              <p className="eyebrow mt-5">{split.season?.name ?? "EloShape season"}</p>
              <h1 className="mt-2 max-w-4xl text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                {split.name}
              </h1>
              <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="size-4" />
                  {formatDate(split.starts_at)} — {formatDate(split.ends_at)}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Swords className="size-4" />
                  4 qualifiers → 16 qualified → one{" "}{split.playoff_size}-team playoff bracket
                </span>
              </p>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/6 p-5 shadow-card">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                Current phase
              </p>
              <p className="mt-2 text-2xl font-black text-foreground">
                {displayStageLabel(split.status)}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {qualifiedCount}/{split.playoff_size} playoff places are currently locked.
              </p>
              {split.dispute_deadline_at ? (
                <p className="mt-4 border-t border-primary/15 pt-3 text-xs text-muted-foreground">
                  Disputes close {formatDateTime(split.dispute_deadline_at)}
                </p>
              ) : null}
            </div>
          </div>
        </PageContainer>
      </section>

      <PageContainer className="py-8 sm:py-10">
        <StageRail activeIndex={currentStageIndex} />

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <OverviewMetric
            icon={<Swords className="size-4" />}
            label="Qualifiers"
            value={`${qualifiers.length}/4`}
            detail="Open events"
          />
          <OverviewMetric
            icon={<Users className="size-4" />}
            label="Teams in split"
            value={String(standings.length)}
            detail="Qualifier seeding table"
          />
          <OverviewMetric
            icon={<CheckCircle2 className="size-4" />}
            label="Qualified"
            value={`${qualifiedCount}/${split.playoff_size}`}
            detail="Playoff places"
          />
          <OverviewMetric
            icon={<Trophy className="size-4" />}
            label="Championship"
            value={`${split.playoff_size} teams`}
            detail="Single elimination"
            gold
          />
        </section>

        <section className="mt-12">
          <SectionHeader
            eyebrow="Stage 1"
            title="Open Qualifiers"
            description="Four open events. Each qualifier awards four playoff places to the highest-finishing eligible teams that are not already qualified. If a qualified team plays again, its qualification place passes down."
          />
          {qualifiers.length ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {qualifiers.map((tournament) => {
                const participantCount = tournament.participants_count ?? 0;
                const maxParticipants = tournament.max_participants ?? 0;
                const fill = maxParticipants
                  ? Math.min(100, Math.round((participantCount / maxParticipants) * 100))
                  : 0;
                return (
                  <Link
                    key={tournament.id}
                    to="/tournaments/$slug"
                    params={{ slug: tournament.slug }}
                    className="group overflow-hidden rounded-2xl border border-border bg-surface-gradient shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
                  >
                    <div className="flex items-center justify-between border-b border-border/70 bg-background/25 px-4 py-3">
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                        Qualifier {tournament.qualifier_index}
                      </span>
                      <StatusBadge status={tournament.status} />
                    </div>
                    <div className="p-4">
                      <h3 className="line-clamp-2 min-h-10 text-sm font-black text-foreground transition-colors group-hover:text-primary">
                        {tournament.name}
                      </h3>
                      <p className="mt-3 text-xs text-muted-foreground">
                        {formatDate(tournament.starts_at)}
                      </p>

                      <div className="mt-5 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Field</span>
                        <span className="font-black tabular-nums text-foreground">
                          {participantCount}/{maxParticipants || "∞"}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background/50">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${fill}%` }}
                        />
                      </div>

                      <div className="mt-5 flex items-center justify-between border-t border-border/70 pt-3 text-xs font-semibold text-muted-foreground">
                        <span>4 slots · pass-down</span>
                        <span className="inline-flex items-center gap-1 text-primary">
                          View <ChevronRight className="size-3.5" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState title="Qualifiers not scheduled yet" />
            </div>
          )}
        </section>

        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeader
              eyebrow="Qualifier table"
              title="Playoff seeding standings"
              description="Only points earned in the four qualifiers count in this table. It sets playoff seeds and replacement priority; playoff results never reshuffle these seeds."
            />
            <Badge variant="outline">{standings.length} teams</Badge>
          </div>

          {podium.length ? (
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {podium.map((row, index) => (
                <Link
                  key={row.team_id}
                  to="/teams/$slug"
                  params={{ slug: row.team_slug }}
                  className={cn(
                    "group rounded-2xl border border-border bg-surface-gradient p-4 shadow-card transition-colors hover:border-primary/40",
                    index === 0 && "border-gold/30 bg-gold/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={cn(
                        "grid size-9 place-items-center rounded-lg border border-border bg-background/35 text-sm font-black tabular-nums text-muted-foreground",
                        index === 0 && "border-gold/30 bg-gold/10 text-gold",
                      )}
                    >
                      #{index + 1}
                    </span>
                    {row.qualification_status === "qualified" ? <Badge>Qualified</Badge> : null}
                  </div>
                  <p className="mt-4 truncate text-lg font-black text-foreground group-hover:text-primary">
                    {row.team_name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.team_tag ? `[${row.team_tag}] · ` : ""}
                    {row.wins}-{row.losses} record
                  </p>
                  <p className="mt-4 text-2xl font-black tabular-nums text-gold">
                    {formatPoints(row.points)}
                    <span className="ml-1 text-xs font-semibold text-muted-foreground">pts</span>
                  </p>
                </Link>
              ))}
            </div>
          ) : null}

          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface-gradient shadow-card">
            {standings.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-background/25 text-left">
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                        Rank
                      </th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                        Team
                      </th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                        Points
                      </th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                        Record
                      </th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                        Qualifiers
                      </th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                        Playoff status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((row, index) => (
                      <tr
                        key={row.team_id}
                        className="border-b border-border/70 transition-colors last:border-0 hover:bg-background/25"
                      >
                        <td className="px-4 py-3.5">
                          <span
                            className={cn(
                              "grid size-7 place-items-center rounded-md border border-border bg-background/30 text-xs font-black tabular-nums text-muted-foreground",
                              index < 3 && "border-primary/20 text-foreground",
                            )}
                          >
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <Link
                            to="/teams/$slug"
                            params={{ slug: row.team_slug }}
                            className="font-black text-foreground hover:text-primary"
                          >
                            {row.team_name}
                          </Link>
                          {row.team_tag ? (
                            <span className="ml-2 text-xs text-muted-foreground">
                              [{row.team_tag}]
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3.5 font-black tabular-nums text-gold">
                          {formatPoints(row.points)}
                        </td>
                        <td className="px-4 py-3.5 font-semibold tabular-nums text-foreground">
                          {row.wins}-{row.losses}
                        </td>
                        <td className="px-4 py-3.5 tabular-nums text-muted-foreground">
                          {row.tournaments_played}
                        </td>
                        <td className="px-4 py-3.5">
                          {row.qualification_status ? (
                            <Badge
                              variant={
                                row.qualification_status === "qualified" ? "default" : "outline"
                              }
                            >
                              {row.qualification_status}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Still competing</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6">
                <EmptyState title="No teams have competed yet" />
              </div>
            )}
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Stage 2 · 16 playoff places"
            title="Qualified field"
            description={
              seedsRevealed
                ? "Four unique eligible teams are taken from each qualifier. The 16-team field is now seeded by qualifier points."
                : "Each qualifier locks four unique playoff places. Already-qualified teams can compete again, but their qualification place passes down."
            }
          />
          {qualifications.length ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {qualifications.map((row) => (
                <article
                  key={row.id}
                  className="rounded-2xl border border-border bg-surface-gradient p-4 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-10 place-items-center rounded-xl border border-primary/20 bg-primary/8 text-sm font-black tabular-nums text-primary">
                      {row.playoff_seed ? `#${row.playoff_seed}` : row.qualification_position}
                    </span>
                    <Badge variant={row.status === "qualified" ? "default" : "outline"}>
                      {row.status}
                    </Badge>
                  </div>
                  <p className="mt-4 truncate font-black text-foreground">
                    {row.team?.name ?? "Unknown team"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.team?.tag ? `[${row.team.tag}] · ` : ""}
                    {row.qualified_from?.qualifier_index
                      ? `Qualifier ${row.qualified_from.qualifier_index}`
                      : "Standings replacement"}
                  </p>
                  <div className="mt-4 border-t border-border/70 pt-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Slot {row.qualification_position}
                    {row.replaces ? ` · replaces ${row.replaces.name}` : ""}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState title="No qualified teams yet" />
            </div>
          )}
        </section>

        <section className="mt-14">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Final stage · one championship bracket</p>
              <h2 className="mt-1 text-2xl font-black text-foreground">16-team playoff bracket</h2>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                This is one continuous single-elimination bracket: Round of 16 → Quarterfinals →
                Semifinals → Grand Final. Walkovers count as match wins; true byes advance without
                match-win points.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">
                {["Round of 16", "Quarterfinals", "Semifinals", "Grand Final"].map(
                  (round, index) => (
                    <span key={round} className="inline-flex items-center gap-2">
                      <span className="rounded-lg border border-border bg-background/30 px-2.5 py-1.5">
                        {round}
                      </span>
                      {index < 3 ? <ChevronRight className="size-3" /> : null}
                    </span>
                  ),
                )}
              </div>
            </div>
            {playoffs ? (
              <Button asChild variant="outline">
                <Link to="/tournaments/$slug" params={{ slug: playoffs.slug }}>
                  Open playoff event
                </Link>
              </Button>
            ) : null}
          </div>
          {playoffs ? (
            <PlayoffBracket slug={playoffs.slug} />
          ) : (
            <EmptyState
              title="Playoffs not created yet"
              description="The bracket appears once the qualifiers are complete and seeding closes."
            />
          )}
        </section>
      </PageContainer>
    </div>
  );
}

function StageRail({ activeIndex }: { activeIndex: number }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface-gradient p-4 shadow-card sm:p-5">
      <div className="flex min-w-max items-start">
        {DISPLAY_STAGES.map((stage, index) => {
          const completed = index < activeIndex;
          const active = index === activeIndex;
          return (
            <div key={stage.key} className="flex items-start">
              <div className="w-28 text-center sm:w-32">
                <span
                  className={cn(
                    "mx-auto grid size-8 place-items-center rounded-full border text-xs font-black",
                    completed && "border-primary bg-primary text-primary-foreground",
                    active && "border-primary bg-primary/10 text-primary ring-4 ring-primary/5",
                    !completed && !active && "border-border bg-background/40 text-muted-foreground",
                  )}
                >
                  {completed ? <CheckCircle2 className="size-4" /> : index + 1}
                </span>
                <p
                  className={cn(
                    "mt-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground",
                    active && "text-primary",
                    completed && "text-foreground",
                  )}
                >
                  {stage.label}
                </p>
              </div>
              {index < DISPLAY_STAGES.length - 1 ? (
                <div
                  className={cn(
                    "mt-4 h-px w-8 sm:w-12",
                    index < activeIndex ? "bg-primary" : "bg-border",
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function OverviewMetric({
  icon,
  label,
  value,
  detail,
  gold = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  gold?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-gradient p-4 shadow-card">
      <div
        className={cn(
          "grid size-9 place-items-center rounded-lg border border-primary/20 bg-primary/8 text-primary",
          gold && "border-gold/25 bg-gold/8 text-gold",
        )}
      >
        {icon}
      </div>
      <p className="mt-4 text-2xl font-black tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-xs font-black text-foreground">{label}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}
