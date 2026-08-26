import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { TeamCard } from "@/components/eloshape/TeamCard";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { teamsQuery } from "@/lib/queries";

export const Route = createFileRoute("/teams/")({
  head: () => ({
    meta: [
      { title: "Teams — EloShape 5v5 rosters" },
      {
        name: "description",
        content:
          "Every EloShape team roster with division, record, championships and season points earned on the circuit.",
      },
      { property: "og:title", content: "EloShape teams" },
      { property: "og:description", content: "5v5 rosters competing on the EloShape circuit." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(teamsQuery());
  },
  component: TeamsPage,
});

function TeamsPage() {
  const { data: teams } = useSuspenseQuery(teamsQuery());

  return (
    <div>
      <PageHeading
        eyebrow="5v5"
        title="Teams"
        description="Teams compete in team-mode brackets. Team points are separate from individual player rankings."
        aside={
          <Button asChild>
            <Link to="/team">Create / manage team</Link>
          </Button>
        }
      />
      <PageContainer className="py-10">
        {teams.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
              <TeamCard key={team.slug} team={team} />
            ))}
          </div>
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
