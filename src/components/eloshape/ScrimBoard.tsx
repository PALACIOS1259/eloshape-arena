import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarClock,
  Check,
  Clock3,
  Gamepad2,
  Handshake,
  LoaderCircle,
  ShieldCheck,
  Swords,
  Trophy,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime } from "@/lib/format";
import {
  cancelMyScrim,
  challengeScrim,
  createMyScrim,
  getMyScrimHub,
  listScrims,
  reportMyScrimResult,
  respondScrimChallenge,
  type ScrimHub,
  type ScrimPost,
} from "@/lib/scrim.functions";
import { cn } from "@/lib/utils";

export function ScrimBoard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const list = useServerFn(listScrims);
  const getHub = useServerFn(getMyScrimHub);

  const scrimsQuery = useQuery({
    queryKey: ["scrims"],
    queryFn: () => list(),
  });
  const hubQuery = useQuery({
    queryKey: ["my-scrim-hub"],
    queryFn: () => getHub(),
    enabled: Boolean(user),
    retry: false,
  });

  const scrims = scrimsQuery.data ?? [];
  const hub = hubQuery.data;
  const myTeam = hub?.team ?? null;
  const isCaptain = Boolean(myTeam?.isCaptain);

  const outgoingByScrim = useMemo(
    () => new Map((hub?.outgoingChallenges ?? []).map((row) => [row.scrimId, row])),
    [hub?.outgoingChallenges],
  );

  const openCount = scrims.filter((scrim) => scrim.status === "open").length;
  const matchedCount = scrims.filter((scrim) => scrim.status === "matched").length;
  const completedCount = scrims.filter((scrim) => scrim.status === "completed").length;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["scrims"] });
    void queryClient.invalidateQueries({ queryKey: ["my-scrim-hub"] });
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-surface-gradient p-5 shadow-card sm:p-6">
        <div className="absolute right-0 top-0 size-64 translate-x-20 -translate-y-24 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Practice only</Badge>
              <Badge variant="secondary">No circuit points</Badge>
            </div>
            <p className="eyebrow mt-5">Scrim finder</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-black tracking-tight text-foreground">
              Find another roster and get games in.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Post availability, challenge another team and save the result as practice history.
              Scrims never affect qualifier slots, Semi-Split seeding or EloShape rankings.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <ScrimMetric label="Open" value={openCount} />
            <ScrimMetric label="Matched" value={matchedCount} />
            <ScrimMetric label="Played" value={completedCount} gold />
          </div>
        </div>
      </section>

      {user ? (
        hubQuery.isPending ? (
          <div className="rounded-2xl border border-border bg-background/30 p-5 text-sm text-muted-foreground">
            Loading your scrim controls…
          </div>
        ) : isCaptain ? (
          <CreateScrimCard invalidate={invalidate} />
        ) : (
          <div className="rounded-2xl border border-border bg-background/30 p-5">
            <p className="font-black text-foreground">
              {myTeam ? "Captain controls are locked" : "Join or create a team first"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {myTeam
                ? "You can browse practice offers, but only your captain can post or challenge."
                : "Scrims are team-vs-team. Build a roster before posting availability."}
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/team">{myTeam ? "Open Team HQ" : "Create or join a team"}</Link>
            </Button>
          </div>
        )
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-background/30 p-5">
          <div>
            <p className="font-black text-foreground">Want to challenge a team?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in with a team roster to post availability and send challenges.
            </p>
          </div>
          <Button asChild>
            <Link to="/auth" search={{ mode: "signin" }}>
              Sign in
            </Link>
          </Button>
        </div>
      )}

      {isCaptain && hub?.incomingChallenges.length ? (
        <IncomingChallenges
          challenges={hub.incomingChallenges}
          respond={useServerFn(respondScrimChallenge)}
          invalidate={invalidate}
        />
      ) : null}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Practice board</p>
            <h3 className="mt-1 text-2xl font-black text-foreground">Available scrims</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Open posts first, then already-matched and recently completed practice.
            </p>
          </div>
          <Badge variant="outline">{scrims.length} posts</Badge>
        </div>

        {scrimsQuery.isPending ? (
          <div className="mt-5 rounded-2xl border border-border bg-background/30 p-8 text-center text-sm text-muted-foreground">
            Loading practice board…
          </div>
        ) : scrims.length ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {scrims.map((scrim) => (
              <ScrimCard
                key={scrim.id}
                scrim={scrim}
                myTeamId={myTeam?.id ?? null}
                isCaptain={isCaptain}
                outgoingStatus={outgoingByScrim.get(scrim.id)?.status ?? null}
                invalidate={invalidate}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5">
            <EmptyState
              title="No scrims posted yet"
              description="The first captain to post availability will appear here."
            />
          </div>
        )}
      </section>
    </div>
  );
}

function CreateScrimCard({ invalidate }: { invalidate: () => void }) {
  const create = useServerFn(createMyScrim);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [bestOf, setBestOf] = useState<1 | 3 | 5>(3);
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          startsAt: new Date(startsAt).toISOString(),
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
          bestOf,
          note,
        },
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Scrim availability posted.");
      setStartsAt("");
      setEndsAt("");
      setNote("");
      invalidate();
    },
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-primary/20 bg-primary/[0.035] shadow-card">
      <div className="flex items-center gap-3 border-b border-primary/15 px-5 py-4">
        <span className="grid size-10 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <CalendarClock className="size-4" />
        </span>
        <div>
          <p className="font-black text-foreground">Post a practice window</p>
          <p className="text-xs text-muted-foreground">
            Other captains can challenge your team for this slot.
          </p>
        </div>
      </div>
      <div className="grid gap-3 p-5 lg:grid-cols-[1fr_1fr_8rem_minmax(0,1.2fr)_auto] lg:items-end">
        <label className="space-y-2 text-xs font-semibold text-foreground">
          Start
          <Input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
        </label>
        <label className="space-y-2 text-xs font-semibold text-foreground">
          End <span className="font-normal text-muted-foreground">(optional)</span>
          <Input
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
          />
        </label>
        <label className="space-y-2 text-xs font-semibold text-foreground">
          Format
          <select
            value={bestOf}
            onChange={(event) => setBestOf(Number(event.target.value) as 1 | 3 | 5)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value={1}>Bo1</option>
            <option value={3}>Bo3</option>
            <option value={5}>Bo5</option>
          </select>
        </label>
        <label className="space-y-2 text-xs font-semibold text-foreground">
          Note
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={240}
            placeholder="Tournament practice · serious comms"
          />
        </label>
        <Button
          onClick={() => mutation.mutate()}
          disabled={!startsAt || mutation.isPending}
          className="font-black"
        >
          {mutation.isPending ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Gamepad2 className="size-4" />
          )}
          Post
        </Button>
      </div>
    </section>
  );
}

