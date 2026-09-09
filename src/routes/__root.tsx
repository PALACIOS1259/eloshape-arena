import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  redirect,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { PageShell } from "../components/layout/PageShell";
import { Toaster } from "../components/ui/sonner";

function parseSiteOrigin(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;

  try {
    const url = new URL(value.trim());
    const isWebUrl = url.protocol === "https:" || url.protocol === "http:";
    const isOriginOnly =
      url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password;

    return isWebUrl && isOriginOnly ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

const siteUrl = parseSiteOrigin(import.meta.env["VITE_SITE_URL"]);
const socialImage = siteUrl ? `${siteUrl}/og-image.jpg` : "/og-image.jpg";
const maintenanceMode = import.meta.env["VITE_MAINTENANCE_MODE"] === "true";
const maintenanceAllowedPaths = new Set(["/maintenance", "/privacy", "/terms"]);

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: { error: Error; reset: () => void }) {
  console.error(error);
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: ({ location }) => {
    if (maintenanceMode && !maintenanceAllowedPaths.has(location.pathname)) {
      throw redirect({ to: "/maintenance", replace: true });
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        title: maintenanceMode
          ? "EloShape — Próximamente"
          : "EloShape — Competitive League of Legends circuit",
      },
      {
        name: "description",
        content: maintenanceMode
          ? "EloShape está preparando su primera beta cerrada competitiva en Argentina."
          : "EloShape is a competitive League of Legends platform for amateur players: skill-based divisions, city-to-region tournaments and rankings earned only on the circuit.",
      },
      { name: "author", content: "EloShape" },
      ...(maintenanceMode ? [{ name: "robots", content: "noindex, nofollow" }] : []),
      { property: "og:site_name", content: "EloShape" },
      {
        property: "og:title",
        content: maintenanceMode
          ? "EloShape — Próximamente"
          : "EloShape — Competitive League of Legends circuit",
      },
      {
        property: "og:description",
        content: maintenanceMode
          ? "Estamos preparando la primera beta cerrada de EloShape en Argentina."
          : "Skill-based divisions, city-to-region tournaments and honest rankings.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: socialImage },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "EloShape competitive circuit" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: maintenanceMode
          ? "EloShape — Próximamente"
          : "EloShape — Competitive League of Legends circuit",
      },
      {
        name: "twitter:description",
        content: maintenanceMode
          ? "Estamos preparando la primera beta cerrada de EloShape en Argentina."
          : "No necesitás ser Challenger para competir.",
      },
      { name: "twitter:image", content: socialImage },
      { name: "twitter:image:alt", content: "EloShape competitive circuit" },
    ],

    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
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

  if (maintenanceMode) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-background">
          <Outlet />
        </div>
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
