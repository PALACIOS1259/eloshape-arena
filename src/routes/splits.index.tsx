import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { StatusBadge } from "@/components/eloshape/StatusBadge";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { formatDate } from "@/lib/format";
import { splitsQuery } from "@/lib/split-queries";
import { canonicalMetadata } from "@/lib/site-metadata";

export const Route = createFileRoute("/splits/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(splitsQuery()),
  head: () => {
    const canonical = canonicalMetadata("/splits");
    return {
      meta: [
        { title: "Semi-Splits — EloShape competitive calendar" },
        {
          name: "description",
          content:
            "Every EloShape Semi-Split: four Open Qualifiers, a 16-team Playoff bracket, Semifinals and the Grand Final.",
        },
        { property: "og:title", content: "EloShape Semi-Splits" },
        {
          property: "og:description",
          content: "Qualifiers, standings and playoff brackets for each EloShape Semi-Split.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...canonical.meta,
      ],
      links: canonical.links,
    };
  },
  errorComponent: () => (
    <PageContainer className="py-16">
      <EmptyState title="Splits unavailable" description="Please try again in a moment." />
    </PageContainer>
  ),
  notFoundComponent: () => (
    <PageContainer className="py-16">
      <EmptyState title="Not found" />
    </PageContainer>
  ),
  component: SplitsPage,
});

function SplitsPage() {
  const { data: splits } = useSuspenseQuery(splitsQuery());

  return (
    <div>
      <PageHeading
        eyebrow="Competitive structure"
        title="Semi-Splits"
        description="A season is divided into Semi-Splits. Each one runs four Open Qualifiers, seeds a 16-team Playoff bracket from split standings, then Semifinals and the Grand Final."
      />
      <PageContainer className="py-10">
        {splits.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {splits.map((split) => (
              <Link
                key={split.id}
                to="/splits/$slug"
                params={{ slug: split.slug }}
                className="bg-surface-gradient block rounded-lg border border-border p-5 transition-colors hover:border-orange"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="eyebrow">{split.season?.name ?? "Season"}</p>
                    <h2 className="mt-1 truncate text-lg font-semibold text-foreground">
                      {split.name}
                    </h2>
                  </div>
                  <StatusBadge status={split.status} />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {formatDate(split.starts_at)} — {formatDate(split.ends_at)} · {split.playoff_size}
                  -team playoffs
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No Semi-Splits yet"
            description="The first Semi-Split will appear here as soon as staff schedules it."
          />
        )}
      </PageContainer>
    </div>
  );
}