function IncomingChallenges({
  challenges,
  respond,
  invalidate,
}: {
  challenges: ScrimHub["incomingChallenges"];
  respond: ReturnType<typeof useServerFn<typeof respondScrimChallenge>>;
  invalidate: () => void;
}) {
  const mutation = useMutation({
    mutationFn: (input: { challengeId: string; accept: boolean }) =>
      respond({ data: input }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.data.status === "matched" ? "Scrim matched." : "Challenge declined.");
      invalidate();
    },
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-gold/25 bg-gold/[0.035] shadow-card">
      <div className="border-b border-gold/15 px-5 py-4">
        <p className="eyebrow text-gold">Incoming challenges</p>
        <h3 className="mt-1 text-lg font-black text-foreground">
          Teams want your practice slot
        </h3>
      </div>
      <div className="divide-y divide-border/70">
        {challenges.map((challenge) => (
          <div
            key={challenge.id}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
          >
            <div>
              <Link
                to="/teams/$slug"
                params={{ slug: challenge.challenger.slug }}
                className="font-black text-foreground hover:text-primary"
              >
                [{challenge.challenger.tag}] {challenge.challenger.name}
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">
                Challenge sent {formatDateTime(challenge.createdAt)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() =>
                  mutation.mutate({ challengeId: challenge.id, accept: true })
                }
                disabled={mutation.isPending}
              >
                <Check className="size-4" /> Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  mutation.mutate({ challengeId: challenge.id, accept: false })
                }
                disabled={mutation.isPending}
              >
                <X className="size-4" /> Decline
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ScrimCard({
  scrim,
  myTeamId,
  isCaptain,
  outgoingStatus,
  invalidate,
}: {
  scrim: ScrimPost;
  myTeamId: string | null;
  isCaptain: boolean;
  outgoingStatus: string | null;
  invalidate: () => void;
}) {
  const challenge = useServerFn(challengeScrim);
  const cancel = useServerFn(cancelMyScrim);
  const report = useServerFn(reportMyScrimResult);
  const [scoreHost, setScoreHost] = useState("");
  const [scoreOpponent, setScoreOpponent] = useState("");

  const isHost = myTeamId === scrim.team.id;
  const isOpponent = myTeamId != null && myTeamId === scrim.opponent?.id;
  const isParticipant = isHost || isOpponent;

  const challengeMutation = useMutation({
    mutationFn: () => challenge({ data: { scrimId: scrim.id } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Challenge sent.");
      invalidate();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancel({ data: { scrimId: scrim.id } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Scrim cancelled.");
      invalidate();
    },
  });

  const reportMutation = useMutation({
    mutationFn: () =>
      report({
        data: {
          scrimId: scrim.id,
          scoreTeam: Number(scoreHost),
          scoreOpponent: Number(scoreOpponent),
        },
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Practice result saved.");
      invalidate();
    },
  });

  const statusLabel =
    scrim.status === "open"
      ? "Looking for opponent"
      : scrim.status === "matched"
        ? "Matched"
        : "Played";

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-surface-gradient shadow-card",
        scrim.status === "open" && "border-primary/20",
        scrim.status === "completed" && "opacity-90",
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-background/25 px-4 py-3">
        <div className="flex items-center gap-2">
          <Badge variant={scrim.status === "open" ? "default" : "outline"}>{statusLabel}</Badge>
          <Badge variant="secondary">Bo{scrim.bestOf}</Badge>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Clock3 className="size-3.5" />
          {formatDateTime(scrim.startsAt)}
        </span>
      </div>

      <div className="p-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
          <TeamSide team={scrim.team} winner={scrim.winnerTeamId === scrim.team.id} />
          <span className="mx-auto grid size-10 place-items-center rounded-full border border-border bg-background/40 text-[10px] font-black text-muted-foreground">
            VS
          </span>
          {scrim.opponent ? (
            <TeamSide
              team={scrim.opponent}
              winner={scrim.winnerTeamId === scrim.opponent.id}
              right
            />
          ) : (
            <div className="text-center sm:text-right">
              <p className="font-black text-muted-foreground">Open slot</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {scrim.challengeCount} pending challenge{scrim.challengeCount === 1 ? "" : "s"}
              </p>
            </div>
          )}
        </div>

        {scrim.note ? (
          <p className="mt-4 rounded-xl border border-border/70 bg-background/25 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            {scrim.note}
          </p>
        ) : null}

        {scrim.status === "completed" ? (
          <div className="mt-4 flex items-center justify-center gap-3 rounded-xl border border-gold/20 bg-gold/5 px-4 py-3">
            <Trophy className="size-4 text-gold" />
            <span className="text-sm font-black tabular-nums text-foreground">
              {scrim.scoreTeam} – {scrim.scoreOpponent}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">Practice result</span>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" />
            Scrim results do not affect official EloShape standings.
          </p>

          <div className="flex flex-wrap gap-2">
            {scrim.status === "open" && isCaptain && !isHost ? (
              <Button
                size="sm"
                onClick={() => challengeMutation.mutate()}
                disabled={challengeMutation.isPending || outgoingStatus === "pending"}
              >
                {challengeMutation.isPending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Handshake className="size-4" />
                )}
                {outgoingStatus === "pending" ? "Challenge sent" : "Challenge team"}
              </Button>
            ) : null}

            {isCaptain && isHost && scrim.status !== "completed" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </div>

        {scrim.status === "matched" && isCaptain && isParticipant ? (
          <div className="mt-4 grid gap-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-4 sm:grid-cols-[1fr_5rem_5rem_auto] sm:items-end">
            <div>
              <p className="text-xs font-black text-foreground">Save practice result</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Score is always shown as {scrim.team.tag} vs {scrim.opponent?.tag}.
              </p>
            </div>
            <Input
              type="number"
              min={0}
              value={scoreHost}
              onChange={(event) => setScoreHost(event.target.value)}
              aria-label={scrim.team.name + " score"}
              placeholder="0"
            />
            <Input
              type="number"
              min={0}
              value={scoreOpponent}
              onChange={(event) => setScoreOpponent(event.target.value)}
              aria-label={(scrim.opponent?.name ?? "Opponent") + " score"}
              placeholder="0"
            />
            <Button
              size="sm"
              onClick={() => reportMutation.mutate()}
              disabled={!scoreHost || !scoreOpponent || reportMutation.isPending}
            >
              <Swords className="size-4" />
              Save
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function TeamSide({
  team,
  winner,
  right = false,
}: {
  team: ScrimPost["team"];
  winner: boolean;
  right?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", right && "sm:flex-row-reverse sm:text-right")}>
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-background/40 text-xs font-black text-primary",
          winner && "border-gold/30 bg-gold/10 text-gold",
        )}
      >
        {team.logoUrl ? (
          <img src={team.logoUrl} alt="" className="size-full object-cover" />
        ) : (
          team.tag
        )}
      </span>
      <div className="min-w-0">
        <Link
          to="/teams/$slug"
          params={{ slug: team.slug }}
          className="block truncate font-black text-foreground hover:text-primary"
        >
          {team.name}
        </Link>
        <p className="mt-1 text-xs text-muted-foreground">
          [{team.tag}]
          {team.division?.name ? " · " + team.division.name : ""}
          {winner ? " · Winner" : ""}
        </p>
      </div>
    </div>
  );
}

function ScrimMetric({
  label,
  value,
  gold = false,
}: {
  label: string;
  value: number;
  gold?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-20 rounded-xl border border-border bg-background/40 p-3 text-center",
        gold && "border-gold/20 bg-gold/5",
      )}
    >
      <p className={cn("text-xl font-black tabular-nums text-foreground", gold && "text-gold")}>
        {value}
      </p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
