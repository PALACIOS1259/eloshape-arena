import { divisionLabel, seasonLabel } from "@/lib/format";
import type { ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SlidersHorizontal, Trophy, Users } from "lucide-react";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { PlayerRow } from "@/components/eloshape/PlayerRow";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { directoryQuery, rankingsQuery } from "@/lib/queries";
import { canonicalMetadata } from "@/lib/site-metadata";

type Search = { period?: "season" | "month"; division?: string; region?: string };
type SearchInput = { period?: "season" | "month"; division?: string; region?: string };

export const Route = createFileRoute("/rankings")({
  validateSearch: (search: SearchInput): Search => search,
  head: () => {
    const canonical = canonicalMetadata("/rankings");
    return {
      meta: [
        { title: "Clasificaciones — EloShape por división y región" },
        {
          name: "description",
          content:
            "Clasificaciones de temporada y mensuales de EloShape, filtradas por división y por región, país, provincia o ciudad.",
        },
        { property: "og:title", content: "Clasificaciones de EloShape" },
        {
          property: "og:description",
          content:
            "Clasificaciones de temporada y mensuales de todas las divisiones y ubicaciones.",
        },
        ...canonical.meta,
      ],
      links: canonical.links,
    };
  },
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    context.queryClient.ensureQueryData(
      rankingsQuery({
        period: deps.period ?? "season",
        divisionCode: deps.division ?? "all",
        regionSlug: deps.region ?? "all",
      }),
    );
    context.queryClient.ensureQueryData(directoryQuery());
  },
  component: RankingsPage,
});

const KIND_LABEL: Record<string, string> = {
  region: "Región",
  country: "País",
  province: "Provincia",
  city: "Ciudad",
};

function RankingsPage() {
  const raw = Route.useSearch();
  const search = {
    period: raw.period ?? ("season" as const),
    division: raw.division ?? "all",
    region: raw.region ?? "all",
  };
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: directory } = useSuspenseQuery(directoryQuery());
  const { data: players } = useSuspenseQuery(
    rankingsQuery({
      period: search.period,
      divisionCode: search.division,
      regionSlug: search.region,
    }),
  );

  const update = (patch: Partial<Search>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) });

  const filtersActive =
    search.period !== "season" || search.division !== "all" || search.region !== "all";

  return (
    <div>
      <PageHeading
        eyebrow={seasonLabel(directory.activeSeason?.name)}
        title="Clasificaciones"
        description="Tu rendimiento en los torneos construye tu clasificación de EloShape. El rango de Riot solo determina a qué división podés entrar."
        aside={
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" />
              <strong className="font-black text-foreground">{players.length}</strong> en la
              clasificación
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Trophy className="size-3.5 text-gold" />
              solo puntos oficiales
            </span>
          </div>
        }
      />

      <PageContainer className="py-7 sm:py-9">
        <section className="border-y border-border/65 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Filtros de clasificación</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Filtrá la tabla por período, división y ubicación.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={!filtersActive}
              onClick={() => update({ period: "season", division: "all", region: "all" })}
            >
              <SlidersHorizontal className="size-4" />
              Restablecer
            </Button>
          </div>

          <div className="mt-4 grid gap-3 border-t border-border/55 pt-4 sm:grid-cols-3">
            <Filter label="Período">
              <Select
                value={search.period}
                onValueChange={(value) => update({ period: value as "season" | "month" })}
              >
                <SelectTrigger className="mt-2 w-full border-border/80 bg-background/45">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="season">Temporada</SelectItem>
                  <SelectItem value="month">Este mes</SelectItem>
                </SelectContent>
              </Select>
            </Filter>

            <Filter label="División">
              <Select value={search.division} onValueChange={(division) => update({ division })}>
                <SelectTrigger className="mt-2 w-full border-border/80 bg-background/45">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las divisiones</SelectItem>
                  {directory.divisions.map((division) => (
                    <SelectItem key={division.code} value={division.code}>
                      {divisionLabel(division)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Filter>

            <Filter label="Ubicación">
              <Select value={search.region} onValueChange={(region) => update({ region })}>
                <SelectTrigger className="mt-2 w-full border-border/80 bg-background/45">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toda LAS</SelectItem>
                  {directory.regions.map((region) => (
                    <SelectItem key={region.slug} value={region.slug}>
                      {KIND_LABEL[region.kind] ?? region.kind} · {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Filter>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">
                {search.period === "month" ? "Tabla mensual" : "Tabla de temporada"}
              </p>
              <h2 className="mt-1 text-xl font-black text-foreground sm:text-2xl">Clasificación</h2>
            </div>
            <p className="text-xs text-muted-foreground">{players.length} jugadores</p>
          </div>

          {players.length ? (
            <div className="overflow-hidden border-y border-border/65 bg-card/20">
              <div className="hidden grid-cols-[2.5rem_minmax(0,1fr)_7rem_6rem_5rem] gap-3 border-b border-border/55 bg-background/15 px-4 py-2.5 sm:grid">
                <span className="eyebrow">#</span>
                <span className="eyebrow">Jugador</span>
                <span className="eyebrow">División</span>
                <span className="eyebrow">Historial</span>
                <span className="eyebrow text-right">Puntos</span>
              </div>
              {players.map((player, index) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  rank={index + 1}
                  period={search.period}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Todavía no hay jugadores en esta clasificación"
              description="Probá ampliar el filtro de ubicación o división."
            />
          )}
        </section>
      </PageContainer>
    </div>
  );
}

function Filter({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  );
}
