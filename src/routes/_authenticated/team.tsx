import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Search, ShieldCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { transferMyTeamCaptain, updateMyTeamMemberRole } from "@/lib/team-management.functions";
import {
  cancelMyTeamInvite,
  createMyTeam,
  getMyTeamHub,
  inviteMyTeamMember,
  leaveMyTeam,
  removeMyTeamMember,
  respondMyTeamInvite,
  updateMyTeam,
  type TeamHub,
} from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "My team — EloShape" },
      { name: "description", content: "Create and manage your EloShape 5v5 roster." },
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
        eyebrow="5v5"
        title="My team"
        description="Build a five-player starting roster, add substitutes, and enter team-mode EloShape brackets."
        aside={
          data?.team ? (
            <div className="flex flex-wrap gap-2">
              {data.team.isCaptain ? (
                <Button asChild>
                  <Link to="/team/players">
                    <Search className="mr-2 size-4" /> Find players
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="outline">
                <Link to="/teams/$slug" params={{ slug: data.team.slug }}>
                  Public team page
                </Link>
              </Button>
            </div>
          ) : undefined
        }
      />
      <PageContainer className="py-10">
        {isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        ) : error || !data ? (
          <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
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
    <div className="space-y-8">
      {hub.incomingInvites.length ? <IncomingInvites invites={hub.incomingInvites} /> : null}
      {hub.team ? <ExistingTeam hub={hub} /> : <CreateTeamCard />}
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
    <section>
      <p className="eyebrow">Team invitations</p>
      <div className="mt-3 space-y-3">
        {invites.map((invite) => (
          <div key={invite.id} className="bg-surface-gradient rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">
                  [{invite.teamTag}] {invite.teamName}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Invited by {invite.invitedBy} ·{" "}
                  {invite.role === "substitute" ? "Substitute" : "Starter"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => mutation.mutate({ inviteId: invite.id, accept: true })}
                  disabled={mutation.isPending}
                >
                  Accept
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
          </div>
        ))}
      </div>
    </section>
  );
}

function CreateTeamCard() {
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

  return (
    <div className="bg-surface-gradient max-w-2xl rounded-lg border border-border p-6 shadow-card">
      <p className="eyebrow">Create roster</p>
      <h2 className="mt-2 text-2xl font-black text-foreground">Start a team</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        You become captain automatically. A player can belong to one EloShape team at a time.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <label className="space-y-2 text-sm">
          <span className="font-semibold">Team name</span>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Golden Nest eSports"
            maxLength={40}
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-semibold">Tag</span>
          <Input
            value={tag}
            onChange={(event) => setTag(event.target.value.toUpperCase())}
            placeholder="NGE"
            maxLength={6}
          />
        </label>
      </div>
      <Button
        className="mt-5"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !name.trim() || !tag.trim()}
      >
        {mutation.isPending ? "Creating…" : "Create team"}
      </Button>
    </div>
  );
}

