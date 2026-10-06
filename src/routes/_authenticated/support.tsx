import { formatDateTime, statusLabel } from "@/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
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
  getMySupportRequests,
  submitMySupportRequest,
  type SupportCategory,
  type SupportStatus,
} from "@/lib/support.functions";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: "Soporte — EloShape" },
      {
        name: "description",
        content:
          "Contactá al soporte de EloShape, informá un error, consultá sobre privacidad o solicitá la eliminación de tu cuenta.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SupportPage,
});

const categoryOptions: { value: SupportCategory; label: string }[] = [
  { value: "support", label: "Soporte general" },
  { value: "bug", label: "Informar un error" },
  { value: "privacy", label: "Solicitud de privacidad" },
  { value: "account_deletion", label: "Eliminación de cuenta" },
];

function SupportPage() {
  const queryClient = useQueryClient();
  const fetchRequests = useServerFn(getMySupportRequests);
  const submit = useServerFn(submitMySupportRequest);
  const [category, setCategory] = useState<SupportCategory>("support");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const query = useQuery({
    queryKey: ["my-support-requests"],
    queryFn: () => fetchRequests(),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: () => submit({ data: { category, subject, message } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Solicitud de soporte enviada.");
      setSubject("");
      setMessage("");
      void queryClient.invalidateQueries({ queryKey: ["my-support-requests"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "No se pudo enviar la solicitud de soporte.",
      );
    },
  });

  return (
    <div>
      <PageHeading
        eyebrow="Ayuda · Privacidad"
        title="Soporte de EloShape"
        description="Pedí ayuda, informá un error o enviá una solicitud de privacidad o eliminación de tu cuenta. La solicitud queda asociada a tu cuenta para que la organización pueda responderte."
      />

      <PageContainer className="grid gap-8 py-7 sm:py-9 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="border-y border-border/65 py-5 sm:py-6">
          <p className="eyebrow">Nueva solicitud</p>
          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="support-category">Categoría</Label>
              <select
                id="support-category"
                value={category}
                onChange={(event) => setCategory(event.target.value as SupportCategory)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="support-subject">Asunto</Label>
              <Input
                id="support-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                maxLength={120}
                placeholder={
                  category === "account_deletion"
                    ? "Eliminar mi cuenta de EloShape"
                    : "¿Cómo podemos ayudarte?"
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="support-message">Mensaje</Label>
              <Textarea
                id="support-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={4000}
                rows={7}
                placeholder={
                  category === "account_deletion"
                    ? "Confirmá que querés solicitar a la organización la revisión de la eliminación de tu cuenta y tus datos personales. Los registros competitivos pueden conservarse o anonimizarse cuando sea necesario para mantener la integridad de los torneos."
                    : "Incluí información suficiente para que la organización pueda reproducir o entender el problema."
                }
              />
              <p className="text-xs text-muted-foreground">{message.length}/4000 caracteres</p>
            </div>

            {category === "account_deletion" ? (
              <div className="border-l-2 border-destructive/35 pl-4 text-sm text-muted-foreground">
                Enviar esta solicitud no elimina de inmediato el historial de torneos. La
                organización revisará el pedido y quitará o anonimizará los datos personales,
                conservando los registros necesarios para la integridad competitiva o las
                obligaciones legales.
              </div>
            ) : null}

            <Button
              onClick={() => mutation.mutate()}
              disabled={
                mutation.isPending || subject.trim().length < 3 || message.trim().length < 10
              }
            >
              {mutation.isPending ? "Enviando…" : "Enviar solicitud"}
            </Button>
          </div>
        </section>

        <section>
          <p className="eyebrow">Tus solicitudes</p>
          <div className="mt-3 space-y-3">
            {query.isPending ? (
              <>
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </>
            ) : query.error ? (
              <EmptyState title="No se pudieron cargar tus solicitudes de soporte" />
            ) : !query.data?.length ? (
              <EmptyState
                title="Todavía no hay solicitudes de soporte"
                description="Tus solicitudes aparecerán acá con su estado actual."
              />
            ) : (
              query.data.map((request) => (
                <article key={request.id} className="border-y border-border/65 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="eyebrow">{categoryLabel(request.category)}</p>
                      <h2 className="mt-1 font-black text-foreground">{request.subject}</h2>
                    </div>
                    <SupportStatusBadge status={request.status} />
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                    {request.message}
                  </p>
                  {request.staffResponse ? (
                    <div className="mt-4 border-l-2 border-primary/25 pl-4">
                      <p className="eyebrow">Respuesta de la organización</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {request.staffResponse}
                      </p>
                    </div>
                  ) : null}
                  <p className="mt-4 text-xs text-muted-foreground">
                    Enviado {formatDateTime(request.createdAt)}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
      </PageContainer>
    </div>
  );
}

function categoryLabel(category: SupportCategory) {
  return categoryOptions.find((option) => option.value === category)?.label ?? category;
}

function SupportStatusBadge({ status }: { status: SupportStatus }) {
  const label = statusLabel(status);
  return (
    <Badge variant={status === "resolved" || status === "closed" ? "secondary" : "outline"}>
      {label}
    </Badge>
  );
}
