import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  ChevronRight,
  CircleAlert,
  Gavel,
  LifeBuoy,
  ShieldCheck,
  Swords,
  UserCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { CompetitionOpsPanel } from "@/components/eloshape/CompetitionOpsPanel";
import { BetaAccessPanel } from "@/components/eloshape/BetaAccessPanel";
import { DivisionBadge } from "@/components/eloshape/DivisionBadge";
import { EmptyState } from "@/components/eloshape/EmptyState";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, riotRankLabel, statusLabel } from "@/lib/format";
import { getAdminOverview, setPlayerEligibility } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Panel de administración — EloShape" },
      {
        name: "description",
        content: "Operaciones de organización, moderación y control competitivo de EloShape.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Decision = "eligible" | "pending_review" | "rejected" | "suspended";

function EligibilityActions({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient();
  const decide = useServerFn(setPlayerEligibility);
  const mutation = useMutation({
    mutationFn: (status: Decision) =>
      decide({ data: { profileId, status, reason: `El staff asignó ${statusLabel(status)}` } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Elegibilidad establecida en ${statusLabel(result.profile.eligibility)}.`);
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: () => toast.error("No se pudo actualizar la elegibilidad."),
  });

  const decideWithConfirmation = (status: Decision) => {
    if (status === "eligible") {
      mutation.mutate(status);
      return;
    }
    const confirmed = window.confirm(
      `¿Cambiar la elegibilidad competitiva de este jugador a «${statusLabel(status)}»?`,
    );
    if (confirmed) mutation.mutate(status);
  };

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button
        size="sm"
        disabled={mutation.isPending}
        onClick={() => decideWithConfirmation("eligible")}
      >
        <UserCheck />
        Aprobar
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={mutation.isPending}
        onClick={() => decideWithConfirmation("pending_review")}
      >
        Mantener pendiente
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={mutation.isPending}
        onClick={() => decideWithConfirmation("rejected")}
      >
        Rechazar
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={mutation.isPending}
        onClick={() => decideWithConfirmation("suspended")}
      >
        Suspender
      </Button>
    </div>
  );
}

function QueueCard({
  icon,
  title,
  description,
  count,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  count?: number;
  action: ReactNode;
}) {
  return (
    <div className="border-l border-border/60 pl-4 py-2 transition-colors hover:border-primary/40 sm:pl-5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
          {icon}
        </span>
        {count != null ? <Badge variant={count ? "default" : "outline"}>{count}</Badge> : null}
      </div>
      <h2 className="mt-4 text-sm font-black text-foreground">{title}</h2>
      <p className="mt-1 min-h-10 text-xs leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-4">{action}</div>
    </div>
  );
}

function AdminPage() {
  const fetchOverview = useServerFn(getAdminOverview);
  const { data, isPending, error } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview(),
    retry: false,
  });

  const queuedCount = data
    ? data.counts.reviews + data.counts.reports + data.counts.disputes + data.counts.support
    : 0;

  return (
    <div>
      <PageHeading
        eyebrow="Organización de EloShape"
        title="Panel de administración"
        description="Revisá primero lo que requiere atención y después abrí el panel de la tarea que quieras completar."
        aside={
          <Button asChild variant="outline">
            <Link to="/dashboard">Panel del jugador</Link>
          </Button>
        }
      />

      <PageContainer className="py-8 sm:py-10">
        {data?.isAdmin ? <BetaAccessPanel /> : null}
        {isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full" />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Skeleton className="h-44 w-full" />
              <Skeleton className="h-44 w-full" />
              <Skeleton className="h-44 w-full" />
              <Skeleton className="h-44 w-full" />
            </div>
          </div>
        ) : error ? (
          <EmptyState
            title="Se requiere acceso de organización"
            description="Este panel está limitado a cuentas de administración y moderación."
          />
        ) : data ? (
          <>
            <section className="border-b border-border/60 pb-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Resumen del sistema</p>
                  <h2 className="mt-1 text-xl font-black text-foreground">
                    Qué requiere tu atención
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Empezá por las tareas pendientes. Los datos de referencia y los controles
                    avanzados quedan disponibles cuando los necesites.
                  </p>
                </div>
                <Badge variant={queuedCount ? "default" : "outline"}>
                  {queuedCount} elemento pendiente{queuedCount === 1 ? "" : "s"}
                </Badge>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3">
                <AdminMetric label="Jugadores" value={data.counts.players} />
                <AdminMetric label="Equipos" value={data.counts.teams} />
                <AdminMetric label="Torneos" value={data.counts.tournaments} />
              </div>
            </section>

            <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <QueueCard
                icon={<UserCheck className="size-4" />}
                title="Revisiones de elegibilidad"
                description="Aprobá, rechazá o mantené pendientes a los jugadores que necesitan una decisión manual de elegibilidad."
                count={data.counts.reviews}
                action={
                  <Button
                    asChild
                    className="w-full"
                    variant={data.counts.reviews ? "default" : "outline"}
                  >
                    <a href="#eligibility">
                      Revisar jugadores
                      <ChevronRight />
                    </a>
                  </Button>
                }
              />
              <QueueCard
                icon={<Gavel className="size-4" />}
                title="Disputas de partidas"
                description="Resolvé informes de marcador contradictorios y disputas sobre resultados competitivos."
                count={data.counts.disputes}
                action={
                  <Button
                    asChild
                    className="w-full"
                    variant={data.counts.disputes ? "default" : "outline"}
                  >
                    <Link to="/admin/disputes">
                      Abrir disputas
                      <ChevronRight />
                    </Link>
                  </Button>
                }
              />
              <QueueCard
                icon={<LifeBuoy className="size-4" />}
                title="Solicitudes de soporte"
                description="Leé y respondé las consultas de jugadores desde su panel de soporte."
                count={data.counts.support}
                action={
                  <Button
                    asChild
                    className="w-full"
                    variant={data.counts.support ? "default" : "outline"}
                  >
                    <Link to="/admin/support">
                      Abrir soporte
                      <ChevronRight />
                    </Link>
                  </Button>
                }
              />
              <QueueCard
                icon={<Swords className="size-4" />}
                title="Operaciones competitivas"
                description="Bloqueá planteles, generá cuadros, registrá resultados, otorgá victorias administrativas y finalizá torneos."
                action={
                  <Button asChild className="w-full" variant="outline">
                    <a href="#competition">
                      Gestionar torneos
                      <ChevronRight />
                    </a>
                  </Button>
                }
              />
            </section>

            <section id="eligibility" className="mt-10 scroll-mt-24">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">Elegibilidad</p>
                  <h2 className="mt-1 text-xl font-black text-foreground">
                    Jugadores pendientes de revisión
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    Esta lista contiene las decisiones pendientes. Al resolverlas, el jugador sale
                    de la lista y la decisión queda guardada en el historial.
                  </p>
                </div>
                <Badge variant={data.counts.reviews ? "default" : "outline"}>
                  {data.counts.reviews} pendientes
                </Badge>
              </div>

              <div className="mt-4 overflow-hidden border-y border-border/65 bg-card/15">
                {data.reviews.length ? (
                  data.reviews.map((review) => (
                    <div
                      key={review.id}
                      className="border-b border-border p-4 last:border-0 sm:p-5"
                    >
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-semibold text-foreground">
                              {review.profile?.display_name ?? "Jugador desconocido"}
                            </span>
                            <Badge variant="outline">{statusLabel(review.status)}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {riotRankLabel(review.profile?.riot_tier, review.profile?.riot_rank)} ·
                            enviado {formatDate(review.created_at)}
                          </p>
                          {review.reason ? (
                            <div className="mt-3 border-l-2 border-primary/25 pl-3">
                              <p className="text-xs font-bold text-foreground">
                                Motivo de revisión
                              </p>
                              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                {review.reason}
                              </p>
                            </div>
                          ) : null}
                        </div>
                        <CircleAlert className="size-5 text-primary" />
                      </div>
                      {review.profile ? <EligibilityActions profileId={review.profile.id} /> : null}
                    </div>
                  ))
                ) : (
                  <div className="p-8">
                    <EmptyState
                      title="No hay revisiones pendientes"
                      description="Actualmente ningún jugador requiere una decisión manual."
                    />
                  </div>
                )}
              </div>

              <details className="group mt-4 border-t border-border/60">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4">
                  <div className="flex items-center gap-3">
                    <Activity className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Historial de decisiones de elegibilidad
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Decisiones recientes de la organización · solo lectura
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <div className="border-t border-border">
                  {data.reviewHistory.length ? (
                    data.reviewHistory.map((review) => (
                      <div
                        key={review.id}
                        className="grid gap-2 border-b border-border p-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {review.profile?.display_name ??
                              review.profile?.handle ??
                              "Jugador desconocido"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDate(review.created_at)}
                            {review.reason ? ` · ${review.reason}` : ""}
                          </p>
                        </div>
                        <Badge variant="outline">{statusLabel(review.status)}</Badge>
                      </div>
                    ))
                  ) : (
                    <div className="p-6">
                      <EmptyState title="Todavía no hay decisiones completadas" />
                    </div>
                  )}
                </div>
              </details>
            </section>

            {data.reports.length ? (
              <section className="mt-10">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="eyebrow">Reportes</p>
                    <h2 className="mt-1 text-lg font-semibold text-foreground">
                      Reportes de moderación activos
                    </h2>
                  </div>
                  <Badge>{data.counts.reports}</Badge>
                </div>
                <div className="mt-4 overflow-hidden border-y border-border/65 bg-card/15">
                  {data.reports.map((report) => (
                    <div
                      key={report.id}
                      className="grid gap-3 border-b border-border p-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {report.reason === "match_result_dispute"
                            ? "Disputa de resultado"
                            : report.reason}{" "}
                          · {report.reported?.display_name ?? "Sin jugador reportado"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(report.created_at)}
                        </p>
                        {report.details ? (
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {report.details}
                          </p>
                        ) : null}
                      </div>
                      <Badge variant="outline">{statusLabel(report.status)}</Badge>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section id="competition" className="mt-12 scroll-mt-24">
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Competencia</p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">Control de torneos</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Operaciones guiadas de planteles, cuadros, resultados, victorias
                    administrativas, correcciones, puntuación y avance de Semi-Splits.
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link to="/admin/splits">
                    Vista avanzada de splits
                    <ChevronRight />
                  </Link>
                </Button>
              </div>
              <CompetitionOpsPanel />
            </section>

            <section className="mt-10">
              <details className="group border-t border-border/60">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 sm:py-5">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-background/40 text-muted-foreground">
                      <Activity className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Referencia de cuentas de Riot
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {data.riotAccounts.length} cuenta vinculada
                        {data.riotAccounts.length === 1 ? "" : "s"} · datos de referencia
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <div className="border-t border-border">
                  {data.riotAccounts.length ? (
                    data.riotAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="grid gap-3 border-b border-border p-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:p-5"
                      >
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-foreground">
                            {account.profile?.display_name ?? "Jugador desconocido"} ·{" "}
                            {account.riot_id}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {riotRankLabel(account.solo_tier, account.solo_rank)}
                            {account.solo_lp != null ? ` · ${account.solo_lp} LP` : ""} ·{" "}
                            {account.platform.toUpperCase()} · sincronizado{" "}
                            {formatDate(account.last_synced_at)}
                          </span>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {account.profile?.division ? (
                              <DivisionBadge division={account.profile.division} />
                            ) : null}
                            <Badge variant={account.data_verified ? "default" : "outline"}>
                              {account.data_verified
                                ? "Datos de Riot verificados"
                                : "Datos sin verificar"}
                            </Badge>
                            <Badge variant="outline">
                              {account.ownership_verified
                                ? "Titularidad verificada"
                                : "Titularidad sin verificar"}
                            </Badge>
                            <Badge variant="outline">
                              {statusLabel(account.profile?.eligibility ?? "pending_review")}
                            </Badge>
                          </div>
                        </div>
                        {account.profile ? (
                          <EligibilityActions profileId={account.profile.id} />
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="p-8">
                      <EmptyState title="Todavía no hay cuentas de Riot vinculadas" />
                    </div>
                  )}
                </div>
              </details>
            </section>

            <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4" />
              Las acciones de competencia y moderación se validan en el servidor y quedan
              registradas.
            </div>
          </>
        ) : null}
      </PageContainer>
    </div>
  );
}

function AdminMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xl font-black tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
