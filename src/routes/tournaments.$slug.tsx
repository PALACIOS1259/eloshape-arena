import type { ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Crown,
  MapPin,
  Radio,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
} from "lucide-react";

import { BracketView, entryLabels } from "@/components/eloshape/BracketView";
import { DivisionBadge } from "@/components/eloshape/DivisionBadge";
import { EmptyState } from "@/components/eloshape/EmptyState";
import { PlayerAvatar } from "@/components/eloshape/PlayerRow";
import { StatusBadge } from "@/components/eloshape/StatusBadge";
import { TournamentRegisterButton } from "@/components/eloshape/TournamentRegisterButton";
import { PageContainer } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatDateTime,
  formatPoints,
  placementLabel,
  divisionLabel,
  statusLabel,
  seasonLabel,
  tournamentFormat,
} from "@/lib/format";
import { tournamentDetailQuery } from "@/lib/queries";
import { canonicalMetadata } from "@/lib/site-metadata";
import { cn } from "@/lib/utils";

const EVENT_STAGES = [
  { key: "registration_open", label: "Inscripción", description: "Completar participantes" },
  { key: "registration_closed", label: "Check-in", description: "Bloquear el cuadro" },
  { key: "live", label: "Cuadro en vivo", description: "Jugar el evento" },
  { key: "completed", label: "Resultados", description: "Posiciones finales" },
] as const;

