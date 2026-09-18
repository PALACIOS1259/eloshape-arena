import type { ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  CalendarDays,
  FilterX,
  Radio,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
} from "lucide-react";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { TournamentCard } from "@/components/eloshape/TournamentCard";
import { PageContainer } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TOURNAMENT_STATUS_LABEL } from "@/lib/format";
import { directoryQuery, tournamentsQuery } from "@/lib/queries";
import { canonicalMetadata } from "@/lib/site-metadata";
import { cn } from "@/lib/utils";

type Search = { status?: string; division?: string; mode?: string };
type SearchInput = { status?: string; division?: string; mode?: string };

export const Route = createFileRoute("/tournaments/")({
  validateSearch: (search: SearchInput): Search => search,
  head: () => {
    const canonical = canonicalMetadata("/tournaments");
    return {
      meta: [
        { title: "Tournaments — EloShape competitive circuit" },
        {
          name: "description",
          content:
            "Browse open, live and completed EloShape League of Legends tournaments by division, format and region.",
        },
        { property: "og:title", content: "EloShape tournaments" },
        {
          property: "og:description",
          content: "Open registrations, live brackets and completed events across the LAS circuit.",
        },
        ...canonical.meta,
      ],
      links: canonical.links,
    };
  },
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    context.queryClient.ensureQueryData(
      tournamentsQuery({
        status: deps.status ?? "all",
        divisionCode: deps.division ?? "all",
        mode: deps.mode ?? "all",
      }),
    );
    context.queryClient.ensureQueryData(directoryQuery());
  },
  component: TournamentsPage,
});

const STATUSES = ["all", "registration_open", "registration_closed", "live", "completed"];

function TournamentsPage() {
  const raw = Route.useSearch();
  const search = {
    status: raw.status ?? "all",
    division: raw.division ?? "all",
    mode: raw.mode ?? "all",
  };
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: directory } = useSuspenseQuery(directoryQuery());
  const { data: tournaments } = useSuspenseQuery(
    tournamentsQuery({ status: search.status, divisionCode: search.division, mode: search.mode }),
  );

  const update = (patch: Partial<Search>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) });

  const activeFilters = [search.status, search.division, search.mode].filter(
    (value) => value !== "all",
  ).length;
  const liveCount = tournaments.filter((tournament) => tournament.status === "live").length;
  const openCount = tournaments.filter(
    (tournament) => tournament.status === "registration_open",
  ).length;
  const teamCount = tournaments.filter((tournament) => tournament.mode === "team").length;

  return (
    <div>
      <section className="bg-hero relative overflow-hidden border-b border-border">
        <div className="absolute left-[15%] top-0 size-80 -translate-y-1/2 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute right-[8%] top-10 size-56 rounded-full bg-gold/8 blur-3xl" />
        <PageContainer className="relative py-10 sm:py-14">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_25rem] xl:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">EloShape circuit</Badge>
                <Badge variant="secondary">League of Legends</Badge>
                <Badge variant="outline">LAS</Badge>
              </div>
              <p className="eyebrow mt-5">Competitive events</p>
              <h1 className="mt-2 max-w-4xl text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                Find your next tournament.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Register with your division, follow live brackets and build your EloShape record
                through official circuit events.
              </p>

              <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-primary" />
                  Server-validated eligibility
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Swords className="size-3.5 text-primary" />
                  Structured brackets
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Trophy className="size-3.5 text-gold" />
                  EloShape circuit points
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <HeroMetric
                icon={<Activity className="size-4" />}
                label="Visible events"
                value={String(tournaments.length)}
              />
              <HeroMetric
                icon={<Radio className="size-4" />}
                label="Live now"
                value={String(liveCount)}
                emphasized={liveCount > 0}
              />
              <HeroMetric
                icon={<CalendarDays className="size-4" />}
                label="Registration"
                value={String(openCount)}
              />
              <HeroMetric
                icon={<Users className="size-4" />}
                label="5v5 events"
                value={String(teamCount)}
              />
            </div>
          </div>
        </PageContainer>
      </section>

      <PageContainer className="py-8 sm:py-10">
        <section className="overflow-hidden rounded-2xl border border-border bg-surface-gradient shadow-card">
          <div className="border-b border-border px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Tournament finder</p>
                <h2 className="mt-1 text-lg font-black text-foreground">Browse the circuit</h2>
              </div>
              {activeFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => update({ status: "all", division: "all", mode: "all" })}
                >
                  <FilterX className="size-4" />
                  Reset {activeFilters} {activeFilters === 1 ? "filter" : "filters"}
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Showing the full circuit</span>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => update({ status })}
                  className={cn(
                    "shrink-0 rounded-xl border px-3.5 py-2 text-xs font-black transition-all",
                    search.status === status
                      ? "border-primary/35 bg-primary/12 text-primary shadow-sm"
                      : "border-border bg-background/25 text-muted-foreground hover:border-primary/25 hover:text-foreground",
                  )}
                >
                  {status === "all"
                    ? "All events"
                    : (TOURNAMENT_STATUS_LABEL[status] ?? status.replaceAll("_", " "))}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Filter
                label="Division"
                value={search.division}
                onChange={(division) => update({ division })}
                options={[
                  { value: "all", label: "All divisions" },
                  ...directory.divisions.map((division) => ({
                    value: division.code,
                    label: division.name,
                  })),
                ]}
              />
              <Filter
                label="Mode"
                value={search.mode}
                onChange={(mode) => update({ mode })}
                options={[
                  { value: "all", label: "Solo & team" },
                  { value: "solo", label: "Solo" },
                  { value: "team", label: "Team 5v5" },
                ]}
              />
            </div>
          </div>
        </section>

        <section className="mt-9">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Tournament board</p>
              <h2 className="mt-1 text-2xl font-black text-foreground">
                {search.status === "live"
                  ? "Live brackets"
                  : search.status === "registration_open"
                    ? "Open for registration"
                    : search.status === "completed"
                      ? "Tournament archive"
                      : "Circuit events"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {tournaments.length} {tournaments.length === 1 ? "event" : "events"} match your
                current filters.
              </p>
            </div>
            {liveCount > 0 ? (
              <div className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/8 px-3 py-2 text-xs font-bold text-primary">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
                {liveCount} live {liveCount === 1 ? "event" : "events"}
              </div>
            ) : null}
          </div>

          <div className="mt-5">
            {tournaments.length ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {tournaments.map((tournament) => (
                  <TournamentCard key={tournament.slug} tournament={tournament} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-surface-gradient p-4 shadow-card sm:p-8">
                <EmptyState
                  title="No tournaments match these filters"
                  description="Try another division, mode or tournament state. New events appear here as soon as they are published."
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => update({ status: "all", division: "all", mode: "all" })}
                    >
                      Clear filters
                    </Button>
                  }
                />
              </div>
            )}
          </div>
        </section>
      </PageContainer>
    </div>
  );
}

function HeroMetric({
  icon,
  label,
  value,
  emphasized = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-background/35 p-4",
        emphasized && "border-primary/30 bg-primary/8",
      )}
    >
      <div className={cn("text-muted-foreground", emphasized && "text-primary")}>{icon}</div>
      <p className="mt-3 text-2xl font-black tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function Filter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block rounded-xl border border-border bg-background/25 p-3">
      <span className="eyebrow">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-2 w-full border-border/80 bg-background/60">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
