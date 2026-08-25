import { Link } from "@tanstack/react-router";

import { EloShapeLogo } from "@/components/brand/EloShapeLogo";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border bg-surface/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="min-w-0">
          <EloShapeLogo />
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            The competitive circuit for amateur League of Legends players. Skill-based divisions,
            city-to-region brackets, and a ranking that only counts EloShape results.
          </p>
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

      <div className="border-t border-border px-4 py-5 text-center text-xs text-muted-foreground sm:px-6">
        EloShape is not endorsed by Riot Games and does not reflect the views of Riot Games or
        anyone officially involved in producing League of Legends.
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { to: string; label: string }[];
}) {
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
