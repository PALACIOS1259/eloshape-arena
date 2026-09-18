import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  MapPin,
  Radio,
  Swords,
  Trophy,
  Users,
} from "lucide-react";

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
        "group relative flex min-h-[27rem] flex-col overflow-hidden rounded-2xl border border-border/80 bg-surface-gradient shadow-card transition-all duration-500 ease-out hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/5",
        className,
      )}
    >
      <div className="relative h-40 overflow-hidden border-b border-border/70">
        {tournament.banner_url ? (
          <img
            src={tournament.banner_url}
            alt=""
            className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.07]"
          />
        ) : (
          <div className="size-full bg-[radial-gradient(circle_at_20%_0%,hsl(var(--primary)/0.25),transparent_45%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)/0.45))]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <div className="absolute -right-12 -top-12 size-32 rounded-full bg-primary/15 blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <div className="absolute inset-x-5 top-4 flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={tournament.status} />
            <DivisionBadge division={tournament.division ?? null} />
          </div>
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-xl border border-border/80 bg-background/75 text-muted-foreground shadow-sm backdrop-blur",
              isLive && "border-primary/30 bg-primary/12 text-primary",
            )}
          >
            {isLive ? <Radio className="size-4" /> : <Swords className="size-4" />}
          </span>
        </div>

        <div className="absolute inset-x-5 bottom-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
            {tournament.mode === "team" ? "5v5 Team Tournament" : "Solo Tournament"}
          </p>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-primary/0 via-primary/45 to-primary/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <div>
          <h3 className="text-xl font-black leading-tight tracking-tight text-foreground transition-colors duration-300 group-hover:text-primary">
            {tournament.name}
          </h3>
          {tournament.subtitle ? (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {tournament.subtitle}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Competitive EloShape bracket for the LAS circuit.
            </p>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <TournamentFact
            icon={<CalendarDays className="size-3.5" />}
            label="Starts"
            value={formatDateTime(tournament.starts_at)}
          />
          <TournamentFact
            icon={<MapPin className="size-3.5" />}
            label="Region"
            value={tournament.region?.name ?? "LAS"}
          />
          <TournamentFact
            icon={<Swords className="size-3.5" />}
            label="Format"
            value={tournament.format ?? "TBD"}
          />
          <TournamentFact
            icon={<Users className="size-3.5" />}
            label="Field"
            value={capacity ? `${filled}/${capacity}` : `${filled} entries`}
          />
        </div>

        {tournament.prize ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-gold/25 bg-gold/8 px-3 py-2.5 text-sm font-semibold text-gold">
            <Trophy className="size-4 shrink-0" />
            <span className="truncate">{tournament.prize}</span>
          </div>
        ) : null}

        <div className="mt-auto pt-5">
          {capacity ? (
            <div>
              <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-3.5" />
                  {spotsLeft === 0
                    ? "Field full"
                    : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`}
                </span>
                <span className="tabular-nums">{pct}% filled</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="bg-brand-gradient h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ) : tournament.registration_closes_at ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock3 className="size-3.5" />
              Registration closes {formatDateTime(tournament.registration_closes_at)}
            </p>
          ) : null}

          <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-4">
            <span
              className={cn(
                "text-xs font-black uppercase tracking-[0.1em] text-muted-foreground transition-colors group-hover:text-primary",
                isLive && "text-primary",
              )}
            >
              {actionLabel(tournament.status)}
            </span>
            <ChevronRight className="size-4 text-muted-foreground transition-all duration-200 group-hover:translate-x-1 group-hover:text-primary" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function TournamentFact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/70 bg-background/25 p-3 transition-colors duration-300 group-hover:border-border">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {icon} {label}
      </p>
      <p className="mt-1.5 truncate text-xs font-black text-foreground">{value}</p>
    </div>
  );
}
