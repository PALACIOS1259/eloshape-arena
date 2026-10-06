import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Gavel,
  LockKeyhole,
  Play,
  ShieldCheck,
  Swords,
  Trophy,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BracketView, entryLabels, type BracketMatchRow } from "@/components/eloshape/BracketView";
import { EmptyState } from "@/components/eloshape/EmptyState";
import { StatusBadge } from "@/components/eloshape/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  advanceSplitStatus,
  buildSplitPlayoffs,
  closeTournament,
  correctCompletedMatchResult,
  generateBracket,
  getStaffSplits,
  getTournamentOps,
  lockEntries,
  recordMatchWalkover,
  submitMatchResult,
} from "@/lib/competition.functions";
import { formatDate, statusLabel, roundName } from "@/lib/format";
import { cn } from "@/lib/utils";

const SPLIT_STAGES = [
  "upcoming",
  "qualifiers",
  "seeding",
  "playoffs",
  "semifinals",
  "final",
  "completed",
];
const NEXT_SPLIT_STAGE: Record<string, string | null> = {
  upcoming: "qualifiers",
  qualifiers: "seeding",
  seeding: "playoffs",
  playoffs: "semifinals",
  semifinals: "final",
  final: "completed",
  completed: null,
  cancelled: null,
};

type Result = { ok: boolean; error?: string };
type AdminView = "tournaments" | "splits";

function humanize(value: string) {
  return statusLabel(value);
}

function useOp(invalidate: () => void) {
  return (label: string) => ({
    onSuccess: (result: Result) => {
      if (!result.ok) {
        toast.error(result.error ?? `${label} falló.`);
        return;
      }
      toast.success(`${label} completado.`);
      invalidate();
    },
    onError: () => toast.error(`${label} falló.`),
  });
}

