import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin, Trophy, Users } from "lucide-react";

import { DivisionBadge, type DivisionLike } from "./DivisionBadge";
import { StatusBadge } from "./StatusBadge";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type TournamentCardData = {
  slug: string;
  name: string;
  subtitle?: string | null;
  status: string;
  mode: string;
  format?: string | null;
  prize?: string | null;
  starts_at: string | null;
  participants_count: number | null;
  max_participants: number | null;
  division?: DivisionLike;
  region?: { name?: string | null } | null;
};

export function TournamentCard({
  tournament,
  className,
}: {
  tournament: TournamentCardData;
  className?: string;
}) {
  const filled = tournament.participants_count ?? 0;
  const capacity = tournament.max_participants ?? 0;
  const pct = capacity ? Math.min(100, Math.round((filled / capacity) * 100)) : 0;

  return (
    <Link
      to="/tournaments/$slug"
      params={{ slug: tournament.slug }}
      className={cn(
        "bg-surface-gradient shadow-card group flex flex-col rounded-lg border border-border p-5 transition-colors hover:border-brand/50",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={tournament.status} />
        <DivisionBadge division={tournament.division ?? null} />
        <span className="eyebrow ml-auto">{tournament.mode === "team" ? "5v5 team" : "Solo"}</span>
      </div>

      <h3 className="mt-4 text-lg font-bold leading-snug text-foreground group-hover:text-brand">
        {tournament.name}
      </h3>
      {tournament.subtitle ? (
        <p className="mt-1 text-sm text-muted-foreground">{tournament.subtitle}</p>
      ) : null}

      <dl className="mt-4 grid gap-2 text-sm">
        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
          <CalendarDays className="size-4 shrink-0" />
          <span className="tabular truncate">{formatDateTime(tournament.starts_at)}</span>
        </div>
        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
          <MapPin className="size-4 shrink-0" />
          <span className="truncate">{tournament.region?.name ?? "Regional"}</span>
        </div>
        {tournament.prize ? (
          <div className="flex min-w-0 items-center gap-2 text-gold">
            <Trophy className="size-4 shrink-0" />
            <span className="truncate">{tournament.prize}</span>
          </div>
        ) : null}
      </dl>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" />
            <span className="tabular">
              {filled}/{capacity || "∞"} slots
            </span>
          </span>
          <span className="tabular">{pct}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="bg-brand-gradient h-full rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </Link>
  );
}