function ExistingTeam({ hub }: { hub: TeamHub }) {
  const team = hub.team!;
  const starters = team.members.filter((member) => member.role !== "substitute").length;
  return (
    <div className="space-y-8">
      <section className="bg-surface-gradient rounded-lg border border-border p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{team.tag}</Badge>
              {team.division ? <Badge>{team.division.name}</Badge> : null}
              {team.city ? <Badge variant="outline">{team.city.name}</Badge> : null}
            </div>
            <h2 className="mt-3 text-3xl font-black text-foreground">{team.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {team.pointsSeason} pts · {team.wins}-{team.losses} · {team.championships}{" "}
              championships
            </p>
          </div>
          <div className="text-right">
            <p className="eyebrow">Starting roster</p>
            <p className="mt-1 text-2xl font-black text-foreground">{starters}/5</p>
            <Badge className="mt-2" variant={team.eligibility.eligible ? "default" : "outline"}>
              {team.eligibility.eligible ? "Tournament ready" : "Roster not ready"}
            </Badge>
          </div>
        </div>
      </section>

      <Roster team={team} />
      {team.isCaptain ? <CaptainTools team={team} /> : <MemberTools />}
    </div>
  );
}

function Roster({ team }: { team: NonNullable<TeamHub["team"]> }) {
  const queryClient = useQueryClient();
  const updateRole = useServerFn(updateMyTeamMemberRole);
  const transferCaptain = useServerFn(transferMyTeamCaptain);
  const remove = useServerFn(removeMyTeamMember);

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
      toast.success("Roster role updated.");
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

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Roster</p>
          <h3 className="mt-1 text-xl font-black">Players</h3>
        </div>
        <span className="text-sm text-muted-foreground">
          Exactly 5 starters required for team brackets
        </span>
      </div>
      <div className="mt-3 overflow-hidden rounded-lg border border-border">
        {team.members.map((member) => (
          <div
            key={member.profileId}
            className="grid gap-3 border-b border-border p-4 last:border-0 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/players/$handle"
                  params={{ handle: member.handle }}
                  className="font-semibold text-foreground hover:text-brand"
                >
                  {member.displayName}
                </Link>
                {member.isCaptain ? <Badge>Captain</Badge> : null}
                <Badge variant="outline">
                  {member.role === "substitute" ? "Substitute" : "Starter"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                @{member.handle} · {member.riotTier ?? "Unranked"} {member.riotRank ?? ""}
                {member.accountLevel != null ? ` · level ${member.accountLevel}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant={member.riotVerified ? "default" : "outline"}>
                  {member.riotVerified ? "Riot verified" : "Riot missing"}
                </Badge>
                <Badge variant={member.eligibility === "eligible" ? "default" : "outline"}>
                  {member.eligibility.replace("_", " ")}
                </Badge>
              </div>
            </div>

            {team.isCaptain && !member.isCaptain ? (
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <select
                  value={member.role}
                  onChange={(event) =>
                    roleMutation.mutate({
                      handle: member.handle,
                      role: event.target.value as "player" | "substitute",
                    })
                  }
                  disabled={roleMutation.isPending}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="player">Starter</option>
                  <option value="substitute">Substitute</option>
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (window.confirm(`Transfer team captaincy to ${member.displayName}?`))
                      captainMutation.mutate(member.handle);
                  }}
                  disabled={captainMutation.isPending}
                >
                  <ShieldCheck className="mr-2 size-4" /> Make captain
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeMutation.mutate(member.handle)}
                  disabled={removeMutation.isPending}
                >
                  Remove
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function CaptainTools({ team }: { team: NonNullable<TeamHub["team"]> }) {
  const queryClient = useQueryClient();
  const update = useServerFn(updateMyTeam);
  const invite = useServerFn(inviteMyTeamMember);
  const cancel = useServerFn(cancelMyTeamInvite);
  const [name, setName] = useState(team.name);
  const [tag, setTag] = useState(team.tag);
  const [bio, setBio] = useState(team.bio ?? "");
  const [handle, setHandle] = useState("");
  const [role, setRole] = useState<"player" | "substitute">("player");

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["my-team-hub"] });
    void queryClient.invalidateQueries({ queryKey: ["teams"] });
  };

  const updateMutation = useMutation({
    mutationFn: () => update({ data: { name, tag, bio } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);

        return;
      }
      toast.success("Team updated.");
      refresh();
    },
  });

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
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="bg-surface-gradient rounded-lg border border-border p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Captain controls</p>
            <h3 className="mt-1 text-lg font-black">Invite player</h3>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/team/players">
              <Search className="mr-2 size-4" /> Find players
            </Link>
          </Button>
        </div>
        <div className="mt-4 flex gap-2">
          <Input
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder="EloShape handle"
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as "player" | "substitute")}
            className="rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="player">Starter</option>
            <option value="substitute">Substitute</option>
          </select>
        </div>
        <Button
          className="mt-3"
          onClick={() => inviteMutation.mutate()}
          disabled={inviteMutation.isPending || !handle.trim()}
        >
          {inviteMutation.isPending ? "Sending…" : "Send invite"}
        </Button>

        {team.pendingInvites.length ? (
          <div className="mt-6 space-y-2 border-t border-border pt-4">
            <p className="eyebrow">Pending invitations</p>
            {team.pendingInvites.map((pending) => (
              <div key={pending.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  @{pending.handle} · {pending.role === "substitute" ? "Substitute" : "Starter"}
                </span>
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
        ) : null}
      </section>

      <section className="bg-surface-gradient rounded-lg border border-border p-5">
        <p className="eyebrow">Team profile</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} />
          <Input
            value={tag}
            onChange={(event) => setTag(event.target.value.toUpperCase())}
            maxLength={6}
          />
        </div>
        <Textarea
          className="mt-3"
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          placeholder="Team bio"
          maxLength={500}
        />
        <Button
          className="mt-3"
          variant="outline"
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? "Saving…" : "Save team profile"}
        </Button>
      </section>
    </div>
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
    <div className="rounded-lg border border-border p-5">
      <p className="eyebrow">Membership</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Only the captain manages tournament registration and check-in.
      </p>
      <Button
        className="mt-4"
        variant="outline"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? "Leaving…" : "Leave team"}
      </Button>
    </div>
  );
}
