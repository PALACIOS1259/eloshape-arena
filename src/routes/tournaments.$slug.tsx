import type { ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Crown,
  MapPin,
  Radio,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
} from "lucide-react";

import { BracketView, entryLabels } from "@/components/eloshape/BracketView";
import { DivisionBadge } from "@/components/eloshape/DivisionBadge";
import { EmptyState } from "@/components/eloshape/EmptyState";
import { PlayerAvatar } from "@/components/eloshape/PlayerRow";
import { StatusBadge } from "@/components/eloshape/StatusBadge";
import { TournamentRegisterButton } from "@/components/eloshape/TournamentRegisterButton";
import { PageContainer } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime, formatPoints, placementLabel } from "@/lib/format";
import { tournamentDetailQuery } from "@/lib/queries";
import { canonicalMetadata } from "@/lib/site-metadata";
import { cn } from "@/lib/utils";

const EVENT_STAGES = [
  { key: "registration_open", label: "Registration", description: "Build the field" },
  { key: "registration_closed", label: "Check-in", description: "Lock the bracket" },
  { key: "live", label: "Live bracket", description: "Play the event" },
  { key: "completed", label: "Results", description: "Final standings" },
] as const;

export const Route = createFileRoute("/tournaments/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(tournamentDetailQuery(params.slug));
    if (!data) throw notFound();
    return { name: data.tournament.name, subtitle: data.tournament.subtitle, slug: params.slug };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Tournament unavailable — EloShape" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const title = `${loaderData.name} — EloShape tournament`;
    const description =
      loaderData.subtitle ?? "Bracket, participants and results for this EloShape tournament.";
    const canonical = canonicalMetadata(`/tournaments/${encodeURIComponent(loaderData.slug)}`);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        ...canonical.meta,
      ],
      links: canonical.links,
    };
  },
  notFoundComponent: () => (
    <PageContainer className="py-20">
      <EmptyState
        title="Tournament not found"
        description="This bracket may have been removed or renamed."
        action={
          <Button asChild>
            <Link to="/tournaments">Back to tournaments</Link>
          </Button>
        }
      />
    </PageContainer>
  ),
  component: TournamentDetailPage,
});

function TournamentDetailPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(tournamentDetailQuery(slug));
  if (!data) return null;

  const { tournament, entries, matches } = data;
  const filled = tournament.participants_count ?? entries.length;
  const capacity = tournament.max_participants ?? 0;
  const pct = capacity ? Math.min(100, Math.round((filled / capacity) * 100)) : 0;
  const currentStageIndex = EVENT_STAGES.findIndex((stage) => stage.key === tournament.status);
  const isDemoFixture = tournament.slug.includes("-demo-");
  const podium = entries
    .filter((entry) => entry.placement && entry.placement <= 3)
    .sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99));
  const qualifierIndexByTournament = new Map(
    data.splitQualifiers.flatMap((qualifier) =>
      qualifier.qualifier_index == null ? [] : [[qualifier.id, qualifier.qualifier_index] as const],
    ),
  );
  const qualifiedFromThisEvent = data.splitQualifications
    .filter(
      (qualification) =>
        qualification.status === "qualified" &&
        qualification.qualified_from_tournament_id === tournament.id,
    )
    .sort((a, b) => (a.qualification_position ?? 999) - (b.qualification_position ?? 999));
  const isQualifier = tournament.split_phase === "qualifier" && tournament.qualifier_index != null;

  const qualificationLabel = (teamId: string | null | undefined) => {
    if (!teamId || !isQualifier) return null;
    const qualification = data.splitQualifications.find(
      (row) => row.team_id === teamId && row.status === "qualified",
    );
    if (!qualification?.qualified_from_tournament_id) return null;
    if (qualification.qualified_from_tournament_id === tournament.id) return "Qualified here";

    const sourceIndex = qualifierIndexByTournament.get(qualification.qualified_from_tournament_id);
    if (sourceIndex != null && sourceIndex < (tournament.qualifier_index ?? 0)) {
      return `Already qualified · Q${sourceIndex}`;
    }
    return null;
  };

  return (
    <div>
      <section className="bg-hero relative overflow-hidden border-b border-border/80">
        {tournament.banner_url ? (
          <div className="absolute inset-0">
            <img
              src={tournament.banner_url}
              alt=""
              className="size-full object-cover opacity-25 blur-[1px] scale-[1.03]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/65" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/40" />
          </div>
        ) : null}
        <div className="absolute left-[12%] top-0 size-80 -translate-y-1/2 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute right-[8%] top-12 size-64 rounded-full bg-gold/8 blur-3xl" />

        <PageContainer className="relative py-8 sm:py-12">
          <Link
            to="/tournaments"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-3.5" />
            Tournament circuit
          </Link>

          <div className="mt-5 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={tournament.status} />
                <DivisionBadge division={tournament.division} />
                <Badge variant="outline">{tournament.mode === "team" ? "5v5 Team" : "Solo"}</Badge>
                {tournament.season?.name ? (
                  <Badge variant="secondary">{tournament.season.name}</Badge>
                ) : null}
                {isDemoFixture ? <Badge variant="outline">Staging demo fixture</Badge> : null}
              </div>

              <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                {tournament.name}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {tournament.subtitle ??
                  "Official EloShape competition with verified eligibility, structured matches and circuit points."}
              </p>

              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3.5 text-primary" />
                  {formatDateTime(tournament.starts_at)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-primary" />
                  {tournament.region?.name ?? "LAS"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Swords className="size-3.5 text-primary" />
                  {tournament.format ?? "Format TBD"}
                </span>
                {tournament.prize ? (
                  <span className="inline-flex items-center gap-1.5 text-gold">
                    <Trophy className="size-3.5" />
                    {tournament.prize}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="w-full border-t border-border/60 pt-4 xl:w-[22rem] xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">Tournament field</p>
                  <p className="mt-1 text-xl font-black tabular-nums text-foreground">
                    {capacity ? `${filled}/${capacity}` : filled}
                  </p>
                </div>
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-lg bg-primary/8 text-muted-foreground",
                    tournament.status === "live" && "border-primary/30 bg-primary/10 text-primary",
                  )}
                >
                  {tournament.status === "live" ? (
                    <Radio className="size-4" />
                  ) : (
                    <Users className="size-4" />
                  )}
                </span>
              </div>

              {capacity ? (
                <>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted/70">
                    <div
                      className="bg-brand-gradient h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                    <span>{Math.max(0, capacity - filled)} spots remaining</span>
                    <span className="tabular-nums">{pct}% full</span>
                  </div>
                </>
              ) : null}

              {tournament.registration_closes_at ? (
                <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                  <Clock3 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <span>
                    Registration closes{" "}
                    <strong className="font-semibold text-foreground">
                      {formatDateTime(tournament.registration_closes_at)}
                    </strong>
                  </span>
                </p>
              ) : null}

              <div className="mt-4 [&_button]:w-full">
                <TournamentRegisterButton
                  slug={tournament.slug}
                  status={tournament.status}
                  mode={tournament.mode}
                />
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      <PageContainer className="py-7 sm:py-9">
        <EventProgress status={tournament.status} currentStageIndex={currentStageIndex} />

        <Tabs defaultValue="overview" className="mt-7">
          <div className="sticky top-16 z-30 -mx-2 bg-background/75 p-2 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
            <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl border border-border/70 bg-card/65 p-1 sm:w-fit sm:min-w-[34rem]">
              <TabsTrigger
                value="overview"
                className="rounded-lg px-4 py-2 text-xs font-black data-[state=active]:bg-primary/12 data-[state=active]:text-primary"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="participants"
                className="rounded-lg px-4 py-2 text-xs font-black data-[state=active]:bg-primary/12 data-[state=active]:text-primary"
              >
                Participants · {entries.length}
              </TabsTrigger>
              <TabsTrigger
                value="bracket"
                className="rounded-lg px-4 py-2 text-xs font-black data-[state=active]:bg-primary/12 data-[state=active]:text-primary"
              >
                Bracket · {matches.length}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="overview"
            className="mt-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-500"
          >
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)]">
              <div className="space-y-5">
                <section className="border-b border-border/60 pb-6">
                  <div>
                    <p className="eyebrow">Event brief</p>
                    <h2 className="mt-1 text-xl font-black text-foreground">
                      Everything you need before game one
                    </h2>
                  </div>
                  <div className="mt-4">
                    <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">
                      {tournament.description ??
                        "Tournament details will be published before check-in opens. Your division, geography and entry requirements are validated by EloShape when you register."}
                    </p>

                    {tournament.rules ? (
                      <div className="mt-7 border-t border-border/70 pt-6">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="size-4 text-primary" />
                          <h3 className="text-sm font-black text-foreground">Competition rules</h3>
                        </div>
                        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                          {tournament.rules}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </section>

                <section>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="eyebrow">Match day flow</p>
                      <h2 className="mt-1 text-xl font-black text-foreground">
                        From registration to results
                      </h2>
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">
                      Simple, server-validated workflow
                    </span>
                  </div>

                  <div className="mt-5 grid gap-5 md:grid-cols-3">
                    <FlowStep
                      number="01"
                      title="Register"
                      description="Enter the tournament while registration is open. Eligibility is checked automatically."
                    />
                    <FlowStep
                      number="02"
                      title="Check in"
                      description="Confirm your entry before the event so the bracket can lock correctly."
                    />
                    <FlowStep
                      number="03"
                      title="Compete"
                      description="Follow your bracket, report results and advance toward the final."
                    />
                  </div>
                </section>
              </div>

              <div className="space-y-5">
                <section className="rounded-2xl border border-border/70 bg-card/40 p-5">
                  <p className="eyebrow">Tournament access</p>
                  <h2 className="mt-1 text-lg font-black text-foreground">Ready to compete?</h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Open to{" "}
                    <strong className="font-semibold text-foreground">
                      {tournament.division?.name ?? "assigned"}
                    </strong>{" "}
                    players or teams. Riot rank is used for eligibility; EloShape tournament results
                    drive circuit standings.
                  </p>

                  <div className="mt-5 space-y-2.5">
                    <AccessCheck label="Division validated on the server" />
                    <AccessCheck label="Region eligibility validated" />
                    <AccessCheck
                      label={
                        tournament.mode === "team"
                          ? "Team roster checked before entry"
                          : "Player identity checked before entry"
                      }
                    />
                  </div>

                  <div className="mt-5 [&_button]:w-full">
                    <TournamentRegisterButton
                      slug={tournament.slug}
                      status={tournament.status}
                      mode={tournament.mode}
                    />
                  </div>
                </section>

                <section>
                  <p className="eyebrow">Event information</p>
                  <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4">
                    <InfoTile
                      icon={<CalendarDays className="size-4" />}
                      label="Start"
                      value={formatDateTime(tournament.starts_at)}
                    />
                    <InfoTile
                      icon={<MapPin className="size-4" />}
                      label="Region"
                      value={tournament.region?.name ?? "LAS"}
                    />
                    <InfoTile
                      icon={<Swords className="size-4" />}
                      label="Format"
                      value={tournament.format ?? "TBD"}
                    />
                    <InfoTile
                      icon={<Users className="size-4" />}
                      label="Mode"
                      value={tournament.mode === "team" ? "5v5 Team" : "Solo"}
                    />
                  </div>
                </section>
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="participants"
            className="mt-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-500"
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Tournament field</p>
                <h2 className="mt-1 text-2xl font-black text-foreground">
                  {tournament.status === "completed" ? "Final standings" : "Registered competitors"}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {entries.length} {entries.length === 1 ? "entry" : "entries"}
                  {capacity ? ` · ${capacity} total slots` : ""}.
                </p>
                {isDemoFixture && tournament.status === "completed" ? (
                  <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                    This staging fixture intentionally reuses some rosters and deterministic match
                    outcomes. Final standings show who finished where; the qualification outcome
                    below shows which teams actually claimed new Semi-Split slots after pass-down.
                  </p>
                ) : null}
              </div>
              <Badge variant="outline">
                {tournament.mode === "team" ? "Team field" : "Solo field"}
              </Badge>
            </div>

            {isQualifier && tournament.status === "completed" && qualifiedFromThisEvent.length ? (
              <section className="mt-5 overflow-hidden rounded-2xl border border-primary/20 bg-primary/[0.035] shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-primary/15 px-4 py-4 sm:px-5">
                  <div>
                    <p className="eyebrow">Qualification outcome</p>
                    <h3 className="mt-1 text-lg font-black text-foreground">
                      New playoff spots earned from this qualifier
                    </h3>
                    <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                      Final standings and qualification are different concepts. If a high finisher
                      was already qualified from an earlier event, its slot passes down to the next
                      eligible team.
                    </p>
                  </div>
                  <Badge variant="outline">{qualifiedFromThisEvent.length} new qualifiers</Badge>
                </div>
                <div className="grid gap-px bg-border/60 sm:grid-cols-2 xl:grid-cols-4">
                  {qualifiedFromThisEvent.map((qualification) => {
                    const entry = entries.find(
                      (candidate) => candidate.team?.id === qualification.team_id,
                    );
                    const name = entry?.team?.name ?? "Qualified team";
                    const passDown =
                      entry?.placement != null && entry.placement > qualifiedFromThisEvent.length;
                    return (
                      <div
                        key={qualification.team_id}
                        className="bg-background/55 px-4 py-4 sm:px-5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                            Slot #{qualification.qualification_position}
                          </span>
                          {passDown ? (
                            <Badge variant="secondary" className="text-[9px]">
                              Pass-down
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-2 truncate text-sm font-black text-foreground">{name}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {entry?.placement
                            ? `Finished ${placementLabel(entry.placement)} in this event`
                            : "Qualified from this event"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {podium.length ? (
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {podium.map((entry) => {
                  const name = entry.team?.name ?? entry.profile?.display_name ?? "TBD";
                  return (
                    <PodiumCard
                      key={entry.id}
                      placement={entry.placement ?? 0}
                      name={name}
                      points={entry.points_awarded}
                    />
                  );
                })}
              </div>
            ) : null}

            {entries.length ? (
              <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-surface-gradient shadow-card">
                <div className="hidden grid-cols-[4rem_minmax(0,1fr)_8rem_8rem] gap-3 border-b border-border bg-background/25 px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground sm:grid">
                  <span>Seed</span>
                  <span>Competitor</span>
                  <span className="text-right">Placement</span>
                  <span className="text-right">Points</span>
                </div>

                {entries.map((entry, index) => {
                  const name = entry.team?.name ?? entry.profile?.display_name ?? "TBD";
                  const href =
                    entry.profile != null
                      ? {
                          to: "/players/$handle" as const,
                          params: { handle: entry.profile.handle },
                        }
                      : entry.team != null
                        ? { to: "/teams/$slug" as const, params: { slug: entry.team.slug } }
                        : null;

                  return (
                    <div
                      key={entry.id}
                      className="group grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/70 px-4 py-4 transition-colors last:border-0 hover:bg-primary/[0.035] sm:grid-cols-[4rem_minmax(0,1fr)_8rem_8rem] sm:px-5"
                    >
                      <span className="grid size-8 place-items-center rounded-lg border border-border bg-background/40 text-xs font-black tabular-nums text-muted-foreground">
                        {entry.seed ?? index + 1}
                      </span>

                      <span className="flex min-w-0 items-center gap-3">
                        <PlayerAvatar name={name} />
                        <span className="min-w-0">
                          {href ? (
                            <Link
                              to={href.to}
                              params={href.params as never}
                              className="block truncate text-sm font-black text-foreground transition-colors group-hover:text-primary"
                            >
                              {name}
                            </Link>
                          ) : (
                            <span className="block truncate text-sm font-black text-foreground">
                              {name}
                            </span>
                          )}
                          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                            <span>{entry.status.replaceAll("_", " ")}</span>
                            {qualificationLabel(entry.team?.id) ? (
                              <span className="rounded-full border border-primary/20 bg-primary/8 px-1.5 py-0.5 text-[9px] tracking-[0.08em] text-primary">
                                {qualificationLabel(entry.team?.id)}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </span>

                      <span className="text-right sm:block">
                        <span className="block text-sm font-black tabular-nums text-foreground">
                          {placementLabel(entry.placement)}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-muted-foreground sm:hidden">
                          +{formatPoints(entry.points_awarded)} pts
                        </span>
                      </span>

                      <span className="hidden text-right text-sm font-black tabular-nums text-gold sm:block">
                        +{formatPoints(entry.points_awarded)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-border bg-surface-gradient p-5 shadow-card">
                <EmptyState
                  title="No participants yet"
                  description="Entries appear here as players or teams register and check in."
                />
              </div>
            )}
          </TabsContent>

          <TabsContent
            value="bracket"
            className="mt-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-500"
          >
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Championship bracket</p>
                <h2 className="mt-1 text-2xl font-black text-foreground">Road to the title</h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Follow every matchup from the opening round through the championship. Open a match
                  to report a result or view its dispute status.
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">{matches.length} matches</Badge>
                <Badge variant="outline">Single elimination</Badge>
              </div>
            </div>

            {matches.length ? (
              <BracketView matches={matches} entries={entryLabels(entries)} linkMatches />
            ) : (
              <div className="rounded-2xl border border-border bg-surface-gradient p-5 shadow-card">
                <EmptyState
                  title="Bracket not generated yet"
                  description="The bracket is seeded once registration closes and check-in completes."
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PageContainer>
    </div>
  );
}

function EventProgress({
  status,
  currentStageIndex,
}: {
  status: string;
  currentStageIndex: number;
}) {
  const completed = status === "completed";

  return (
    <section className="border-b border-border/60 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Event progress</p>
          <p className="mt-1 text-sm font-black text-foreground">
            {completed ? "Tournament complete" : "Follow the event from entry to final results"}
          </p>
        </div>
        {status === "live" ? (
          <span className="inline-flex items-center gap-2 text-xs font-black text-primary">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            LIVE
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        {EVENT_STAGES.map((stage, index) => {
          const active = stage.key === status;
          const passed = completed || (currentStageIndex >= 0 && index < currentStageIndex);

          return (
            <div
              key={stage.key}
              className={cn("relative px-1 py-2 transition-colors", active && "text-primary")}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-background/40 text-xs font-black text-muted-foreground",
                    active && "border-primary/35 bg-primary/12 text-primary",
                    passed && !active && "border-primary/20 text-primary",
                  )}
                >
                  {passed && !active ? <CheckCircle2 className="size-4" /> : index + 1}
                </span>
                <div className="min-w-0">
                  <p className={cn("text-xs font-black text-foreground", active && "text-primary")}>
                    {stage.label}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                    {stage.description}
                  </p>
                </div>
              </div>
              {index < EVENT_STAGES.length - 1 ? (
                <ChevronRight className="absolute right-2 top-1/2 hidden size-3.5 -translate-y-1/2 text-muted-foreground/35 sm:block" />
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FlowStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="group">
      <span className="text-2xl font-black tabular-nums text-primary/40 transition-colors duration-300 group-hover:text-primary/70">
        {number}
      </span>
      <h3 className="mt-2 text-sm font-black text-foreground">{title}</h3>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function AccessCheck({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2.5 text-xs font-semibold text-muted-foreground">
      <CheckCircle2 className="size-3.5 shrink-0 text-primary" />
      {label}
    </p>
  );
}

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="text-primary">{icon}</span>
      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-xs font-black text-foreground">{value}</p>
    </div>
  );
}

function PodiumCard({
  placement,
  name,
  points,
}: {
  placement: number;
  name: string;
  points: number | null;
}) {
  const first = placement === 1;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-surface-gradient p-5 shadow-card",
        first && "border-gold/30 bg-gold/[0.035]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "grid size-10 place-items-center rounded-xl border border-border bg-background/40 text-sm font-black text-muted-foreground",
            first && "border-gold/30 bg-gold/10 text-gold",
          )}
        >
          {first ? <Crown className="size-4" /> : placement}
        </span>
        <span className="text-xs font-black tabular-nums text-gold">
          +{formatPoints(points)} pts
        </span>
      </div>
      <p className="mt-5 truncate text-lg font-black text-foreground">{name}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {placementLabel(placement)} place
      </p>
    </div>
  );
}
