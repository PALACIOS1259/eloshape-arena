import { Link } from "@tanstack/react-router";
import { ChevronRight, Crown, MapPin, Trophy } from "lucide-react";

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
  const podium = Boolean(rank && rank <= 3);

  return (
    <Link
      to="/teams/$slug"
      params={{ slug: team.slug }}
      aria-label={`Open ${team.name} roster`}
      className={cn(
        "group relative flex min-h-60 flex-col overflow-hidden rounded-2xl border border-border/75 bg-gradient-to-br from-card/95 via-card/80 to-background/70 p-5 shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-primary/35 hover:shadow-xl sm:p-6",
        podium && "border-gold/20",
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-20 size-48 rounded-full bg-primary/[0.055] blur-3xl transition-opacity group-hover:bg-primary/[0.09]" />
      {podium ? (
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
      ) : null}

      <div className="relative flex items-start gap-4">
        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-primary/20 bg-background/55 text-sm font-black text-primary ring-1 ring-inset ring-white/5">
          {team.logo_url ? (
            <img src={team.logo_url} alt="" className="size-full object-cover" />
          ) : (
            (team.tag ?? initials(team.name)).slice(0, 6)
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-lg font-black tracking-tight text-foreground transition-colors group-hover:text-primary">
              {team.name}
            </h3>
            {rank === 1 ? <Crown className="size-4 shrink-0 text-gold" /> : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {team.tag ? <span className="font-black text-foreground/80">[{team.tag}]</span> : null}
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {team.city?.name ?? "LAS"}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {rank ? (
            <span
              className={cn(
                "text-xs font-black tabular-nums text-muted-foreground",
                podium && "text-gold",
              )}
            >
              #{rank}
            </span>
          ) : null}
          <DivisionBadge division={team.division ?? null} className="scale-90 origin-right" />
        </div>
      </div>

      <div className="relative mt-7 grid grid-cols-3 divide-x divide-border/60">
        <Stat value={formatPoints(team.points_season)} label="Points" />
        <Stat value={record} label={`${winRate(team.wins, team.losses)} WR`} />
        <Stat
          value={String(team.championships ?? 0)}
          label="Titles"
          icon={<Trophy className="size-3.5" />}
          gold
        />
      </div>

      <div className="relative mt-auto flex items-center justify-between pt-7 text-[11px] font-semibold text-muted-foreground">
        <span>{games ? `${games} official games` : "No official games yet"}</span>
        <ChevronRight className="size-4 transition-all group-hover:translate-x-1 group-hover:text-primary" />
      </div>
    </Link>
  );
}

function Stat({
  value,
  label,
  icon,
  gold = false,
}: {
  value: string;
  label: string;
  icon?: React.ReactNode;
  gold?: boolean;
}) {
  return (
    <div className="px-3 first:pl-0 last:pr-0">
      <p
        className={cn(
          "flex items-center gap-1.5 text-lg font-black tabular-nums text-foreground",
          gold && "text-gold",
        )}
      >
        {icon}
        {value}
      </p>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
