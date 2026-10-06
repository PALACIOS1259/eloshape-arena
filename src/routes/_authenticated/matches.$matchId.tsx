import { statusLabel } from "@/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  getMyMatchResult,
  respondMyMatchResult,
  submitMyMatchResult,
  type MatchEntrySummary,
  type MatchResultState,
} from "@/lib/match-result.functions";

export const Route = createFileRoute("/_authenticated/matches/$matchId")({
  head: () => ({
    meta: [
      { title: "Resultado de partida — EloShape" },
      {
        name: "description",
        content: "Enviá, confirmá o disputá un resultado de torneo de EloShape.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MatchResultPage,
});

function MatchResultPage() {
  const { matchId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchState = useServerFn(getMyMatchResult);
  const submitResult = useServerFn(submitMyMatchResult);
  const respondResult = useServerFn(respondMyMatchResult);

  const query = useQuery({
    queryKey: ["match-result", matchId],
    queryFn: () => fetchState({ data: { matchId } }),
    retry: false,
  });

  const [scoreA, setScoreA] = useState("0");
  const [scoreB, setScoreB] = useState("0");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [reportNote, setReportNote] = useState("");
  const [disputeNote, setDisputeNote] = useState("");

  useEffect(() => {
    const claim = query.data?.claim;
    if (!claim) return;
    setScoreA(String(claim.scoreA));
    setScoreB(String(claim.scoreB));
    setEvidenceUrl(claim.evidenceUrl ?? "");
    setReportNote(claim.reporterNote ?? "");
  }, [query.data?.claim]);

  const updateState = (state: MatchResultState) => {
    queryClient.setQueryData(["match-result", matchId], state);
    void queryClient.invalidateQueries({ queryKey: ["tournament-detail"] });
  };

  const submitMutation = useMutation({
    mutationFn: () =>
      submitResult({
        data: {
          matchId,
          scoreA: Number(scoreA),
          scoreB: Number(scoreB),
          evidenceUrl,
          note: reportNote,
        },
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);

        return;
      }
      updateState(result.state);
      toast.success("Resultado enviado. Esperando confirmación del rival.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "No se pudo enviar el resultado."),
  });

  const responseMutation = useMutation({
    mutationFn: (input: { confirm: boolean; note?: string }) =>
      respondResult({ data: { matchId, ...input } }),
    onSuccess: (result, variables) => {
      if (!result.ok) {
        toast.error(result.error);

        return;
      }
      updateState(result.state);
      toast.success(
        variables.confirm
          ? "Resultado confirmado."
          : "Disputa abierta para revisión de la organización.",
      );
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "No se pudo responder."),
  });

  if (query.isPending) {
    return (
      <PageContainer className="py-16">
        <Skeleton className="h-64 w-full" />
      </PageContainer>
    );
  }

  if (query.error || !query.data) {
    return (
      <PageContainer className="py-16">
        <EmptyState
          title="Se requiere acceso como participante"
          description="Solo un jugador participante, el capitán del plantel bloqueado o la organización puede acceder a los controles de resultado de esta partida."
        />
      </PageContainer>
    );
  }

  const state = query.data;
  const claim = state.claim;
  const isReporter = Boolean(claim && state.myEntryId && claim.reporterEntryId === state.myEntryId);
  const official = state.match.status === "completed" && Boolean(state.match.winnerEntryId);

  return (
    <div>
      <PageHeading
        eyebrow={`${state.match.roundLabel} · Al mejor de ${state.match.bestOf}`}
        title="Resultado de partida"
        description={`${state.entryA?.name ?? "A confirmar"} vs ${state.entryB?.name ?? "A confirmar"}`}
        aside={
          <Button asChild variant="outline">
            <Link to="/tournaments/$slug" params={{ slug: state.tournament.slug }}>
              Volver al torneo
            </Link>
          </Button>
        }
      />

      <PageContainer className="space-y-7 py-7 sm:py-9">
        <section className="rounded-2xl border border-border/70 bg-card/35 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">{state.tournament.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {state.tournament.mode === "team"
                  ? "Solo el capitán del plantel bloqueado puede enviar o responder un resultado."
                  : "Cada jugador participante puede enviar o responder el resultado."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{statusLabel(state.match.status)}</Badge>
              {claim ? <ClaimBadge status={claim.status} /> : null}
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
            <EntryCard
              entry={state.entryA}
              score={official ? state.match.scoreA : (claim?.scoreA ?? null)}
              mine={state.myEntryId === state.entryA?.id}
              winner={official && state.match.winnerEntryId === state.entryA?.id}
            />
            <div className="text-center text-xs font-black uppercase tracking-widest text-muted-foreground">
              VS
            </div>
            <EntryCard
              entry={state.entryB}
              score={official ? state.match.scoreB : (claim?.scoreB ?? null)}
              mine={state.myEntryId === state.entryB?.id}
              winner={official && state.match.winnerEntryId === state.entryB?.id}
            />
          </div>
        </section>

        {official ? (
          <section className="rounded-lg border border-success/30 bg-success/10 p-5">
            <p className="font-black text-success">Resultado oficial confirmado</p>
            <p className="mt-2 text-sm text-muted-foreground">
              El cuadro fue actualizado con el marcador oficial {state.match.scoreA}–
              {state.match.scoreB}.
            </p>
            {claim?.resolutionNote ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nota de la organización: {claim.resolutionNote}
              </p>
            ) : null}
          </section>
        ) : null}

        {!official && claim?.status === "disputed" ? (
          <section className="rounded-lg border border-destructive/30 bg-destructive/10 p-5">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div>
                <p className="font-black text-foreground">Resultado en disputa — cuadro pausado</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  La organización debe revisar esta partida antes de que avance un ganador.
                </p>
                {claim.responderNote ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Disputa: {claim.responderNote}
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {!official && claim?.status === "pending_confirmation" && isReporter ? (
          <section className="rounded-lg border border-gold/30 bg-gold/10 p-5">
            <p className="font-black text-foreground">Esperando confirmación del rival</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Podés actualizar el marcador enviado mientras el rival no haya respondido.
            </p>
          </section>
        ) : null}

        {claim ? <SubmittedEvidence claim={claim} /> : null}

        {!official && state.canRespond && claim ? (
          <section className="rounded-2xl border border-border/70 bg-card/35 p-5 sm:p-6">
            <p className="eyebrow">El rival envió un resultado</p>
            <h2 className="mt-2 text-xl font-black text-foreground">
              Confirmar {claim.scoreA}–{claim.scoreB}?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              La confirmación convierte el marcador en resultado oficial y hace avanzar el cuadro.
              Si es incorrecto, explicá el desacuerdo y abrí una disputa.
            </p>
            <div className="mt-5">
              <Label htmlFor="disputeNote">Explicación de la disputa</Label>
              <Textarea
                id="disputeNote"
                value={disputeNote}
                onChange={(event) => setDisputeNote(event.target.value)}
                placeholder="Solo es obligatoria si disputás el resultado enviado."
                className="mt-2 min-h-24"
                maxLength={1000}
              />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                disabled={responseMutation.isPending}
                onClick={() =>
                  responseMutation.mutate({ confirm: true, note: "Confirmado por el rival" })
                }
              >
                Confirmar resultado
              </Button>
              <Button
                variant="destructive"
                disabled={responseMutation.isPending || disputeNote.trim().length < 3}
                onClick={() =>
                  responseMutation.mutate({ confirm: false, note: disputeNote.trim() })
                }
              >
                Disputar resultado
              </Button>
            </div>
          </section>
        ) : null}

        {!official && state.canSubmit ? (
          <section className="rounded-2xl border border-border/70 bg-card/35 p-5 sm:p-6">
            <p className="eyebrow">
              {claim?.status === "dismissed"
                ? "Enviar un informe nuevo"
                : isReporter
                  ? "Actualizar resultado"
                  : "Informar resultado"}
            </p>
            <h2 className="mt-2 text-xl font-black text-foreground">
              Ingresá el marcador de la serie
            </h2>
            {claim?.status === "dismissed" && claim.resolutionNote ? (
              <p className="mt-2 rounded-md border border-border p-3 text-sm text-muted-foreground">
                Informe anterior descartado por la organización: {claim.resolutionNote}
              </p>
            ) : null}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="scoreA">{state.entryA?.name ?? "Participante A"}</Label>
                <Input
                  id="scoreA"
                  type="number"
                  min={0}
                  max={state.match.bestOf}
                  step={1}
                  value={scoreA}
                  onChange={(event) => setScoreA(event.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="scoreB">{state.entryB?.name ?? "Participante B"}</Label>
                <Input
                  id="scoreB"
                  type="number"
                  min={0}
                  max={state.match.bestOf}
                  step={1}
                  value={scoreB}
                  onChange={(event) => setScoreB(event.target.value)}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="mt-4">
              <Label htmlFor="evidence">Enlace de evidencia (opcional)</Label>
              <Input
                id="evidence"
                type="url"
                value={evidenceUrl}
                onChange={(event) => setEvidenceUrl(event.target.value)}
                placeholder="https://... screenshot or match evidence"
                className="mt-2"
                maxLength={500}
              />
            </div>

            <div className="mt-4">
              <Label htmlFor="reportNote">Nota del resultado (opcional)</Label>
              <Textarea
                id="reportNote"
                value={reportNote}
                onChange={(event) => setReportNote(event.target.value)}
                placeholder="Información que deba conocer la organización o el rival."
                className="mt-2 min-h-24"
                maxLength={1000}
              />
            </div>

            <Button
              className="mt-5"
              disabled={submitMutation.isPending || scoreA === "" || scoreB === ""}
              onClick={() => submitMutation.mutate()}
            >
              {submitMutation.isPending
                ? "Enviando…"
                : isReporter
                  ? "Actualizar resultado enviado"
                  : "Enviar resultado"}
            </Button>
          </section>
        ) : null}

        {state.isStaff && !state.myEntryId && !official ? (
          <section className="border-l-2 border-border pl-4 text-sm text-muted-foreground">
            La organización puede revisar esta partida acá. Usá la{" "}
            <Link to="/admin/disputes" className="font-semibold text-foreground hover:text-brand">
              lista de disputas de partidas
            </Link>{" "}
            para resolver resultados en disputa.
          </section>
        ) : null}
      </PageContainer>
    </div>
  );
}

function EntryCard({
  entry,
  score,
  mine,
  winner,
}: {
  entry: MatchEntrySummary | null;
  score?: number | null;
  mine: boolean;
  winner: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${mine ? "border-primary/35 bg-primary/[0.035]" : "border-border/70 bg-background/25"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={`truncate font-black ${winner ? "text-brand" : "text-foreground"}`}>
            {entry?.name ?? "A confirmar"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {mine ? <Badge variant="outline">Tu inscripción</Badge> : null}
            {winner ? <Badge>Ganador</Badge> : null}
          </div>
        </div>
        <span className="tabular text-3xl font-black text-foreground">{score ?? "–"}</span>
      </div>
    </div>
  );
}

function ClaimBadge({
  status,
}: {
  status: MatchResultState["claim"] extends infer _T ? string : never;
}) {
  const variant =
    status === "disputed"
      ? "destructive"
      : status === "confirmed" || status === "resolved"
        ? "default"
        : "outline";
  return <Badge variant={variant}>{statusLabel(status)}</Badge>;
}

function SubmittedEvidence({ claim }: { claim: NonNullable<MatchResultState["claim"]> }) {
  if (!claim.reporterNote && !claim.evidenceUrl && !claim.responderNote && !claim.resolutionNote)
    return null;
  return (
    <section className="rounded-2xl border border-border/70 bg-card/35 p-5">
      <p className="eyebrow">Registro del resultado</p>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
        {claim.reporterNote ? <p>Informante: {claim.reporterNote}</p> : null}
        {claim.responderNote ? <p>Rival: {claim.responderNote}</p> : null}
        {claim.resolutionNote ? <p>Staff: {claim.resolutionNote}</p> : null}
        {claim.evidenceUrl ? (
          <a
            href={claim.evidenceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-brand"
          >
            Abrir evidencia enviada <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>
    </section>
  );
}
