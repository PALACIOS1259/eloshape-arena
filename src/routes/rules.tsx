import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { directoryQuery } from "@/lib/queries";
import { formatPoints } from "@/lib/format";
import { canonicalMetadata } from "@/lib/site-metadata";

export const Route = createFileRoute("/rules")({
  head: () => {
    const canonical = canonicalMetadata("/rules");
    return {
      meta: [
        { title: "Points & rules — EloShape" },
        {
          name: "description",
          content:
            "The EloShape point system: configurable awards for participation, wins and placements, earned only in EloShape tournaments.",
        },
        { property: "og:title", content: "EloShape points & rules" },
        {
          property: "og:description",
          content: "Transparent, configurable point awards for the EloShape competitive circuit.",
        },
        ...canonical.meta,
      ],
      links: canonical.links,
    };
  },
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(directoryQuery());
  },
  component: RulesPage,
});

function RulesPage() {
  const { data: directory } = useSuspenseQuery(directoryQuery());

  return (
    <div>
      <PageHeading
        eyebrow="Ranking system"
        title="Points & rules"
        description="Every point on an EloShape leaderboard traces back to one of these rules, applied to a real EloShape match or placement. Solo Queue performance never awards points."
      />

      <PageContainer className="py-10">
        <div className="bg-surface-gradient overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-border px-4 py-2.5">
            <span className="eyebrow">Rule</span>
            <span className="eyebrow text-right">Points</span>
          </div>
          {directory.pointRules.map((rule) => (
            <div
              key={rule.code}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 last:border-0"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {rule.label}
                </span>
                <span className="eyebrow mt-1 block">{rule.code}</span>
              </span>
              <span className="tabular shrink-0 text-sm font-black text-gold">
                +{formatPoints(rule.points)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Card
            title="Season and monthly boards"
            body={`Season totals accumulate across ${directory.activeSeason?.name ?? "the season"}. Monthly totals reset each month so new players always have something to chase.`}
          />
          <Card
            title="Geography ladders"
            body="The same points feed city, province, country and regional leaderboards, so a Rosario player can win locally without beating all of LAS."
          />
          <Card
            title="Riot rank is eligibility only"
            body="Rank decides which division you can enter. It contributes zero points and never appears in the ranking formula."
          />
          <Card
            title="Reviews can adjust results"
            body="If an eligibility review finds a smurf, entries are voided and awarded points are removed from the ledger."
          />
        </div>
      </PageContainer>
    </div>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-surface-gradient shadow-card rounded-lg border border-border p-5">
      <p className="font-bold text-foreground">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
