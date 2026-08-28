import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { archiveMyTeam } from "@/lib/team-management.functions";
import { getMyTeamHub, type TeamHub } from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/team_/settings")({
  head: () => ({
    meta: [
      { title: "Team settings — EloShape" },
      { name: "description", content: "Manage irreversible EloShape team settings." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeamSettingsPage,
});

function TeamSettingsPage() {
  const fetchHub = useServerFn(getMyTeamHub);
  const query = useQuery({
    queryKey: ["my-team-hub"],
    queryFn: () => fetchHub(),
    retry: false,
  });

  return (
    <div>
      <PageHeading
        eyebrow="5v5 · Settings"
        title="Team settings"
        description="Manage high-impact team actions without deleting historical tournament records."
        aside={
          <Button asChild variant="outline">
            <Link to="/team">Back to My team</Link>
          </Button>
        }
      />
      <PageContainer className="py-10">
        {query.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : query.error || !query.data ? (
          <EmptyState title="Could not load team settings" />
        ) : !query.data.team ? (
          <EmptyState
            title="No active team"
            description="Create or join a team before opening team settings."
            action={
              <Button asChild>
                <Link to="/team">Open My team</Link>
              </Button>
            }
          />
        ) : (
          <Settings team={query.data.team} />
        )}
      </PageContainer>
    </div>
  );
}

function Settings({ team }: { team: NonNullable<TeamHub["team"]> }) {
  if (!team.isCaptain) {
    return (
      <EmptyState
        title="Captain access required"
        description="Only the current team captain can disband the team."
        action={
          <Button asChild variant="outline">
            <Link to="/team">Back to roster</Link>
          </Button>
        }
      />
    );
  }

  return <DangerZone team={team} />;
}

function DangerZone({ team }: { team: { name: string; tag: string; slug: string } }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const archive = useServerFn(archiveMyTeam);
  const [confirmation, setConfirmation] = useState("");
  const canArchive = confirmation.trim() === team.name;

  const mutation = useMutation({
    mutationFn: () => archive(),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Team disbanded. Historical tournament records were preserved.");
      void queryClient.invalidateQueries({ queryKey: ["my-team-hub"] });
      void queryClient.invalidateQueries({ queryKey: ["teams"] });
      void queryClient.invalidateQueries({ queryKey: ["team", team.slug] });
      void navigate({ to: "/team" });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not disband team.");
    },
  });

  return (
    <div className="max-w-3xl space-y-8">
      <section className="bg-surface-gradient rounded-lg border border-border p-6 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{team.tag}</Badge>
          <span className="font-black text-foreground">{team.name}</span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Disbanding releases every current member and cancels pending invitations. Registrations
          that have not gone live are withdrawn automatically. Historical tournament entries,
          locked rosters, results and ranking records remain intact.
        </p>
      </section>

      <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-6">
        <p className="eyebrow text-destructive">Danger zone</p>
        <h2 className="mt-2 text-xl font-black text-foreground">Disband team</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This action cannot be undone. It is blocked while the team is checked in to or competing
          in an active tournament. To confirm, type the exact team name below.
        </p>
        <Input
          className="mt-5 max-w-md"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder={team.name}
          autoComplete="off"
        />
        <Button
          className="mt-3"
          variant="destructive"
          disabled={!canArchive || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Disbanding…" : "Permanently disband team"}
        </Button>
      </section>
    </div>
  );
}
