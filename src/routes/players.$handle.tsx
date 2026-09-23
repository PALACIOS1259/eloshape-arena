import type { ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { Award, ChevronRight, ShieldAlert, ShieldCheck, Swords, Trophy } from "lucide-react";

import { DivisionBadge } from "@/components/eloshape/DivisionBadge";
import { EmptyState } from "@/components/eloshape/EmptyState";
import { MovementIndicator, PlayerAvatar } from "@/components/eloshape/PlayerRow";
import { PageContainer } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { formatDate, formatPoints, placementLabel, riotRankLabel, winRate } from "@/lib/format";
import { playerQuery } from "@/lib/queries";
import { canonicalMetadata } from "@/lib/site-metadata";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/players/$handle")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(playerQuery(params.handle));
    if (!data) throw notFound();
    return { name: data.profile.display_name, handle: data.profile.handle };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Player unavailable — EloShape" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${loaderData.name} — EloShape player profile`;
    const description = `EloShape points, division, record, achievements and tournament history for ${loaderData.name}.`;
    const canonical = canonicalMetadata(`/players/${encodeURIComponent(loaderData.handle)}`);
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
        title="Player not found"
        action={
          <Button asChild>
            <Link to="/rankings">Back to rankings</Link>
          </Button>
        }
      />
    </PageContainer>
  ),
  component: PlayerPage,
});

