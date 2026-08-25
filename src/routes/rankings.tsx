import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { PlayerRow } from "@/components/eloshape/PlayerRow";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { directoryQuery, rankingsQuery } from "@/lib/queries";

type Search = { period?: "season" | "month"; division?: string; region?: string };
type SearchInput = { period?: "season" | "month"; division?: string; region?: string };

export const Route = createFileRoute("/rankings")({
  validateSearch: (search: SearchInput): Search => ({
    period: search.period ?? "season",
    division: search.division ?? "all",
    region: search.region ?? "all",
  }),
  head: () => ({
    meta: [
      { title: "Rankings — EloShape leaderboards by division and region" },
      {
        name: "description",
        content:
          "EloShape rankings for season and monthly periods, filtered by division and by region, country, province or city.",
      },
      { property: "og:title", content: "EloShape rankings" },
      {
        property: "og:description",
        content: "Season and monthly leaderboards across every division and geography.",
      },
    ],
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    context.queryClient.ensureQueryData(
      rankingsQuery({
        period: deps.period ?? "season",
        divisionCode: deps.division ?? "all",
        regionSlug: deps.region ?? "all",
      }),
    );
    context.queryClient.ensureQueryData(directoryQuery());
  },
  component: RankingsPage,
});

const KIND_LABEL: Record<string, string> = {
  region: "Region",
  country: "Country",
  province: "Province",
  city: "City",
};

function RankingsPage() {
  const raw = Route.useSearch();
  const search = {
    period: raw.period ?? ("season" as const),
    division: raw.division ?? "all",
    region: raw.region ?? "all",
  };
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: directory } = useSuspenseQuery(directoryQuery());
  const { data: players } = useSuspenseQuery(
    rankingsQuery({
      period: search.period,
      divisionCode: search.division,
      regionSlug: search.region,
    }),
  );

  const update = (patch: Partial<Search>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) });

  return (
    <div>
      <PageHeading
        eyebrow={directory.activeSeason?.name ?? "Season 1"}
        title="Rankings"
        description="Points are awarded exclusively for EloShape tournament results. Riot rank never adds points — it only decides which division you can enter."
      />

      <PageContainer className="py-10">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="eyebrow">Period</span>
            <Select
              value={search.period}
              onValueChange={(value) => update({ period: value as Search["period"] })}
            >
              <SelectTrigger className="mt-2 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="season">Season</SelectItem>
                <SelectItem value="month">This month</SelectItem>
              </SelectContent>
            </Select>
          </label>

          <label className="block">
            <span className="eyebrow">Division</span>
            <Select value={search.division} onValueChange={(division) => update({ division })}>
              <SelectTrigger className="mt-2 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All divisions</SelectItem>
                {directory.divisions.map((division) => (
                  <SelectItem key={division.code} value={division.code}>
                    {division.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="block">
            <span className="eyebrow">Geography</span>
            <Select value={search.region} onValueChange={(region) => update({ region })}>
              <SelectTrigger className="mt-2 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All of LAS</SelectItem>
                {directory.regions.map((region) => (
                  <SelectItem key={region.slug} value={region.slug}>
                    {KIND_LABEL[region.kind] ?? region.kind} · {region.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>

        <div className="mt-8">
          {players.length ? (
            <div className="bg-surface-gradient overflow-hidden rounded-lg border border-border">
              <div className="hidden grid-cols-[2.5rem_minmax(0,1fr)_7rem_5rem_4rem] gap-3 border-b border-border px-3 py-2.5 sm:grid">
                <span className="eyebrow">#</span>
                <span className="eyebrow">Player</span>
                <span className="eyebrow">Division</span>
                <span className="eyebrow">Record</span>
                <span className="eyebrow text-right">Points</span>
              </div>
              {players.map((player, index) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  rank={index + 1}
                  period={search.period}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No players in this ranking yet"
              description="Try a broader geography or division filter."
            />
          )}
        </div>
      </PageContainer>
    </div>
  );
}
