import type { ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarDays, FilterX, Radio, Users } from "lucide-react";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { TournamentCard } from "@/components/eloshape/TournamentCard";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
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
      <PageHeading
        eyebrow="EloShape circuit"
        title="Tournaments"
        description="Find an event, enter the right division and follow every official bracket from registration through final standings."
        aside={
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <Metric icon={<Radio className="size-3.5" />} value={liveCount} label="live" accent />
            <Metric icon={<CalendarDays className="size-3.5" />} value={openCount} label="open" />
            <Metric icon={<Users className="size-3.5" />} value={teamCount} label="5v5" />
          </div>
        }
      />

      <PageContainer className="py-7 sm:py-9">
        <section className="sticky top-16 z-20 rounded-2xl border border-border/80 bg-background/85 shadow-card backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
          <div className="flex flex-col gap-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Tournament finder</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Filter official EloShape events by stage, division and mode.
                </p>
              </div>
              {activeFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => update({ status: "all", division: "all", mode: "all" })}
                >
                  <FilterX className="size-4" />
                  Reset
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {tournaments.length} visible events
                </span>
              )}
            </div>

            <div className="h-px bg-border/60" />

            <div className="flex gap-2 overflow-x-auto pb-1">
              {STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => update({ status })}
                  className={cn(
                    "shrink-0 rounded-lg border px-3 py-2 text-xs font-black transition-colors",
                    search.status === status
                      ? "border-primary/35 bg-primary/10 text-primary"
                      : "border-border/70 bg-background/30 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {status === "all"
                    ? "All events"
                    : (TOURNAMENT_STATUS_LABEL[status] ?? status.replaceAll("_", " "))}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
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

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Tournament board</p>
              <h2 className="mt-1 text-xl font-black text-foreground sm:text-2xl">
                {search.status === "live"
                  ? "Live brackets"
                  : search.status === "registration_open"
                    ? "Open for registration"
                    : search.status === "completed"
                      ? "Tournament archive"
                      : "Circuit events"}
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              <strong className="font-black text-foreground">{tournaments.length}</strong>{" "}
              {tournaments.length === 1 ? "event" : "events"}
            </p>
          </div>

          {tournaments.length ? (
            <div className="mt-5 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
              {tournaments.map((tournament) => (
                <TournamentCard key={tournament.slug} tournament={tournament} className="h-full" />
              ))}
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                title="No tournaments match these filters"
                description="Try another division, mode or tournament state."
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
        </section>
      </PageContainer>
    </div>
  );
}

function Metric({
  icon,
  value,
  label,
  accent = false,
}: {
  icon: ReactNode;
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={accent ? "text-primary" : "text-muted-foreground"}>{icon}</span>
      <strong className={cn("font-black tabular-nums text-foreground", accent && "text-primary")}>
        {value}
      </strong>
      <span className="uppercase tracking-[0.09em]">{label}</span>
    </span>
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
    <label className="block">
      <span className="eyebrow">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-2 w-full border-border/80 bg-background/45">
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
