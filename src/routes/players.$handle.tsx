import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { Award, ShieldCheck, ShieldAlert } from "lucide-react";

import { DivisionBadge } from "@/components/eloshape/DivisionBadge";
import { EmptyState } from "@/components/eloshape/EmptyState";
import { MovementIndicator, PlayerAvatar } from "@/components/eloshape/PlayerRow";
import { StatTile } from "@/components/eloshape/StatTile";
import { PageContainer } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { formatDate, formatPoints, placementLabel, riotRankLabel, winRate } from "@/lib/format";
import { playerQuery } from "@/lib/queries";

export const Route = createFileRoute("/players/$handle")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(playerQuery(params.handle));
    if (!data) throw notFound();
    return { name: data.profile.display_name, handle: data.profile.handle };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Player unavailable — EloShape" }, { name: "robots", content: "noindex" }] };
    }
    const title = `${loaderData.name} — EloShape player profile`;
    const description = `EloShape points, division, record, achievements and tournament history for ${loaderData.name}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
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
      <section className="bg-hero border-b border-border">
        <PageContainer className="py-12">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <PlayerAvatar
                name={profile.display_name}
                url={profile.avatar_url}
                className="size-14 rounded-xl text-base"
              />
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                  {profile.display_name}
                </h1>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  @{profile.handle} ·{" "}
                  {[profile.city?.name, profile.province?.name, profile.country?.name]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <DivisionBadge division={profile.division} size="md" />
              <span
                className={`inline-flex items-center gap-1.5 text-xs ${eligible ? "text-success" : "text-warning"}`}
              >
                {eligible ? <ShieldCheck className="size-3.5" /> : <ShieldAlert className="size-3.5" />}
                {eligible ? "Eligibility verified" : `Eligibility: ${profile.eligibility}`}
              </span>
            </div>
          </div>

          {profile.bio ? (
            <p className="mt-6 max-w-2xl text-sm text-muted-foreground">{profile.bio}</p>
          ) : null}

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatTile
              label="Season points"
              value={formatPoints(profile.points_season)}
              hint={<MovementIndicator value={profile.rank_movement} />}
            />
            <StatTile label="Month points" value={formatPoints(profile.points_month)} />
            <StatTile
              label="Record"
              value={`${profile.wins}-${profile.losses}`}
              hint={`${winRate(profile.wins, profile.losses)} win rate`}
            />
            <StatTile label="Tournaments" value={profile.tournaments_played ?? 0} />
            <StatTile
              label="Riot rank (eligibility only)"
              value={riotRankLabel(profile.riot_tier ?? null, profile.riot_rank ?? null)}
            />
          </div>
        </PageContainer>
      </section>

      <PageContainer className="grid gap-8 py-10 lg:grid-cols-[1.4fr_minmax(0,1fr)]">
        <div className="min-w-0 space-y-8">
          <div>
            <p className="eyebrow">EloShape points ledger</p>
            <div className="bg-surface-gradient mt-3 overflow-hidden rounded-lg border border-border">
              {ledger.length ? (
                ledger.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 last:border-0"
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
                ))
              ) : (
                <div className="p-6">
                  <EmptyState
                    title="No points yet"
                    description="Points appear here after placing in an EloShape tournament."
                  />
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="eyebrow">Tournament history</p>
            <div className="mt-3 space-y-3">
              {entries.length ? (
                entries.map((entry) => (
                  <Link
                    key={entry.id}
                    to="/tournaments/$slug"
                    params={{ slug: entry.tournament?.slug ?? "" }}
                    className="bg-surface-gradient shadow-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border p-4 hover:border-brand/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {entry.tournament?.name}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {formatDate(entry.tournament?.starts_at)} · {entry.status}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="tabular block text-sm font-black text-foreground">
                        {placementLabel(entry.placement)}
                      </span>
                      <span className="tabular block text-xs text-gold">
                        +{formatPoints(entry.points_awarded)}
                      </span>
                    </span>
                  </Link>
                ))
              ) : (
                <EmptyState title="No tournaments played yet" />
              )}
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-8">
          <div>
            <p className="eyebrow">Achievements</p>
            <div className="mt-3 space-y-3">
              {achievements.length ? (
                achievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className="bg-surface-gradient shadow-card flex gap-3 rounded-lg border border-border p-4"
                  >
                    <Award className="mt-0.5 size-4 shrink-0 text-gold" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {achievement.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {achievement.description ?? formatDate(achievement.earned_at)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState title="No achievements yet" />
              )}
            </div>
          </div>

          <div>
            <p className="eyebrow">Teams</p>
            <div className="mt-3 space-y-3">
              {teams.length ? (
                teams.map((membership) =>
                  membership.team ? (
                    <Link
                      key={membership.team.id}
                      to="/teams/$slug"
                      params={{ slug: membership.team.slug }}
                      className="bg-surface-gradient shadow-card block rounded-lg border border-border p-4 hover:border-brand/50"
                    >
                      <p className="truncate text-sm font-semibold text-foreground">
                        {membership.team.name}
                      </p>
                      <p className="eyebrow mt-1">
                        {membership.role}
                        {membership.is_captain ? " · Captain" : ""}
                      </p>
                    </Link>
                  ) : null,
                )
              ) : (
                <EmptyState title="Not on a team" />
              )}
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
