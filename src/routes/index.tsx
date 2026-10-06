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
import { formatPoints, divisionDescription, riotRankLabel, seasonLabel } from "@/lib/format";
import { canonicalMetadata } from "@/lib/site-metadata";

export const Route = createFileRoute("/")({
  head: () => {
    const canonical = canonicalMetadata("/");
    return {
      meta: [
        { title: "EloShape — League of Legends competitivo para jugadores amateurs" },
        {
          name: "description",
          content:
            "EloShape organiza torneos de League of Legends por nivel, desde tu ciudad hasta tu región. Divisiones de Hierro a Oro, elegibilidad verificada y clasificaciones basadas solo en el circuito de EloShape.",
        },
        { property: "og:title", content: "EloShape — El circuito competitivo amateur de LoL" },
        {
          property: "og:description",
          content:
            "Divisiones de Hierro a Oro, cuadros locales y regionales, y una clasificación que cuenta solo los resultados de EloShape.",
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
              <p className="eyebrow">{seasonLabel(directory.activeSeason?.name)} · Circuito LAS</p>
              <h1 className="mt-3 text-4xl font-black leading-[1.03] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                League competitivo para el <span className="text-brand-gradient">otro 90 %</span>
              </h1>
              <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
                EloShape es un circuito organizado para jugadores de Hierro a Oro. Competís en tu
                división, contra tu ciudad y tu región; cada punto de la clasificación se gana en un
                torneo de EloShape.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/tournaments">
                    Explorar torneos
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/rankings">Ver clasificaciones</Link>
                </Button>
              </div>

              <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-border/60 pt-5">
                <HomeMetric
                  icon={<Users className="size-4" />}
                  label="Jugadores"
                  value={formatPoints(snapshot.stats.players)}
                />
                <HomeMetric
                  icon={<Swords className="size-4" />}
                  label="Torneos"
                  value={formatPoints(snapshot.stats.tournaments)}
                />
                <HomeMetric
                  icon={<Trophy className="size-4" />}
                  label="Mayor puntaje"
                  value={formatPoints(topPoints)}
                  gold
                />
              </div>
            </div>

            <div className="min-w-0">
              <div className="overflow-hidden border-y border-border/65 bg-card/15">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/55 bg-background/10 px-4 py-3">
                  <p className="eyebrow">Clasificación de temporada actualizada</p>
                  <Link
                    to="/rankings"
                    className="shrink-0 text-xs font-semibold text-brand hover:underline"
                  >
                    Clasificación completa
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
          eyebrow="Estructura por nivel"
          title="Cuatro divisiones, una clasificación justa"
          description="Tu rango de Riot determina a qué división podés entrar. Los puestos, puntos y títulos se obtienen únicamente en EloShape."
          action={
            <Button asChild variant="outline">
              <Link to="/divisions">Cómo funciona la elegibilidad</Link>
            </Button>
          }
        />
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {directory.divisions.map((division) => (
            <div
              key={division.id}
              className="rounded-2xl border border-border/70 bg-gradient-to-br from-card/92 via-card/72 to-background/55 p-5 shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
            >
              <DivisionBadge division={division} size="md" />
              <p className="mt-4 text-sm text-muted-foreground">
                {divisionDescription(division.code, division.description)}
              </p>
              <p className="eyebrow mt-4">
                Riot:{" "}
                {(division.riot_tiers as string[] | null)
                  ?.map((tier) => riotRankLabel(tier, null))
                  .join(", ") ?? "—"}
              </p>
            </div>
          ))}
        </div>
      </PageContainer>

      {/* Featured tournaments */}
      <PageContainer className="pb-16">
        <SectionHeader
          eyebrow="Próximamente"
          title="Cuadros destacados"
          description="Circuitos semanales por ciudad, ligas provinciales y campeonatos nacionales mensuales."
          action={
            <Button asChild variant="outline">
              <Link to="/tournaments">Todos los torneos</Link>
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
              title="Equipos del circuito"
              action={
                <Button asChild variant="ghost">
                  <Link to="/teams">Todos los equipos</Link>
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
            <p className="eyebrow">Integridad</p>
            <h3 className="mt-3 text-xl font-black text-foreground">
              Diseñado para detectar cuentas de nivel inferior al real
            </h3>
            <ul className="mt-5 space-y-4 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
                Vincular Riot permite verificar el rango de cada jugador que entra a una división.
              </li>
              <li className="flex gap-3">
                <Target className="mt-0.5 size-4 shrink-0 text-brand" />
                El rendimiento sospechoso genera una revisión manual de elegibilidad antes de
                entregar premios.
              </li>
              <li className="flex gap-3">
                <Trophy className="mt-0.5 size-4 shrink-0 text-brand" />
                Los puntos surgen de las reglas configurables de cada torneo, nunca de la cola
                clasificatoria individual.
              </li>
            </ul>
            <Button asChild className="mt-6">
              <Link to="/rules">Leer las reglas de puntuación</Link>
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
