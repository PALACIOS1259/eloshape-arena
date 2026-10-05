import { Link } from "@tanstack/react-router";
import { Instagram } from "lucide-react";

import { EloShapeLogo } from "@/components/brand/EloShapeLogo";
import { RIOT_LEGAL_NOTICE } from "@/lib/riot-legal";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border/70 bg-gradient-to-b from-card/20 to-background">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="min-w-0">
          <EloShapeLogo />
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            The competitive circuit for amateur League of Legends players. Skill-based divisions,
            city-to-region brackets, and a ranking that only counts EloShape results.
          </p>
          <a
            href="https://www.instagram.com/eloshape.circuito.lol/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex max-w-full items-center gap-2 rounded-sm text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            aria-label="Instagram: @eloshape.circuito.lol (opens in a new tab)"
          >
            <Instagram className="size-4 shrink-0" aria-hidden="true" />
            <span className="break-all">@eloshape.circuito.lol</span>
          </a>
        </div>

        <FooterColumn
          title="Compete"
          links={[
            { to: "/tournaments", label: "Tournaments" },
            { to: "/rankings", label: "Rankings" },
            { to: "/teams", label: "Teams" },
          ]}
        />
        <FooterColumn
          title="Platform"
          links={[
            { to: "/divisions", label: "Divisions & eligibility" },
            { to: "/rules", label: "Points & rules" },
            { to: "/auth", label: "Sign in" },
            { to: "/support", label: "Support & account requests" },
            { to: "/privacy", label: "Privacy Policy" },
            { to: "/terms", label: "Terms of Service" },
          ]}
        />
        <div>
          <p className="eyebrow">Fair play</p>
          <p className="mt-3 text-sm text-muted-foreground">
            Riot rank is used only to verify division eligibility. EloShape points are earned
            exclusively in EloShape tournaments.
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
