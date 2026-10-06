import type { ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, Swords, Trophy, Users } from "lucide-react";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { StatusBadge } from "@/components/eloshape/StatusBadge";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, statusLabel, seasonLabel } from "@/lib/format";
import { canonicalMetadata } from "@/lib/site-metadata";
import { splitsQuery } from "@/lib/split-queries";
import { cn } from "@/lib/utils";

const FORMAT_STEPS = [
  {
    number: "01",
    title: "4 clasificatorios abiertos",
    description: "Cada clasificatorio otorga cuatro lugares únicos en las eliminatorias.",
  },
  {
    number: "02",
    title: "16 equipos clasificados",
    description: "Si un equipo vuelve a clasificarse, su lugar pasa al siguiente equipo elegible.",
  },
  {
    number: "03",
    title: "Ordenamiento de clasificados",
    description: "Los puntos de los clasificatorios ordenan los equipos del puesto 1 al 16.",
  },
  {
    number: "04",
    title: "Un cuadro de eliminatorias",
    description: "Desde octavos hasta la gran final en un único cuadro de eliminación directa.",
  },
] as const;

function stageLabel(status: string) {
  const labels: Record<string, string> = {
    upcoming: "Programado",
    qualifiers: "Clasificatorios abiertos",
    seeding: "Ordenamiento",
    playoffs: "Eliminatorias de 16 equipos",
    semifinals: "Semifinales",
    final: "Gran final",
    completed: "Completado",
  };
  return labels[status] ?? statusLabel(status);
}

export const Route = createFileRoute("/splits/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(splitsQuery()),
  head: () => {
    const canonical = canonicalMetadata("/splits");
    return {
      meta: [
        { title: "Semi-Splits — Calendario competitivo de EloShape" },
        {
          name: "description",
          content:
            "Cada Semi-Split de EloShape tiene cuatro clasificatorios abiertos, 16 equipos únicos clasificados, ordenamiento por puntos y un cuadro de eliminatorias de 16 equipos.",
        },
        { property: "og:title", content: "Semi-Splits de EloShape" },
        {
          property: "og:description",
          content:
            "Clasificatorios, posiciones y cuadros de eliminatorias de cada Semi-Split de EloShape.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...canonical.meta,
      ],
      links: canonical.links,
    };
  },
  errorComponent: () => (
    <PageContainer className="py-16">
      <EmptyState title="Splits no disponibles" description="Volvé a intentar en un momento." />
    </PageContainer>
  ),
  notFoundComponent: () => (
    <PageContainer className="py-16">
      <EmptyState title="No encontrado" />
    </PageContainer>
  ),
  component: SplitsPage,
});

function SplitsPage() {
  const { data: splits } = useSuspenseQuery(splitsQuery());
  const liveCount = splits.filter(
    (split) => !["upcoming", "completed"].includes(split.status),
  ).length;
  const completedCount = splits.filter((split) => split.status === "completed").length;

  return (
    <div>
      <PageHeading
        eyebrow="Calendario competitivo"
        title="Semi-Splits"
        description="Cuatro clasificatorios forman un grupo de 16 equipos. Sus puntos determinan el orden inicial; las eliminatorias determinan al campeón."
        aside={
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <InlineMetric value={splits.length} label="splits" />
            <InlineMetric value={liveCount} label="active" accent />
            <InlineMetric value={completedCount} label="completed" />
          </div>
        }
      />

      <PageContainer className="py-7 sm:py-9">
        <section className="border-y border-border/65 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Cómo funciona el circuito</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Un camino desde el clasificatorio abierto hasta el cuadro del campeonato.
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/rankings">Ver clasificaciones</Link>
            </Button>
          </div>

          <div className="mt-5 grid gap-5 border-t border-border/55 pt-5 md:grid-cols-2 xl:grid-cols-4">
            {FORMAT_STEPS.map((step, index) => (
              <div key={step.number} className="relative pr-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black tabular-nums text-primary/50">
                    {step.number}
                  </span>
                  {index < FORMAT_STEPS.length - 1 ? (
                    <ChevronRight className="size-3.5 text-muted-foreground/40" />
                  ) : (
                    <Trophy className="size-3.5 text-gold" />
                  )}
                </div>
                <h2 className="mt-3 text-sm font-black text-foreground">{step.title}</h2>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Archivo de competencias</p>
              <h2 className="mt-1 text-xl font-black text-foreground sm:text-2xl">
                Calendario de Semi-Splits
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Abrí un split para ver sus clasificatorios, equipos clasificados, ordenamiento y
              eliminatorias.
            </p>
          </div>

          {splits.length ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {splits.map((split) => (
                <Link
                  key={split.id}
                  to="/splits/$slug"
                  params={{ slug: split.slug }}
                  className="group relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card/92 via-card/72 to-background/55 p-5 shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-primary/35 hover:shadow-xl"
                >
                  <div className="pointer-events-none absolute -right-14 -top-20 size-44 rounded-full bg-primary/[0.05] blur-3xl" />

                  <div className="relative flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{seasonLabel(split.season?.name)}</Badge>
                        <StatusBadge status={split.status} />
                      </div>
                      <h3 className="mt-3 truncate text-xl font-black tracking-tight text-foreground transition-colors group-hover:text-primary">
                        {split.name}
                      </h3>
                      <p className="mt-1.5 inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarDays className="size-3.5" />
                        {formatDate(split.starts_at)} — {formatDate(split.ends_at)}
                      </p>
                    </div>

                    <span className="grid size-9 shrink-0 place-items-center text-primary">
                      <Swords className="size-4" />
                    </span>
                  </div>

                  <div className="relative mt-6 grid grid-cols-3 divide-x divide-border/60">
                    <SplitMetric
                      icon={<Users className="size-3.5" />}
                      label="Participantes de eliminatorias"
                      value={`${split.playoff_size}`}
                    />
                    <SplitMetric
                      icon={<Swords className="size-3.5" />}
                      label="Fase"
                      value={stageLabel(split.status)}
                    />
                    <SplitMetric
                      icon={<Trophy className="size-3.5" />}
                      label="Formato"
                      value="Eliminación directa"
                      gold
                    />
                  </div>

                  <div className="relative mt-5 flex items-center justify-between border-t border-border/60 pt-4 text-xs text-muted-foreground">
                    <span>4 clasificatorios · 16 lugares únicos en eliminatorias</span>
                    <ChevronRight className="size-4 transition-all group-hover:translate-x-1 group-hover:text-primary" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                title="Todavía no hay Semi-Splits"
                description="El primer Semi-Split aparecerá acá cuando el staff lo programe."
              />
            </div>
          )}
        </section>
      </PageContainer>
    </div>
  );
}

function InlineMetric({
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
      <strong className={cn("font-black tabular-nums text-foreground", accent && "text-primary")}>
        {value}
      </strong>
      <span className="uppercase tracking-[0.09em]">{label}</span>
    </span>
  );
}

function SplitMetric({
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
    <div className="px-3 first:pl-0 last:pr-0">
      <p
        className={cn(
          "flex items-center gap-1.5 text-base font-black text-foreground",
          gold && "text-gold",
        )}
      >
        {icon}
        <span className="truncate">{value}</span>
      </p>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
