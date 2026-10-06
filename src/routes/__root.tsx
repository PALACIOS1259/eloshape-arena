import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  redirect,
  Scripts,
  useRouterState,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { absoluteSiteUrl, shouldNoIndexSite, siteOrigin } from "../lib/site-metadata";
import { PageShell } from "../components/layout/PageShell";
import { Toaster } from "../components/ui/sonner";
import { callBetaRpc, mayEnterDuringMaintenance, type BetaAccess } from "../lib/beta-access";

const socialImage = absoluteSiteUrl("/og-image.jpg") ?? "/og-image.jpg";
const maintenanceMode = import.meta.env["VITE_MAINTENANCE_MODE"] === "true";
const noIndexSite = shouldNoIndexSite(siteOrigin, maintenanceMode);
const maintenanceAllowedPaths = new Set([
  "/maintenance",
  "/auth",
  "/auth/reset-password",
  "/auth/discord",
  "/privacy",
  "/terms",
]);

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La página que buscás no existe o cambió de ubicación.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: ErrorComponentProps) {
  console.error(error);
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          No se pudo cargar esta página
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ocurrió un problema. Podés volver a intentar o regresar al inicio.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Volver a intentar
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Browser sessions live in local storage. Defer protected beta pages until
  // the browser can check access; server functions and the Data API still gate requests.
  ssr: ({ location }) => !maintenanceMode || maintenanceAllowedPaths.has(location.pathname),
  beforeLoad: async ({ location }) => {
    if (maintenanceMode && !maintenanceAllowedPaths.has(location.pathname)) {
      const { supabase } = await import("../integrations/supabase/client");
      const { data } = await supabase.auth.getSession();
      let access: BetaAccess | null = null;
      if (data.session) {
        try {
          access = await callBetaRpc<BetaAccess>(supabase, "get_beta_access");
        } catch {
          // Missing configuration or backend errors must never open the beta.
        }
      }
      if (!mayEnterDuringMaintenance(access)) {
        throw redirect({ to: "/maintenance", replace: true });
      }
    }
    return undefined;
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        title: maintenanceMode
          ? "EloShape — Próximamente"
          : "EloShape — Circuito competitivo de League of Legends",
      },
      {
        name: "description",
        content: maintenanceMode
          ? "EloShape está preparando su primera beta cerrada competitiva en Argentina."
          : "EloShape es una plataforma competitiva de League of Legends para jugadores amateur, con divisiones por nivel, torneos de ciudad a región y puntos obtenidos dentro del circuito.",
      },
      { name: "author", content: "EloShape" },
      ...(noIndexSite ? [{ name: "robots", content: "noindex, nofollow" }] : []),
      { property: "og:site_name", content: "EloShape" },
      {
        property: "og:title",
        content: maintenanceMode
          ? "EloShape — Próximamente"
          : "EloShape — Circuito competitivo de League of Legends",
      },
      {
        property: "og:description",
        content: maintenanceMode
          ? "Estamos preparando la primera beta cerrada de EloShape en Argentina."
          : "Divisiones por nivel, torneos regionales y clasificaciones transparentes.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: socialImage },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Circuito competitivo de EloShape" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: maintenanceMode
          ? "EloShape — Próximamente"
          : "EloShape — Circuito competitivo de League of Legends",
      },
      {
        name: "twitter:description",
        content: maintenanceMode
          ? "Estamos preparando la primera beta cerrada de EloShape en Argentina."
          : "No necesitás ser Challenger para competir.",
      },
      { name: "twitter:image", content: socialImage },
      { name: "twitter:image:alt", content: "Circuito competitivo de EloShape" },
    ],

    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "alternate icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es-AR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (maintenanceMode && maintenanceAllowedPaths.has(pathname)) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-background">
          <Outlet />
        </div>
        <Toaster />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PageShell>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </PageShell>
      <Toaster />
    </QueryClientProvider>
  );
}