function MatchReporter({
  matchId,
  bestOf,
  entryA,
  entryB,
  onDone,
}: {
  matchId: string;
  bestOf: number;
  entryA: { id: string; label: string };
  entryB: { id: string; label: string };
  onDone: () => void;
}) {
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [walkoverNote, setWalkoverNote] = useState("");
  const report = useServerFn(submitMatchResult);
  const walkover = useServerFn(recordMatchWalkover);

  const mutation = useMutation({
    mutationFn: () => report({ data: { matchId, scoreA: Number(scoreA), scoreB: Number(scoreB) } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Resultado registrado.");
      setScoreA("");
      setScoreB("");
      onDone();
    },
    onError: () => toast.error("No se pudo registrar el resultado."),
  });

  const walkoverMutation = useMutation({
    mutationFn: (winnerEntryId: string) =>
      walkover({ data: { matchId, winnerEntryId, note: walkoverNote } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Victoria administrativa registrada como victoria de partida.");
      setWalkoverNote("");
      onDone();
    },
    onError: () => toast.error("No se pudo registrar la victoria administrativa."),
  });

  const parsedA = Number(scoreA);
  const parsedB = Number(scoreB);
  const winsRequired = Math.floor(bestOf / 2) + 1;
  const validSeriesScore =
    scoreA !== "" &&
    scoreB !== "" &&
    Number.isInteger(parsedA) &&
    Number.isInteger(parsedB) &&
    parsedA >= 0 &&
    parsedB >= 0 &&
    parsedA !== parsedB &&
    parsedA + parsedB <= bestOf &&
    Math.max(parsedA, parsedB) === winsRequired;
  const pending = mutation.isPending || walkoverMutation.isPending;

  const confirmWalkover = (entry: { id: string; label: string }) => {
    const confirmed = window.confirm(
      `¿Otorgar esta partida a ${entry.label} por victoria administrativa? El equipo avanzará y recibirá los puntos habituales por victoria.`,
    );
    if (confirmed) walkoverMutation.mutate(entry.id);
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-border/70/60 pb-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">Registrar resultado</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Al mejor de {bestOf} · gana quien llegue primero a {winsRequired} victoria
              {winsRequired === 1 ? "" : "s"}
            </p>
          </div>
          <Badge variant="outline">Resultado competitivo</Badge>
        </div>

        <div className="grid gap-2">
          <label className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-3 rounded-md border border-border/70 bg-card/60 px-3 py-2">
            <span className="min-w-0 truncate text-sm font-medium text-foreground">
              {entryA.label}
            </span>
            <Input
              aria-label={`Marcador de ${entryA.label}`}
              className="text-center"
              inputMode="numeric"
              placeholder="0"
              value={scoreA}
              onChange={(event) => setScoreA(event.target.value)}
            />
          </label>
          <label className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-3 rounded-md border border-border/70 bg-card/60 px-3 py-2">
            <span className="min-w-0 truncate text-sm font-medium text-foreground">
              {entryB.label}
            </span>
            <Input
              aria-label={`Marcador de ${entryB.label}`}
              className="text-center"
              inputMode="numeric"
              placeholder="0"
              value={scoreB}
              onChange={(event) => setScoreB(event.target.value)}
            />
          </label>
        </div>

        {scoreA !== "" && scoreB !== "" && !validSeriesScore ? (
          <p className="mt-2 text-xs text-destructive">
            Ingresá un resultado válido al mejor de {bestOf}. Un equipo debe alcanzar {winsRequired}{" "}
            victoria
            {winsRequired === 1 ? "" : "s"}.
          </p>
        ) : null}

        <div className="mt-3 flex justify-end">
          <Button disabled={pending || !validSeriesScore} onClick={() => mutation.mutate()}>
            <ClipboardCheck />
            Guardar resultado
          </Button>
        </div>
      </div>

      <details className="group border-t border-border/70/60">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
          <span className="flex items-center gap-2">
            <Gavel className="size-4" />
            Acciones administrativas
          </span>
          <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
        </summary>
        <div className="border-t border-border/70 p-4">
          <p className="text-sm font-semibold text-foreground">Declarar victoria administrativa</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Usá esta opción solo ante una ausencia documentada o una resolución administrativa. El
            ganador avanza y recibe los mismos puntos de EloShape que por una victoria jugada.
          </p>
          <Input
            aria-label="Motivo de la victoria administrativa"
            className="mt-3"
            maxLength={1000}
            placeholder="Motivo obligatorio, por ejemplo: ausencia del rival"
            value={walkoverNote}
            onChange={(event) => setWalkoverNote(event.target.value)}
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              disabled={pending || walkoverNote.trim().length < 3}
              onClick={() => confirmWalkover(entryA)}
            >
              Otorgar victoria administrativa a {entryA.label}
            </Button>
            <Button
              variant="outline"
              disabled={pending || walkoverNote.trim().length < 3}
              onClick={() => confirmWalkover(entryB)}
            >
              Otorgar victoria administrativa a {entryB.label}
            </Button>
          </div>
        </div>
      </details>
    </div>
  );
}

function CompletedMatchCorrection({
  match,
  entryA,
  entryB,
  onDone,
}: {
  match: BracketMatchRow;
  entryA: { id: string; label: string };
  entryB: { id: string; label: string };
  onDone: () => void;
}) {
  const [scoreA, setScoreA] = useState(String(match.score_a));
  const [scoreB, setScoreB] = useState(String(match.score_b));
  const [note, setNote] = useState("");
  const correct = useServerFn(correctCompletedMatchResult);

  const mutation = useMutation({
    mutationFn: () =>
      correct({
        data: {
          matchId: match.id,
          scoreA: Number(scoreA),
          scoreB: Number(scoreB),
          note,
        },
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        const message = result.error.includes("downstream_match_already_started")
          ? "La partida de la siguiente ronda ya tiene actividad. No se puede modificar este resultado de forma segura."
          : result.error.includes("tournament_finalized")
            ? "No se pueden corregir torneos finalizados."
            : result.error;
        toast.error(message);
        return;
      }
      toast.success("Resultado corregido y registrado en el historial de auditoría.");
      setNote("");
      onDone();
    },
    onError: () => toast.error("No se pudo corregir el resultado."),
  });

  const parsedA = Number(scoreA);
  const parsedB = Number(scoreB);
  const scoresAreIntegers = Number.isInteger(parsedA) && Number.isInteger(parsedB);
  const winsRequired = Math.floor(match.best_of / 2) + 1;
  const validSeriesScore =
    scoresAreIntegers &&
    parsedA >= 0 &&
    parsedB >= 0 &&
    parsedA !== parsedB &&
    parsedA + parsedB <= match.best_of &&
    Math.max(parsedA, parsedB) === winsRequired;
  const changed = parsedA !== match.score_a || parsedB !== match.score_b;

  const confirmCorrection = () => {
    const newWinner = parsedA > parsedB ? entryA : entryB;
    const winnerChanges = newWinner.id !== match.winner_entry_id;
    const warning = winnerChanges
      ? ` Esto cambia el ganador a ${newWinner.label} y reemplazará al participante de la siguiente ronda solo si esa partida no empezó.`
      : "";
    if (
      window.confirm(
        `Corregir ${entryA.label} vs ${entryB.label} a ${parsedA}-${parsedB}?${warning} Este cambio queda registrado.`,
      )
    ) {
      mutation.mutate();
    }
  };

  return (
    <details className="group border-t border-border/70/60">
      <summary className="grid cursor-pointer list-none gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {entryA.label} {match.score_a}–{match.score_b} {entryB.label}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {roundName(match.round_label)} · Al mejor de {match.best_of}
          </p>
        </div>
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          Editar resultado
          <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
        </span>
      </summary>
      <div className="border-t border-border/70 p-4">
        <div className="mb-3 rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-muted-foreground">
          Las correcciones quedan registradas. Si cambiar el ganador entra en conflicto con la
          actividad de la siguiente ronda, EloShape bloquea el cambio automáticamente.
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">{entryA.label}</span>
            <Input
              aria-label={`Marcador corregido de ${entryA.label}`}
              inputMode="numeric"
              value={scoreA}
              onChange={(event) => setScoreA(event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">{entryB.label}</span>
            <Input
              aria-label={`Marcador corregido de ${entryB.label}`}
              inputMode="numeric"
              value={scoreB}
              onChange={(event) => setScoreB(event.target.value)}
            />
          </label>
        </div>
        <Input
          aria-label="Motivo de la corrección"
          className="mt-3"
          maxLength={1000}
          placeholder="Motivo obligatorio de la corrección"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        {!validSeriesScore && scoreA !== "" && scoreB !== "" ? (
          <p className="mt-2 text-xs text-destructive">
            Ingresá un resultado válido al mejor de {match.best_of}.
          </p>
        ) : null}
        <div className="mt-3 flex justify-end">
          <Button
            variant="outline"
            disabled={mutation.isPending || !validSeriesScore || !changed || note.trim().length < 3}
            onClick={confirmCorrection}
          >
            Guardar corrección
          </Button>
        </div>
      </div>
    </details>
  );
}

function WorkflowStep({ label, state }: { label: string; state: "done" | "current" | "pending" }) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium",
        state === "done" && "border-emerald-500/25 bg-emerald-500/5 text-emerald-300",
        state === "current" && "border-primary/35 bg-primary/10 text-foreground",
        state === "pending" && "border-border/70 bg-background/30 text-muted-foreground",
      )}
    >
      {state === "done" ? (
        <CheckCircle2 className="size-4 shrink-0" />
      ) : state === "current" ? (
        <CircleDot className="size-4 shrink-0" />
      ) : (
        <span className="size-4 shrink-0 rounded-full border border-border/70" />
      )}
      <span className="truncate">{label}</span>
    </div>
  );
}