function PlayerPage() {
  const { handle } = Route.useParams();
  const { data } = useSuspenseQuery(playerQuery(handle));
  if (!data) return null;

  const { profile, ledger, achievements, teams, entries } = data;
  const eligible = profile.eligibility === "eligible";

  return (
    <div>
      <section className="relative overflow-hidden border-b border-border/70 bg-gradient-to-br from-background via-background to-primary/[0.025]">
        <div className="pointer-events-none absolute left-1/2 top-0 h-56 w-[70vw] -translate-x-1/2 rounded-full bg-primary/[0.04] blur-3xl" />
        <PageContainer className="relative py-8 sm:py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-4">
                <PlayerAvatar
                  name={profile.display_name}
                  url={profile.avatar_url}
                  className="size-14 rounded-2xl text-base"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                      {profile.display_name}
                    </h1>
                    <DivisionBadge division={profile.division} size="md" />
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    @{profile.handle}
                    {[profile.city?.name, profile.province?.name, profile.country?.name]
                      .filter(Boolean)
                      .length
                      ? ` · ${[profile.city?.name, profile.province?.name, profile.country?.name]
                          .filter(Boolean)
                          .join(", ")}`
                      : ""}
                  </p>
                </div>
              </div>

              {profile.bio ? (
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {profile.bio}
                </p>
              ) : null}

              <p
                className={cn(
                  "mt-4 inline-flex items-center gap-1.5 text-xs font-semibold",
                  eligible ? "text-success" : "text-warning",
                )}
              >
                {eligible ? (
                  <ShieldCheck className="size-3.5" />
                ) : (
                  <ShieldAlert className="size-3.5" />
                )}
                {eligible ? "Eligibility verified" : `Eligibility: ${profile.eligibility}`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-7 gap-y-4 border-t border-border/60 pt-5 sm:grid-cols-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
              <Metric
                label="Season"
                value={formatPoints(profile.points_season)}
                extra={<MovementIndicator value={profile.rank_movement} />}
                accent
              />
              <Metric label="Month" value={formatPoints(profile.points_month)} />
              <Metric
                label="Record"
                value={`${profile.wins}-${profile.losses}`}
                extra={winRate(profile.wins, profile.losses)}
              />
              <Metric label="Events" value={String(profile.tournaments_played ?? 0)} />
              <Metric
                label="Riot rank"
                value={riotRankLabel(profile.riot_tier ?? null, profile.riot_rank ?? null)}
              />
            </div>
          </div>
        </PageContainer>
      </section>

      <PageContainer className="grid gap-8 py-8 lg:grid-cols-[1.35fr_minmax(0,0.9fr)]">
        <div className="min-w-0 space-y-8">
          <section>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Official history</p>
                <h2 className="mt-1 text-xl font-black text-foreground">Tournament results</h2>
              </div>
              <Swords className="size-4 text-muted-foreground" />
            </div>

            {entries.length ? (
              <div className="mt-3 overflow-hidden rounded-2xl border border-border/70 bg-card/45">
                {entries.map((entry) => (
                  <Link
                    key={entry.id}
                    to="/tournaments/$slug"
                    params={{ slug: entry.tournament?.slug ?? "" }}
                    className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border/60 px-4 py-4 transition-colors last:border-0 hover:bg-primary/[0.035]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                        {entry.tournament?.name}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {formatDate(entry.tournament?.starts_at)} · {entry.status}
                      </span>
                    </span>
                    <span className="flex items-center gap-4 text-right">
                      <span>
                        <span className="tabular block text-sm font-black text-foreground">
                          {placementLabel(entry.placement)}
                        </span>
                        <span className="tabular block text-xs text-gold">
                          +{formatPoints(entry.points_awarded)}
                        </span>
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-3">
                <EmptyState title="No tournaments played yet" />
              </div>
            )}
          </section>

          <section>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Scoring history</p>
                <h2 className="mt-1 text-xl font-black text-foreground">Points ledger</h2>
              </div>
              <Trophy className="size-4 text-gold" />
            </div>

            {ledger.length ? (
              <div className="mt-3 divide-y divide-border/60 rounded-2xl border border-border/70 bg-card/35">
                {ledger.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {row.rule?.label ?? row.rule_code}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {row.tournament?.name ?? row.note ?? "EloShape circuit"} ·{" "}
                        {formatDate(row.awarded_at)}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-sm font-black text-gold">
                      +{formatPoints(row.points)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3">
                <EmptyState
                  title="No points yet"
                  description="Points appear here after competing in EloShape tournaments."
                />
              </div>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-8">
          <section>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Recognition</p>
                <h2 className="mt-1 text-xl font-black text-foreground">Achievements</h2>
              </div>
              <Award className="size-4 text-gold" />
            </div>

            {achievements.length ? (
              <div className="mt-3 divide-y divide-border/60 rounded-2xl border border-border/70 bg-card/35">
                {achievements.map((achievement) => (
                  <div key={achievement.id} className="flex gap-3 px-4 py-3.5">
                    <Award className="mt-0.5 size-4 shrink-0 text-gold" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">
                        {achievement.title}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {achievement.description ?? formatDate(achievement.earned_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3">
                <EmptyState title="No achievements yet" />
              </div>
            )}
          </section>

          <section>
            <p className="eyebrow">Team history</p>
            <h2 className="mt-1 text-xl font-black text-foreground">Teams</h2>

            {teams.length ? (
              <div className="mt-3 divide-y divide-border/60 rounded-2xl border border-border/70 bg-card/35">
                {teams.map((membership) =>
                  membership.team ? (
                    <Link
                      key={membership.team.id}
                      to="/teams/$slug"
                      params={{ slug: membership.team.slug }}
                      className="group flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-primary/[0.035]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                          {membership.team.name}
                        </span>
                        <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                          {membership.role}
                          {membership.is_captain ? " · Captain" : ""}
                        </span>
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                    </Link>
                  ) : null,
                )}
              </div>
            ) : (
              <div className="mt-3">
                <EmptyState title="Not on a team" />
              </div>
            )}
          </section>
        </aside>
      </PageContainer>
    </div>
  );
}

function Metric({
  label,
  value,
  extra,
  accent = false,
}: {
  label: string;
  value: string;
  extra?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className={cn("truncate text-lg font-black text-foreground", accent && "text-gold")}>
        {value}
      </p>
      <div className="mt-0.5 flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
          {label}
        </span>
        {extra ? <span className="text-[10px] text-muted-foreground">{extra}</span> : null}
      </div>
    </div>
  );
}
