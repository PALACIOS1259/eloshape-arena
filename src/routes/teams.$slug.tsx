import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { Trophy } from "lucide-react";

import { DivisionBadge } from "@/components/eloshape/DivisionBadge";
import { EmptyState } from "@/components/eloshape/EmptyState";
import { PlayerAvatar } from "@/components/eloshape/PlayerRow";
import { StatTile } from "@/components/eloshape/StatTile";
import { StatusBadge } from "@/components/eloshape/StatusBadge";
import { PageContainer } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { formatDate, formatPoints, initials, placementLabel, winRate } from "@/lib/format";
import { teamQuery } from "@/lib/queries";

export const Route = createFileRoute("/teams/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(teamQuery(params.slug));
    if (!data) throw notFound();
    return { name: data.team.name, tag: data.team.tag };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Team unavailable — EloShape" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${loaderData.name} — EloShape team`;
    const description = `Roster, record and tournament history for ${loaderData.name} on the EloShape circuit.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  notFoundComponent: () => (
    <PageContainer className="py-20">
      <EmptyState
        title="Team not found"
        action={
          <Button asChild>
            <Link to="/teams">Back to teams</Link>
          </Button>
        }
      />
    </PageContainer>
  ),
  component: TeamPage,
});

function TeamPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(teamQuery(slug));
  if (!data) return null;
  const { team, members, entries } = data;

  return (
    <div>
      <section className="bg-hero border-b border-border">
        <PageContainer className="py-12">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-xl border border-border bg-surface-raised text-lg font-black text-steel">
                {team.tag ?? initials(team.name)}
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                  {team.name}
                </h1>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {team.city?.name ?? "LAS"}
                </p>
              </div>
            </div>
            <DivisionBadge division={team.division} size="md" />
          </div>

          {team.bio ? (
            <p className="mt-6 max-w-2xl text-sm text-muted-foreground">{team.bio}</p>
          ) : null}

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Season points" value={formatPoints(team.points_season)} />
            <StatTile
              label="Record"
              value={`${team.wins}-${team.losses}`}
              hint={`${winRate(team.wins, team.losses)} win rate`}
            />
            <StatTile
              label="Championships"
              value={team.championships ?? 0}
              icon={<Trophy className="size-5" />}
            />
            <StatTile label="Roster" value={members.length} />
          </div>
        </PageContainer>
      </section>

      <PageContainer className="grid gap-8 py-10 lg:grid-cols-[1.3fr_minmax(0,1fr)]">
        <div className="min-w-0">
          <p className="eyebrow">Roster</p>
          <div className="bg-surface-gradient mt-3 overflow-hidden rounded-lg border border-border">
            {members.map((member) => (
              <div
                key={member.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 last:border-0"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <PlayerAvatar name={member.profile?.display_name ?? "?"} />
                  <span className="min-w-0">
                    {member.profile ? (
                      <Link
                        to="/players/$handle"
                        params={{ handle: member.profile.handle }}
                        className="block truncate text-sm font-semibold text-foreground hover:text-brand"
                      >
                        {member.profile.display_name}
                      </Link>
                    ) : null}
                    <span className="eyebrow mt-1 block">
                      {member.role}
                      {member.is_captain ? " · Captain" : ""}
                    </span>
                  </span>
                </span>
                <span className="tabular text-right text-sm font-bold text-foreground">
                  {formatPoints(member.profile?.points_season)}
                  <span className="eyebrow mt-1 block">pts</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0">
          <p className="eyebrow">Tournament history</p>
          <div className="mt-3 space-y-3">
            {entries.length ? (
              entries.map((entry) => (
                <Link
                  key={entry.id}
                  to="/tournaments/$slug"
                  params={{ slug: entry.tournament?.slug ?? "" }}
                  className="bg-surface-gradient shadow-card block rounded-lg border border-border p-4 hover:border-brand/50"
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {entry.tournament?.name}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {formatDate(entry.tournament?.starts_at)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="tabular block text-sm font-black text-foreground">
                        {placementLabel(entry.placement)}
                      </span>
                      <span className="tabular block text-xs text-gold">
                        +{formatPoints(entry.points_awarded)}
                      </span>
                    </span>
                  </div>
                  {entry.tournament ? (
                    <StatusBadge status={entry.tournament.status} className="mt-3" />
                  ) : null}
                </Link>
              ))
            ) : (
              <EmptyState title="No tournaments played yet" />
            )}
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
