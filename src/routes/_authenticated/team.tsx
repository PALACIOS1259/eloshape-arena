import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Crown,
  ExternalLink,
  Search,
  ShieldCheck,
  Trophy,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  TEAM_LANES,
  TeamLaneBadge,
  TeamLaneIcon,
  type TeamLaneRole,
} from "@/components/eloshape/TeamLaneRole";
import { TeamWorkspaceNav } from "@/components/eloshape/TeamWorkspaceNav";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  transferMyTeamCaptain,
  updateMyTeamMemberLaneRole,
  updateMyTeamMemberRole,
} from "@/lib/team-management.functions";
import {
  cancelMyTeamInvite,
  createMyTeam,
  getMyTeamHub,
  inviteMyTeamMember,
  leaveMyTeam,
  removeMyTeamMember,
  respondMyTeamInvite,
  type TeamHub,
} from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team HQ — EloShape" },
      {
        name: "description",
        content: "Build, organize and prepare your EloShape 5v5 roster for competition.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeamHubPage,
});

function TeamHubPage() {
  const getHub = useServerFn(getMyTeamHub);
  const { data, isPending, error } = useQuery({
    queryKey: ["my-team-hub"],
    queryFn: () => getHub(),
    retry: false,
  });

  return (
    <div>
      <PageHeading
        eyebrow="EloShape 5v5"
        title="Team HQ"
        description="Build your starting five, assign League roles, recruit substitutes and see exactly what your roster needs before competition."
        aside={
          data?.team ? (
            <Button asChild variant="outline">
              <Link to="/teams/$slug" params={{ slug: data.team.slug }}>
                <ExternalLink className="mr-2 size-4" /> Public profile
              </Link>
            </Button>
          ) : undefined
        }
      />

      <PageContainer className="py-8 sm:py-10">
        {isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
        ) : error || !data ? (
          <div className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
            Could not load your team workspace.
          </div>
        ) : (
          <TeamHubContent hub={data} />
        )}
      </PageContainer>
    </div>
  );
}

function TeamHubContent({ hub }: { hub: TeamHub }) {
  return (
    <div className="space-y-6">
      <TeamWorkspaceNav
        active="overview"
        hasTeam={Boolean(hub.team)}
        isCaptain={Boolean(hub.team?.isCaptain)}
      />

      {hub.incomingInvites.length ? <IncomingInvites invites={hub.incomingInvites} /> : null}
      {hub.team ? <ExistingTeam hub={hub} /> : <CreateTeamExperience />}
    </div>
  );
}

