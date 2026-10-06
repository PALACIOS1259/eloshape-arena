import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, CircleAlert, Trophy, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { StatusBadge } from "@/components/eloshape/StatusBadge";
import { StatTile } from "@/components/eloshape/StatTile";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  advanceSplitStatus,
  buildSplitPlayoffs,
  getStaffSplits,
  replaceQualifier,
} from "@/lib/competition.functions";
import { formatDate, statusLabel } from "@/lib/format";
import { getStaffSplitOps, type StaffSplitOps } from "@/lib/split-ops.functions";

export const Route = createFileRoute("/_authenticated/admin_/splits")({
  head: () => ({
    meta: [
      { title: "Operaciones de Semi-Split — Organización de EloShape" },
      {
        name: "description",
        content:
          "Finalizá clasificatorios, gestioná reemplazos y ordená las eliminatorias de EloShape.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SplitOperationsPage,
});

type OperationResult = { ok: boolean; error?: string };

function SplitOperationsPage() {
  const fetchSplits = useServerFn(getStaffSplits);
  const [selectedSplitId, setSelectedSplitId] = useState<string | null>(null);
  const splitsQuery = useQuery({
    queryKey: ["staff-splits"],
    queryFn: () => fetchSplits(),
    retry: false,
  });

  const selected =
    selectedSplitId ??
    splitsQuery.data?.splits.find((split) => split.status !== "completed")?.id ??
    null;

  return (
    <div>
      <PageHeading
        eyebrow="Organización · Operaciones del circuito"
        title="Operaciones de Semi-Split"
        description="Finalizá los clasificatorios abiertos, verificá los cuatro cupos otorgados, gestioná retiros y reemplazos, y ordená las eliminatorias según la tabla del split."
        aside={
          <Button asChild variant="outline">
            <Link to="/admin">Volver al panel de moderación</Link>
          </Button>
        }
      />

      <PageContainer className="py-7 sm:py-9">
        {splitsQuery.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : splitsQuery.error || !splitsQuery.data ? (
          <EmptyState
            title="Se requiere acceso de organización"
            description="Esta página está limitada a cuentas de administración y moderación."
          />
        ) : !splitsQuery.data.splits.length ? (
          <EmptyState title="No hay Semi-Splits configurados" />
        ) : (
          <div className="space-y-8">
            <section>
              <p className="eyebrow">Seleccionar Semi-Split</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {splitsQuery.data.splits.map((split) => (
                  <Button
                    key={split.id}
                    size="sm"
                    variant={selected === split.id ? "default" : "outline"}
                    onClick={() => setSelectedSplitId(split.id)}
                  >
                    {split.name}
                  </Button>
                ))}
              </div>
            </section>

            {selected ? <SplitWorkspace splitId={selected} /> : null}
          </div>
        )}
      </PageContainer>
    </div>
  );
}

function SplitWorkspace({ splitId }: { splitId: string }) {
  const queryClient = useQueryClient();
  const fetchOps = useServerFn(getStaffSplitOps);
  const advance = useServerFn(advanceSplitStatus);
  const playoffs = useServerFn(buildSplitPlayoffs);
  const replace = useServerFn(replaceQualifier);

  const query = useQuery({
    queryKey: ["staff-split-ops", splitId],
    queryFn: () => fetchOps({ data: { splitId } }),
    retry: false,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["staff-split-ops", splitId] });
    void queryClient.invalidateQueries({ queryKey: ["staff-splits"] });
  };

  const stageMutation = useMutation({
    mutationFn: (status: string) => advance({ data: { splitId, status } }),
    onSuccess: (result: OperationResult) => {
      if (!result.ok) {
        toast.error(friendlyOperationError(result.error));

        return;
      }
      toast.success("Etapa del Semi-Split actualizada.");
      invalidate();
    },
    onError: () => toast.error("No se pudo actualizar la etapa del Semi-Split."),
  });

  const playoffMutation = useMutation({
    mutationFn: (input: { allowShortField?: boolean; reason?: string }) =>
      playoffs({ data: { splitId, bestOf: 3, ...input } }),
    onSuccess: (result: OperationResult) => {
      if (!result.ok) {
        toast.error(friendlyOperationError(result.error));

        return;
      }
      toast.success("Cuadro de eliminatorias generado según la tabla del split.");
      invalidate();
    },
    onError: () => toast.error("No se pudieron generar las eliminatorias."),
  });

  const replacementMutation = useMutation({
    mutationFn: (teamId: string) => replace({ data: { splitId, teamId } }),
    onSuccess: (result: OperationResult) => {
      if (!result.ok) {
        toast.error(friendlyOperationError(result.error));

        return;
      }
      toast.success("Reemplazo de clasificación procesado.");
      invalidate();
    },
    onError: () => toast.error("No se pudo procesar el reemplazo."),
  });

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.error || !query.data) {
    return <EmptyState title="No se pudieron cargar las operaciones del Semi-Split" />;
  }

  const ops = query.data;
  const r = ops.readiness;
  const nextStage = nextManualStage(ops.split.status);

  return (
    <div className="space-y-10">
      <section className="border-b border-border/60 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={ops.split.status} />
              <Badge variant="outline">
                Mejores {ops.split.qualificationSlotsPerQualifier} / clasificatorio
              </Badge>
              <Badge variant="outline">{ops.split.playoffSize}equipos en eliminatorias</Badge>
            </div>
            <h2 className="mt-3 text-2xl font-black text-foreground">{ops.split.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatDate(ops.split.startsAt)} — {formatDate(ops.split.endsAt)}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/splits/$slug" params={{ slug: ops.split.slug }}>
              Página pública del Semi-Split
            </Link>
          </Button>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Clasificatorios finalizados"
          value={`${r.finalizedQualifierCount}/${r.qualifierCount}`}
          icon={
            r.allQualifiersFinalized ? (
              <CheckCircle2 className="size-5" />
            ) : (
              <CircleAlert className="size-5" />
            )
          }
        />
        <StatTile
          label="Clasificado"
          value={`${r.qualifiedCount}/${r.playoffSize}`}
          icon={<Users className="size-5" />}
        />
        <StatTile label="Lista de reemplazos" value={ops.replacementCandidates.length} />
        <StatTile
          label="Cuadro de eliminatorias"
          value={ops.playoffTournament?.bracketGeneratedAt ? "Generado" : "Sin generar"}
          icon={<Trophy className="size-5" />}
        />
      </div>

      <StageActions
        ops={ops}
        stagePending={stageMutation.isPending}
        playoffPending={playoffMutation.isPending}
        onStage={(status) => stageMutation.mutate(status)}
        onFullPlayoffs={() => playoffMutation.mutate({})}
        onShortPlayoffs={() => {
          const reason = window.prompt(
            `Solo ${r.qualifiedCount}/${r.playoffSize} equipos están clasificados. Ingresá el motivo registrado para unas eliminatorias con menos equipos:`,
          );
          if (!reason?.trim()) return;
          playoffMutation.mutate({ allowShortField: true, reason: reason.trim() });
        }}
        nextStage={nextStage}
      />

      <QualifierReadiness qualifiers={ops.qualifiers} />

      <Qualifications
        ops={ops}
        replacing={replacementMutation.isPending}
        onReplace={(teamId, teamName) => {
          if (
            !window.confirm(
              `¿Marcar a ${teamName} como retirado y reemplazarlo por el equipo elegible sin clasificar mejor ubicado?`,
            )
          ) {
            return;
          }
          replacementMutation.mutate(teamId);
        }}
      />

      <Standings standings={ops.standings} replacementCandidates={ops.replacementCandidates} />
    </div>
  );
}

function StageActions({
  ops,
  stagePending,
  playoffPending,
  onStage,
  onFullPlayoffs,
  onShortPlayoffs,
  nextStage,
}: {
  ops: StaffSplitOps;
  stagePending: boolean;
  playoffPending: boolean;
  onStage: (status: string) => void;
  onFullPlayoffs: () => void;
  onShortPlayoffs: () => void;
  nextStage: string | null;
}) {
  const r = ops.readiness;
  return (
    <section className="border-y border-border/65 py-5">
      <p className="eyebrow">Controles de etapa</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {ops.split.status === "qualifiers" ? (
          <Button disabled={!r.canEnterSeeding || stagePending} onClick={() => onStage("seeding")}>
            {r.canEnterSeeding
              ? "Cerrar clasificatorios → Ordenamiento"
              : `Primero finalizá todos los clasificatorios (${r.finalizedQualifierCount}/${r.qualifierCount})`}
          </Button>
        ) : null}

        {ops.split.status === "seeding" && !ops.playoffTournament?.bracketGeneratedAt ? (
          <>
            <Button disabled={!r.canGeneratePlayoffs || playoffPending} onClick={onFullPlayoffs}>
              Generar {r.playoffSize}equipos en eliminatorias
            </Button>
            {r.canGenerateShortPlayoffs ? (
              <Button variant="outline" disabled={playoffPending} onClick={onShortPlayoffs}>
                Generar con cupo incompleto…
              </Button>
            ) : null}
          </>
        ) : null}

        {nextStage && ops.split.status !== "qualifiers" && ops.split.status !== "seeding" ? (
          <Button variant="outline" disabled={stagePending} onClick={() => onStage(nextStage)}>
            Avanzar a {nextStage}
          </Button>
        ) : null}

        <Button asChild variant="outline">
          <Link to="/admin">Abrir operaciones del torneo</Link>
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Finalizar cada clasificatorio otorga automáticamente los cupos a los equipos habilitados
        mejor ubicados que todavía no estén clasificados.
      </p>
    </section>
  );
}

function QualifierReadiness({ qualifiers }: { qualifiers: StaffSplitOps["qualifiers"] }) {
  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Etapa 1</p>
          <h3 className="mt-1 text-xl font-black text-foreground">Clasificatorios abiertos</h3>
        </div>
        <span className="text-sm text-muted-foreground">
          Finalizar → Se otorgan los cuatro cupos en una sola operación
        </span>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {qualifiers.map((qualifier) => (
          <article key={qualifier.id} className="border-y border-border/65 py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Clasificatorio n.º{qualifier.qualifierIndex}</p>
                <Link
                  to="/tournaments/$slug"
                  params={{ slug: qualifier.slug }}
                  className="mt-1 block font-bold text-foreground hover:text-brand"
                >
                  {qualifier.name}
                </Link>
              </div>
              <StatusBadge status={qualifier.status} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <Metric
                label="Equipos"
                value={`${qualifier.participantsCount}/${qualifier.maxParticipants ?? "∞"}`}
              />
              <Metric label="Cuatro cupos activos" value={qualifier.activeQualificationGrants} />
              <Metric label="Finalizado" value={qualifier.finalizedAt ? "Sí" : "No"} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant={qualifier.entriesLockedAt ? "default" : "outline"}>
                {qualifier.entriesLockedAt ? "Planteles bloqueados" : "Planteles abiertos"}
              </Badge>
              <Badge variant={qualifier.bracketGeneratedAt ? "default" : "outline"}>
                {qualifier.bracketGeneratedAt ? "Cuadro generado" : "Sin cuadro"}
              </Badge>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Qualifications({
  ops,
  replacing,
  onReplace,
}: {
  ops: StaffSplitOps;
  replacing: boolean;
  onReplace: (teamId: string, teamName: string) => void;
}) {
  const replaceWindow = ops.split.status === "qualifiers" || ops.split.status === "seeding";
  const active = ops.qualifications.filter((qualification) => qualification.status === "qualified");

  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Participantes de eliminatorias</p>
          <h3 className="mt-1 text-xl font-black text-foreground">Equipos clasificados</h3>
        </div>
        <span className="text-sm text-muted-foreground">
          {active.length}/{ops.split.playoffSize} activos
        </span>
      </div>

      {!ops.qualifications.length ? (
        <div className="mt-4">
          <EmptyState title="Todavía no se otorgaron cupos de clasificación" />
        </div>
      ) : (
        <div className="mt-4 overflow-hidden border-y border-border/65 bg-card/15">
          {ops.qualifications.map((qualification) => (
            <div
              key={qualification.id}
              className="grid gap-3 border-b border-border/60 p-4 last:border-0 lg:grid-cols-[3rem_minmax(0,1fr)_auto] lg:items-center"
            >
              <span className="tabular text-lg font-black text-muted-foreground">
                #{qualification.qualificationPosition}
              </span>
              <div className="min-w-0">
                <Link
                  to="/teams/$slug"
                  params={{ slug: qualification.teamSlug }}
                  className="font-semibold text-foreground hover:text-brand"
                >
                  [{qualification.teamTag}] {qualification.teamName}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {qualification.sourceQualifierIndex
                    ? `Clasificado desde el clasificatorio abierto n.º${qualification.sourceQualifierIndex}`
                    : qualification.replacesTeamName
                      ? `Reemplazo de ${qualification.replacesTeamName}`
                      : "Reemplazo / asignación de organización"}
                  {qualification.playoffSeed
                    ? ` · posición inicial en eliminatorias n.º${qualification.playoffSeed}`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <Badge variant={qualification.status === "qualified" ? "default" : "outline"}>
                  {statusLabel(qualification.status)}
                </Badge>
                {qualification.status === "qualified" && replaceWindow ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={replacing}
                    onClick={() => onReplace(qualification.teamId, qualification.teamName)}
                  >
                    Reemplazar equipo retirado…
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Standings({
  standings,
  replacementCandidates,
}: {
  standings: StaffSplitOps["standings"];
  replacementCandidates: StaffSplitOps["replacementCandidates"];
}) {
  const replacementIds = new Set(replacementCandidates.map((candidate) => candidate.team_id));
  return (
    <section>
      <p className="eyebrow">Orden de reemplazo</p>
      <h3 className="mt-1 text-xl font-black text-foreground">Tabla del split</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Si se retira un equipo clasificado, se elige automáticamente al equipo habilitado no
        clasificado mejor ubicado.
      </p>
      {!standings.length ? (
        <div className="mt-4">
          <EmptyState title="Todavía no compitieron equipos" />
        </div>
      ) : (
        <div className="mt-4 overflow-hidden border-y border-border/65 bg-card/15">
          {standings.map((team, index) => (
            <div
              key={team.team_id}
              className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 px-4 py-3 last:border-0"
            >
              <span className="tabular font-black text-muted-foreground">{index + 1}</span>
              <div className="min-w-0">
                <Link
                  to="/teams/$slug"
                  params={{ slug: team.team_slug }}
                  className="truncate text-sm font-semibold text-foreground hover:text-brand"
                >
                  [{team.team_tag}] {team.team_name}
                </Link>
                <p className="eyebrow mt-1">
                  {team.wins}-{team.losses} · {team.tournaments_played} torneos
                </p>
              </div>
              <div className="text-right">
                <p className="tabular font-black text-foreground">{team.points} pts</p>
                {team.qualification_status ? (
                  <Badge className="mt-1" variant="outline">
                    {team.qualification_status}
                  </Badge>
                ) : replacementIds.has(team.team_id) ? (
                  <Badge className="mt-1" variant="outline">
                    lista de reemplazos
                  </Badge>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-bold text-foreground">{value}</p>
    </div>
  );
}

function nextManualStage(status: string) {
  if (status === "playoffs") return "semifinals";
  if (status === "semifinals") return "final";
  if (status === "final") return "completed";
  return null;
}

function friendlyOperationError(error?: string) {
  const text = error ?? "No se pudo completar la operación.";
  if (text.includes("qualifiers_not_finalized"))
    return "Todos los clasificatorios abiertos deben finalizar antes del ordenamiento.";
  if (text.includes("qualifiers_missing"))
    return "Este Semi-Split no tiene clasificatorios abiertos.";
  if (text.includes("playoff_field_incomplete"))
    return "Todavía no están completos los participantes de eliminatorias.";
  if (text.includes("playoff_field_too_small"))
    return "Se requieren al menos dos equipos clasificados.";
  if (text.includes("playoffs_not_generated"))
    return "Generá el cuadro antes de avanzar a la etapa de eliminatorias.";
  if (text.includes("playoff_not_finalized"))
    return "Finalizá el torneo de eliminatorias antes de completar el Semi-Split.";
  if (text.includes("replacement_window_closed"))
    return "Los reemplazos de clasificación están cerrados en esta etapa.";
  if (text.includes("qualification_not_found"))
    return "Ese equipo ya no tiene un cupo de clasificación activo.";
  if (text.includes("invalid_transition"))
    return "Ese cambio de etapa del Semi-Split no está permitido.";
  return text;
}
