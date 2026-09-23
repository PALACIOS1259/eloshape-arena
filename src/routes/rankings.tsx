import type { ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SlidersHorizontal, Trophy, Users } from "lucide-react";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { PlayerRow } from "@/components/eloshape/PlayerRow";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { directoryQuery, rankingsQuery } from "@/lib/queries";
import { canonicalMetadata } from "@/lib/site-metadata";

type Search = { period?: "season" | "month"; division?: string; region?: string };
type SearchInput = { period?: "season" | "month"; division?: string; region?: string };

export const Route = createFileRoute("/rankings")({
  validateSearch: (search: SearchInput): Search => search,
  head: () => {
    const canonical = canonicalMetadata("/rankings");
    return {
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
        ...canonical.meta,
      ],
      links: canonical.links,
    };
  },
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

  const filtersActive =
    search.period !== "season" || search.division !== "all" || search.region !== "all";

  return (
    <div>
      <PageHeading
        eyebrow={directory.activeSeason?.name ?? "Season 1"}
        title="Rankings"
        description="Tournament performance builds your EloShape ranking. Riot rank only decides which division you are eligible to enter."
        aside={
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" />
              <strong className="font-black text-foreground">{players.length}</strong> ranked
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Trophy className="size-3.5 text-gold" />
              official points only
            </span>
          </div>
        }
      />

      <PageContainer className="py-7 sm:py-9">
        <section className="rounded-2xl border border-border/80 bg-gradient-to-br from-card/90 to-background/60 p-4 shadow-card sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Leaderboard filters</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Narrow the table by period, division and geography.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={!filtersActive}
              onClick={() => update({ period: "season", division: "all", region: "all" })}
            >
              <SlidersHorizontal className="size-4" />
              Reset
            </Button>
          </div>

          <div className="mt-4 grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-3">
            <Filter label="Period">
              <Select
                value={search.period}
                onValueChange={(value) => update({ period: value as "season" | "month" })}
              >
                <SelectTrigger className="mt-2 w-full border-border/80 bg-background/45">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="season">Season</SelectItem>
                  <SelectItem value="month">This month</SelectItem>
                </SelectContent>
              </Select>
            </Filter>

            <Filter label="Division">
              <Select value={search.division} onValueChange={(division) => update({ division })}>
                <SelectTrigger className="mt-2 w-full border-border/80 bg-background/45">
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
            </Filter>

            <Filter label="Geography">
              <Select value={search.region} onValueChange={(region) => update({ region })}>
                <SelectTrigger className="mt-2 w-full border-border/80 bg-background/45">
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
            </Filter>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">
                {search.period === "month" ? "Monthly table" : "Season table"}
              </p>
              <h2 className="mt-1 text-xl font-black text-foreground sm:text-2xl">Leaderboard</h2>
            </div>
            <p className="text-xs text-muted-foreground">{players.length} players</p>
          </div>

          {players.length ? (
            <div className="overflow-hidden rounded-2xl border border-border/75 bg-card/45">
              <div className="hidden grid-cols-[2.5rem_minmax(0,1fr)_7rem_6rem_5rem] gap-3 border-b border-border/60 bg-background/25 px-4 py-2.5 sm:grid">
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
        </section>
      </PageContainer>
    </div>
  );
}

function Filter({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  );
}
