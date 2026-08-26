import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { BracketView, entryLabels } from "@/components/eloshape/BracketView";
import { EmptyState } from "@/components/eloshape/EmptyState";
import { SectionHeader } from "@/components/eloshape/SectionHeader";
import { StatTile } from "@/components/eloshape/StatTile";
import { StatusBadge } from "@/components/eloshape/StatusBadge";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime, formatPoints } from "@/lib/format";
import { bracketQuery, splitDetailQuery } from "@/lib/split-queries";

const STAGES = [
  { key: "qualifiers", label: "Open Qualifiers" },
  { key: "seeding", label: "Seeding" },
  { key: "playoffs", label: "16-team Playoffs" },
  { key: "semifinals", label: "Semifinals" },
  { key: "final", label: "Grand Final" },
  { key: "completed", label: "Completed" },
] as const;

export const Route = createFileRoute("/splits/$slug")({
  loader: async ({ context, params }) => {
    const split = await context.queryClient.ensureQueryData(splitDetailQuery(params.slug));
    if (!split) throw notFound();
    return split;
  },
  head: ({ loaderData }) => {
    const name = loaderData?.split.name ?? "Semi-Split";
    const description = `Standings, qualifier results and the playoff bracket for ${name} on EloShape.`;
    return {
      meta: [
        { title: `${name} — EloShape Semi-Split` },
        { name: "description", content: description },
        { property: "og:title", content: `${name} — EloShape` },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
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
  const qualifiers = tournaments.filter((t) => t.qualifier_index != null);
  const playoffs = tournaments.find((t) => t.split_phase === "playoffs");
  const qualifiedCount = qualifications.filter((q) => q.status === "qualified").length;

  return (
    <div>
      <PageHeading
        eyebrow={split.season?.name ?? "Season"}
        title={split.name}
        description={`${formatDate(split.starts_at)} — ${formatDate(split.ends_at)} · Four Open Qualifiers feed a ${split.playoff_size}-team playoff bracket seeded from split standings.`}
      />

      <PageContainer className="py-10">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={split.status} />
          {split.division ? <Badge variant="outline">{split.division.name}</Badge> : null}
          {split.region ? <Badge variant="outline">{split.region.name}</Badge> : null}
          {split.dispute_deadline_at ? (
            <Badge variant="outline">
              Disputes close {formatDateTime(split.dispute_deadline_at)}
            </Badge>
          ) : null}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <StatTile label="Qualifiers" value={qualifiers.length} />
          <StatTile label="Teams in split" value={standings.length} />
          <StatTile label="Qualified" value={qualifiedCount} />
          <StatTile label="Playoff slots" value={split.playoff_size} />
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {STAGES.map((stage) => (
            <span
              key={stage.key}
              className={
                stage.key === split.status
                  ? "rounded-md border border-orange px-3 py-1.5 text-xs font-semibold text-foreground"
                  : "rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground"
              }
            >
              {stage.label}
            </span>
          ))}
        </div>

        <section className="mt-12">
          <SectionHeader eyebrow="Stage 1" title="Open Qualifiers" />
          {qualifiers.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {qualifiers.map((tournament) => (
                <Link
                  key={tournament.id}
                  to="/tournaments/$slug"
                  params={{ slug: tournament.slug }}
                  className="bg-surface-gradient block rounded-lg border border-border p-4 transition-colors hover:border-orange"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="eyebrow">Qualifier #{tournament.qualifier_index}</p>
                      <p className="mt-1 truncate text-sm font-semibold text-foreground">
                        {tournament.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(tournament.starts_at)} · {tournament.participants_count}/
                        {tournament.max_participants} teams
                      </p>
                    </div>
                    <StatusBadge status={tournament.status} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState title="Qualifiers not scheduled yet" />
            </div>
          )}
        </section>

        <section className="mt-12">
          <SectionHeader
            eyebrow="Standings"
            title="Split standings"
            description="EloShape points earned inside this Semi-Split only. Riot rank never contributes points."
          />
          <div className="bg-surface-gradient mt-4 overflow-x-auto rounded-lg border border-border">
            {standings.length ? (
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 text-xs tracking-wide text-muted-foreground uppercase">
                      #
                    </th>
                    <th className="px-4 py-3 text-xs tracking-wide text-muted-foreground uppercase">
                      Team
                    </th>
                    <th className="px-4 py-3 text-xs tracking-wide text-muted-foreground uppercase">
                      Points
                    </th>
                    <th className="px-4 py-3 text-xs tracking-wide text-muted-foreground uppercase">
                      W-L
                    </th>
                    <th className="px-4 py-3 text-xs tracking-wide text-muted-foreground uppercase">
                      Qualifiers
                    </th>
                    <th className="px-4 py-3 text-xs tracking-wide text-muted-foreground uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row, index) => (
                    <tr key={row.team_id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                      <td className="px-4 py-3">
                        <Link
                          to="/teams/$slug"
                          params={{ slug: row.team_slug }}
                          className="font-semibold text-foreground hover:text-orange"
                        >
                          {row.team_name}
                        </Link>
                        {row.team_tag ? (
                          <span className="ml-2 text-xs text-muted-foreground">{row.team_tag}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gold tabular-nums">
                        {formatPoints(row.points)}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {row.wins}-{row.losses}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{row.tournaments_played}</td>
                      <td className="px-4 py-3">
                        {row.qualification_status ? (
                          <Badge
                            variant={
                              row.qualification_status === "qualified" ? "default" : "outline"
                            }
                          >
                            {row.qualification_status}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6">
                <EmptyState title="No teams have competed yet" />
              </div>
            )}
          </div>
        </section>

        <section className="mt-12">
          <SectionHeader
            eyebrow="Stage 2"
            title="Qualified teams"
            description={
              seedsRevealed
                ? "Playoff seeds are set by split standings, not by qualification order."
                : "Playoff seeds stay hidden until the scheduled reveal."
            }
          />
          <div className="bg-surface-gradient mt-4 overflow-hidden rounded-lg border border-border">
            {qualifications.length ? (
              qualifications.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border p-4 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {row.team?.name ?? "Unknown team"}
                      {row.team?.tag ? (
                        <span className="ml-2 text-xs text-muted-foreground">{row.team.tag}</span>
                      ) : null}
                    </p>
                    <p className="eyebrow mt-1">
                      Slot {row.qualification_position} ·{" "}
                      {row.qualified_from?.qualifier_index
                        ? `Qualifier #${row.qualified_from.qualifier_index}`
                        : "Standings replacement"}
                      {row.replaces ? ` · replaces ${row.replaces.name}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {row.playoff_seed ? <Badge variant="outline">Seed {row.playoff_seed}</Badge> : null}
                    <Badge variant={row.status === "qualified" ? "default" : "outline"}>
                      {row.status}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6">
                <EmptyState title="No qualified teams yet" />
              </div>
            )}
          </div>
        </section>

        <section className="mt-12">
          <SectionHeader
            eyebrow="Stage 3"
            title="Playoff bracket"
            description="Single elimination. Byes advance the top seeds without awarding match points."
          />
          <div className="mt-4">
            {playoffs ? (
              <PlayoffBracket slug={playoffs.slug} />
            ) : (
              <EmptyState
                title="Playoffs not created yet"
                description="The bracket appears once the qualifiers are complete and seeding closes."
              />
            )}
          </div>
        </section>
      </PageContainer>
    </div>
  );
}
