import { Link } from "@tanstack/react-router";
import { ChevronRight, MapPin, ShieldCheck, Trophy } from "lucide-react";

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
  rank?: number | undefined;
}) {
  const games = team.wins + team.losses;
  const record = games ? `${team.wins}-${team.losses}` : "0-0";

  return (
    <Link
      to="/teams/$slug"
      params={{ slug: team.slug }}
      className={cn(
        "group relative flex min-h-72 flex-col overflow-hidden rounded-2xl border border-border bg-surface-gradient shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-primary/35 hover:shadow-xl",
        className,
      )}
    >
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-primary/10 to-transparent opacity-70" />
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent opacity-60" />

      <div className="relative p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-primary/20 bg-background/60 text-sm font-black text-primary shadow-sm ring-1 ring-inset ring-white/5">
              {team.logo_url ? (
                <img src={team.logo_url} alt={team.name} className="size-full object-cover" />
              ) : (
                (team.tag ?? initials(team.name)).slice(0, 6)
              )}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-lg font-black tracking-tight text-foreground transition-colors group-hover:text-primary">
                  {team.name}
                </h3>
                {rank ? (
                  <span className="shrink-0 rounded-full border border-border bg-background/70 px-2 py-0.5 text-[10px] font-black tabular-nums text-muted-foreground">
                    #{rank}
                  </span>
                ) : null}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {team.tag ? (
                  <span className="font-black tracking-wider text-foreground/80">[{team.tag}]</span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" />
                  {team.city?.name ?? "LAS"}
                </span>
              </div>
            </div>
          </div>
          <DivisionBadge division={team.division ?? null} className="shrink-0" />
        </div>

        <div className="mt-6 grid grid-cols-3 overflow-hidden rounded-xl border border-border/80 bg-background/35">
          <div className="p-3.5 text-center">
            <p className="text-lg font-black tabular-nums text-foreground">
              {formatPoints(team.points_season)}
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Points
            </p>
          </div>
          <div className="border-x border-border/70 p-3.5 text-center">
            <p className="text-lg font-black tabular-nums text-foreground">{record}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {winRate(team.wins, team.losses)} WR
            </p>
          </div>
          <div className="p-3.5 text-center">
            <p className="inline-flex items-center gap-1.5 text-lg font-black tabular-nums text-gold">
              <Trophy className="size-4" />
              {team.championships ?? 0}
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Titles
            </p>
          </div>
        </div>
      </div>

      <div className="mt-auto border-t border-border/70 bg-background/25 px-5 py-3.5 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" />
            Open roster profile
          </span>
          <ChevronRight className="size-4 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary" />
        </div>
      </div>
    </Link>
  );
}
