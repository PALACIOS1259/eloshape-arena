import { Link } from "@tanstack/react-router";
import { ChevronRight, MapPin, Trophy } from "lucide-react";

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

export function TeamCard({
  team,
  className,
  rank,
}: {
  team: TeamCardData;
  className?: string;
  rank?: number;
}) {
  return (
    <Link
      to="/teams/$slug"
      params={{ slug: team.slug }}
      className={cn(
        "bg-surface-gradient shadow-card group relative overflow-hidden rounded-xl border border-border p-5 transition-all hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-lg",
        className,
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-surface-raised text-sm font-black text-steel shadow-sm">
            {team.logo_url ? (
              <img src={team.logo_url} alt={team.name} className="size-full object-cover" />
            ) : (
              (team.tag ?? initials(team.name))
            )}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate font-black text-foreground transition-colors group-hover:text-brand">
                {team.name}
              </span>
              {rank ? (
                <span className="shrink-0 rounded-md border border-border bg-background/50 px-1.5 py-0.5 text-[10px] font-black tabular-nums text-muted-foreground">
                  #{rank}
                </span>
              ) : null}
            </span>
            <span className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              {team.city?.name ?? "LAS"}
              {team.tag ? ` · [${team.tag}]` : ""}
            </span>
          </span>
        </div>
        <DivisionBadge division={team.division ?? null} className="shrink-0" />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 rounded-lg border border-border/70 bg-background/25 p-3 text-center">
        <div>
          <p className="tabular text-base font-black text-foreground">
            {formatPoints(team.points_season)}
          </p>
          <p className="eyebrow mt-1">Season pts</p>
        </div>
        <div className="border-x border-border/70">
          <p className="tabular text-base font-black text-foreground">
            {team.wins}-{team.losses}
          </p>
          <p className="eyebrow mt-1">{winRate(team.wins, team.losses)} WR</p>
        </div>
        <div>
          <p className="tabular inline-flex items-center gap-1 text-base font-black text-gold">
            <Trophy className="size-3.5" />
            {team.championships ?? 0}
          </p>
          <p className="eyebrow mt-1">Titles</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs font-semibold text-muted-foreground">
        <span>View roster & tournament history</span>
        <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
      </div>
    </Link>
  );
}
