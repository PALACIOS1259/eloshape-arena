import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, MapPin, Radio, Swords, Trophy, Users } from "lucide-react";

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
  registration_closes_at?: string | null;
  participants_count: number | null;
  max_participants: number | null;
  banner_url?: string | null;
  division?: DivisionLike;
  region?: { name?: string | null } | null;
};

function actionLabel(status: string) {
  if (status === "registration_open") return "Open registration";
  if (status === "registration_closed") return "View seeded field";
  if (status === "live") return "Follow live bracket";
  if (status === "completed") return "View results";
  return "Open tournament";
}

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
  const spotsLeft = capacity ? Math.max(0, capacity - filled) : null;
  const isLive = tournament.status === "live";

  return (
    <Link
      to="/tournaments/$slug"
      params={{ slug: tournament.slug }}
      className={cn(
        "group relative flex min-h-[21rem] flex-col overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card/92 via-card/72 to-background/55 shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-primary/35 hover:shadow-xl",
        className,
      )}
    >
      <div className="relative h-28 overflow-hidden">
        {tournament.banner_url ? (
          <img
            src={tournament.banner_url}
            alt=""
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
          />
        ) : (
          <div className="size-full bg-[radial-gradient(circle_at_20%_0%,hsl(var(--primary)/0.18),transparent_48%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)/0.25))]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
        <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={tournament.status} />
            <DivisionBadge division={tournament.division ?? null} />
          </div>
          <span
            className={cn(
              "grid size-8 place-items-center text-muted-foreground",
              isLive && "text-primary",
            )}
          >
            {isLive ? <Radio className="size-4" /> : <Swords className="size-4" />}
          </span>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          {tournament.mode === "team" ? "5v5 Team Tournament" : "Solo Tournament"}
        </p>
        <h3 className="mt-2 text-lg font-black leading-tight tracking-tight text-foreground transition-colors group-hover:text-primary">
          {tournament.name}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {tournament.subtitle ?? "Competitive EloShape event for the LAS circuit."}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-border/55 pt-4 text-xs">
          <Fact
            icon={<CalendarDays className="size-3.5" />}
            label={formatDateTime(tournament.starts_at)}
          />
          <Fact icon={<MapPin className="size-3.5" />} label={tournament.region?.name ?? "LAS"} />
          <Fact icon={<Swords className="size-3.5" />} label={tournament.format ?? "TBD"} />
          <Fact
            icon={<Users className="size-3.5" />}
            label={capacity ? `${filled}/${capacity} entries` : `${filled} entries`}
          />
        </div>

        {tournament.prize ? (
          <div className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-gold">
            <Trophy className="size-3.5" />
            <span className="truncate">{tournament.prize}</span>
          </div>
        ) : null}

        <div className="mt-auto pt-5">
          {capacity ? (
            <div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{spotsLeft === 0 ? "Field full" : `${spotsLeft} spots left`}</span>
                <span className="tabular-nums">{pct}%</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted/70">
                <div
                  className="bg-brand-gradient h-full rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4">
            <span
              className={cn(
                "text-xs font-black uppercase tracking-[0.08em] text-muted-foreground group-hover:text-primary",
                isLive && "text-primary",
              )}
            >
              {actionLabel(tournament.status)}
            </span>
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function Fact({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
      <span className="shrink-0 text-primary/80">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  );
}
