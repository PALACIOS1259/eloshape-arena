import { Link } from "@tanstack/react-router";
import { Instagram, MessageCircle } from "lucide-react";

import { EloShapeLogo } from "@/components/brand/EloShapeLogo";
import { RIOT_LEGAL_NOTICE } from "@/lib/riot-legal";
import { DISCORD_INVITE_URL, INSTAGRAM_URL } from "@/lib/social-links";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border/70 bg-gradient-to-b from-card/20 to-background">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="min-w-0">
          <EloShapeLogo />
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            El circuito competitivo para jugadores amateur de League of Legends. Divisiones por
            nivel, cuadros de ciudad a región y una clasificación que solo cuenta resultados de
            EloShape.
          </p>
          <div className="mt-5 flex flex-col items-start gap-3">
            <a
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-sm text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              aria-label="Unite al Discord de EloShape (abre en una pestaña nueva)"
            >
              <MessageCircle className="size-4 shrink-0" aria-hidden="true" />
              <span>Discord de EloShape</span>
            </a>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-2 rounded-sm text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              aria-label="Instagram: @eloshape.circuito.lol (abre en una pestaña nueva)"
            >
              <Instagram className="size-4 shrink-0" aria-hidden="true" />
              <span className="break-all">@eloshape.circuito.lol</span>
            </a>
          </div>
        </div>

        <FooterColumn
          title="Competir"
          links={[
            { to: "/tournaments", label: "Torneos" },
            { to: "/rankings", label: "Clasificaciones" },
            { to: "/teams", label: "Equipos" },
          ]}
        />
        <FooterColumn
          title="Plataforma"
          links={[
            { to: "/divisions", label: "Divisiones y elegibilidad" },
            { to: "/rules", label: "Puntos y reglas" },
            { to: "/auth", label: "Iniciar sesión" },
            { to: "/support", label: "Soporte y solicitudes de cuenta" },
            { to: "/privacy", label: "Política de privacidad" },
            { to: "/terms", label: "Términos de servicio" },
          ]}
        />
        <div>
          <p className="eyebrow">Juego limpio</p>
          <p className="mt-3 text-sm text-muted-foreground">
            El rango de Riot se usa únicamente para verificar la división. Los puntos de EloShape se
            obtienen exclusivamente en sus torneos.
          </p>
        </div>
      </div>

      <div className="border-t border-border/60 px-4 py-5 text-center text-xs text-muted-foreground sm:px-6">
        {RIOT_LEGAL_NOTICE}
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <p className="eyebrow">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
