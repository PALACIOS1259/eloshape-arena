import { divisionDescription, riotRankLabel } from "@/lib/format";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

import { DivisionBadge } from "@/components/eloshape/DivisionBadge";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { directoryQuery } from "@/lib/queries";
import { canonicalMetadata } from "@/lib/site-metadata";

export const Route = createFileRoute("/divisions")({
  head: () => {
    const canonical = canonicalMetadata("/divisions");
    return {
      meta: [
        { title: "Divisiones y elegibilidad — EloShape" },
        {
          name: "description",
          content:
            "Cómo funcionan las divisiones de EloShape: el rango de Riot verifica a qué división podés entrar y los puntos se ganan solo en los torneos de EloShape.",
        },
        { property: "og:title", content: "Divisiones y elegibilidad de EloShape" },
        {
          property: "og:description",
          content:
            "Divisiones Hierro, Bronce, Plata y Oro con elegibilidad verificada mediante el rango de Riot.",
        },
        ...canonical.meta,
      ],
      links: canonical.links,
    };
  },
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(directoryQuery());
  },
  component: DivisionsPage,
});

function DivisionsPage() {
  const { data: directory } = useSuspenseQuery(directoryQuery());

  return (
    <div>
      <PageHeading
        eyebrow="Juego limpio"
        title="Divisiones y elegibilidad"
        description="EloShape está pensado para jugadores amateurs, por eso los cuadros se separan por habilidad. Se verifica tu rango de Riot para asignarte una división y, a partir de ahí, cuentan solo tus resultados en EloShape."
      />

      <PageContainer className="py-7 sm:py-9">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {directory.divisions.map((division) => (
            <div
              key={division.id}
              className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card/92 via-card/72 to-background/55 p-5 shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
            >
              <DivisionBadge division={division} size="md" />
              <p className="mt-4 text-sm text-muted-foreground">
                {divisionDescription(division.code, division.description)}
              </p>
              <p className="eyebrow mt-5">Rangos de Riot habilitados</p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {(division.riot_tiers as string[] | null)
                  ?.map((tier) => riotRankLabel(tier, null))
                  .join(" · ") ?? "—"}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-border/60 pt-7">
          <p className="eyebrow">Proceso contra cuentas de nivel inferior al real</p>
          <ol className="mt-4 grid gap-4 text-sm text-muted-foreground md:grid-cols-3">
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
              Vinculá tu cuenta de Riot. EloShape consulta tu rango para verificar la elegibilidad;
              no guarda claves ni credenciales en el navegador.
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
              Tu división se asigna según ese rango y se vuelve a comprobar periódicamente.
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
              Los resultados dominantes o anómalos generan una revisión manual de elegibilidad antes
              de confirmar puntos y premios.
            </li>
          </ol>
          <Button asChild className="mt-6">
            <Link to="/rules">Ver cómo se otorgan los puntos</Link>
          </Button>
        </div>
      </PageContainer>
    </div>
  );
}
