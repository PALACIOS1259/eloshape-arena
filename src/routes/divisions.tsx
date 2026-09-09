import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

import { DivisionBadge } from "@/components/eloshape/DivisionBadge";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { directoryQuery } from "@/lib/queries";
import { canonicalMetadata } from "@/lib/site-metadata";

export const Route = createFileRoute("/divisions")({
  head: () => {
    const canonical = canonicalMetadata("/divisions");
    return {
      meta: [
        { title: "Divisions & eligibility — EloShape" },
        {
          name: "description",
          content:
            "How EloShape divisions work: Riot rank verifies which division you may enter, and points are earned only inside EloShape tournaments.",
        },
        { property: "og:title", content: "EloShape divisions & eligibility" },
        {
          property: "og:description",
          content: "Iron, Bronze, Silver and Gold divisions with verified Riot-rank eligibility.",
        },
        ...canonical.meta,
      ],
      links: canonical.links,
    };
  },
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(directoryQuery());
  },
  component: DivisionsPage,
});

function DivisionsPage() {
  const { data: directory } = useSuspenseQuery(directoryQuery());

  return (
    <div>
      <PageHeading
        eyebrow="Fair play"
        title="Divisions & eligibility"
        description="EloShape is built for amateur players, so brackets are separated by skill. Your Riot rank is verified once to place you in a division — after that, only EloShape results matter."
      />

      <PageContainer className="py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {directory.divisions.map((division) => (
            <div
              key={division.id}
              className="bg-surface-gradient shadow-card rounded-lg border border-border p-5"
            >
              <DivisionBadge division={division} size="md" />
              <p className="mt-4 text-sm text-muted-foreground">{division.description}</p>
              <p className="eyebrow mt-5">Eligible Riot tiers</p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {(division.riot_tiers as string[] | null)?.join(" · ") ?? "—"}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-surface-gradient shadow-card mt-10 rounded-lg border border-border p-6">
          <p className="eyebrow">Anti-smurf process</p>
          <ol className="mt-4 space-y-4 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
              Link your Riot account. EloShape reads only your rank for eligibility — no keys or
              credentials are stored client-side.
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
              Your division is assigned from that tier and re-checked periodically.
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
              Dominant or anomalous results trigger a manual eligibility review before points and
              prizes are confirmed.
            </li>
          </ol>
          <Button asChild className="mt-6">
            <Link to="/rules">See how points are awarded</Link>
          </Button>
        </div>
      </PageContainer>
    </div>
  );
}
