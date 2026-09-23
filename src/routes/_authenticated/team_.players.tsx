import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, CircleAlert, Search, ShieldCheck, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { TeamWorkspaceNav } from "@/components/eloshape/TeamWorkspaceNav";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyTeamHub, inviteMyTeamMember, type TeamHub } from "@/lib/team.functions";
import { searchMyTeamCandidates, type TeamCandidate } from "@/lib/team-search.functions";

export const Route = createFileRoute("/_authenticated/team_/players")({
  head: () => ({
    meta: [
      { title: "Recruit players — EloShape" },
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
        title="Recruit players"
        description="Search free agents, verify competitive readiness and build your roster without guessing who can actually compete."
        aside={
          <Button asChild variant="outline">
            <Link to="/team">Back to Team HQ</Link>
          </Button>
        }
      />

      <PageContainer className="py-7 sm:py-9">
        {hub.isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-52 w-full" />
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
                description="Recruiting belongs to a roster. Create your team first, then return here to build the lineup."
                action={
                  <Button asChild>
                    <Link to="/team">Create a team</Link>
                  </Button>
                }
              />
            ) : !hub.data.team.isCaptain ? (
              <EmptyState
                title="Captain access required"
                description="Only the current captain can send invitations or fill roster slots."
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
                candidates={candidates.data}
                candidatesPending={candidates.isPending}
                candidatesError={candidates.error}
                invitePending={inviteMutation.isPending}
                onInvite={(candidate) => inviteMutation.mutate(candidate)}
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
  candidatesPending,
  candidatesError,
  invitePending,
  onInvite,
}: {
  team: NonNullable<TeamHub["team"]>;
  input: string;
  setInput: (value: string) => void;
  query: string;
  role: "player" | "substitute";
  setRole: (value: "player" | "substitute") => void;
  runSearch: () => void;
  candidates: TeamCandidate[] | undefined;
  candidatesPending: boolean;
  candidatesError: Error | null;
  invitePending: boolean;
  onInvite: (candidate: TeamCandidate) => void;
}) {
  const starters = team.members.filter((member) => member.role !== "substitute");
  const substitutes = team.members.filter((member) => member.role === "substitute");
  const remainingStarterSlots = Math.max(0, 5 - starters.length);
  const starterComplete = remainingStarterSlots === 0;
  const rosterStatus = starterComplete
    ? "Starting five complete"
    : `${remainingStarterSlots} starter slot${remainingStarterSlots === 1 ? "" : "s"} open`;

  return (
    <>
      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card/90 to-background/55 p-5 sm:p-6">
        <div className="absolute right-0 top-0 size-64 translate-x-20 -translate-y-28 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">[{team.tag}]</Badge>
              <Badge variant={starterComplete ? "default" : "secondary"}>{rosterStatus}</Badge>
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-foreground">
              Build {team.name}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Starter invitations require the player to pass EloShape readiness checks. Bench
              invitations stay available for flexible roster depth.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <RecruitingStat
              label="Starters"
              value={`${starters.length}/5`}
              active={starterComplete}
            />
            <RecruitingStat
              label="Open"
              value={String(remainingStarterSlots)}
              active={!starterComplete}
            />
            <RecruitingStat label="Bench" value={String(substitutes.length)} />
          </div>
        </div>

        <div className="relative mt-6 border-t border-border/60 pt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-foreground">Who are you recruiting?</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose the roster status first, then search the free-agent pool.
              </p>
            </div>
            <div className="inline-flex rounded-lg border border-border bg-background/55 p-1">
              <button
                type="button"
                onClick={() => setRole("player")}
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                  role === "player"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Starter
              </button>
              <button
                type="button"
                onClick={() => setRole("substitute")}
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                  role === "substitute"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Substitute
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") runSearch();
                }}
                className="pl-9"
                placeholder="Search by handle or display name"
                aria-label="Search free agents"
              />
            </label>
            <Button onClick={runSearch}>
              <Search className="mr-2 size-4" /> Search players
            </Button>
          </div>
        </div>

        <div className="relative mt-4 grid gap-2 md:grid-cols-2">
          <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/20 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              Starter ready means eligible, Riot verified, level 30+ and compatible with the team
              division.
            </span>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/20 p-3 text-xs text-muted-foreground">
            <Users className="mt-0.5 size-4 shrink-0" />
            <span>Substitutes add depth without occupying one of the five starting slots.</span>
          </div>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Free-agent pool</p>
            <h2 className="mt-1 text-xl font-black text-foreground">
              {query ? `Results for “${query}”` : "Available players"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Players already attached to another active team are excluded automatically.
            </p>
          </div>
          {candidates ? <Badge variant="outline">{candidates.length} available</Badge> : null}
        </div>

        {candidatesPending ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-72 w-full rounded-2xl" />
            ))}
          </div>
        ) : candidatesError ? (
          <div className="mt-4 rounded-2xl border border-border p-5 text-sm text-muted-foreground">
            Could not load the free-agent pool right now.
          </div>
        ) : candidates?.length ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {candidates.map((candidate) => {
              const starterBlocked = role === "player" && !candidate.ready;
              return (
                <CandidateCard
                  key={candidate.profileId}
                  candidate={candidate}
                  role={role}
                  disabled={invitePending || starterBlocked}
                  onInvite={() => onInvite(candidate)}
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

function RecruitingStat({
  label,
  value,
  active = false,
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div
      className={`min-w-20 rounded-xl border px-3 py-3 ${
        active ? "border-primary/30 bg-primary/10" : "border-border bg-background/35"
      }`}
    >
      <p className="text-lg font-black tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
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
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface-gradient shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to="/players/$handle"
              params={{ handle: candidate.handle }}
              className="block truncate text-lg font-black text-foreground transition-colors hover:text-primary"
            >
              {candidate.displayName}
            </Link>
            <p className="mt-1 truncate text-sm text-muted-foreground">@{candidate.handle}</p>
          </div>
          <Badge variant={candidate.ready ? "default" : "outline"}>
            {candidate.ready ? "Ready" : "Needs checks"}
          </Badge>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline">{candidate.divisionName ?? "No division"}</Badge>
          <Badge variant="outline">
            {candidate.riotTier ?? "Unranked"} {candidate.riotRank ?? ""}
          </Badge>
          {candidate.cityName ? <Badge variant="outline">{candidate.cityName}</Badge> : null}
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-border bg-background/30">
          <div className="border-b border-border/70 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Competitive checks
          </div>
          <div className="space-y-2.5 p-3">
            <CandidateCheck label="Riot account verified" done={candidate.riotVerified} />
            <CandidateCheck label="Competitive eligibility" done={eligible} />
            <CandidateCheck
              label={
                candidate.accountLevel != null
                  ? `Account level ${candidate.accountLevel}`
                  : "Account level unknown"
              }
              done={levelReady}
            />
          </div>
        </div>
      </div>

      <div className="mt-auto border-t border-border/70 bg-background/25 p-4">
        <Button className="w-full" size="sm" disabled={disabled} onClick={onInvite}>
          <UserPlus className="mr-2 size-4" />
          {role === "player" && !candidate.ready
            ? "Cannot join starting five yet"
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
      <span className={done ? "font-medium text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
    </div>
  );
}
