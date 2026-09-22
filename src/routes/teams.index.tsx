import { useMemo, useState, type ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { BarChart3, Search, SlidersHorizontal, Swords, Trophy, Users } from "lucide-react";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { ScrimBoard } from "@/components/eloshape/ScrimBoard";
import { TeamCard } from "@/components/eloshape/TeamCard";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { teamsQuery } from "@/lib/queries";
import { canonicalMetadata } from "@/lib/site-metadata";

export const Route = createFileRoute("/teams/")({
  head: () => {
    const canonical = canonicalMetadata("/teams");
    return {
      meta: [
        { title: "Teams — EloShape 5v5 rosters" },
        {
          name: "description",
          content:
            "Every EloShape team roster with division, record, championships and season points earned on the circuit.",
        },
        { property: "og:title", content: "EloShape teams" },
        { property: "og:description", content: "5v5 rosters competing on the EloShape circuit." },
        ...canonical.meta,
      ],
      links: canonical.links,
    };
  },
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(teamsQuery());
  },
  component: TeamsPage,
});

type SortMode = "points" | "record" | "titles" | "name";

function TeamsPage() {
  const { data: teams } = useSuspenseQuery(teamsQuery());
  const [search, setSearch] = useState("");
  const [division, setDivision] = useState("all");
  const [sort, setSort] = useState<SortMode>("points");
  const [view, setView] = useState<"directory" | "scrims">("directory");

  const divisions = useMemo(
    () =>
      Array.from(
        new Set(
          teams.map((team) => team.division?.name).filter((name): name is string => Boolean(name)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [teams],
  );

  const standingsRank = useMemo(
    () =>
      new Map(
        [...teams]
          .sort((a, b) => b.points_season - a.points_season)
          .map((team, index) => [team.slug, index + 1]),
      ),
    [teams],
  );

  const visibleTeams = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const result = teams.filter((team) => {
      const matchesSearch =
        !needle ||
        team.name.toLowerCase().includes(needle) ||
        team.tag?.toLowerCase().includes(needle) ||
        team.city?.name?.toLowerCase().includes(needle);
      const matchesDivision = division === "all" || team.division?.name === division;
      return matchesSearch && matchesDivision;
    });

    return [...result].sort((a, b) => {
      if (sort === "record") {
        const aRate = a.wins + a.losses ? a.wins / (a.wins + a.losses) : 0;
        const bRate = b.wins + b.losses ? b.wins / (b.wins + b.losses) : 0;
        return bRate - aRate || b.wins - a.wins;
      }
      if (sort === "titles") return (b.championships ?? 0) - (a.championships ?? 0);
      if (sort === "name") return a.name.localeCompare(b.name);
      return b.points_season - a.points_season;
    });
  }, [division, search, sort, teams]);

  const totalTitles = teams.reduce((total, team) => total + (team.championships ?? 0), 0);
  const totalGames = teams.reduce((total, team) => total + team.wins + team.losses, 0);
  const filtersActive = Boolean(search.trim()) || division !== "all" || sort !== "points";

  return (
    <div>
      <PageHeading
        eyebrow="EloShape 5v5"
        title="Teams & practice"
        description="Discover active rosters, compare official performance and find practice matches without affecting the competitive circuit."
        aside={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/team/players">Find players</Link>
            </Button>
            <Button asChild>
              <Link to="/team">Open Team HQ</Link>
            </Button>
          </div>
        }
      />

      <PageContainer className="py-8 sm:py-10">
        <div className="mb-6 grid gap-2 rounded-2xl border border-border bg-surface-gradient p-2 shadow-card sm:grid-cols-2">
          <Button
            type="button"
            variant={view === "directory" ? "default" : "ghost"}
            className="h-auto justify-start rounded-xl px-4 py-3 text-left"
            onClick={() => setView("directory")}
          >
            <span>
              <span className="block font-black">Team directory</span>
              <span className="mt-0.5 block text-[11px] font-medium opacity-70">
                Official records, points and rosters
              </span>
            </span>
          </Button>
          <Button
            type="button"
            variant={view === "scrims" ? "default" : "ghost"}
            className="h-auto justify-start rounded-xl px-4 py-3 text-left"
            onClick={() => setView("scrims")}
          >
            <span>
              <span className="block font-black">Scrim finder</span>
              <span className="mt-0.5 block text-[11px] font-medium opacity-70">
                Practice matches · no circuit points
              </span>
            </span>
          </Button>
        </div>

        {view === "scrims" ? (
          <ScrimBoard />
        ) : teams.length ? (
          <>
            <section className="relative overflow-hidden rounded-2xl border border-border bg-surface-gradient p-5 shadow-card sm:p-6">
              <div className="absolute right-0 top-0 size-64 translate-x-20 -translate-y-24 rounded-full bg-primary/10 blur-3xl" />
              <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div>
                  <p className="eyebrow">Competitive landscape</p>
                  <h2 className="mt-2 max-w-2xl text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                    Every roster. One circuit.
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Search by team, tag or city. Filter by division and sort by the metric that
                    matters to you.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <CircuitStat
                    icon={<Users className="size-4" />}
                    label="Teams"
                    value={String(teams.length)}
                  />
                  <CircuitStat
                    icon={<Swords className="size-4" />}
                    label="Divisions"
                    value={String(divisions.length)}
                  />
                  <CircuitStat
                    icon={<BarChart3 className="size-4" />}
                    label="Games"
                    value={String(totalGames)}
                  />
                  <CircuitStat
                    icon={<Trophy className="size-4" />}
                    label="Titles"
                    value={String(totalTitles)}
                  />
                </div>
              </div>
            </section>

            <section className="mt-5 overflow-hidden rounded-2xl border border-border bg-background/25 shadow-card">
              <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3 text-xs font-semibold text-muted-foreground">
                <SlidersHorizontal className="size-4" />
                Explore teams
              </div>
              <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_12rem_12rem_auto]">
                <label className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="pl-9"
                    placeholder="Search team, tag or city"
                    aria-label="Search teams"
                  />
                </label>
                <select
                  value={division}
                  onChange={(event) => setDivision(event.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  aria-label="Filter by division"
                >
                  <option value="all">All divisions</option>
                  {divisions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortMode)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  aria-label="Sort teams"
                >
                  <option value="points">Season points</option>
                  <option value="record">Win rate</option>
                  <option value="titles">Championships</option>
                  <option value="name">Team name</option>
                </select>
                <Button
                  variant="outline"
                  disabled={!filtersActive}
                  onClick={() => {
                    setSearch("");
                    setDivision("all");
                    setSort("points");
                  }}
                >
                  Reset
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">
                <span>
                  Showing <strong className="text-foreground">{visibleTeams.length}</strong> of{" "}
                  {teams.length} teams
                </span>
                <span>Team points are separate from individual player rankings.</span>
              </div>
            </section>

            {visibleTeams.length ? (
              <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visibleTeams.map((team) => (
                  <TeamCard key={team.slug} team={team} rank={standingsRank.get(team.slug)} />
                ))}
              </section>
            ) : (
              <div className="mt-6">
                <EmptyState
                  title="No teams match these filters"
                  description="Try another team name, city or division."
                  action={
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearch("");
                        setDivision("all");
                        setSort("points");
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              </div>
            )}
          </>
        ) : (
          <EmptyState
            title="No teams registered yet"
            description="Create the first 5v5 roster and invite players by their EloShape handle."
            action={
              <Button asChild>
                <Link to="/team">Create a team</Link>
              </Button>
            }
          />
        )}
      </PageContainer>
    </div>
  );
}

function CircuitStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-24 rounded-xl border border-border bg-background/45 p-3">
      <div className="flex items-center gap-2 text-primary">{icon}</div>
      <p className="mt-2 text-xl font-black tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
