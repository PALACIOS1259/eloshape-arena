import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Eye, Save, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { TeamWorkspaceNav } from "@/components/eloshape/TeamWorkspaceNav";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { archiveMyTeam } from "@/lib/team-management.functions";
import { getMyTeamHub, updateMyTeam, type TeamHub } from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/team_/settings")({
  head: () => ({
    meta: [
      { title: "Team settings — EloShape" },
      { name: "description", content: "Manage your EloShape team identity and settings." },
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
        eyebrow="Team workspace"
        title="Team settings"
        description="Manage the identity players see across rankings, brackets and your public team profile."
        aside={
          <Button asChild variant="outline">
            <Link to="/team">Back to Team HQ</Link>
          </Button>
        }
      />
      <PageContainer className="py-8 sm:py-10">
        {query.isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : query.error || !query.data ? (
          <EmptyState title="Could not load team settings" />
        ) : (
          <div className="space-y-6">
            <TeamWorkspaceNav
              active="settings"
              hasTeam={Boolean(query.data.team)}
              isCaptain={Boolean(query.data.team?.isCaptain)}
            />

            {!query.data.team ? (
              <EmptyState
                title="No active team"
                description="Create or join a team before opening team settings."
                action={
                  <Button asChild>
                    <Link to="/team">Open Team HQ</Link>
                  </Button>
                }
              />
            ) : !query.data.team.isCaptain ? (
              <EmptyState
                title="Captain access required"
                description="Only the current team captain can edit team identity or disband the roster."
                action={
                  <Button asChild variant="outline">
                    <Link to="/team">Back to Team HQ</Link>
                  </Button>
                }
              />
            ) : (
              <CaptainSettings team={query.data.team} />
            )}
          </div>
        )}
      </PageContainer>
    </div>
  );
}

function CaptainSettings({ team }: { team: NonNullable<TeamHub["team"]> }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-6">
        <IdentitySettings team={team} />
        <DangerZone team={team} />
      </div>

      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <section className="relative overflow-hidden rounded-2xl border border-border bg-surface-gradient p-5 shadow-card">
          <div className="absolute right-0 top-0 size-40 translate-x-12 -translate-y-16 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow">Public identity</p>
              <Eye className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-5 flex items-center gap-4">
              <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-primary/25 bg-primary/10 font-black text-primary shadow-sm">
                {team.logoUrl ? (
                  <img src={team.logoUrl} alt={team.name} className="size-full object-cover" />
                ) : (
                  team.tag
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-black text-foreground">{team.name}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="outline">[{team.tag}]</Badge>
                  {team.division ? <Badge>{team.division.name}</Badge> : null}
                </div>
              </div>
            </div>
            <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {team.bio || "No public bio yet. Add one so players know what your team represents."}
            </p>
            <Button asChild className="mt-5 w-full" variant="outline">
              <Link to="/teams/$slug" params={{ slug: team.slug }}>
                <ExternalLink className="mr-2 size-4" /> View public profile
              </Link>
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-background/25 p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <p className="font-black text-foreground">Where this identity appears</p>
          </div>
          <div className="mt-4 space-y-3 text-xs leading-relaxed text-muted-foreground">
            <p>
              <strong className="text-foreground">Name & tag</strong> appear in rankings, matchups,
              tournament brackets and team cards.
            </p>
            <p>
              <strong className="text-foreground">Bio</strong> gives visitors context on your public
              team page.
            </p>
            <p>
              <strong className="text-foreground">Roster and roles</strong> stay in Team HQ so
              identity changes never get mixed with lineup operations.
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}

function IdentitySettings({ team }: { team: NonNullable<TeamHub["team"]> }) {
  const queryClient = useQueryClient();
  const update = useServerFn(updateMyTeam);
  const [name, setName] = useState(team.name);
  const [tag, setTag] = useState(team.tag);
  const [bio, setBio] = useState(team.bio ?? "");
  const dirty = name !== team.name || tag !== team.tag || bio !== (team.bio ?? "");

  const mutation = useMutation({
    mutationFn: () => update({ data: { name, tag, bio } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Team profile saved.");
      void queryClient.invalidateQueries({ queryKey: ["my-team-hub"] });
      void queryClient.invalidateQueries({ queryKey: ["teams"] });
      void queryClient.invalidateQueries({ queryKey: ["team", team.slug] });
    },
    onError: () => toast.error("Could not save team settings."),
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface-gradient shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-5 py-5 sm:px-6">
        <div>
          <p className="eyebrow">Team profile</p>
          <h2 className="mt-1 text-xl font-black text-foreground">Identity & bio</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Keep your team recognizable everywhere it appears on the EloShape circuit.
          </p>
        </div>
        <Badge variant={dirty ? "default" : "outline"}>
          {dirty ? "Unsaved changes" : "Up to date"}
        </Badge>
      </div>

      <div className="p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <label className="space-y-2 text-sm">
            <span className="font-semibold text-foreground">Team name</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} />
            <span className="block text-xs text-muted-foreground">3–40 characters</span>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-semibold text-foreground">Team tag</span>
            <Input
              value={tag}
              onChange={(event) => setTag(event.target.value.toUpperCase())}
              maxLength={6}
            />
            <span className="block text-xs text-muted-foreground">2–6 characters</span>
          </label>
        </div>

        <label className="mt-5 block space-y-2 text-sm">
          <span className="font-semibold text-foreground">Public bio</span>
          <Textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="Tell players where you compete, what you are building and what defines the roster."
            maxLength={500}
            rows={6}
          />
          <span className="flex justify-between text-xs text-muted-foreground">
            <span>Visible on the public team profile.</span>
            <span>{bio.length}/500</span>
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-background/25 px-5 py-4 sm:px-6">
        <p className="text-xs text-muted-foreground">
          Changes propagate to the team directory and public profile after saving.
        </p>
        <div className="flex flex-wrap gap-2">
          {dirty ? (
            <Button
              variant="outline"
              onClick={() => {
                setName(team.name);
                setTag(team.tag);
                setBio(team.bio ?? "");
              }}
              disabled={mutation.isPending}
            >
              Reset
            </Button>
          ) : null}
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !dirty || !name.trim() || !tag.trim()}
          >
            <Save className="mr-2 size-4" />
            {mutation.isPending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </div>
    </section>
  );
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
    <section className="overflow-hidden rounded-2xl border border-destructive/35 bg-destructive/5">
      <div className="flex items-start gap-3 border-b border-destructive/20 p-5 sm:p-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-destructive/25 bg-destructive/10 text-destructive">
          <ShieldAlert className="size-5" />
        </span>
        <div>
          <p className="eyebrow text-destructive">Danger zone</p>
          <h2 className="mt-1 text-xl font-black text-foreground">Disband team</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Current members are released and pending invitations are cancelled. Historical
            tournament entries, locked rosters, results and ranking records remain preserved.
          </p>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="rounded-xl border border-destructive/20 bg-background/30 p-4">
          <p className="text-sm font-semibold text-foreground">
            Type <span className="font-black">{team.name}</span> to confirm.
          </p>
          <Input
            className="mt-3 max-w-md"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={team.name}
            autoComplete="off"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            This action is blocked while the team is checked in to or competing in an active
            tournament.
          </p>
          <Button
            className="mt-4"
            variant="destructive"
            disabled={!canArchive || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Disbanding…" : "Permanently disband team"}
          </Button>
        </div>
      </div>
    </section>
  );
}
