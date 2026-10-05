import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBetaInvitations, saveBetaInvitation, setClosedBetaEnabled } from "@/lib/beta.functions";
import type { BetaInvitation } from "@/lib/beta-access";

export function BetaAccessPanel() {
  const queryClient = useQueryClient();
  const load = useServerFn(getBetaInvitations);
  const save = useServerFn(saveBetaInvitation);
  const toggle = useServerFn(setClosedBetaEnabled);
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
  const busy = invitation.isPending || enabled.isPending;
  const maintenance = import.meta.env["VITE_MAINTENANCE_MODE"] === "true";

  return (
    <section lang="es" className="mb-8 rounded-xl border border-border bg-card p-5">
      <h2 className="text-lg font-bold">Lista de acceso a la beta</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Aprobá un correo antes de que cree su cuenta. Cuando confirme su correo y vincule Discord,
        el bot podrá asignarle Beta tester. No hace falta copiar su ID. Este acceso no otorga
        permisos de administración ni elegibilidad competitiva.
      </p>
      {isPending ? (
        <p className="mt-4 text-sm">Cargando invitaciones…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-destructive">No se pudo cargar la lista de acceso.</p>
      ) : data ? (
        <>
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
                      {!entry.active
                        ? "Revocada"
                        : entry.expires_at && Date.parse(entry.expires_at) <= Date.now()
                          ? "Vencida"
                          : "Activa"}
                    </td>
                    <td>
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
    </section>
  );
}
