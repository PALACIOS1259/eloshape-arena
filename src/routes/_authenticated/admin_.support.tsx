import { statusLabel, formatDateTime, supportCategoryLabel } from "@/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  getStaffSupportRequests,
  updateStaffSupportRequest,
  type StaffSupportRequest,
  type SupportStatus,
} from "@/lib/support.functions";

export const Route = createFileRoute("/_authenticated/admin_/support")({
  head: () => ({
    meta: [
      { title: "Solicitudes de soporte — Organización de EloShape" },
      {
        name: "description",
        content: "Revisá solicitudes de soporte, privacidad y eliminación de cuentas.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StaffSupportPage,
});

function StaffSupportPage() {
  const fetchRequests = useServerFn(getStaffSupportRequests);
  const query = useQuery({
    queryKey: ["staff-support-requests"],
    queryFn: () => fetchRequests(),
    retry: false,
  });

  const openCount = query.data?.filter((request) => request.status === "open").length ?? 0;
  const reviewCount = query.data?.filter((request) => request.status === "in_review").length ?? 0;

  return (
    <div>
      <PageHeading
        eyebrow="Organización · Soporte"
        title="Solicitudes de soporte"
        description="Revisá consultas, errores, solicitudes de privacidad y eliminación de cuentas. La eliminación se revisa para conservar o anonimizar el historial competitivo cuando corresponda."
        aside={
          <Button asChild variant="outline">
            <Link to="/admin">Volver al panel de moderación</Link>
          </Button>
        }
      />

      <PageContainer className="py-7 sm:py-9">
        {query.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : query.error || !query.data ? (
          <EmptyState
            title="Se requiere acceso de organización"
            description="Esta lista está limitada a cuentas de administración y moderación de EloShape."
          />
        ) : (
          <>
            <div className="mb-6 flex flex-wrap gap-2 border-b border-border/60 pb-4">
              <Badge variant="outline">{openCount} abiertas</Badge>
              <Badge variant="outline">{reviewCount} en revisión</Badge>
              <Badge variant="secondary">{query.data.length} total</Badge>
            </div>

            <div className="space-y-4">
              {query.data.length ? (
                query.data.map((request) => <SupportCard key={request.id} request={request} />)
              ) : (
                <EmptyState title="No hay solicitudes pendientes" />
              )}
            </div>
          </>
        )}
      </PageContainer>
    </div>
  );
}

function SupportCard({ request }: { request: StaffSupportRequest }) {
  const queryClient = useQueryClient();
  const update = useServerFn(updateStaffSupportRequest);
  const [response, setResponse] = useState(request.staffResponse ?? "");

  const mutation = useMutation({
    mutationFn: (status: SupportStatus) =>
      update({ data: { requestId: request.id, status, response } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Solicitud de soporte marcada como ${statusLabel(result.result.status)}.`);
      void queryClient.invalidateQueries({ queryKey: ["staff-support-requests"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "No se pudo actualizar la solicitud de soporte.",
      );
    },
  });

  const requester = request.profile
    ? `${request.profile.displayName} (@${request.profile.handle})`
    : "Cuenta sin perfil público vinculado";

  return (
    <article className="border-y border-border/65 py-5 sm:py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{supportCategoryLabel(request.category)}</Badge>
            <StatusBadge status={request.status} />
          </div>
          <h2 className="mt-3 text-lg font-black text-foreground">{request.subject}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {requester} · {formatDateTime(request.createdAt)}
          </p>
        </div>
        {request.profile ? (
          <Button asChild size="sm" variant="outline">
            <Link to="/players/$handle" params={{ handle: request.profile.handle }}>
              Perfil del jugador
            </Link>
          </Button>
        ) : null}
      </div>

      <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{request.message}</p>

      <div className="mt-5">
        <p className="eyebrow">Respuesta visible para el jugador</p>
        <Textarea
          className="mt-2"
          rows={4}
          maxLength={2000}
          value={response}
          onChange={(event) => setResponse(event.target.value)}
          placeholder="Agregá una respuesta o una nota de resolución."
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("in_review")}
        >
          Marcar en revisión
        </Button>
        <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate("resolved")}>
          Resolver
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("closed")}
        >
          Cerrar
        </Button>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: SupportStatus }) {
  return (
    <Badge variant={status === "resolved" || status === "closed" ? "secondary" : "outline"}>
      {statusLabel(status)}
    </Badge>
  );
}
