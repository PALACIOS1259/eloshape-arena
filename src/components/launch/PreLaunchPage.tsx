import { Link } from "@tanstack/react-router";

import { EloShapeLogo } from "@/components/brand/EloShapeLogo";

const launchMilestones = [
  { label: "Circuito competitivo", status: "Listo" },
  { label: "Infraestructura", status: "En preparación" },
  { label: "Beta cerrada", status: "Próximamente" },
] as const;

export function PreLaunchPage() {
  return (
    <main
      lang="es"
      className="relative isolate min-h-screen overflow-hidden bg-background text-foreground"
    >
      <div className="bg-tech-grid pointer-events-none absolute inset-0 opacity-70" />
      <div className="bg-hero pointer-events-none absolute inset-0" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-px w-[min(72rem,90vw)] -translate-x-1/2 bg-gradient-to-r from-transparent via-brand/70 to-transparent"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between border-b border-border/70 pb-6">
          <EloShapeLogo />
          <span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1.5 text-[0.625rem] font-bold uppercase tracking-[0.16em] text-gold">
            Pre-lanzamiento
          </span>
        </header>

        <section className="flex flex-1 items-center py-14 sm:py-20">
          <div className="grid w-full gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end lg:gap-20">
            <div className="max-w-3xl">
              <p className="eyebrow text-gold">Argentina · Beta cerrada</p>
              <h1 className="mt-5 text-5xl font-black leading-[0.95] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
                Estamos preparando
                <span className="mt-2 block text-brand-gradient">EloShape.</span>
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                Una plataforma competitiva de League of Legends para jugadores amateur, con
                divisiones por nivel, torneos regionales y rankings construidos dentro del circuito.
              </p>
              <p className="mt-5 max-w-xl text-sm leading-6 text-steel">
                Estamos terminando la infraestructura para nuestra primera beta cerrada. El registro
                público todavía no está habilitado.
              </p>
            </div>

            <aside className="shadow-elevated overflow-hidden rounded-xl border border-border bg-surface/90 backdrop-blur-sm">
              <div className="border-b border-border px-5 py-4">
                <p className="eyebrow">Estado del lanzamiento</p>
              </div>
              <dl className="divide-y divide-border">
                {launchMilestones.map((milestone, index) => (
                  <div key={milestone.label} className="flex items-center gap-4 px-5 py-4">
                    <span className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-[0.6875rem] font-bold text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <dt className="text-sm font-semibold text-foreground">{milestone.label}</dt>
                      <dd className="mt-1 text-xs text-muted-foreground">{milestone.status}</dd>
                    </div>
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        index === 0 ? "bg-success" : index === 1 ? "bg-gold" : "bg-steel/50"
                      }`}
                    />
                  </div>
                ))}
              </dl>
            </aside>
          </div>
        </section>

        <footer className="flex flex-col gap-4 border-t border-border/70 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 EloShape. Competitive circuit.</p>
          <nav aria-label="Información legal" className="flex items-center gap-5">
            <Link to="/privacy" className="transition-colors hover:text-foreground">
              Privacidad
            </Link>
            <Link to="/terms" className="transition-colors hover:text-foreground">
              Términos
            </Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
