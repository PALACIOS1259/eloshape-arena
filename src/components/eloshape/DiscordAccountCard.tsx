import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Link2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { DISCORD_LINK_REQUEST, discordIdentity, discordLabel } from "@/lib/discord-link";

export function DiscordAccountCard({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["discord-identities", userId];
  const identities = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUserIdentities();
      if (error) throw error;
      return data.identities;
    },
    retry: false,
  });
  const linked = discordIdentity(identities.data ?? []);
  const connect = useMutation({
    mutationFn: async () => {
      const { data: current, error: userError } = await supabase.auth.getUser();
      if (userError || current.user?.id !== userId) throw new Error("La sesión cambió");
      sessionStorage.setItem(
        DISCORD_LINK_REQUEST,
        JSON.stringify({ userId, startedAt: Date.now() }),
      );
      try {
        const { data, error } = await supabase.auth.linkIdentity({
          provider: "discord",
          options: {
            redirectTo: `${window.location.origin}/auth/discord`,
            skipBrowserRedirect: true,
          },
        });
        if (error || !data.url) throw error ?? new Error("Falta la dirección de autorización");
        window.location.assign(data.url);
      } catch (error) {
        sessionStorage.removeItem(DISCORD_LINK_REQUEST);
        throw error;
      }
    },
    onError: () => toast.error("No pudimos iniciar la vinculación. Probá de nuevo más tarde."),
  });
  const disconnect = useMutation({
    mutationFn: async () => {
      // Refresh before unlinking; do not act on a stale identity or another session.
      const { data, error } = await supabase.auth.getUser();
      if (error || data.user?.id !== userId) throw new Error("La sesión cambió");
      const identity = discordIdentity(data.user.identities ?? []);
      if (!identity) return;
      const result = await supabase.auth.unlinkIdentity(identity);
      if (result.error) throw result.error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      toast.success("Discord desvinculado. El bot retirará Cuenta vinculada al sincronizar.");
    },
    onError: () => toast.error("No pudimos desvincular Discord. Probá de nuevo más tarde."),
  });

  return (
    <section className="border border-border/60 bg-card/20 p-5" aria-labelledby="discord-heading">
      <h2 id="discord-heading" className="flex items-center gap-2 text-lg font-black">
        <Link2 className="size-5 text-primary" aria-hidden="true" /> Discord
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {linked
          ? `Cuenta conectada: ${discordLabel(linked)}.`
          : "Conectá tu cuenta para identificarte en el servidor de EloShape."}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        El rol Cuenta vinculada se actualiza cuando el bot sincroniza y estás en el servidor. La
        aprobación para la beta y la elegibilidad competitiva se gestionan por separado.
      </p>
      {identities.error ? (
        <div className="mt-4 flex items-center gap-3 text-sm" role="status">
          No pudimos consultar tu cuenta.
          <Button
            variant="outline"
            size="sm"
            onClick={() => void identities.refetch()}
            disabled={identities.isFetching}
          >
            Reintentar
          </Button>
        </div>
      ) : (
        <Button
          className="mt-4"
          variant={linked ? "outline" : "default"}
          disabled={
            identities.isPending ||
            connect.isPending ||
            disconnect.isPending ||
            (Boolean(linked) && (identities.data?.length ?? 0) < 2)
          }
          onClick={() => (linked ? disconnect.mutate() : connect.mutate())}
        >
          {connect.isPending || disconnect.isPending
            ? "Procesando…"
            : linked
              ? "Desvincular Discord"
              : "Vincular Discord"}
        </Button>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Al vincular aceptás el uso de estos datos según nuestra{" "}
        <Link to="/privacy" className="underline underline-offset-4">
          política de privacidad
        </Link>
        .
      </p>
    </section>
  );
}
