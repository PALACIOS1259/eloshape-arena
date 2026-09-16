import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Crown, MapPin, ShieldCheck, Trophy, Users } from "lucide-react";

import { DivisionBadge } from "@/components/eloshape/DivisionBadge";
import { EmptyState } from "@/components/eloshape/EmptyState";
import { PlayerAvatar } from "@/components/eloshape/PlayerRow";
import { StatTile } from "@/components/eloshape/StatTile";
import { StatusBadge } from "@/components/eloshape/StatusBadge";
import { PageContainer } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatPoints, initials, placementLabel, winRate } from "@/lib/format";
import { teamQuery } from "@/lib/queries";
import { canonicalMetadata } from "@/lib/site-metadata";

export const Route = createFileRoute("/teams/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(teamQuery(params.slug));
    if (!data) throw notFound();
    return { name: data.team.name, tag: data.team.tag, slug: params.slug };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Team unavailable — EloShape" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${loaderData.name} — EloShape team`;
    const description = `Roster, record and tournament history for ${loaderData.name} on the EloShape circuit.`;
    const canonical = canonicalMetadata(`/teams/${encodeURIComponent(loaderData.slug)}`);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        ...canonical.meta,
      ],
      links: canonical.links,
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
  const starters = members.filter((member) => member.role !== "substitute");
  const substitutes = members.filter((member) => member.role === "substitute");
  const totalMatches = team.wins + team.losses;

  return (
    <div>
      <section className="bg-hero relative overflow-hidden border-b border-border">
        <div className="absolute right-0 top-0 size-72 translate-x-16 -translate-y-28 rounded-full bg-primary/10 blur-3xl" />
        <PageContainer className="relative py-8 sm:py-12">
          <Button asChild size="sm" variant="ghost" className="mb-6 -ml-3">
            <Link to="/teams">
              <ArrowLeft className="mr-2 size-4" /> All teams
            </Link>
          </Button>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="flex min-w-0 items-start gap-4 sm:gap-5">
              <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-primary/25 bg-surface-raised text-lg font-black text-steel shadow-card sm:size-20 sm:text-xl">
                {team.logo_url ? (
                  <img src={team.logo_url} alt={team.name} className="size-full object-cover" />
                ) : (
                  (team.tag ?? initials(team.name))
                )}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {team.tag ? <Badge variant="outline">[{team.tag}]</Badge> : null}
                  <DivisionBadge division={team.division} />
                </div>
                <h1 className="mt-3 truncate text-3xl font-black tracking-tight text-foreground sm:text-5xl">
                  {team.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4" /> {team.city?.name ?? "LAS"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-4" /> {members.length} roster members
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="size-4" /> {starters.length}/5 starters
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background/30 px-5 py-4 text-left lg:min-w-48 lg:text-right">
              <p className="eyebrow">Season standing</p>
              <p className="mt-1 text-3xl font-black tabular-nums text-foreground">
                {formatPoints(team.points_season)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">team points</p>
            </div>
          </div>

          {team.bio ? (
            <p className="mt-7 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {team.bio}
            </p>
          ) : null}

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Season points" value={formatPoints(team.points_season)} />
            <StatTile
              label="Match record"
              value={`${team.wins}-${team.losses}`}
              hint={`${winRate(team.wins, team.losses)} win rate · ${totalMatches} played`}
            />
            <StatTile
              label="Championships"
              value={team.championships ?? 0}
              icon={<Trophy className="size-5" />}
            />
            <StatTile
              label="Roster"
              value={members.length}
              hint={`${starters.length} starters · ${substitutes.length} substitutes`}
            />
          </div>
        </PageContainer>
      </section>

      <PageContainer className="py-8 sm:py-10">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]">
          <section className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Roster</p>
                <h2 className="mt-1 text-xl font-black text-foreground">Starting five & bench</h2>
              </div>
              <Badge variant="outline">{members.length} players</Badge>
            </div>

            <div className="mt-4 space-y-5">
              <RosterSection
                title="Starting roster"
                description="Players currently occupying competitive starting slots."
                members={starters}
              />
              {substitutes.length ? (
                <RosterSection
                  title="Substitutes"
                  description="Bench depth available to the team."
                  members={substitutes}
                />
              ) : null}
            </div>
          </section>

          <section className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Competition history</p>
                <h2 className="mt-1 text-xl font-black text-foreground">Tournament results</h2>
              </div>
              <Badge variant="outline">{entries.length}</Badge>
            </div>

            <div className="mt-4 space-y-3">
              {entries.length ? (
                entries.map((entry) => (
                  <Link
                    key={entry.id}
                    to="/tournaments/$slug"
                    params={{ slug: entry.tournament?.slug ?? "" }}
                    className="bg-surface-gradient shadow-card group block rounded-xl border border-border p-4 transition-colors hover:border-brand/50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-black text-foreground group-hover:text-brand">
                          {entry.tournament?.name}
                        </span>
                        <span className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarDays className="size-3.5" />
                          {formatDate(entry.tournament?.starts_at)}
                        </span>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-black tabular-nums text-foreground">
                          {placementLabel(entry.placement)}
                        </p>
                        <p className="mt-1 text-xs font-bold tabular-nums text-gold">
                          +{formatPoints(entry.points_awarded)} pts
                        </p>
                      </div>
                    </div>
                    {entry.tournament ? (
                      <StatusBadge status={entry.tournament.status} className="mt-3" />
                    ) : null}
                  </Link>
                ))
              ) : (
                <EmptyState
                  title="No tournaments played yet"
                  description="This team has not recorded an EloShape tournament result yet."
                />
              )}
            </div>
          </section>
        </div>
      </PageContainer>
    </div>
  );
}

function RosterSection({
  title,
  description,
  members,
}: {
  title: string;
  description: string;
  members: Array<{
    id: string;
    role: string;
    is_captain: boolean;
    profile: null | {
      id: string;
      handle: string;
      display_name: string;
      points_season: number;
      riot_tier: string | null;
      riot_rank: string | null;
      wins: number;
      losses: number;
    };
  }>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background/20">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div>
          <p className="font-black text-foreground">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline">{members.length}</Badge>
      </div>

      {members.length ? (
        <div className="divide-y divide-border">
          {members.map((member) => {
            const profile = member.profile;
            if (!profile) return null;
            return (
              <div
                key={member.id}
                className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <PlayerAvatar name={profile.display_name} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to="/players/$handle"
                        params={{ handle: profile.handle }}
                        className="truncate text-sm font-black text-foreground hover:text-brand"
                      >
                        {profile.display_name}
                      </Link>
                      {member.is_captain ? (
                        <Badge variant="secondary">
                          <Crown className="mr-1 size-3" /> Captain
                        </Badge>
                      ) : null}
                      <Badge variant="outline">
                        {member.role === "substitute" ? "Substitute" : "Starter"}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      @{profile.handle} · {profile.riot_tier ?? "Unranked"}{" "}
                      {profile.riot_rank ?? ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-5 sm:text-right">
                  <div>
                    <p className="text-sm font-black tabular-nums text-foreground">
                      {profile.wins}-{profile.losses}
                    </p>
                    <p className="eyebrow mt-1">Record</p>
                  </div>
                  <div>
                    <p className="text-sm font-black tabular-nums text-foreground">
                      {formatPoints(profile.points_season)}
                    </p>
                    <p className="eyebrow mt-1">Player pts</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-6 text-sm text-muted-foreground">No players in this group.</div>
      )}
    </div>
  );
}
