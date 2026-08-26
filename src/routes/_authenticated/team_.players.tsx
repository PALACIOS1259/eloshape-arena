import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Search, UserPlus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { inviteMyTeamMember } from "@/lib/team.functions";
import { searchMyTeamCandidates, type TeamCandidate } from "@/lib/team-search.functions";

export const Route = createFileRoute("/_authenticated/team_/players")({
  head: () => ({
    meta: [
      { title: "Find players — EloShape" },
      { name: "description", content: "Find available EloShape players for your 5v5 roster." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeamPlayerFinderPage,
});

function TeamPlayerFinderPage() {
  const searchCandidates = useServerFn(searchMyTeamCandidates);
  const invite = useServerFn(inviteMyTeamMember);
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"player" | "substitute">("player");

  const candidates = useQuery({
    queryKey: ["team-candidates", query],
    queryFn: () => searchCandidates({ data: { query, limit: 20 } }),
    retry: false,
  });

  const inviteMutation = useMutation({
    mutationFn: (candidate: TeamCandidate) =>
      invite({ data: { handle: candidate.handle, role } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Invitation sent.");
      void queryClient.invalidateQueries({ queryKey: ["team-candidates"] });
      void queryClient.invalidateQueries({ queryKey: ["my-team-hub"] });
    },
    onError: () => toast.error("Could not invite that player."),
  });

  return (
    <div>
      <PageHeading
        eyebrow="Captain tools"
        title="Find players"
        description="Search free EloShape players before inviting them to your starting roster or substitute bench."
        aside={
          <Button asChild variant="outline">
            <Link to="/team">Back to my team</Link>
          </Button>
        }
      />

      <PageContainer className="py-10">
        <section className="bg-surface-gradient rounded-lg border border-border p-5 shadow-card">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_11rem_auto]">
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") setQuery(input.trim());
              }}
              placeholder="Search handle or display name"
            />
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as "player" | "substitute")}
              className="rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="player">Starter</option>
              <option value="substitute">Substitute</option>
            </select>
            <Button onClick={() => setQuery(input.trim())}>
              <Search className="mr-2 size-4" /> Search
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Starter-ready means eligible, Riot data verified, account level 30+, and the same EloShape division as your team.
          </p>
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Available players</p>
              <h2 className="mt-1 text-xl font-black text-foreground">
                {query ? `Results for “${query}”` : "Free agents"}
              </h2>
            </div>
            {candidates.data ? (
              <span className="text-sm text-muted-foreground">{candidates.data.length} found</span>
            ) : null}
          </div>

          {candidates.isPending ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
            </div>
          ) : candidates.error ? (
            <div className="mt-4 rounded-lg border border-border p-5 text-sm text-muted-foreground">
              Player search is available only to team captains.
            </div>
          ) : candidates.data?.length ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {candidates.data.map((candidate) => {
                const starterBlocked = role === "player" && !candidate.ready;
                return (
                  <article
                    key={candidate.profileId}
                    className="bg-surface-gradient rounded-lg border border-border p-5 shadow-card"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Link
                          to="/players/$handle"
                          params={{ handle: candidate.handle }}
                          className="truncate text-lg font-black text-foreground hover:text-brand"
                        >
                          {candidate.displayName}
                        </Link>
                        <p className="mt-1 text-sm text-muted-foreground">@{candidate.handle}</p>
                      </div>
                      <Badge variant={candidate.ready ? "default" : "outline"}>
                        {candidate.ready ? "Starter ready" : "Not starter ready"}
                      </Badge>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge variant="outline">{candidate.divisionName ?? "No division"}</Badge>
                      <Badge variant="outline">
                        {candidate.riotTier ?? "Unranked"} {candidate.riotRank ?? ""}
                      </Badge>
                      <Badge variant={candidate.riotVerified ? "default" : "outline"}>
                        {candidate.riotVerified ? "Riot verified" : "Riot missing"}
                      </Badge>
                      <Badge variant={candidate.eligibility === "eligible" ? "default" : "outline"}>
                        {candidate.eligibility.replace("_", " ")}
                      </Badge>
                    </div>

                    <p className="mt-3 text-sm text-muted-foreground">
                      {candidate.cityName ?? "Location not set"}
                      {candidate.accountLevel != null ? ` · account level ${candidate.accountLevel}` : " · level unknown"}
                    </p>

                    <Button
                      className="mt-4"
                      size="sm"
                      disabled={inviteMutation.isPending || starterBlocked}
                      onClick={() => inviteMutation.mutate(candidate)}
                    >
                      <UserPlus className="mr-2 size-4" />
                      {starterBlocked ? "Not eligible as starter" : `Invite as ${role === "player" ? "starter" : "substitute"}`}
                    </Button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
              No free EloShape players match this search yet.
            </div>
          )}
        </section>
      </PageContainer>
    </div>
  );
}
