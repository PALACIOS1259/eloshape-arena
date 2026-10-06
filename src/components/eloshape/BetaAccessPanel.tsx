import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  confirmBetaEmail,
  getBetaInfrastructure,
  getBetaInvitations,
  saveBetaInvitation,
  setClosedBetaEnabled,
} from "@/lib/beta.functions";
import type { BetaInvitation } from "@/lib/beta-access";

export function BetaAccessPanel() {
  const queryClient = useQueryClient();
  const load = useServerFn(getBetaInvitations);
  const save = useServerFn(saveBetaInvitation);
  const toggle = useServerFn(setClosedBetaEnabled);
  const confirmEmail = useServerFn(confirmBetaEmail);
  const checkInfrastructure = useServerFn(getBetaInfrastructure);
  const [confirming, setConfirming] = useState<BetaInvitation | null>(null);
  const [email, setEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const { data, isPending, error } = useQuery({
    queryKey: ["beta-invitations"],
    queryFn: () => load(),
    retry: false,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["beta-invitations"] });
    toast.success("Acceso beta actualizado.");
  };
  const infrastructure = useQuery({
    queryKey: ["beta-infrastructure"],
    queryFn: () => checkInfrastructure(),
    enabled: !!data,
    retry: false,
    staleTime: 60_000,
  });
  const invitation = useMutation({
    mutationFn: (entry: BetaInvitation) =>
      save({
        data: {
          email: entry.email,
          active: entry.active,
          discordId: entry.discord_id ?? "",
          expiresAt: entry.expires_at,
        },
      }),
    onSuccess: refresh,
    onError: () => toast.error("No se pudo guardar la invitación. Revisá los datos y permisos."),
  });
  const enabled = useMutation({
    mutationFn: (value: boolean) => toggle({ data: { enabled: value } }),
    onSuccess: refresh,
    onError: () => toast.error("No se pudo cambiar el acceso a la beta."),
  });
  const confirmation = useMutation({
    mutationFn: (entry: BetaInvitation) => confirmEmail({ data: { email: entry.email } }),
    onSuccess: (result) => {
      setConfirming(null);
      void queryClient.invalidateQueries({ queryKey: ["beta-invitations"] });
      toast.success("Correo confirmado. La persona ya puede iniciar sesión.");
      if (result.auditPending)
        toast.warning(
          "La confirmación quedó registrada como solicitud; revisá el historial de auditoría.",
        );
    },
    onError: () =>
      toast.error(
        "No se pudo confirmar. Actualizá la lista y comprobá que la invitación siga activa.",
      ),
  });
  const busy = invitation.isPending || enabled.isPending || confirmation.isPending;
  const maintenance = import.meta.env["VITE_MAINTENANCE_MODE"] === "true";

  return (
    <section lang="es" className="mb-8 rounded-xl border border-border bg-card p-5">
      <h2 className="text-lg font-bold">Lista de acceso a la beta</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Aprobá un correo antes de que cree su cuenta. Cuando confirme su correo y vincule Discord,
        el bot podrá asignarle Beta tester. No hace falta copiar su ID. Este acceso no otorga
        permisos de administración ni elegibilidad competitiva.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Guardar una invitación autoriza el acceso; compartí el enlace de registro con esa persona.
        La confirmación habitual llega por correo. Si necesita ayuda, podés confirmar una cuenta
        invitada después de comprobar su identidad por otro medio.
      </p>
      {isPending ? (
        <p className="mt-4 text-sm">Cargando invitaciones…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-destructive">No se pudo cargar la lista de acceso.</p>
      ) : data ? (
        <>
          <div className="mt-4 rounded-lg border border-border p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <strong>Conexión con Discord</strong>
              <Button
                size="sm"
                variant="outline"
                disabled={infrastructure.isFetching}
                onClick={() => void infrastructure.refetch()}
              >
                Actualizar estado
              </Button>
            </div>
            <p className="mt-2">
              Vinculación:{" "}
              {infrastructure.data?.discordOAuth === true
                ? "Activada"
                : infrastructure.data?.discordOAuth === false
                  ? "Desactivada en Supabase"
                  : "Sin comprobar"}
              .
            </p>
            <p className="mt-1">
              Servicios de roles:{" "}
              {infrastructure.data?.linkedSnapshot === "protected" &&
              infrastructure.data?.betaSnapshot === "protected"
                ? "Disponibles y protegidos"
                : "Pendientes de comprobar"}
              .
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Esta comprobación no confirma que el bot esté encendido ni que tenga permisos para
              gestionar roles. Completá una prueba con un invitado antes de abrir el acceso.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="text-sm">
              Acceso por invitación: <strong>{data.enabled ? "Activo" : "Desactivado"}</strong>
            </p>
            <Button
              variant="outline"
              disabled={busy || (!data.enabled && !maintenance)}
              onClick={() => enabled.mutate(!data.enabled)}
            >
              {data.enabled ? "Desactivar beta cerrada" : "Activar beta cerrada"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {maintenance
              ? "El público sigue viendo Próximamente. Al activar la beta, solo ingresan invitados y staff."
              : "Configurá el despliegue en mantenimiento antes de activar la beta cerrada."}{" "}
            Desactivar esta restricción devuelve las API a sus permisos normales.
          </p>
          <form
            className="mt-5 grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              invitation.mutate(
                {
                  email,
                  discord_id: null,
                  active: true,
                  expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
                },
                {
                  onSuccess: () => {
                    setEmail("");
                    setExpiresAt("");
                  },
                },
              );
            }}
          >
            <div>
              <Label htmlFor="beta-email">Correo invitado</Label>
              <Input
                id="beta-email"
                type="email"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="beta-expiry">Vencimiento (opcional)</Label>
              <Input
                id="beta-expiry"
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                className="mt-2"
              />
            </div>
            <Button type="submit" disabled={busy}>
              Guardar invitación
            </Button>
          </form>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-3">Correo</th>
                  <th className="pr-3">Discord</th>
                  <th className="pr-3">Cuenta</th>
                  <th className="pr-3">Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {data.invitations.map((entry) => (
                  <tr key={entry.email} className="border-b border-border/50">
                    <td className="py-3 pr-3">{entry.email}</td>
                    <td className="pr-3">{entry.discord_id ?? "Pendiente"}</td>
                    <td className="pr-3">
                      {!entry.user_id
                        ? "Sin registrar"
                        : entry.email_confirmed_at
                          ? "Correo confirmado"
                          : "Correo pendiente"}
                    </td>
                    <td className="pr-3">
                      {!entry.active
                        ? "Revocada"
                        : entry.expires_at && Date.parse(entry.expires_at) <= Date.now()
                          ? "Vencida"
                          : "Activa"}
                    </td>
                    <td>
                      {entry.user_id &&
                      !entry.email_confirmed_at &&
                      entry.active &&
                      (!entry.expires_at || Date.parse(entry.expires_at) > Date.now()) ? (
                        <Button
                          size="sm"
                          className="mr-2 mb-2"
                          disabled={busy}
                          onClick={() => setConfirming(entry)}
                        >
                          Confirmar correo
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => invitation.mutate({ ...entry, active: !entry.active })}
                      >
                        {entry.active ? "Revocar" : "Reactivar"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.invitations.length ? (
              <p className="mt-3 text-sm text-muted-foreground">Todavía no hay invitados.</p>
            ) : null}
          </div>
        </>
      ) : null}
      <AlertDialog
        open={!!confirming}
        onOpenChange={(open) => {
          if (!open && !confirmation.isPending) setConfirming(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cuenta invitada</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a confirmar {confirming?.email} sin que abra el enlace del correo. Continuá solo
              si comprobaste que la cuenta corresponde a la persona invitada. Esta acción queda
              registrada y no vincula Discord ni concede otros roles.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (confirming) confirmation.mutate(confirming);
              }}
            >
              {confirmation.isPending ? "Confirmando…" : "Confirmé la identidad: aprobar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
