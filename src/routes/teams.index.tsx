import { useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Search, SlidersHorizontal } from "lucide-react";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { ScrimBoard } from "@/components/eloshape/ScrimBoard";
import { TeamCard } from "@/components/eloshape/TeamCard";
import { PageContainer } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { teamsQuery } from "@/lib/queries";
import { canonicalMetadata } from "@/lib/site-metadata";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/teams/")({
  head: () => {
    const canonical = canonicalMetadata("/teams");
    return {
      meta: [
        { title: "Equipos — Planteles de 5 contra 5 de EloShape" },
        {
          name: "description",
          content:
            "Todos los planteles de EloShape con división, historial, campeonatos y puntos de temporada obtenidos en el circuito.",
        },
        { property: "og:title", content: "Equipos de EloShape" },
        {
          property: "og:description",
          content: "Planteles de 5 contra 5 del circuito de EloShape.",
        },
        ...canonical.meta,
      ],
      links: canonical.links,
    };
  },
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(teamsQuery());
  },
  component: TeamsPage,
});

type SortMode = "points" | "record" | "titles" | "name";
type TeamsView = "directory" | "scrims";

function TeamsPage() {
  const { data: teams } = useSuspenseQuery(teamsQuery());
  const [search, setSearch] = useState("");
  const [division, setDivision] = useState("all");
  const [sort, setSort] = useState<SortMode>("points");
  const [view, setView] = useState<TeamsView>("directory");

  const divisions = useMemo(
    () =>
      Array.from(
        new Set(
          teams.map((team) => team.division?.name).filter((name): name is string => Boolean(name)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [teams],
  );

  const standingsRank = useMemo(
    () =>
      new Map(
        [...teams]
          .sort((a, b) => b.points_season - a.points_season)
          .map((team, index) => [team.slug, index + 1]),
      ),
    [teams],
  );

  const visibleTeams = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const result = teams.filter((team) => {
      const matchesSearch =
        !needle ||
        team.name.toLowerCase().includes(needle) ||
        team.tag?.toLowerCase().includes(needle) ||
        team.city?.name?.toLowerCase().includes(needle);
      const matchesDivision = division === "all" || team.division?.name === division;
      return matchesSearch && matchesDivision;
    });

    return [...result].sort((a, b) => {
      if (sort === "record") {
        const aRate = a.wins + a.losses ? a.wins / (a.wins + a.losses) : 0;
        const bRate = b.wins + b.losses ? b.wins / (b.wins + b.losses) : 0;
        return bRate - aRate || b.wins - a.wins;
      }
      if (sort === "titles") return (b.championships ?? 0) - (a.championships ?? 0);
      if (sort === "name") return a.name.localeCompare(b.name);
      return b.points_season - a.points_season;
    });
  }, [division, search, sort, teams]);

  const totalTitles = teams.reduce((total, team) => total + (team.championships ?? 0), 0);
  const totalGames = teams.reduce((total, team) => total + team.wins + team.losses, 0);
  const filtersActive = Boolean(search.trim()) || division !== "all" || sort !== "points";

  const resetFilters = () => {
    setSearch("");
    setDivision("all");
    setSort("points");
  };

  return (
    <div>
      <PageContainer className="relative py-7 sm:py-9">
        <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-80 w-[70vw] -translate-x-1/2 rounded-full bg-primary/[0.035] blur-3xl" />

        <header className="mb-6 border-b border-border/60 pb-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="eyebrow">EloShape 5 contra 5</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                Equipos y práctica
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Consultá los planteles y rendimientos oficiales o buscá práctica sin mezclarla con
                el circuito competitivo.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Button asChild variant="outline" size="sm">
                <Link to="/team/players">Buscar jugadores</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/team">Abrir panel del equipo</Link>
              </Button>
            </div>
          </div>

          <nav className="mt-5 flex flex-wrap items-center gap-2">
            <ViewButton
              active={view === "directory"}
              title="Directorio de equipos"
              subtitle="Registros y planteles oficiales"
              onClick={() => setView("directory")}
            />
            <ViewButton
              active={view === "scrims"}
              title="Solo práctica"
              subtitle="Práctica · sin puntos del circuito"
              onClick={() => setView("scrims")}
            />
          </nav>
        </header>

        {view === "scrims" ? (
          <ScrimBoard />
        ) : teams.length ? (
          <>
            <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card/95 via-card/80 to-primary/[0.035] shadow-card">
              <div className="flex flex-col gap-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="eyebrow">Directorio de equipos</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Buscá en el circuito y compará el rendimiento oficial de los equipos.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <DirectoryMetric value={teams.length} label="teams" />
                    <DirectoryMetric value={divisions.length} label="divisions" />
                    <DirectoryMetric value={totalGames} label="games" />
                    <DirectoryMetric value={totalTitles} label="titles" accent />
                  </div>
                </div>

                <div className="h-px bg-border/60" />

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_11rem_11rem_auto]">
                  <label className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="border-border/80 bg-background/45 pl-9"
                      placeholder="Buscar equipo, sigla o ciudad"
                      aria-label="Buscar equipos"
                    />
                  </label>
                  <select
                    value={division}
                    onChange={(event) => setDivision(event.target.value)}
                    className="h-10 rounded-md border border-border/80 bg-background/45 px-3 text-sm text-foreground"
                    aria-label="Filtrar por división"
                  >
                    <option value="all">Todas las divisiones</option>
                    {divisions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as SortMode)}
                    className="h-10 rounded-md border border-border/80 bg-background/45 px-3 text-sm text-foreground"
                    aria-label="Ordenar equipos"
                  >
                    <option value="points">Puntos de temporada</option>
                    <option value="record">Porcentaje de victorias</option>
                    <option value="titles">Campeonatos</option>
                    <option value="name">Nombre del equipo</option>
                  </select>
                  <Button
                    variant="ghost"
                    className="gap-2 text-muted-foreground"
                    disabled={!filtersActive}
                    onClick={resetFilters}
                  >
                    <SlidersHorizontal className="size-4" />
                    Restablecer
                  </Button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>
                    <strong className="font-bold text-foreground">{visibleTeams.length}</strong> de{" "}
                    {teams.length} equipos
                  </span>
                  <span>Solo puntos oficiales · las prácticas nunca afectan las posiciones</span>
                </div>
              </div>
            </section>

            {visibleTeams.length ? (
              <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visibleTeams.map((team) => (
                  <TeamCard key={team.slug} team={team} rank={standingsRank.get(team.slug)} />
                ))}
              </section>
            ) : (
              <div className="mt-6">
                <EmptyState
                  title="No hay equipos que coincidan con estos filtros"
                  description="Probá otro nombre, ciudad o división."
                  action={
                    <Button variant="outline" onClick={resetFilters}>
                      Limpiar filtros
                    </Button>
                  }
                />
              </div>
            )}
          </>
        ) : (
          <EmptyState
            title="Todavía no hay equipos registrados"
            description="Creá el primer plantel de 5 contra 5 e invitá jugadores con su identificador de EloShape."
            action={
              <Button asChild>
                <Link to="/team">Crear un equipo</Link>
              </Button>
            }
          />
        )}
      </PageContainer>
    </div>
  );
}

function ViewButton({
  active,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group rounded-xl border px-4 py-2.5 text-left transition-all",
        active
          ? "border-primary/35 bg-primary/10 shadow-sm"
          : "border-transparent bg-transparent hover:border-border hover:bg-card/50",
      )}
    >
      <span
        className={cn(
          "block text-sm font-black",
          active ? "text-primary" : "text-foreground group-hover:text-primary",
        )}
      >
        {title}
      </span>
      <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {subtitle}
      </span>
    </button>
  );
}

function DirectoryMetric({
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
      <strong
        className={cn("text-sm font-black tabular-nums text-foreground", accent && "text-gold")}
      >
        {value}
      </strong>
      <span className="uppercase tracking-[0.1em]">{label}</span>
    </span>
  );
}
