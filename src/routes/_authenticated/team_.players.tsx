import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, CircleAlert, Search, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { TeamWorkspaceNav } from "@/components/eloshape/TeamWorkspaceNav";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyTeamHub, inviteMyTeamMember } from "@/lib/team.functions";
import { searchMyTeamCandidates, type TeamCandidate } from "@/lib/team-search.functions";

export const Route = createFileRoute("/_authenticated/team_/players")({
  head: () => ({
    meta: [
      { title: "Find players — EloShape" },
      {
        name: "description",
        content: "Recruit available EloShape players for your 5v5 roster.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeamPlayerFinderPage,
});

function TeamPlayerFinderPage() {
  const fetchHub = useServerFn(getMyTeamHub);
  const searchCandidates = useServerFn(searchMyTeamCandidates);
  const invite = useServerFn(inviteMyTeamMember);
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"player" | "substitute">("player");

  const hub = useQuery({
    queryKey: ["my-team-hub"],
    queryFn: () => fetchHub(),
    retry: false,
  });

  const candidates = useQuery({
    queryKey: ["team-candidates", query],
    queryFn: () => searchCandidates({ data: { query, limit: 30 } }),
    retry: false,
    enabled: Boolean(hub.data?.team?.isCaptain),
  });

  const inviteMutation = useMutation({
    mutationFn: (candidate: TeamCandidate) => invite({ data: { handle: candidate.handle, role } }),
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

  const runSearch = () => setQuery(input.trim());

  return (
    <div>
      <PageHeading
        eyebrow="Team recruiting"
        title="Find players"
        description="Search the EloShape free-agent pool, check competitive readiness and invite players directly into your roster."
        aside={
          <Button asChild variant="outline">
            <Link to="/team">Back to Team HQ</Link>
          </Button>
        }
      />

      <PageContainer className="py-8 sm:py-10">
        {hub.isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
        ) : hub.error || !hub.data ? (
          <EmptyState title="Could not load your team" />
        ) : (
          <div className="space-y-6">
            <TeamWorkspaceNav
              active="players"
              hasTeam={Boolean(hub.data.team)}
              isCaptain={Boolean(hub.data.team?.isCaptain)}
            />

            {!hub.data.team ? (
              <EmptyState
                title="Create a team before recruiting"
                description="The player finder is a captain workspace. Create your roster first, then come back here to recruit."
                action={
                  <Button asChild>
                    <Link to="/team">Create a team</Link>
                  </Button>
                }
              />
            ) : !hub.data.team.isCaptain ? (
              <EmptyState
                title="Captain access required"
                description="Only the current team captain can send roster invitations."
                action={
                  <Button asChild variant="outline">
                    <Link to="/team">Back to Team HQ</Link>
                  </Button>
                }
              />
            ) : (
              <RecruitingWorkspace
                team={hub.data.team}
                input={input}
                setInput={setInput}
                query={query}
                role={role}
                setRole={setRole}
                runSearch={runSearch}
                candidates={candidates}
                inviteMutation={inviteMutation}
              />
            )}
          </div>
        )}
      </PageContainer>
    </div>
  );
}

function RecruitingWorkspace({
  team,
  input,
  setInput,
  query,
  role,
  setRole,
  runSearch,
  candidates,
  inviteMutation,
}: {
  team: NonNullable<Awaited<ReturnType<ReturnType<typeof useServerFn<typeof getMyTeamHub>>>>>["team"];
  input: string;
  setInput: (value: string) => void;
  query: string;
  role: "player" | "substitute";
  setRole: (value: "player" | "substitute") => void;
  runSearch: () => void;
  candidates: ReturnType<typeof useQuery<TeamCandidate[]>>;
  inviteMutation: ReturnType<typeof useMutation<unknown, Error, TeamCandidate>>;
}) {
  const starters = team.members.filter((member) => member.role !== "substitute");
  const substitutes = team.members.filter((member) => member.role === "substitute");
  const remainingStarterSlots = Math.max(0, 5 - starters.length);

  return (
    <>
      <section className="bg-surface-gradient rounded-xl border border-border p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">[{team.tag}]</Badge>
              <p className="font-black text-foreground">Recruiting for {team.name}</p>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Search by EloShape handle or display name. Starter invites are blocked when the player
              does not currently satisfy the roster readiness checks.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <RecruitingStat label="Starters" value={`${starters.length}/5`} />
            <RecruitingStat label="Open slots" value={String(remainingStarterSlots)} />
            <RecruitingStat label="Bench" value={String(substitutes.length)} />
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_11rem_auto]">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") runSearch();
              }}
              className="pl-9"
              placeholder="Search handle or display name"
              aria-label="Search free agents"
            />
          </label>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as "player" | "substitute")}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Invitation roster status"
          >
            <option value="player">Invite as starter</option>
            <option value="substitute">Invite as substitute</option>
          </select>
          <Button onClick={runSearch}>
            <Search className="mr-2 size-4" /> Search
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-primary" /> Starter ready = eligible + Riot
            verified + level 30+ + team division
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" /> Substitutes do not occupy one of the five starting slots
          </span>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Free agents</p>
            <h2 className="mt-1 text-xl font-black text-foreground">
              {query ? `Results for “${query}”` : "Available players"}
            </h2>
          </div>
          {candidates.data ? (
            <span className="text-sm text-muted-foreground">{candidates.data.length} found</span>
          ) : null}
        </div>

        {candidates.isPending ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-56 w-full" />
            ))}
          </div>
        ) : candidates.error ? (
          <div className="mt-4 rounded-xl border border-border p-5 text-sm text-muted-foreground">
            Could not load the free-agent pool right now.
          </div>
        ) : candidates.data?.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {candidates.data.map((candidate) => {
              const starterBlocked = role === "player" && !candidate.ready;
              return (
                <CandidateCard
                  key={candidate.profileId}
                  candidate={candidate}
                  role={role}
                  disabled={inviteMutation.isPending || starterBlocked}
                  onInvite={() => inviteMutation.mutate(candidate)}
                />
              );
            })}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState
              title="No free agents found"
              description="Try another handle or display name. Players already on a team are not available here."
            />
          </div>
        )}
      </section>
    </>
  );
}

function RecruitingStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-20 rounded-lg border border-border bg-background/35 px-3 py-2.5">
      <p className="text-lg font-black tabular-nums text-foreground">{value}</p>
      <p className="eyebrow mt-1">{label}</p>
    </div>
  );
}

function CandidateCard({
  candidate,
  role,
  disabled,
  onInvite,
}: {
  candidate: TeamCandidate;
  role: "player" | "substitute";
  disabled: boolean;
  onInvite: () => void;
}) {
  const levelReady = (candidate.accountLevel ?? 0) >= 30;
  const eligible = candidate.eligibility === "eligible";

  return (
    <article className="bg-surface-gradient flex h-full flex-col rounded-xl border border-border p-5 shadow-card transition-colors hover:border-brand/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/players/$handle"
            params={{ handle: candidate.handle }}
            className="block truncate text-lg font-black text-foreground hover:text-brand"
          >
            {candidate.displayName}
          </Link>
          <p className="mt-1 truncate text-sm text-muted-foreground">@{candidate.handle}</p>
        </div>
        <Badge variant={candidate.ready ? "default" : "outline"}>
          {candidate.ready ? "Starter ready" : "Needs checks"}
        </Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="outline">{candidate.divisionName ?? "No division"}</Badge>
        <Badge variant="outline">
          {candidate.riotTier ?? "Unranked"} {candidate.riotRank ?? ""}
        </Badge>
        {candidate.cityName ? <Badge variant="outline">{candidate.cityName}</Badge> : null}
      </div>

      <div className="mt-5 space-y-2 rounded-lg border border-border bg-background/30 p-3">
        <CandidateCheck label="Riot account verified" done={candidate.riotVerified} />
        <CandidateCheck label="Competitive eligibility" done={eligible} />
        <CandidateCheck
          label={candidate.accountLevel != null ? `Account level ${candidate.accountLevel}` : "Account level unknown"}
          done={levelReady}
        />
      </div>

      <div className="mt-auto pt-5">
        <Button className="w-full" size="sm" disabled={disabled} onClick={onInvite}>
          <UserPlus className="mr-2 size-4" />
          {role === "player" && !candidate.ready
            ? "Not eligible as starter"
            : `Invite as ${role === "player" ? "starter" : "substitute"}`}
        </Button>
      </div>
    </article>
  );
}

function CandidateCheck({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {done ? (
        <CheckCircle2 className="size-3.5 shrink-0 text-primary" />
      ) : (
        <CircleAlert className="size-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
