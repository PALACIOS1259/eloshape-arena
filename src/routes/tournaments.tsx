import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { TournamentCard } from "@/components/eloshape/TournamentCard";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { directoryQuery, tournamentsQuery } from "@/lib/queries";
import { TOURNAMENT_STATUS_LABEL } from "@/lib/format";

type Search = { status: string; division: string; mode: string };

export const Route = createFileRoute("/tournaments")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    status: typeof search["status"] === "string" ? search["status"] : "all",
    division: typeof search["division"] === "string" ? search["division"] : "all",
    mode: typeof search["mode"] === "string" ? search["mode"] : "all",
  }),
  head: () => ({
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
    ],
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    context.queryClient.ensureQueryData(
      tournamentsQuery({ status: deps.status, divisionCode: deps.division, mode: deps.mode }),
    );
    context.queryClient.ensureQueryData(directoryQuery());
  },
  component: TournamentsPage,
});

const STATUSES = ["all", "registration_open", "registration_closed", "live", "completed"];

function TournamentsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: directory } = useSuspenseQuery(directoryQuery());
  const { data: tournaments } = useSuspenseQuery(
    tournamentsQuery({ status: search.status, divisionCode: search.division, mode: search.mode }),
  );

  const update = (patch: Partial<Search>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) });

  return (
    <div>
      <PageHeading
        eyebrow="Circuit"
        title="Tournaments"
        description="City, provincial, national and regional brackets. Register inside your division and earn EloShape points by placing."
      />

      <PageContainer className="py-10">
        <div className="grid gap-3 sm:grid-cols-3">
          <Filter
            label="Status"
            value={search.status}
            onChange={(status) => update({ status })}
            options={STATUSES.map((value) => ({
              value,
              label: value === "all" ? "All statuses" : (TOURNAMENT_STATUS_LABEL[value] ?? value),
            }))}
          />
          <Filter
            label="Division"
            value={search.division}
            onChange={(division) => update({ division })}
            options={[
              { value: "all", label: "All divisions" },
              ...directory.divisions.map((d) => ({ value: d.code, label: d.name })),
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

        <div className="mt-8">
          {tournaments.length ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tournaments.map((tournament) => (
                <TournamentCard key={tournament.slug} tournament={tournament} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No tournaments match these filters"
              description="Try widening the division or status filter — new brackets are published every week."
            />
          )}
        </div>
      </PageContainer>
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
    <label className="block">
      <span className="eyebrow">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-2 w-full">
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
