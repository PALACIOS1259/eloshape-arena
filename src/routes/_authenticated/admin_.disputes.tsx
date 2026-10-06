import { statusLabel } from "@/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, ShieldAlert } from "lucide-react";
import { useState } from "react";
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
  dismissStaffMatchDispute,
  getStaffMatchDisputes,
  resolveStaffMatchDispute,
  type StaffMatchDispute,
} from "@/lib/match-result.functions";

export const Route = createFileRoute("/_authenticated/admin_/disputes")({
  head: () => ({
    meta: [
      { title: "Disputas de partidas — Organización de EloShape" },
      { name: "description", content: "Revisión de resultados de torneos de EloShape en disputa." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MatchDisputesPage,
});

function MatchDisputesPage() {
  const fetchDisputes = useServerFn(getStaffMatchDisputes);
  const query = useQuery({
    queryKey: ["staff-match-disputes"],
    queryFn: () => fetchDisputes(),
    retry: false,
  });

  return (
    <div>
      <PageHeading
        eyebrow="Organización · Integridad competitiva"
        title="Disputas de partidas"
        description="Revisá los marcadores, las evidencias y los desacuerdos antes de que un resultado oficial haga avanzar el cuadro."
        aside={
          <Button asChild variant="outline">
            <Link to="/admin">Volver al panel de moderación</Link>
          </Button>
        }
      />
      <PageContainer className="py-7 sm:py-9">
        {query.isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        ) : query.error ? (
          <EmptyState
            title="Se requiere acceso de organización"
            description="Esta lista está limitada a cuentas de administración y moderación."
          />
        ) : !query.data?.length ? (
          <EmptyState
            title="No hay disputas pendientes"
            description="Las confirmaciones pendientes y los resultados en disputa aparecerán acá."
          />
        ) : (
          <div className="space-y-5">
            {query.data.map((claim) => (
              <DisputeCard key={claim.id} claim={claim} />
            ))}
          </div>
        )}
      </PageContainer>
    </div>
  );
}

function DisputeCard({ claim }: { claim: StaffMatchDispute }) {
  const queryClient = useQueryClient();
  const resolve = useServerFn(resolveStaffMatchDispute);
  const dismiss = useServerFn(dismissStaffMatchDispute);
  const [scoreA, setScoreA] = useState(String(claim.scoreA));
  const [scoreB, setScoreB] = useState(String(claim.scoreB));
  const [note, setNote] = useState("");

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["staff-match-disputes"] });
    void queryClient.invalidateQueries({ queryKey: ["match-result", claim.matchId] });
    void queryClient.invalidateQueries({ queryKey: ["tournament-detail"] });
  };

  const resolveMutation = useMutation({
    mutationFn: () =>
      resolve({
        data: {
          claimId: claim.id,
          scoreA: Number(scoreA),
          scoreB: Number(scoreB),
          note: note.trim(),
        },
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Resultado oficial aplicado y cuadro actualizado.");
      refresh();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo resolver la disputa.");
    },
  });

  const dismissMutation = useMutation({
    mutationFn: () => dismiss({ data: { claimId: claim.id, note: note.trim() } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Informe descartado. Los participantes pueden enviar un resultado nuevo.");
      refresh();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo descartar el informe.");
    },
  });

  const pending = resolveMutation.isPending || dismissMutation.isPending;

  return (
    <article className="border-y border-border/65 py-5 sm:py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={claim.status === "disputed" ? "destructive" : "outline"}>
              {statusLabel(claim.status)}
            </Badge>
            <span className="eyebrow">{claim.roundLabel}</span>
          </div>
          <Link
            to="/tournaments/$slug"
            params={{ slug: claim.tournament.slug }}
            className="mt-2 block text-lg font-black text-foreground hover:text-brand"
          >
            {claim.tournament.name}
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            {claim.entryA} vs {claim.entryB}
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/matches/$matchId" params={{ matchId: claim.matchId }}>
            Revisar partida
          </Link>
        </Button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="border-t border-border/60 pt-4">
          <p className="eyebrow">Resultado enviado</p>
          <p className="tabular mt-2 text-3xl font-black text-foreground">
            {claim.scoreA}–{claim.scoreB}
          </p>
          {claim.reporterNote ? (
            <p className="mt-3 text-sm text-muted-foreground">Informante: {claim.reporterNote}</p>
          ) : null}
          {claim.responderNote ? (
            <p className="mt-2 text-sm text-muted-foreground">Rival: {claim.responderNote}</p>
          ) : null}
          {claim.evidenceUrl ? (
            <a
              href={claim.evidenceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-foreground hover:text-brand"
            >
              Abrir evidencia <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </div>

        <div className="border-t border-border/60 pt-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-brand" />
            <p className="eyebrow">Resolución de la organización</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`score-a-${claim.id}`}>{claim.entryA}</Label>
              <Input
                id={`score-a-${claim.id}`}
                type="number"
                min={0}
                step={1}
                value={scoreA}
                onChange={(event) => setScoreA(event.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor={`score-b-${claim.id}`}>{claim.entryB}</Label>
              <Input
                id={`score-b-${claim.id}`}
                type="number"
                min={0}
                step={1}
                value={scoreB}
                onChange={(event) => setScoreB(event.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <div className="mt-4">
            <Label htmlFor={`resolution-${claim.id}`}>Nota de resolución</Label>
            <Textarea
              id={`resolution-${claim.id}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="¿Qué evidencia o regla determinó la resolución?"
              className="mt-2 min-h-24"
              maxLength={1000}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              disabled={pending || note.trim().length < 3 || scoreA === "" || scoreB === ""}
              onClick={() => {
                if (
                  !window.confirm(
                    `¿Aplicar ${scoreA}–${scoreB} como resultado oficial? Esto hace avanzar el cuadro.`,
                  )
                )
                  return;
                resolveMutation.mutate();
              }}
            >
              Aplicar resultado oficial
            </Button>
            <Button
              variant="outline"
              disabled={pending || note.trim().length < 3}
              onClick={() => {
                if (!window.confirm("¿Descartar este informe sin hacer avanzar el cuadro?")) return;
                dismissMutation.mutate();
              }}
            >
              Descartar informe
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
