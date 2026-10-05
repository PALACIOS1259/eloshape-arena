import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/PageShell";
import { supabase } from "@/integrations/supabase/client";
import { DISCORD_LINK_REQUEST, discordIdentity, validDiscordLinkRequest } from "@/lib/discord-link";

export const Route = createFileRoute("/auth_/discord")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Vincular Discord — EloShape" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DiscordCallback,
});

async function finishDiscordLink() {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const request = sessionStorage.getItem(DISCORD_LINK_REQUEST);
  try {
    if (url.searchParams.has("error") || hash.has("error"))
      throw new Error("Authorization declined");
    // The existing browser client processes implicit OAuth tokens on initialization.
    // Support PKCE too if the client flow is changed in a future update.
    const code = url.searchParams.get("code");
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user || !validDiscordLinkRequest(request, data.user.id)) {
      throw new Error("Invalid linking session");
    }
    if (!discordIdentity(data.user.identities ?? [])) throw new Error("Discord not linked");
    return true;
  } finally {
    sessionStorage.removeItem(DISCORD_LINK_REQUEST);
    // Never retain OAuth credentials, codes or error details in the address bar.
    window.history.replaceState(null, "", "/auth/discord");
  }
}

function DiscordCallback() {
  const result = useQuery({
    queryKey: ["discord-link-callback"],
    queryFn: finishDiscordLink,
    retry: false,
    staleTime: Infinity,
  });
  return (
    <PageContainer className="max-w-xl space-y-4 py-16" aria-live="polite">
      <h1 className="text-2xl font-black">
        {result.isPending
          ? "Verificando Discord…"
          : result.error
            ? "No se completó la vinculación"
            : "Discord vinculado"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {result.isPending
          ? "Estamos comprobando tu cuenta."
          : result.error
            ? "Volvé a tu perfil y probá de nuevo. Si el problema continúa, contactá al staff."
            : "El bot actualizará Cuenta vinculada al sincronizar. Conectar Discord no aprueba el acceso a la beta."}
      </p>
      {!result.isPending && (
        <Button asChild>
          <Link to="/dashboard">Volver a mi perfil</Link>
        </Button>
      )}
    </PageContainer>
  );
}