export const Route = createFileRoute("/tournaments/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(tournamentDetailQuery(params.slug));
    if (!data) throw notFound();
    return { name: data.tournament.name, subtitle: data.tournament.subtitle, slug: params.slug };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Torneo no disponible — EloShape" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const title = `${loaderData.name} — Torneo de EloShape`;
    const description =
      loaderData.subtitle ?? "Cuadro, participantes y resultados de este torneo de EloShape.";
    const canonical = canonicalMetadata(`/tournaments/${encodeURIComponent(loaderData.slug)}`);
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
        title="Torneo no encontrado"
        description="Este cuadro pudo haberse eliminado o cambiado de nombre."
        action={
          <Button asChild>
            <Link to="/tournaments">Volver a torneos</Link>
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
  const filled = tournament.participants_count ?? entries.length;
  const capacity = tournament.max_participants ?? 0;
  const pct = capacity ? Math.min(100, Math.round((filled / capacity) * 100)) : 0;
  const currentStageIndex = EVENT_STAGES.findIndex((stage) => stage.key === tournament.status);
  const isDemoFixture = tournament.slug.includes("-demo-");
  const podium = entries
    .filter((entry) => entry.placement && entry.placement <= 3)
    .sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99));
  const qualifierIndexByTournament = new Map(
    data.splitQualifiers.flatMap((qualifier) =>
      qualifier.qualifier_index == null ? [] : [[qualifier.id, qualifier.qualifier_index] as const],
    ),
  );
  const qualifiedFromThisEvent = data.splitQualifications
    .filter(
      (qualification) =>
        qualification.status === "qualified" &&
        qualification.qualified_from_tournament_id === tournament.id,
    )
    .sort((a, b) => (a.qualification_position ?? 999) - (b.qualification_position ?? 999));
  const isQualifier = tournament.split_phase === "qualifier" && tournament.qualifier_index != null;

  const qualificationLabel = (teamId: string | null | undefined) => {
    if (!teamId || !isQualifier) return null;
    const qualification = data.splitQualifications.find(
      (row) => row.team_id === teamId && row.status === "qualified",
    );
    if (!qualification?.qualified_from_tournament_id) return null;
    if (qualification.qualified_from_tournament_id === tournament.id) return "Clasificó acá";

    const sourceIndex = qualifierIndexByTournament.get(qualification.qualified_from_tournament_id);
    if (sourceIndex != null && sourceIndex < (tournament.qualifier_index ?? 0)) {
      return `Ya clasificado · C${sourceIndex}`;
    }
    return null;
  };

  return (
    <div>
      <section className="bg-hero relative overflow-hidden border-b border-border/80">
        {tournament.banner_url ? (
          <div className="absolute inset-0">
            <img
              src={tournament.banner_url}
              alt=""
              className="size-full object-cover opacity-25 blur-[1px] scale-[1.03]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/65" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/40" />
          </div>
        ) : null}
        <div className="absolute left-[12%] top-0 size-80 -translate-y-1/2 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute right-[8%] top-12 size-64 rounded-full bg-gold/8 blur-3xl" />

        <PageContainer className="relative py-8 sm:py-12">
          <Link
            to="/tournaments"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-3.5" />
            Circuito de torneos
          </Link>

          <div className="mt-5 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={tournament.status} />
                <DivisionBadge division={tournament.division} />
                <Badge variant="outline">
                  {tournament.mode === "team" ? "Equipos de 5 contra 5" : "Individual"}
                </Badge>
                {tournament.season?.name ? (
                  <Badge variant="secondary">{seasonLabel(tournament.season.name)}</Badge>
                ) : null}
                {isDemoFixture ? (
                  <Badge variant="outline">Datos de demostración del entorno de pruebas</Badge>
                ) : null}
              </div>

              <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                {tournament.name}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {tournament.subtitle ??
                  "Competencia oficial de EloShape con elegibilidad verificada, partidas organizadas y puntos del circuito."}
              </p>

              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3.5 text-primary" />
                  {formatDateTime(tournament.starts_at)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-primary" />
                  {tournament.region?.name ?? "LAS"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Swords className="size-3.5 text-primary" />
                  {tournamentFormat(tournament.format)}
                </span>
                {tournament.prize ? (
                  <span className="inline-flex items-center gap-1.5 text-gold">
                    <Trophy className="size-3.5" />
                    {tournament.prize}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="w-full border-t border-border/60 pt-4 xl:w-[22rem] xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">Participantes del torneo</p>
                  <p className="mt-1 text-xl font-black tabular-nums text-foreground">
                    {capacity ? `${filled}/${capacity}` : filled}
                  </p>
                </div>
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-lg bg-primary/8 text-muted-foreground",
                    tournament.status === "live" && "border-primary/30 bg-primary/10 text-primary",
                  )}
                >
                  {tournament.status === "live" ? (
                    <Radio className="size-4" />
                  ) : (
                    <Users className="size-4" />
                  )}
                </span>
              </div>

              {capacity ? (
                <>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted/70">
                    <div
                      className="bg-brand-gradient h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                    <span>{Math.max(0, capacity - filled)} lugares disponibles</span>
                    <span className="tabular-nums">{pct}% completo</span>
                  </div>
                </>
              ) : null}

              {tournament.registration_closes_at ? (
                <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                  <Clock3 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <span>
                    Cierre de inscripción{" "}
                    <strong className="font-semibold text-foreground">
                      {formatDateTime(tournament.registration_closes_at)}
                    </strong>
                  </span>
                </p>
              ) : null}

              <div className="mt-4 [&_button]:w-full">
                <TournamentRegisterButton
                  slug={tournament.slug}
                  status={tournament.status}
                  mode={tournament.mode}
                />
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      <PageContainer className="py-7 sm:py-9">
        <EventProgress status={tournament.status} currentStageIndex={currentStageIndex} />

        <Tabs defaultValue="overview" className="mt-7">
          <div className="sticky top-16 z-30 -mx-2 bg-background/75 p-2 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
            <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl border border-border/70 bg-card/65 p-1 sm:w-fit sm:min-w-[34rem]">
              <TabsTrigger
                value="overview"
                className="rounded-lg px-4 py-2 text-xs font-black data-[state=active]:bg-primary/12 data-[state=active]:text-primary"
              >
                Resumen
              </TabsTrigger>
              <TabsTrigger
                value="participants"
                className="rounded-lg px-4 py-2 text-xs font-black data-[state=active]:bg-primary/12 data-[state=active]:text-primary"
              >
                Participantes · {entries.length}
              </TabsTrigger>
              <TabsTrigger
                value="bracket"
                className="rounded-lg px-4 py-2 text-xs font-black data-[state=active]:bg-primary/12 data-[state=active]:text-primary"
              >
                Cuadro · {matches.length}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="overview"
            className="mt-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-500"
          >
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)]">
              <div className="space-y-5">
                <section className="border-b border-border/60 pb-6">
                  <div>
                    <p className="eyebrow">Información del evento</p>
                    <h2 className="mt-1 text-xl font-black text-foreground">
                      Todo lo que necesitás antes de la primera partida
                    </h2>
                  </div>
                  <div className="mt-4">
                    <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">
                      {tournament.description ??
                        "Los detalles del torneo se publicarán antes de abrir la confirmación de asistencia. EloShape valida tu división, ubicación y requisitos de ingreso cuando te inscribís."}
                    </p>

                    {tournament.rules ? (
                      <div className="mt-7 border-t border-border/70 pt-6">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="size-4 text-primary" />
                          <h3 className="text-sm font-black text-foreground">
                            Reglas de competencia
                          </h3>
                        </div>
                        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                          {tournament.rules}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </section>

                <section>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="eyebrow">Desarrollo del día de partidas</p>
                      <h2 className="mt-1 text-xl font-black text-foreground">
                        De la inscripción a los resultados
                      </h2>
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">
                      Proceso simple, validado por el servidor
                    </span>
                  </div>

                  <div className="mt-5 grid gap-5 md:grid-cols-3">
                    <FlowStep
                      number="01"
                      title="Inscribirse"
                      description="Inscribite mientras el registro esté abierto. La elegibilidad se comprueba automáticamente."
                    />
                    <FlowStep
                      number="02"
                      title="Confirmar asistencia"
                      description="Confirmá tu participación antes del evento para que el cuadro pueda cerrarse correctamente."
                    />
                    <FlowStep
                      number="03"
                      title="Competir"
                      description="Seguí tu cuadro, informá resultados y avanzá hacia la final."
                    />
                  </div>
                </section>
              </div>

              <div className="space-y-5">
                <section className="border-y border-border/65 py-5">
                  <p className="eyebrow">Acceso al torneo</p>
                  <h2 className="mt-1 text-lg font-black text-foreground">¿Listo para competir?</h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Abierto a{" "}
                    <strong className="font-semibold text-foreground">
                      {divisionLabel(tournament.division)}
                    </strong>{" "}
                    jugadores o equipos. El rango de Riot se usa para verificar la elegibilidad; los
                    resultados de EloShape determinan las posiciones del circuito.
                  </p>

                  <div className="mt-5 space-y-2.5">
                    <AccessCheck label="División validada por el servidor" />
                    <AccessCheck label="Elegibilidad regional validada" />
                    <AccessCheck
                      label={
                        tournament.mode === "team"
                          ? "Plantel del equipo verificado antes de inscribirse"
                          : "Identidad del jugador verificada antes de inscribirse"
                      }
                    />
                  </div>

                  <div className="mt-5 [&_button]:w-full">
                    <TournamentRegisterButton
                      slug={tournament.slug}
                      status={tournament.status}
                      mode={tournament.mode}
                    />
                  </div>
                </section>

                <section>
                  <p className="eyebrow">Información del evento</p>
                  <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4">
                    <InfoTile
                      icon={<CalendarDays className="size-4" />}
                      label="Inicio"
                      value={formatDateTime(tournament.starts_at)}
                    />
                    <InfoTile
                      icon={<MapPin className="size-4" />}
                      label="Región"
                      value={tournament.region?.name ?? "LAS"}
                    />
                    <InfoTile
                      icon={<Swords className="size-4" />}
                      label="Formato"
                      value={tournamentFormat(tournament.format)}
                    />
                    <InfoTile
                      icon={<Users className="size-4" />}
                      label="Modalidad"
                      value={tournament.mode === "team" ? "Equipos de 5 contra 5" : "Individual"}
                    />
                  </div>
                </section>
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="participants"
            className="mt-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-500"
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Participantes del torneo</p>
                <h2 className="mt-1 text-2xl font-black text-foreground">
                  {tournament.status === "completed"
                    ? "Posiciones finales"
                    : "Competidores inscritos"}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {entries.length} {entries.length === 1 ? "entry" : "entries"}
                  {capacity ? ` · ${capacity} lugares totales` : ""}.
                </p>
                {isDemoFixture && tournament.status === "completed" ? (
                  <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                    Estos datos de demostración del entorno de pruebas reutilizan algunos planteles
                    y resultados predeterminados. Las posiciones finales muestran quién terminó en
                    cada puesto; la clasificación de abajo muestra qué equipos obtuvieron nuevos
                    lugares en el Semi-Split al transferirse los cupos repetidos.
                  </p>
                ) : null}
              </div>
              <Badge variant="outline">
                {tournament.mode === "team" ? "Equipos participantes" : "Jugadores participantes"}
              </Badge>
            </div>

            {isQualifier && tournament.status === "completed" && qualifiedFromThisEvent.length ? (
              <section className="mt-5 overflow-hidden rounded-2xl border border-primary/20 bg-primary/[0.035] shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-primary/15 px-4 py-4 sm:px-5">
                  <div>
                    <p className="eyebrow">Resultado de clasificación</p>
                    <h3 className="mt-1 text-lg font-black text-foreground">
                      Nuevos lugares en eliminatorias obtenidos en este clasificatorio
                    </h3>
                    <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                      Las posiciones finales y la clasificación son conceptos distintos. Si un
                      equipo bien ubicado ya estaba clasificado, su lugar pasa al siguiente equipo
                      elegible.
                    </p>
                  </div>
                  <Badge variant="outline">
                    {qualifiedFromThisEvent.length} nuevos clasificados
                  </Badge>
                </div>
                <div className="grid gap-px bg-border/60 sm:grid-cols-2 xl:grid-cols-4">
                  {qualifiedFromThisEvent.map((qualification) => {
                    const entry = entries.find(
                      (candidate) => candidate.team?.id === qualification.team_id,
                    );
                    const name = entry?.team?.name ?? "Equipo clasificado";
                    const passDown =
                      entry?.placement != null && entry.placement > qualifiedFromThisEvent.length;
                    return (
                      <div
                        key={qualification.team_id}
                        className="bg-background/55 px-4 py-4 sm:px-5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                            Lugar n.º{qualification.qualification_position}
                          </span>
                          {passDown ? (
                            <Badge variant="secondary" className="text-[9px]">
                              Cupo transferido
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-2 truncate text-sm font-black text-foreground">{name}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {entry?.placement
                            ? `Terminó ${placementLabel(entry.placement)} en este evento`
                            : "Clasificó en este evento"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {podium.length ? (
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {podium.map((entry) => {
                  const name = entry.team?.name ?? entry.profile?.display_name ?? "A confirmar";
                  return (
                    <PodiumCard
                      key={entry.id}
                      placement={entry.placement ?? 0}
                      name={name}
                      points={entry.points_awarded}
                    />
                  );
                })}
              </div>
            ) : null}

            {entries.length ? (
              <div className="mt-5 overflow-hidden border-y border-border/65 bg-card/15">
                <div className="hidden grid-cols-[4rem_minmax(0,1fr)_8rem_8rem] gap-3 border-b border-border bg-background/25 px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground sm:grid">
                  <span>Posición inicial</span>
                  <span>Competidor</span>
                  <span className="text-right">Puesto final</span>
                  <span className="text-right">Puntos</span>
                </div>

                {entries.map((entry, index) => {
                  const name = entry.team?.name ?? entry.profile?.display_name ?? "A confirmar";
                  const href =
                    entry.profile != null
                      ? {
                          to: "/players/$handle" as const,
                          params: { handle: entry.profile.handle },
                        }
                      : entry.team != null
                        ? { to: "/teams/$slug" as const, params: { slug: entry.team.slug } }
                        : null;

                  return (
                    <div
                      key={entry.id}
                      className="group grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/55 px-4 py-4 transition-colors last:border-0 hover:bg-primary/[0.03] sm:grid-cols-[4rem_minmax(0,1fr)_8rem_8rem] sm:px-5"
                    >
                      <span className="grid size-8 place-items-center rounded-lg border border-border/70 bg-background/30 text-xs font-black tabular-nums text-muted-foreground">
                        {entry.seed ?? index + 1}
                      </span>

                      <span className="flex min-w-0 items-center gap-3">
                        <PlayerAvatar name={name} />
                        <span className="min-w-0">
                          {href ? (
                            <Link
                              to={href.to}
                              params={href.params as never}
                              className="block truncate text-sm font-black text-foreground transition-colors group-hover:text-primary"
                            >
                              {name}
                            </Link>
                          ) : (
                            <span className="block truncate text-sm font-black text-foreground">
                              {name}
                            </span>
                          )}
                          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                            <span>{statusLabel(entry.status)}</span>
                            {qualificationLabel(entry.team?.id) ? (
                              <span className="rounded-full border border-primary/20 bg-primary/8 px-1.5 py-0.5 text-[9px] tracking-[0.08em] text-primary">
                                {qualificationLabel(entry.team?.id)}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </span>

                      <span className="text-right sm:block">
                        <span className="block text-sm font-black tabular-nums text-foreground">
                          {placementLabel(entry.placement)}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-muted-foreground sm:hidden">
                          +{formatPoints(entry.points_awarded)} pts
                        </span>
                      </span>

                      <span className="hidden text-right text-sm font-black tabular-nums text-gold sm:block">
                        +{formatPoints(entry.points_awarded)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 border-y border-border/65 py-5">
                <EmptyState
                  title="Todavía no hay participantes"
                  description="Las inscripciones aparecen acá cuando jugadores o equipos se registran y confirman asistencia."
                />
              </div>
            )}
          </TabsContent>

          <TabsContent
            value="bracket"
            className="mt-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-500"
          >
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Cuadro del campeonato</p>
                <h2 className="mt-1 text-2xl font-black text-foreground">Camino al título</h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Seguí cada cruce desde la primera ronda hasta el campeonato. Abrí una partida para
                  informar un resultado o consultar su disputa.
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">{matches.length} partidas</Badge>
                <Badge variant="outline">Eliminación directa</Badge>
              </div>
            </div>

            {matches.length ? (
              <BracketView matches={matches} entries={entryLabels(entries)} linkMatches />
            ) : (
              <div className="border-y border-border/65 py-5">
                <EmptyState
                  title="El cuadro todavía no se generó"
                  description="El cuadro se ordena cuando cierran las inscripciones y termina la confirmación de asistencia."
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PageContainer>
    </div>
  );
}

function EventProgress({
  status,
  currentStageIndex,
}: {
  status: string;
  currentStageIndex: number;
}) {
  const completed = status === "completed";

  return (
    <section className="border-b border-border/60 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Avance del evento</p>
          <p className="mt-1 text-sm font-black text-foreground">
            {completed
              ? "Torneo finalizado"
              : "Seguí el evento desde la inscripción hasta los resultados finales"}
          </p>
        </div>
        {status === "live" ? (
          <span className="inline-flex items-center gap-2 text-xs font-black text-primary">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            EN VIVO
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        {EVENT_STAGES.map((stage, index) => {
          const active = stage.key === status;
          const passed = completed || (currentStageIndex >= 0 && index < currentStageIndex);

          return (
            <div
              key={stage.key}
              className={cn("relative px-1 py-2 transition-colors", active && "text-primary")}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-lg border border-border/70 bg-background/30 text-xs font-black text-muted-foreground",
                    active && "border-primary/35 bg-primary/12 text-primary",
                    passed && !active && "border-primary/20 text-primary",
                  )}
                >
                  {passed && !active ? <CheckCircle2 className="size-4" /> : index + 1}
                </span>
                <div className="min-w-0">
                  <p className={cn("text-xs font-black text-foreground", active && "text-primary")}>
                    {stage.label}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                    {stage.description}
                  </p>
                </div>
              </div>
              {index < EVENT_STAGES.length - 1 ? (
                <ChevronRight className="absolute right-2 top-1/2 hidden size-3.5 -translate-y-1/2 text-muted-foreground/35 sm:block" />
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FlowStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="group">
      <span className="text-2xl font-black tabular-nums text-primary/40 transition-colors duration-300 group-hover:text-primary/70">
        {number}
      </span>
      <h3 className="mt-2 text-sm font-black text-foreground">{title}</h3>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function AccessCheck({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2.5 text-xs font-semibold text-muted-foreground">
      <CheckCircle2 className="size-3.5 shrink-0 text-primary" />
      {label}
    </p>
  );
}

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="text-primary">{icon}</span>
      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-xs font-black text-foreground">{value}</p>
    </div>
  );
}

function PodiumCard({
  placement,
  name,
  points,
}: {
  placement: number;
  name: string;
  points: number | null;
}) {
  const first = placement === 1;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/70 bg-card/35 p-5",
        first && "border-gold/30 bg-gold/[0.035]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "grid size-10 place-items-center rounded-xl border border-border bg-background/40 text-sm font-black text-muted-foreground",
            first && "border-gold/30 bg-gold/10 text-gold",
          )}
        >
          {first ? <Crown className="size-4" /> : placement}
        </span>
        <span className="text-xs font-black tabular-nums text-gold">
          +{formatPoints(points)} pts
        </span>
      </div>
      <p className="mt-5 truncate text-lg font-black text-foreground">{name}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {placementLabel(placement)} puesto
      </p>
    </div>
  );
}
