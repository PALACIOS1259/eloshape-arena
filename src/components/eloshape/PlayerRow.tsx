import { Link } from "@tanstack/react-router";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { DivisionBadge, type DivisionLike } from "./DivisionBadge";
import { formatPoints, initials, riotRankLabel, winRate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type PlayerRowData = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url?: string | null | undefined;
  points_season: number;
  points_month: number;
  wins: number;
  losses: number;
  tournaments_played?: number | null;
  rank_movement?: number | null;
  riot_tier?: string | null;
  riot_rank?: string | null;
  division?: DivisionLike;
  city?: { name?: string | null } | null;
  country?: { name?: string | null } | null;
};

export function MovementIndicator({ value }: { value?: number | null }) {
  const movement = value ?? 0;
  if (movement > 0)
    return (
      <span className="tabular inline-flex items-center gap-1 text-xs text-success">
        <TrendingUp className="size-3.5" />
        {movement}
      </span>
    );
  if (movement < 0)
    return (
      <span className="tabular inline-flex items-center gap-1 text-xs text-destructive">
        <TrendingDown className="size-3.5" />
        {Math.abs(movement)}
      </span>
    );
  return (
    <span className="inline-flex items-center text-xs text-muted-foreground">
      <Minus className="size-3.5" />
    </span>
  );
}

export function PlayerAvatar({
  name,
  url,
  className,
}: {
  name: string;
  url?: string | null | undefined;
  className?: string | undefined;
}) {
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-surface-raised text-xs font-bold text-steel",
        className,
      )}
    >
      {url ? (
        <img src={url} alt={name} className="size-full object-cover" loading="lazy" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function PlayerRow({
  player,
  rank,
  period = "season",
}: {
  player: PlayerRowData;
  rank: number;
  period?: "season" | "month";
}) {
  const points = period === "month" ? player.points_month : player.points_season;

  return (
    <Link
      to="/players/$handle"
      params={{ handle: player.handle }}
      className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-3 py-3 transition-colors last:border-0 hover:bg-surface-raised sm:grid-cols-[2.5rem_minmax(0,1fr)_7rem_5rem_4rem]"
    >
      <span
        className={cn(
          "tabular text-sm font-black",
          rank === 1 ? "text-gold" : rank <= 3 ? "text-brand" : "text-muted-foreground",
        )}
      >
        {rank}
      </span>

      <span className="flex min-w-0 items-center gap-3">
        <PlayerAvatar name={player.display_name} url={player.avatar_url} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">
            {player.display_name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {riotRankLabel(player.riot_tier ?? null, player.riot_rank ?? null)} ·{" "}
            {player.city?.name ?? player.country?.name ?? "LAS"}
          </span>
        </span>
      </span>

      <span className="hidden sm:block">
        <DivisionBadge division={player.division ?? null} />
      </span>

      <span className="tabular hidden text-sm text-muted-foreground sm:block">
        {player.wins}W · {player.losses}L · {winRate(player.wins, player.losses)}
      </span>

      <span className="flex items-center justify-end gap-3">
        <MovementIndicator value={player.rank_movement} />
        <span className="tabular text-sm font-black text-foreground">{formatPoints(points)}</span>
      </span>
    </Link>
  );
}
