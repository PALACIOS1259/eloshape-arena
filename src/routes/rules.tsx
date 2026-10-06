import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { directoryQuery } from "@/lib/queries";
import { formatPoints, pointRuleLabel, seasonLabel } from "@/lib/format";
import { canonicalMetadata } from "@/lib/site-metadata";

export const Route = createFileRoute("/rules")({
  head: () => {
    const canonical = canonicalMetadata("/rules");
    return {
      meta: [
        { title: "Puntos y reglas — EloShape" },
        {
          name: "description",
          content:
            "El sistema de puntos de EloShape: premios configurables por participación, victorias y puestos, obtenidos solo en torneos de EloShape.",
        },
        { property: "og:title", content: "Puntos y reglas de EloShape" },
        {
          property: "og:description",
          content: "Puntos transparentes y configurables para el circuito competitivo de EloShape.",
        },
        ...canonical.meta,
      ],
      links: canonical.links,
    };
  },
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(directoryQuery());
  },
  component: RulesPage,
});

function RulesPage() {
  const { data: directory } = useSuspenseQuery(directoryQuery());

  return (
    <div>
      <PageHeading
        eyebrow="Sistema de clasificación"
        title="Puntos y reglas"
        description="Cada punto de la clasificación de EloShape corresponde a una de estas reglas, aplicada a una partida o puesto real de EloShape. El rendimiento en la cola clasificatoria individual nunca otorga puntos."
      />

      <PageContainer className="py-7 sm:py-9">
        <div className="overflow-hidden border-y border-border/65 bg-card/15">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-border/55 bg-background/15 px-4 py-2.5">
            <span className="eyebrow">Regla</span>
            <span className="eyebrow text-right">Puntos</span>
          </div>
          {directory.pointRules.map((rule) => (
            <div
              key={rule.code}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/55 px-4 py-3.5 last:border-0"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {pointRuleLabel(rule.code, rule.label)}
                </span>
              </span>
              <span className="tabular shrink-0 text-sm font-black text-gold">
                +{formatPoints(rule.points)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-x-8 gap-y-6 border-t border-border/60 pt-7 sm:grid-cols-2">
          <Card
            title="Clasificaciones de temporada y mensuales"
            body={`Los totales de temporada se acumulan durante ${directory.activeSeason?.name ? seasonLabel(directory.activeSeason.name) : "la temporada"}. Los totales mensuales se reinician cada mes para que los nuevos jugadores siempre tengan un objetivo.`}
          />
          <Card
            title="Clasificaciones por ubicación"
            body="Los mismos puntos alimentan las clasificaciones por ciudad, provincia, país y región, para que un jugador de Rosario pueda ganar a nivel local sin superar a toda LAS."
          />
          <Card
            title="El rango de Riot solo determina la elegibilidad"
            body="El rango decide a qué división podés entrar. No aporta puntos ni aparece en la fórmula de clasificación."
          />
          <Card
            title="Las revisiones pueden ajustar resultados"
            body="Si una revisión detecta una cuenta de nivel inferior al real, se anulan las inscripciones y se retiran los puntos otorgados."
          />
        </div>
      </PageContainer>
    </div>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="font-black text-foreground">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