function IncomingInvites({ invites }: { invites: TeamHub["incomingInvites"] }) {
  const queryClient = useQueryClient();
  const respond = useServerFn(respondMyTeamInvite);
  const mutation = useMutation({
    mutationFn: (input: { inviteId: string; accept: boolean }) => respond({ data: input }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Team invitation updated.");
      void queryClient.invalidateQueries({ queryKey: ["my-team-hub"] });
      void queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });

  return (
    <section className="overflow-hidden rounded-xl border border-primary/30 bg-primary/5">
      <div className="flex items-center gap-3 border-b border-primary/20 px-4 py-3 sm:px-5">
        <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <UserPlus className="size-4" />
        </span>
        <div>
          <p className="text-sm font-black text-foreground">You have a team invitation</p>
          <p className="text-xs text-muted-foreground">
            Accepting an invite adds you to that roster immediately.
          </p>
        </div>
      </div>
      <div className="divide-y divide-border/70">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{invite.teamTag}</Badge>
                <p className="truncate font-black text-foreground">{invite.teamName}</p>
                <Badge variant={invite.role === "player" ? "default" : "secondary"}>
                  {invite.role === "substitute" ? "Substitute" : "Starter"}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Invited by {invite.invitedBy ?? "the team captain"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => mutation.mutate({ inviteId: invite.id, accept: true })}
                disabled={mutation.isPending}
              >
                Accept invite
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => mutation.mutate({ inviteId: invite.id, accept: false })}
                disabled={mutation.isPending}
              >
                Decline
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CreateTeamExperience() {
  const queryClient = useQueryClient();
  const create = useServerFn(createMyTeam);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const mutation = useMutation({
    mutationFn: () => create({ data: { name, tag } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Team created. You are the captain.");
      setName("");
      setTag("");
      void queryClient.invalidateQueries({ queryKey: ["my-team-hub"] });
      void queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });

  const previewName = name.trim() || "Your team";
  const previewTag = tag.trim().toUpperCase() || "TAG";

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_minmax(0,0.9fr)]">
      <section className="bg-surface-gradient overflow-hidden rounded-xl border border-border p-5 shadow-card sm:p-7">
        <p className="eyebrow">Create your roster</p>
        <h2 className="mt-2 max-w-xl text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          Build the team you want to compete with.
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Pick the identity now. After creation you can recruit players, assign Top, Jungle, Mid,
          ADC and Support, then prepare the roster for EloShape tournaments.
        </p>

        <div className="mt-7 grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <label className="space-y-2 text-sm">
            <span className="font-semibold text-foreground">Team name</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Golden Nest eSports"
              maxLength={40}
            />
            <span className="block text-xs text-muted-foreground">3–40 characters</span>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-semibold text-foreground">Team tag</span>
            <Input
              value={tag}
              onChange={(event) => setTag(event.target.value.toUpperCase())}
              placeholder="NGE"
              maxLength={6}
            />
            <span className="block text-xs text-muted-foreground">2–6 characters</span>
          </label>
        </div>

        <Button
          className="mt-5"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !name.trim() || !tag.trim()}
        >
          {mutation.isPending ? "Creating team…" : "Create team"}
        </Button>
      </section>

      <aside className="space-y-4">
        <div className="rounded-xl border border-border bg-background/30 p-5">
          <p className="eyebrow">Identity preview</p>
          <div className="mt-4 flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-lg font-black text-primary">
              {previewTag.slice(0, 6)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xl font-black text-foreground">{previewName}</p>
              <p className="mt-1 text-sm text-muted-foreground">[{previewTag}] · EloShape 5v5</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background/30 p-5">
          <p className="eyebrow">What happens next</p>
          <div className="mt-4 space-y-4">
            {[
              ["1", "Recruit your five", "Search free agents or invite friends by handle."],
              ["2", "Set the lineup", "Assign every starter a unique League role."],
              ["3", "Get tournament ready", "Riot verification and eligibility are checked automatically."],
            ].map(([step, title, description]) => (
              <div key={step} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-primary/25 bg-primary/10 text-xs font-black text-primary">
                  {step}
                </span>
                <div>
                  <p className="text-sm font-bold text-foreground">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function ExistingTeam({ hub }: { hub: TeamHub }) {
  const team = hub.team!;
  const starters = team.members.filter((member) => member.role !== "substitute");
  const substitutes = team.members.filter((member) => member.role === "substitute");
  const assignedRoles = starters.filter((member) => member.laneRole).length;
  const uniqueRoles = new Set(starters.flatMap((member) => (member.laneRole ? [member.laneRole] : [])))
    .size;

  return (
    <div className="space-y-6">
      <TeamIdentityHero
        team={team}
        starters={starters.length}
        substitutes={substitutes.length}
        assignedRoles={assignedRoles}
      />

      <ReadinessPanel team={team} starters={starters} uniqueRoles={uniqueRoles} />
      <StartingLineup team={team} starters={starters} />
      <RosterManagement team={team} />
      {team.isCaptain ? <CaptainRecruiting team={team} /> : <MemberTools />}
    </div>
  );
}

function TeamIdentityHero({
  team,
  starters,
  substitutes,
  assignedRoles,
}: {
  team: NonNullable<TeamHub["team"]>;
  starters: number;
  substitutes: number;
  assignedRoles: number;
}) {
  return (
    <section className="bg-surface-gradient relative overflow-hidden rounded-xl border border-border p-5 shadow-card sm:p-7">
      <div className="absolute right-0 top-0 size-48 translate-x-16 -translate-y-20 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-primary/25 bg-primary/10 text-lg font-black text-primary shadow-sm sm:size-20">
            {team.logoUrl ? (
              <img src={team.logoUrl} alt={team.name} className="size-full object-cover" />
            ) : (
              team.tag
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">[{team.tag}]</Badge>
              {team.division ? <Badge>{team.division.name}</Badge> : null}
              {team.city ? <Badge variant="outline">{team.city.name}</Badge> : null}
              {team.isCaptain ? (
                <Badge variant="secondary">
                  <Crown className="mr-1 size-3" /> Captain view
                </Badge>
              ) : null}
            </div>
            <h2 className="mt-3 truncate text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              {team.name}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {team.bio ||
                "Your competitive roster, lineup readiness and recruiting controls live here."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          {team.isCaptain ? (
            <Button asChild>
              <Link to="/team/players">
                <Search className="mr-2 size-4" /> Recruit players
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link to="/teams/$slug" params={{ slug: team.slug }}>
              Public profile
            </Link>
          </Button>
        </div>
      </div>

      <div className="relative mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <HeroStat label="Season points" value={String(team.pointsSeason)} />
        <HeroStat label="Record" value={`${team.wins}-${team.losses}`} />
        <HeroStat label="Titles" value={String(team.championships)} icon={<Trophy className="size-4" />} />
        <HeroStat label="Starters" value={`${starters}/5`} />
        <HeroStat label="Roles" value={`${assignedRoles}/5`} />
        <HeroStat label="Bench" value={String(substitutes)} />
      </div>
    </section>
  );
}

function HeroStat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/80 bg-background/30 p-3">
      <p className="flex items-center gap-1.5 text-lg font-black tabular-nums text-foreground">
        {icon}
        {value}
      </p>
      <p className="eyebrow mt-1">{label}</p>
    </div>
  );
}

function ReadinessPanel({
  team,
  starters,
  uniqueRoles,
}: {
  team: NonNullable<TeamHub["team"]>;
  starters: NonNullable<TeamHub["team"]>["members"];
  uniqueRoles: number;
}) {
  const assignedRoles = starters.filter((member) => member.laneRole).length;
  const checks = [
    {
      label: "Starting five",
      done: starters.length === 5,
      detail: `${starters.length}/5 starters selected`,
    },
    {
      label: "League roles",
      done: starters.length === 5 && assignedRoles === 5 && uniqueRoles === 5,
      detail:
        assignedRoles === 5 && uniqueRoles === 5
          ? "Top, Jungle, Mid, ADC and Support covered"
          : `${assignedRoles}/5 assigned · ${uniqueRoles}/5 unique`,
    },
    {
      label: "Riot verification",
      done: starters.length === 5 && starters.every((member) => member.riotVerified),
      detail: `${starters.filter((member) => member.riotVerified).length}/${starters.length || 5} verified`,
    },
    {
      label: "Competitive eligibility",
      done: starters.length === 5 && starters.every((member) => member.eligibility === "eligible"),
      detail: `${starters.filter((member) => member.eligibility === "eligible").length}/${starters.length || 5} eligible`,
    },
    {
      label: "Account level",
      done:
        starters.length === 5 &&
        starters.every((member) => member.accountLevel != null && member.accountLevel >= 30),
      detail: `${starters.filter((member) => (member.accountLevel ?? 0) >= 30).length}/${starters.length || 5} level 30+`,
    },
  ];

  return (
    <section className="rounded-xl border border-border bg-background/25 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">Competition readiness</p>
          <h3 className="mt-1 text-xl font-black text-foreground">Is this roster ready?</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            EloShape validates the roster again when you register and check in. This view shows the
            most important issues before you reach tournament day.
          </p>
        </div>
        <Badge
          className="w-fit"
          variant={team.eligibility.eligible ? "default" : "outline"}
        >
          {team.eligibility.eligible ? (
            <>
              <CheckCircle2 className="mr-1 size-3.5" /> Tournament eligible
            </>
          ) : (
            <>
              <CircleAlert className="mr-1 size-3.5" /> Needs attention
            </>
          )}
        </Badge>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {checks.map((check) => (
          <div
            key={check.label}
            className={`rounded-lg border p-3 ${
              check.done
                ? "border-primary/20 bg-primary/5"
                : "border-border bg-background/35"
            }`}
          >
            <div className="flex items-center gap-2">
              {check.done ? (
                <CheckCircle2 className="size-4 shrink-0 text-primary" />
              ) : (
                <CircleAlert className="size-4 shrink-0 text-muted-foreground" />
              )}
              <p className="text-sm font-bold text-foreground">{check.label}</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{check.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function StartingLineup({
  team,
  starters,
}: {
  team: NonNullable<TeamHub["team"]>;
  starters: NonNullable<TeamHub["team"]>["members"];
}) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Starting five</p>
          <h3 className="mt-1 text-xl font-black text-foreground">League lineup</h3>
        </div>
        <p className="max-w-xl text-sm text-muted-foreground">
          Every lane should have one starter. Empty or duplicated roles are easy to spot here.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {TEAM_LANES.map((lane) => {
          const assigned = starters.filter((member) => member.laneRole === lane.value);
          const member = assigned[0];
          const duplicate = assigned.length > 1;

          return (
            <div
              key={lane.value}
              className={`min-h-40 rounded-xl border p-4 ${
                member ? "bg-surface-gradient" : "border-dashed bg-background/20"
              } ${duplicate ? "border-destructive/45" : "border-border"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <TeamLaneIcon role={lane.value} />
                <span className="eyebrow">{lane.short}</span>
              </div>
              <p className="mt-3 font-black text-foreground">{lane.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{lane.description}</p>

              {member ? (
                <div className="mt-4 border-t border-border pt-3">
                  <Link
                    to="/players/$handle"
                    params={{ handle: member.handle }}
                    className="block truncate text-sm font-bold text-foreground hover:text-brand"
                  >
                    {member.displayName}
                  </Link>
                  <p className="mt-1 truncate text-xs text-muted-foreground">@{member.handle}</p>
                  {member.isCaptain ? (
                    <Badge className="mt-2" variant="secondary">
                      <Crown className="mr-1 size-3" /> Captain
                    </Badge>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                  No starter assigned
                </div>
              )}

              {duplicate ? (
                <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-destructive">
                  <CircleAlert className="size-3.5" /> {assigned.length} starters use this role
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {team.isCaptain ? (
        <div className="mt-3 flex justify-end">
          <Button asChild size="sm" variant="outline">
            <a href="#roster-management">
              Edit lineup <ChevronRight className="ml-1 size-4" />
            </a>
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function RosterManagement({ team }: { team: NonNullable<TeamHub["team"]> }) {
  const queryClient = useQueryClient();
  const updateRole = useServerFn(updateMyTeamMemberRole);
  const updateLaneRole = useServerFn(updateMyTeamMemberLaneRole);
  const transferCaptain = useServerFn(transferMyTeamCaptain);
  const remove = useServerFn(removeMyTeamMember);
  const starters = team.members.filter((member) => member.role !== "substitute");
  const substitutes = team.members.filter((member) => member.role === "substitute");

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["my-team-hub"] });
    void queryClient.invalidateQueries({ queryKey: ["teams"] });
  };

  const roleMutation = useMutation({
    mutationFn: (input: { handle: string; role: "player" | "substitute" }) =>
      updateRole({ data: input }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Roster status updated.");
      refresh();
    },
  });

  const laneMutation = useMutation({
    mutationFn: (input: { handle: string; laneRole: TeamLaneRole | null }) =>
      updateLaneRole({ data: input }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("League role updated.");
      refresh();
    },
  });

  const captainMutation = useMutation({
    mutationFn: (handle: string) => transferCaptain({ data: { handle } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Captaincy transferred.");
      refresh();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (handle: string) => remove({ data: { handle } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Player removed from roster.");
      refresh();
    },
  });

  const busy =
    roleMutation.isPending ||
    laneMutation.isPending ||
    captainMutation.isPending ||
    removeMutation.isPending;

  return (
    <section id="roster-management" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Roster management</p>
          <h3 className="mt-1 text-xl font-black text-foreground">Players & bench</h3>
        </div>
        {team.isCaptain ? (
          <Button asChild size="sm">
            <Link to="/team/players">
              <UserPlus className="mr-2 size-4" /> Add player
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <RosterGroup
          title="Starting roster"
          description="These five players are used for team tournament eligibility."
          members={starters}
          empty="No starters yet."
          team={team}
          busy={busy}
          onLaneRole={(handle, laneRole) => laneMutation.mutate({ handle, laneRole })}
          onRosterRole={(handle, role) => roleMutation.mutate({ handle, role })}
          onCaptain={(member) => {
            if (window.confirm(`Transfer team captaincy to ${member.displayName}?`)) {
              captainMutation.mutate(member.handle);
            }
          }}
          onRemove={(member) => {
            if (window.confirm(`Remove ${member.displayName} from the team?`)) {
              removeMutation.mutate(member.handle);
            }
          }}
        />

        <RosterGroup
          title="Substitutes"
          description="Bench players stay with the team without occupying a starting slot."
          members={substitutes}
          empty={team.isCaptain ? "No substitutes yet. Recruit depth for tournament day." : "No substitutes."}
          team={team}
          busy={busy}
          onLaneRole={(handle, laneRole) => laneMutation.mutate({ handle, laneRole })}
          onRosterRole={(handle, role) => roleMutation.mutate({ handle, role })}
          onCaptain={(member) => {
            if (window.confirm(`Transfer team captaincy to ${member.displayName}?`)) {
              captainMutation.mutate(member.handle);
            }
          }}
          onRemove={(member) => {
            if (window.confirm(`Remove ${member.displayName} from the team?`)) {
              removeMutation.mutate(member.handle);
            }
          }}
        />
      </div>
    </section>
  );
}

type HubMember = NonNullable<TeamHub["team"]>["members"][number];

function RosterGroup({
  title,
  description,
  members,
  empty,
  team,
  busy,
  onLaneRole,
  onRosterRole,
  onCaptain,
  onRemove,
}: {
  title: string;
  description: string;
  members: HubMember[];
  empty: string;
  team: NonNullable<TeamHub["team"]>;
  busy: boolean;
  onLaneRole: (handle: string, role: TeamLaneRole | null) => void;
  onRosterRole: (handle: string, role: "player" | "substitute") => void;
  onCaptain: (member: HubMember) => void;
  onRemove: (member: HubMember) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background/20">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-black text-foreground">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          <Badge variant="outline">{members.length}</Badge>
        </div>
      </div>

      {members.length ? (
        <div className="divide-y divide-border">
          {members.map((member) => (
            <RosterMemberRow
              key={member.profileId}
              member={member}
              isCaptainView={team.isCaptain}
              busy={busy}
              onLaneRole={onLaneRole}
              onRosterRole={onRosterRole}
              onCaptain={onCaptain}
              onRemove={onRemove}
            />
          ))}
        </div>
      ) : (
        <div className="p-6 text-sm text-muted-foreground">{empty}</div>
      )}
    </div>
  );
}

function RosterMemberRow({
  member,
  isCaptainView,
  busy,
  onLaneRole,
  onRosterRole,
  onCaptain,
  onRemove,
}: {
  member: HubMember;
  isCaptainView: boolean;
  busy: boolean;
  onLaneRole: (handle: string, role: TeamLaneRole | null) => void;
  onRosterRole: (handle: string, role: "player" | "substitute") => void;
  onCaptain: (member: HubMember) => void;
  onRemove: (member: HubMember) => void;
}) {
  return (
    <div className="p-4 sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/players/$handle"
                params={{ handle: member.handle }}
                className="truncate font-bold text-foreground hover:text-brand"
              >
                {member.displayName}
              </Link>
              {member.isCaptain ? (
                <Badge variant="secondary">
                  <Crown className="mr-1 size-3" /> Captain
                </Badge>
              ) : null}
              <TeamLaneBadge role={member.laneRole} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              @{member.handle} · {member.riotTier ?? "Unranked"} {member.riotRank ?? ""}
              {member.accountLevel != null ? ` · level ${member.accountLevel}` : ""}
            </p>
          </div>
          <span
            className={`grid size-8 shrink-0 place-items-center rounded-full border ${
              member.riotVerified && member.eligibility === "eligible"
                ? "border-primary/25 bg-primary/10 text-primary"
                : "border-border bg-background/40 text-muted-foreground"
            }`}
            title={
              member.riotVerified && member.eligibility === "eligible"
                ? "Competitive checks passed"
                : "Competitive checks incomplete"
            }
          >
            {member.riotVerified && member.eligibility === "eligible" ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <CircleAlert className="size-4" />
            )}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant={member.riotVerified ? "default" : "outline"}>
            {member.riotVerified ? "Riot verified" : "Riot missing"}
          </Badge>
          <Badge variant={member.eligibility === "eligible" ? "default" : "outline"}>
            {member.eligibility.replace("_", " ")}
          </Badge>
          <Badge variant={(member.accountLevel ?? 0) >= 30 ? "default" : "outline"}>
            {(member.accountLevel ?? 0) >= 30 ? "Level 30+" : "Level check needed"}
          </Badge>
        </div>

        {isCaptainView ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              aria-label={`League role for ${member.displayName}`}
              value={member.laneRole ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                onLaneRole(member.handle, value ? (value as TeamLaneRole) : null);
              }}
              disabled={busy}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">League role</option>
              {TEAM_LANES.map((lane) => (
                <option key={lane.value} value={lane.value}>
                  {lane.label}
                </option>
              ))}
            </select>

            {!member.isCaptain ? (
              <select
                aria-label={`Roster status for ${member.displayName}`}
                value={member.role}
                onChange={(event) =>
                  onRosterRole(
                    member.handle,
                    event.target.value as "player" | "substitute",
                  )
                }
                disabled={busy}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="player">Starter</option>
                <option value="substitute">Substitute</option>
              </select>
            ) : (
              <div className="flex h-9 items-center rounded-md border border-border bg-background/30 px-3 text-sm text-muted-foreground">
                Captain · Starter
              </div>
            )}
          </div>
        ) : null}

        {isCaptainView && !member.isCaptain ? (
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <Button size="sm" variant="outline" onClick={() => onCaptain(member)} disabled={busy}>
              <ShieldCheck className="mr-2 size-4" /> Make captain
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onRemove(member)} disabled={busy}>
              <X className="mr-1 size-4" /> Remove
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CaptainRecruiting({ team }: { team: NonNullable<TeamHub["team"]> }) {
  const queryClient = useQueryClient();
  const invite = useServerFn(inviteMyTeamMember);
  const cancel = useServerFn(cancelMyTeamInvite);
  const [handle, setHandle] = useState("");
  const [role, setRole] = useState<"player" | "substitute">("player");

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["my-team-hub"] });
    void queryClient.invalidateQueries({ queryKey: ["teams"] });
  };

  const inviteMutation = useMutation({
    mutationFn: () => invite({ data: { handle, role } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Invitation sent.");
      setHandle("");
      refresh();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (inviteId: string) => cancel({ data: { inviteId } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Invitation cancelled.");
      refresh();
    },
  });

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)]">
      <div className="bg-surface-gradient rounded-xl border border-border p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Recruiting</p>
            <h3 className="mt-1 text-xl font-black text-foreground">Bring in another player</h3>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Search the free-agent pool for verified candidates or invite a friend directly by
              their EloShape handle.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/team/players">
              <Search className="mr-2 size-4" /> Find players
            </Link>
          </Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
          <Input
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder="Player handle"
            onKeyDown={(event) => {
              if (event.key === "Enter" && handle.trim() && !inviteMutation.isPending) {
                inviteMutation.mutate();
              }
            }}
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as "player" | "substitute")}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="player">Starter</option>
            <option value="substitute">Substitute</option>
          </select>
          <Button
            onClick={() => inviteMutation.mutate()}
            disabled={inviteMutation.isPending || !handle.trim()}
          >
            <UserPlus className="mr-2 size-4" />
            {inviteMutation.isPending ? "Sending…" : "Invite"}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-background/20">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
          <div>
            <p className="font-black text-foreground">Pending invites</p>
            <p className="mt-1 text-xs text-muted-foreground">Waiting for a player response.</p>
          </div>
          <Badge variant="outline">{team.pendingInvites.length}</Badge>
        </div>

        {team.pendingInvites.length ? (
          <div className="divide-y divide-border">
            {team.pendingInvites.map((pending) => (
              <div key={pending.id} className="flex items-center justify-between gap-3 p-4 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">@{pending.handle}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pending.role === "substitute" ? "Substitute" : "Starter"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => cancelMutation.mutate(pending.id)}
                  disabled={cancelMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-5 text-sm text-muted-foreground">No outstanding invitations.</div>
        )}
      </div>
    </section>
  );
}

function MemberTools() {
  const queryClient = useQueryClient();
  const leave = useServerFn(leaveMyTeam);
  const mutation = useMutation({
    mutationFn: () => leave(),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("You left the team.");
      void queryClient.invalidateQueries({ queryKey: ["my-team-hub"] });
      void queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });

  return (
    <section className="rounded-xl border border-border bg-background/20 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-black text-foreground">Team membership</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The captain manages tournament registration, roster roles and invitations.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            if (window.confirm("Leave this team?")) mutation.mutate();
          }}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Leaving…" : "Leave team"}
        </Button>
      </div>
    </section>
  );
}
