import { Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";

import { DivisionBadge, type DivisionLike } from "./DivisionBadge";
import { formatPoints, initials, winRate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type TeamCardData = {
  slug: string;
  name: string;
  tag?: string | null;
  logo_url?: string | null;
  wins: number;
  losses: number;
  championships?: number | null;
  points_season: number;
  division?: DivisionLike;
  city?: { name?: string | null } | null;
};

export function TeamCard({ team, className }: { team: TeamCardData; className?: string }) {
  return (
    <Link
      to="/teams/$slug"
      params={{ slug: team.slug }}
      className={cn(
        "bg-surface-gradient shadow-card group rounded-lg border border-border p-5 transition-colors hover:border-brand/50",
        className,
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-md border border-border bg-surface-raised text-sm font-black text-steel">
            {team.logo_url ? (
              <img src={team.logo_url} alt={team.name} className="size-full rounded-md object-cover" />
            ) : (
              (team.tag ?? initials(team.name))
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-bold text-foreground group-hover:text-brand">
              {team.name}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {team.tag ? `[${team.tag}] · ` : ""}
              {team.city?.name ?? "LAS"}
            </span>
          </span>
        </div>
        <DivisionBadge division={team.division ?? null} className="shrink-0" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
        <div>
          <p className="tabular text-sm font-black text-foreground">{formatPoints(team.points_season)}</p>
          <p className="eyebrow mt-1">Points</p>
        </div>
        <div>
          <p className="tabular text-sm font-black text-foreground">
            {team.wins}-{team.losses}
          </p>
          <p className="eyebrow mt-1">{winRate(team.wins, team.losses)} WR</p>
        </div>
        <div>
          <p className="tabular inline-flex items-center gap-1 text-sm font-black text-gold">
            <Trophy className="size-3.5" />
            {team.championships ?? 0}
          </p>
          <p className="eyebrow mt-1">Titles</p>
        </div>
      </div>
    </Link>
  );
}
