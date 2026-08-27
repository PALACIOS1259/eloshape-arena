import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { CalendarDays, MapPin, Trophy, Users } from "lucide-react";

import { DivisionBadge } from "@/components/eloshape/DivisionBadge";
import { EmptyState } from "@/components/eloshape/EmptyState";
import { PlayerAvatar } from "@/components/eloshape/PlayerRow";
import { StatTile } from "@/components/eloshape/StatTile";
import { StatusBadge } from "@/components/eloshape/StatusBadge";
import { TournamentRegisterButton } from "@/components/eloshape/TournamentRegisterButton";
import { PageContainer } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime, formatPoints, placementLabel } from "@/lib/format";
import { tournamentDetailQuery } from "@/lib/queries";

export const Route = createFileRoute("/tournaments/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(tournamentDetailQuery(params.slug));
    if (!data) throw notFound();
    return { name: data.tournament.name, subtitle: data.tournament.subtitle };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Tournament unavailable — EloShape" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const title = `${loaderData.name} — EloShape tournament`;
    const description =
      loaderData.subtitle ?? "Bracket, participants and results for this EloShape tournament.";
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
        title="Tournament not found"
        description="This bracket may have been removed or renamed."
        action={
          <Button asChild>
            <Link to="/tournaments">Back to tournaments</Link>
          </Button>
        }
      />
    </PageContainer>
  ),
  component: TournamentDetailPage,
});

function TournamentDetailPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(tournamentDetailQuery(slug));
  if (!data) return null;

  const { tournament, entries, matches } = data;
  const rounds = [...new Set(matches.map((m) => m.round_label))];

  return (
    <div>
      <section className="bg-hero border-b border-border">
        <PageContainer className="py-12">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={tournament.status} />
            <DivisionBadge division={tournament.division} />
            <span className="eyebrow">{tournament.mode === "team" ? "5v5 team" : "Solo"}</span>
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            {tournament.name}
          </h1>
          {tournament.subtitle ? (
            <p className="mt-2 text-muted-foreground">{tournament.subtitle}</p>
          ) : null}

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Starts"
              value={formatDateTime(tournament.starts_at)}
              icon={<CalendarDays className="size-5" />}
            />
            <StatTile
              label="Participants"
              value={`${tournament.participants_count ?? 0}/${tournament.max_participants ?? "∞"}`}
              icon={<Users className="size-5" />}
            />
            <StatTile label="Format" value={tournament.format ?? "TBD"} />
            <StatTile
              label="Region"
              value={tournament.region?.name ?? "LAS"}
              icon={<MapPin className="size-5" />}
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {tournament.prize ? (
              <p className="inline-flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold">
                <Trophy className="size-4" /> {tournament.prize}
              </p>
            ) : null}
            <TournamentRegisterButton slug={tournament.slug} status={tournament.status} />
          </div>
        </PageContainer>
      </section>

      <PageContainer className="py-10">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="participants">Participants</TabsTrigger>
            <TabsTrigger value="bracket">Bracket</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-[1.4fr_minmax(0,1fr)]">
              <div className="bg-surface-gradient shadow-card min-w-0 rounded-lg border border-border p-6">
                <p className="eyebrow">About this event</p>
                <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
                  {tournament.description ??
                    "Details for this tournament will be published before check-in opens."}
                </p>
                {tournament.rules ? (
                  <>
                    <p className="eyebrow mt-8">Rules</p>
                    <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
                      {tournament.rules}
                    </p>
                  </>
                ) : null}
              </div>

              <div className="bg-surface-gradient shadow-card min-w-0 rounded-lg border border-border p-6">
                <p className="eyebrow">Eligibility</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  Open to players verified in the{" "}
                  <span className="font-semibold text-foreground">
                    {tournament.division?.name ?? "assigned"}
                  </span>{" "}
                  division. Riot rank is checked once for eligibility; standings here are pure
                  EloShape results.
                </p>
                <div className="mt-6">
                  <TournamentRegisterButton slug={tournament.slug} status={tournament.status} />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Eligibility, division and geography are validated on the server when you register.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="participants" className="mt-6">
            {entries.length ? (
              <div className="bg-surface-gradient overflow-hidden rounded-lg border border-border">
                {entries.map((entry, index) => {
                  const name = entry.team?.name ?? entry.profile?.display_name ?? "TBD";
                  return (
                    <div
                      key={entry.id}
                      className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 last:border-0"
                    >
                      <span className="tabular text-sm font-black text-muted-foreground">
                        {entry.placement ?? entry.seed ?? index + 1}
                      </span>
                      <span className="flex min-w-0 items-center gap-3">
                        <PlayerAvatar name={name} />
                        <span className="min-w-0">
                          {entry.profile ? (
                            <Link
                              to="/players/$handle"
                              params={{ handle: entry.profile.handle }}
                              className="block truncate text-sm font-semibold text-foreground hover:text-brand"
                            >
                              {name}
                            </Link>
                          ) : entry.team ? (
                            <Link
                              to="/teams/$slug"
                              params={{ slug: entry.team.slug }}
                              className="block truncate text-sm font-semibold text-foreground hover:text-brand"
                            >
                              {name}
                            </Link>
                          ) : (
                            <span className="block truncate text-sm font-semibold">{name}</span>
                          )}
                          <span className="eyebrow mt-1 block">{entry.status}</span>
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="tabular block text-sm font-bold text-foreground">
                          {placementLabel(entry.placement)}
                        </span>
                        <span className="tabular block text-xs text-gold">
                          +{formatPoints(entry.points_awarded)} pts
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No participants yet"
                description="Entries appear here as players register and check in."
              />
            )}
          </TabsContent>

          <TabsContent value="bracket" className="mt-6">
            {matches.length ? (
              <div className="grid gap-4 lg:grid-cols-3">
                {rounds.map((round) => (
                  <div key={round} className="min-w-0">
                    <p className="eyebrow">{round}</p>
                    <div className="mt-3 space-y-3">
                      {matches
                        .filter((match) => match.round_label === round)
                        .map((match) => {
                          const a = entries.find((e) => e.id === match.entry_a_id);
                          const b = entries.find((e) => e.id === match.entry_b_id);
                          const nameOf = (e: typeof a) =>
                            e?.team?.name ?? e?.profile?.display_name ?? "TBD";
                          return (
                            <div
                              key={match.id}
                              className="bg-surface-gradient shadow-card rounded-lg border border-border p-3"
                            >
                              <MatchSide
                                name={nameOf(a)}
                                score={match.score_a}
                                winner={match.winner_entry_id === match.entry_a_id}
                              />
                              <div className="my-2 h-px bg-border" />
                              <MatchSide
                                name={nameOf(b)}
                                score={match.score_b}
                                winner={match.winner_entry_id === match.entry_b_id}
                              />
                              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                <p className="eyebrow">{match.status}</p>
                                {!match.is_bye && match.entry_a_id && match.entry_b_id ? (
                                  <Button asChild size="sm" variant="outline">
                                    <Link to="/matches/$matchId" params={{ matchId: match.id }}>
                                      Result / dispute
                                    </Link>
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Bracket not generated yet"
                description="The bracket is seeded once registration closes and check-in completes."
              />
            )}
          </TabsContent>
        </Tabs>
      </PageContainer>
    </div>
  );
}

function MatchSide({
  name,
  score,
  winner,
}: {
  name: string;
  score: number | null;
  winner: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
      <span
        className={
          winner
            ? "truncate text-sm font-bold text-foreground"
            : "truncate text-sm text-muted-foreground"
        }
      >
        {name}
      </span>
      <span
        className={
          winner ? "tabular text-sm font-black text-brand" : "tabular text-sm text-muted-foreground"
        }
      >
        {score ?? "–"}
      </span>
    </div>
  );
}
