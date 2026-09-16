import { useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Search, Swords, Trophy, Users } from "lucide-react";

import { EmptyState } from "@/components/eloshape/EmptyState";
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

  return (
    <div>
      <PageHeading
        eyebrow="EloShape 5v5"
        title="Teams on the circuit"
        description="Explore active rosters, compare season performance and follow the teams building their path through EloShape competition."
        aside={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/team/players">Find players</Link>
            </Button>
            <Button asChild>
              <Link to="/team">My team</Link>
            </Button>
          </div>
        }
      />

      <PageContainer className="py-8 sm:py-10">
        {teams.length ? (
          <>
            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-surface-gradient p-4 sm:p-5">
                <span className="grid size-9 place-items-center rounded-lg border border-border bg-background/45 text-primary">
                  <Users className="size-4" />
                </span>
                <p className="mt-4 text-2xl font-black tabular-nums text-foreground">
                  {teams.length}
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Active teams
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface-gradient p-4 sm:p-5">
                <span className="grid size-9 place-items-center rounded-lg border border-border bg-background/45 text-primary">
                  <Swords className="size-4" />
                </span>
                <p className="mt-4 text-2xl font-black tabular-nums text-foreground">
                  {divisions.length}
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Divisions represented
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface-gradient p-4 sm:p-5">
                <span className="grid size-9 place-items-center rounded-lg border border-border bg-background/45 text-gold">
                  <Trophy className="size-4" />
                </span>
                <p className="mt-4 text-2xl font-black tabular-nums text-foreground">
                  {totalTitles}
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Championships
                </p>
              </div>
            </section>

            <section className="mt-6 rounded-xl border border-border bg-background/25 p-3 sm:p-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
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
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
                <span>
                  Showing {visibleTeams.length} of {teams.length} teams
                </span>
                <span>Team points are ranked separately from individual player points.</span>
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
