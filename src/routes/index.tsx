import type { ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Swords, Target, Trophy, Users } from "lucide-react";

import { DivisionBadge } from "@/components/eloshape/DivisionBadge";
import { PlayerRow } from "@/components/eloshape/PlayerRow";
import { SectionHeader } from "@/components/eloshape/SectionHeader";
import { TeamCard } from "@/components/eloshape/TeamCard";
import { TournamentCard } from "@/components/eloshape/TournamentCard";
import { IntroVideoSection } from "@/components/launch/IntroVideoSection";
import { PageContainer } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { directoryQuery, homeSnapshotQuery } from "@/lib/queries";
import { formatPoints } from "@/lib/format";
import { canonicalMetadata } from "@/lib/site-metadata";

export const Route = createFileRoute("/")({
  head: () => {
    const canonical = canonicalMetadata("/");
    return {
      meta: [
        { title: "EloShape — Competitive League of Legends for amateur players" },
        {
          name: "description",
          content:
            "EloShape runs skill-based League of Legends tournaments from city to region. Iron to Gold divisions, verified eligibility, and rankings earned only on the EloShape circuit.",
        },
        { property: "og:title", content: "EloShape — The amateur LoL competitive circuit" },
        {
          property: "og:description",
          content:
            "Iron to Gold divisions, city-to-region brackets and a ranking that only counts EloShape results.",
        },
        ...canonical.meta,
      ],
      links: canonical.links,
    };
  },
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(homeSnapshotQuery());
    context.queryClient.ensureQueryData(directoryQuery());
  },
  component: HomePage,
});

function HomePage() {
  const { data: snapshot } = useSuspenseQuery(homeSnapshotQuery());
  const { data: directory } = useSuspenseQuery(directoryQuery());

  const featured = [...snapshot.live, ...snapshot.upcoming].slice(0, 3);
  const topPoints = snapshot.topPlayers[0]?.points_season ?? 0;

  return (
    <div>
      {/* Hero */}
      <section className="bg-hero relative overflow-hidden border-b border-border">
        <div className="bg-tech-grid absolute inset-0 opacity-60" aria-hidden />
        <PageContainer className="relative py-12 sm:py-16">
          <div className="grid gap-9 lg:grid-cols-[1.05fr_minmax(0,0.95fr)] lg:items-center">
            <div className="min-w-0">
              <p className="eyebrow">{directory.activeSeason?.name ?? "Season 1"} · LAS circuit</p>
              <h1 className="mt-3 text-4xl font-black leading-[1.03] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Competitive League for the <span className="text-brand-gradient">other 90%</span>
              </h1>
              <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
                EloShape is a structured circuit for Iron to Gold players. You compete inside your
                division, against your city and your region — and every point on the leaderboard is
                earned in an EloShape tournament.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/tournaments">
                    Browse tournaments
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/rankings">View rankings</Link>
                </Button>
              </div>

              <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-border/60 pt-5">
                <HomeMetric
                  icon={<Users className="size-4" />}
                  label="Players"
                  value={formatPoints(snapshot.stats.players)}
                />
                <HomeMetric
                  icon={<Swords className="size-4" />}
                  label="Tournaments"
                  value={formatPoints(snapshot.stats.tournaments)}
                />
                <HomeMetric
                  icon={<Trophy className="size-4" />}
                  label="Top score"
                  value={formatPoints(topPoints)}
                  gold
                />
              </div>
            </div>

            <div className="min-w-0">
              <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/45">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 px-4 py-3">
                  <p className="eyebrow">Live season leaderboard</p>
                  <Link
                    to="/rankings"
                    className="shrink-0 text-xs font-semibold text-brand hover:underline"
                  >
                    Full ranking
                  </Link>
                </div>
                <div>
                  {snapshot.topPlayers.map((player, index) => (
                    <PlayerRow key={player.id} player={player} rank={index + 1} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      <IntroVideoSection />

      {/* Divisions */}
      <PageContainer className="py-16">
        <SectionHeader
          eyebrow="Skill-based structure"
          title="Four divisions, one honest ladder"
          description="Your Riot rank decides which division you are eligible for. Nothing else carries over — placement, points and titles are EloShape-only."
          action={
            <Button asChild variant="outline">
              <Link to="/divisions">How eligibility works</Link>
            </Button>
          }
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {directory.divisions.map((division) => (
            <div
              key={division.id}
              className="rounded-2xl border border-border/70 bg-gradient-to-br from-card/80 to-background/45 p-5"
            >
              <DivisionBadge division={division} size="md" />
              <p className="mt-4 text-sm text-muted-foreground">{division.description}</p>
              <p className="eyebrow mt-4">
                Riot: {(division.riot_tiers as string[] | null)?.join(", ") ?? "—"}
              </p>
            </div>
          ))}
        </div>
      </PageContainer>

      {/* Featured tournaments */}
      <PageContainer className="pb-16">
        <SectionHeader
          eyebrow="Next up"
          title="Featured brackets"
          description="Weekly city circuits, provincial leagues and national monthly championships."
          action={
            <Button asChild variant="outline">
              <Link to="/tournaments">All tournaments</Link>
            </Button>
          }
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((tournament) => (
            <TournamentCard key={tournament.slug} tournament={tournament} />
          ))}
        </div>
      </PageContainer>

      {/* Teams + fair play */}
      <PageContainer className="pb-16">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_minmax(0,1fr)]">
          <div className="min-w-0">
            <SectionHeader
              eyebrow="5v5"
              title="Teams on the circuit"
              action={
                <Button asChild variant="ghost">
                  <Link to="/teams">All teams</Link>
                </Button>
              }
            />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {snapshot.topTeams.map((team) => (
                <TeamCard key={team.slug} team={team} />
              ))}
            </div>
          </div>

          <div className="min-w-0 border-l border-border/60 pl-0 lg:pl-8">
            <p className="eyebrow">Integrity</p>
            <h3 className="mt-3 text-xl font-black text-foreground">Built against smurfing</h3>
            <ul className="mt-5 space-y-4 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
                Riot account linking verifies the rank behind every division entry.
              </li>
              <li className="flex gap-3">
                <Target className="mt-0.5 size-4 shrink-0 text-brand" />
                Suspicious performance triggers a manual eligibility review before payouts.
              </li>
              <li className="flex gap-3">
                <Trophy className="mt-0.5 size-4 shrink-0 text-brand" />
                Points come from configurable tournament rules — never from Solo Queue.
              </li>
            </ul>
            <Button asChild className="mt-6">
              <Link to="/rules">Read the point rules</Link>
            </Button>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}

function HomeMetric({
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
    <div className="flex items-center gap-2">
      <span className={gold ? "text-gold" : "text-primary"}>{icon}</span>
      <span>
        <span
          className={
            gold ? "block text-lg font-black text-gold" : "block text-lg font-black text-foreground"
          }
        >
          {value}
        </span>
        <span className="block text-[9px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
          {label}
        </span>
      </span>
    </div>
  );
}