function TournamentOps({ tournamentId }: { tournamentId: string }) {
  const queryClient = useQueryClient();
  const fetchOps = useServerFn(getTournamentOps);
  const lock = useServerFn(lockEntries);
  const bracket = useServerFn(generateBracket);
  const close = useServerFn(closeTournament);
  const [bestOf, setBestOf] = useState(1);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["tournament-ops", tournamentId] });
    void queryClient.invalidateQueries({ queryKey: ["staff-splits"] });
  };
  const handlers = useOp(invalidate);

  const { data, isPending } = useQuery({
    queryKey: ["tournament-ops", tournamentId],
    queryFn: () => fetchOps({ data: { tournamentId } }),
    retry: false,
  });

  const lockMutation = useMutation({
    mutationFn: () => lock({ data: { tournamentId } }),
    ...handlers("Bloqueo de planteles"),
  });
  const bracketMutation = useMutation({
    mutationFn: () => bracket({ data: { tournamentId, bestOf } }),
    ...handlers("Generación del cuadro"),
  });
  const closeMutation = useMutation({
    mutationFn: () => close({ data: { tournamentId } }),
    ...handlers("Finalización del torneo"),
  });

  if (isPending) return <Skeleton className="h-56 w-full" />;
  if (!data?.tournament) return <EmptyState title="Torneo no encontrado" />;

  const t = data.tournament;
  const labels = entryLabels(data.entries);
  const byId = new Map(labels.map((entry) => [entry.id, entry.label]));
  const readyMatches = data.matches.filter(
    (match) =>
      match.status !== "completed" &&
      !match.is_bye &&
      Boolean(match.entry_a_id && match.entry_b_id),
  );
  const waitingMatches = data.matches.filter(
    (match) =>
      match.status !== "completed" && !match.is_bye && !(match.entry_a_id && match.entry_b_id),
  );
  const correctableMatches = data.matches.filter(
    (match) =>
      match.status === "completed" &&
      !match.is_bye &&
      match.resolution_type === "played" &&
      match.entry_a_id &&
      match.entry_b_id,
  );
  const competitiveCompleted = data.matches.filter(
    (match) =>
      match.status === "completed" &&
      (match.resolution_type === "played" || match.resolution_type === "walkover"),
  ).length;
  const finalRound = data.matches.reduce((max, match) => Math.max(max, match.round_index), -1);
  const finalMatch = data.matches.find(
    (match) => match.round_index === finalRound && match.bracket_slot === 0,
  );
  const finalComplete = Boolean(
    finalMatch && finalMatch.status === "completed" && finalMatch.winner_entry_id,
  );
  const pending = lockMutation.isPending || bracketMutation.isPending || closeMutation.isPending;

  const workflowCurrent = t.finalized_at
    ? 4
    : !t.entries_locked_at
      ? 0
      : !t.bracket_generated_at
        ? 1
        : !finalComplete
          ? 2
          : 3;
  const workflow = [
    "Inscripción",
    "Preparación del cuadro",
    "Gestionar partidas",
    "Finalizar",
    "Completo",
  ];

  const confirmLock = () => {
    if (
      window.confirm(
        "¿Bloquear los planteles habilitados que confirmaron asistencia? Se guardarán los integrantes que se usarán para el cuadro y la puntuación del torneo.",
      )
    ) {
      lockMutation.mutate();
    }
  };

  const confirmFinalize = () => {
    if (
      window.confirm(
        "¿Finalizar este torneo y otorgar todos los puntos de EloShape? Después de finalizarlo, los resultados completados serán de solo lectura.",
      )
    ) {
      closeMutation.mutate();
    }
  };

  return (
    <div className="space-y-6 border-t border-border/70 bg-background/15 p-4 sm:p-6">
      <section>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-foreground">Panel del torneo</p>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              EloShape muestra la acción que corresponde a la etapa actual del torneo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={t.status} />
            <Badge variant="outline">{data.entries.length} participantes</Badge>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-5">
          {workflow.map((label, index) => (
            <WorkflowStep
              key={label}
              label={label}
              state={
                index < workflowCurrent ? "done" : index === workflowCurrent ? "current" : "pending"
              }
            />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-primary/20 bg-primary/5 p-4 sm:p-5">
        {!t.entries_locked_at ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="eyebrow text-primary">Próxima acción</p>
              <h3 className="mt-1 text-base font-semibold text-foreground">
                Bloquear planteles del torneo
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Fijá los planteles habilitados que confirmaron asistencia antes de generar el
                cuadro. Los cambios posteriores en los equipos no modificarán el plantel registrado
                para el torneo.
              </p>
            </div>
            <Button disabled={pending} onClick={confirmLock}>
              <LockKeyhole />
              Bloquear planteles
            </Button>
          </div>
        ) : !t.bracket_generated_at ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="eyebrow text-primary">Próxima acción</p>
              <h3 className="mt-1 text-base font-semibold text-foreground">Generar el cuadro</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Formato de las series del cuadro
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Formato de series del cuadro"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none focus:ring-1 focus:ring-ring"
                value={bestOf}
                onChange={(event) => setBestOf(Number(event.target.value))}
              >
                <option value={1}>Al mejor de 1</option>
                <option value={3}>Al mejor de 3</option>
              </select>
              <Button disabled={pending} onClick={() => bracketMutation.mutate()}>
                <Swords />
                Generar cuadro
              </Button>
            </div>
          </div>
        ) : !finalComplete ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="eyebrow text-primary">Torneo en curso</p>
              <h3 className="mt-1 text-base font-semibold text-foreground">
                Gestionar las partidas listas
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {competitiveCompleted} resultado competitivo{competitiveCompleted === 1 ? "" : "s"}{" "}
                registrado · {readyMatches.length} listo ahora · {waitingMatches.length} en espera
                de una ronda anterior.
              </p>
            </div>
            <Badge variant={readyMatches.length ? "default" : "outline"}>
              {readyMatches.length
                ? `${readyMatches.length} requieren atención`
                : "Esperando el avance del cuadro"}
            </Badge>
          </div>
        ) : !t.finalized_at ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="eyebrow text-primary">Final completada</p>
              <h3 className="mt-1 text-base font-semibold text-foreground">
                Finalizar y otorgar puntos
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                El campeón ya está definido. La finalización calcula posiciones, victorias de
                partida, premios de cada fase y clasificaciones.
              </p>
            </div>
            <Button disabled={pending} onClick={confirmFinalize}>
              <Trophy />
              Finalizar torneo
            </Button>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" />
            <div>
              <p className="font-semibold text-foreground">Torneo finalizado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Los puntos y las posiciones quedaron fijados. Finalizado{" "}
                {formatDate(t.finalized_at)}.
              </p>
            </div>
          </div>
        )}
      </section>

      {data.matches.length ? (
        <>
          <details className="group rounded-lg border border-border/70 bg-card/35" open>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Resumen del cuadro</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.matches.length} espacio de partida en total
                  {data.matches.length === 1 ? "" : "s"}
                </p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
            </summary>
            <div className="border-t border-border/70 p-3 sm:p-4">
              <BracketView matches={data.matches} entries={labels} />
            </div>
          </details>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Partidas que requieren una acción
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Las partidas listas aparecen primero. Las pendientes se habilitan automáticamente
                  a medida que avanzan los ganadores.
                </p>
              </div>
              <Badge variant={readyMatches.length ? "default" : "outline"}>
                {readyMatches.length} listas
              </Badge>
            </div>

            {readyMatches.length ? (
              <div className="space-y-3">
                {readyMatches.map((match) => {
                  const entryA = {
                    id: match.entry_a_id!,
                    label: byId.get(match.entry_a_id!) ?? "Equipo A",
                  };
                  const entryB = {
                    id: match.entry_b_id!,
                    label: byId.get(match.entry_b_id!) ?? "Equipo B",
                  };
                  return (
                    <div
                      key={match.id}
                      className="rounded-lg border border-border/70 bg-card/35 p-4 sm:p-5"
                    >
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="eyebrow">
                            {roundName(match.round_label)} · Partida {match.bracket_slot + 1}
                          </p>
                          <h4 className="mt-1 text-base font-semibold text-foreground">
                            {entryA.label} <span className="text-muted-foreground">vs</span>{" "}
                            {entryB.label}
                          </h4>
                        </div>
                        <Badge variant="outline">Mejor de{match.best_of}</Badge>
                      </div>
                      <MatchReporter
                        matchId={match.id}
                        bestOf={match.best_of}
                        entryA={entryA}
                        entryB={entryB}
                        onDone={invalidate}
                      />
                    </div>
                  );
                })}
              </div>
            ) : t.bracket_generated_at && !t.finalized_at ? (
              <div className="rounded-lg border border-dashed border-border/70 p-5 text-sm text-muted-foreground">
                Ninguna partida necesita un resultado por ahora.
              </div>
            ) : null}

            {waitingMatches.length ? (
              <details className="group mt-3 rounded-lg border border-border/70 bg-background/20">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm text-muted-foreground">
                  <span>{waitingMatches.length} en espera de rondas anteriores</span>
                  <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
                </summary>
                <div className="border-t border-border/70">
                  {waitingMatches.map((match) => (
                    <div
                      key={match.id}
                      className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {roundName(match.round_label)} · Partida {match.bracket_slot + 1}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {byId.get(match.entry_a_id ?? "") ?? "A confirmar"} vs{" "}
                          {byId.get(match.entry_b_id ?? "") ?? "A confirmar"}
                        </p>
                      </div>
                      <Badge variant="outline">En espera</Badge>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </section>

          {correctableMatches.length ? (
            <section>
              <div className="mb-3">
                <p className="text-sm font-semibold text-foreground">Resultados completados</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Abrí una partida solo cuando debas corregir un resultado enviado.
                </p>
              </div>
              {t.finalized_at ? (
                <div className="rounded-lg border border-border/70 p-4 text-sm text-muted-foreground">
                  Este torneo está finalizado. Sus resultados son de solo lectura.
                </div>
              ) : (
                <div className="space-y-2">
                  {correctableMatches.map((match) => {
                    const entryA = {
                      id: match.entry_a_id!,
                      label: byId.get(match.entry_a_id!) ?? "Equipo A",
                    };
                    const entryB = {
                      id: match.entry_b_id!,
                      label: byId.get(match.entry_b_id!) ?? "Equipo B",
                    };
                    return (
                      <CompletedMatchCorrection
                        key={match.id}
                        match={match}
                        entryA={entryA}
                        entryB={entryB}
                        onDone={invalidate}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}
        </>
      ) : (
        <EmptyState
          title="Todavía no hay cuadro"
          description="Primero bloqueá los planteles y después generá el cuadro."
        />
      )}

      {data.auditLog.length ? (
        <details className="group border-t border-border/70/60">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ShieldCheck className="size-4" />
              Historial de auditoría ({data.auditLog.length})
            </span>
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
          </summary>
          <div className="border-t border-border/70">
            {data.auditLog.map((entry) => (
              <div
                key={entry.id}
                className="grid gap-1 border-b border-border/70 px-4 py-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <span className="text-sm font-medium text-foreground">
                  {humanize(entry.action)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(entry.created_at)}
                </span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function TournamentStageLabel({
  tournament,
}: {
  tournament: {
    entries_locked_at: string | null;
    bracket_generated_at: string | null;
    finalized_at: string | null;
    status: string;
  };
}) {
  if (tournament.finalized_at) return <Badge>Completo</Badge>;
  if (!tournament.entries_locked_at)
    return <Badge variant="outline">Inscripción / confirmación de asistencia</Badge>;
  if (!tournament.bracket_generated_at)
    return <Badge variant="outline">Falta generar el cuadro</Badge>;
  return <Badge variant="outline">Torneo en curso</Badge>;
}

function SplitStageRail({ current }: { current: string }) {
  const currentIndex = SPLIT_STAGES.indexOf(current);
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {SPLIT_STAGES.filter((stage) => stage !== "upcoming" || current === "upcoming").map(
        (stage) => {
          const index = SPLIT_STAGES.indexOf(stage);
          const active = stage === current;
          const complete = currentIndex >= 0 && index < currentIndex;
          return (
            <span
              key={stage}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                active && "border-primary/40 bg-primary/10 text-foreground",
                complete && "border-emerald-500/20 bg-emerald-500/5 text-emerald-300",
                !active && !complete && "border-border/70 text-muted-foreground",
              )}
            >
              {humanize(stage)}
            </span>
          );
        },
      )}
    </div>
  );
}

/** Staff-only competition operations: clear tournament workspaces and guided Semi-Split controls. */
export function CompetitionOpsPanel() {
  const queryClient = useQueryClient();
  const fetchSplits = useServerFn(getStaffSplits);
  const advance = useServerFn(advanceSplitStatus);
  const playoffs = useServerFn(buildSplitPlayoffs);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<AdminView>("tournaments");

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["staff-splits"] });
  const handlers = useOp(invalidate);

  const { data, isPending } = useQuery({
    queryKey: ["staff-splits"],
    queryFn: () => fetchSplits(),
    retry: false,
  });

  const stageMutation = useMutation({
    mutationFn: (input: { splitId: string; status: string }) => advance({ data: input }),
    ...handlers("Cambio de etapa"),
  });
  const playoffMutation = useMutation({
    mutationFn: (input: { splitId: string; allowShortField?: boolean; reason?: string }) =>
      playoffs({ data: { bestOf: 3, ...input } }),
    ...handlers("Generación de eliminatorias"),
  });

  if (isPending) return <Skeleton className="h-64 w-full" />;
  if (!data) return <EmptyState title="Se requiere acceso de organización" />;

  const activeTournaments = data.tournaments.filter(
    (tournament) => !tournament.finalized_at,
  ).length;
  const completedTournaments = data.tournaments.length - activeTournaments;
  const activeSplits = data.splits.filter(
    (split) => !["completed", "cancelled"].includes(split.status),
  ).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border/70 bg-card/35 p-4">
          <p className="eyebrow">Torneos activos</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{activeTournaments}</p>
          <p className="mt-1 text-xs text-muted-foreground">Requieren seguimiento o avance</p>
        </div>
        <div className="rounded-lg border border-border/70 bg-card/35 p-4">
          <p className="eyebrow">Completado</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{completedTournaments}</p>
          <p className="mt-1 text-xs text-muted-foreground">Torneos finalizados de esta lista</p>
        </div>
        <div className="rounded-lg border border-border/70 bg-card/35 p-4">
          <p className="eyebrow">Semi-Splits activos</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{activeSplits}</p>
          <p className="mt-1 text-xs text-muted-foreground">Etapas del circuito todavía en curso</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border/70 pb-3">
        <Button
          size="sm"
          variant={view === "tournaments" ? "default" : "ghost"}
          onClick={() => setView("tournaments")}
        >
          <Swords />
          Torneos
        </Button>
        <Button
          size="sm"
          variant={view === "splits" ? "default" : "ghost"}
          onClick={() => setView("splits")}
        >
          <Trophy />
          Semi-Splits
        </Button>
      </div>

      {view === "tournaments" ? (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Operaciones de torneos</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Abrí un torneo por vez. El panel te guía desde el bloqueo de planteles hasta la
              puntuación final.
            </p>
          </div>

          {data.tournaments.length ? (
            <div className="overflow-hidden rounded-lg border border-border/70 bg-card/35">
              {data.tournaments.map((tournament) => {
                const isSelected = selected === tournament.id;
                return (
                  <div key={tournament.id} className="border-b border-border/70 last:border-0">
                    <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {tournament.name}
                          </p>
                          {tournament.qualifier_index ? (
                            <Badge variant="outline">
                              Clasificatorio n.º{tournament.qualifier_index}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{tournament.participants_count} participantes</span>
                          <span aria-hidden="true">·</span>
                          <span>{humanize(tournament.status)}</span>
                          <TournamentStageLabel tournament={tournament} />
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={isSelected ? "secondary" : "outline"}
                        onClick={() => setSelected(isSelected ? null : tournament.id)}
                      >
                        {isSelected ? "Cerrar panel" : "Abrir panel"}
                        <ChevronRight
                          className={cn("transition-transform", isSelected && "rotate-90")}
                        />
                      </Button>
                    </div>
                    {isSelected ? <TournamentOps tournamentId={tournament.id} /> : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No hay torneos" />
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Avance del Semi-Split</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Solo se ofrece la próxima etapa válida. La generación de eliminatorias está separada
              del cambio de etapa para evitar acciones incorrectas.
            </p>
          </div>

          {data.splits.length ? (
            <div className="space-y-3">
              {data.splits.map((split) => {
                const nextStage = NEXT_SPLIT_STAGE[split.status] ?? null;
                const isSeeding = split.status === "seeding";
                return (
                  <div
                    key={split.id}
                    className="rounded-lg border border-border/70 bg-card/35 p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {split.name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(split.starts_at)} — {formatDate(split.ends_at)} ·{" "}
                          {split.playoff_size} lugares en eliminatorias
                        </p>
                      </div>
                      <StatusBadge status={split.status} />
                    </div>

                    <SplitStageRail current={split.status} />

                    <div className="mt-4 rounded-lg border border-border/70 bg-background/30 p-4">
                      {isSeeding ? (
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              Armar el grupo de eliminatorias
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                              Generar el cuadro de {split.playoff_size}equipos clasificados antes de
                              avanzar el split a las eliminatorias.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              disabled={playoffMutation.isPending}
                              onClick={() => playoffMutation.mutate({ splitId: split.id })}
                            >
                              <Play />
                              Generar eliminatorias ({split.playoff_size})
                            </Button>
                            <details className="group">
                              <summary className="list-none">
                                <Button asChild variant="outline">
                                  <span>
                                    <AlertTriangle />
                                    Excepción por cupo incompleto
                                  </span>
                                </Button>
                              </summary>
                              <div className="mt-3 max-w-xl rounded-md border border-amber-500/25 bg-amber-500/5 p-3">
                                <p className="text-xs leading-relaxed text-muted-foreground">
                                  Solo para emergencias. Se requiere un motivo escrito para crear
                                  eliminatorias con menos de {split.playoff_size} equipos
                                  clasificados.
                                </p>
                                <Button
                                  className="mt-3"
                                  size="sm"
                                  variant="outline"
                                  disabled={playoffMutation.isPending}
                                  onClick={() => {
                                    const reason = window.prompt(
                                      `¿Por qué se generan las eliminatorias con menos de ${split.playoff_size} equipos clasificados?`,
                                    );
                                    if (!reason?.trim()) return;
                                    playoffMutation.mutate({
                                      splitId: split.id,
                                      allowShortField: true,
                                      reason: reason.trim(),
                                    });
                                  }}
                                >
                                  Confirmar generación con cupo incompleto
                                </Button>
                              </div>
                            </details>
                          </div>
                        </div>
                      ) : nextStage ? (
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              Próxima etapa: {humanize(nextStage)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Avanzá solo después de completar las operaciones y revisiones de los
                              torneos de la etapa actual.
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            disabled={stageMutation.isPending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `¿Avanzar ${split.name} de ${humanize(split.status)} a ${humanize(nextStage)}?`,
                                )
                              ) {
                                stageMutation.mutate({ splitId: split.id, status: nextStage });
                              }
                            }}
                          >
                            Avanzar a {humanize(nextStage)}
                            <ChevronRight />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" />
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {split.status === "cancelled"
                                ? "Split cancelado"
                                : "Split completado"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              No hay acciones de etapa disponibles.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No hay Semi-Splits" />
          )}
        </div>
      )}
    </div>
  );
}
