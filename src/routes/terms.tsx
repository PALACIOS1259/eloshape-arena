import { createFileRoute } from "@tanstack/react-router";

import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { RIOT_LEGAL_NOTICE } from "@/lib/riot-legal";
import { canonicalMetadata } from "@/lib/site-metadata";

export const Route = createFileRoute("/terms")({
  head: () => {
    const canonical = canonicalMetadata("/terms");
    return {
      meta: [
        { title: "Terms of Service — EloShape" },
        {
          name: "description",
          content:
            "The rules for competing on EloShape: eligibility, fair play, division integrity and account conduct.",
        },
        { property: "og:title", content: "EloShape Terms of Service" },
        {
          property: "og:description",
          content: "Eligibility, fair play and account conduct rules for the EloShape circuit.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        ...canonical.meta,
      ],
      links: canonical.links,
    };
  },
  component: TermsPage,
});

function TermsPage() {
  return (
    <div>
      <PageHeading
        eyebrow="Legal"
        title="Terms of Service"
        description="Competing on EloShape means agreeing to these terms."
      />
      <PageContainer className="max-w-3xl space-y-6 py-10 text-sm text-muted-foreground">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
          Effective August 27, 2026
        </p>
        <section>
          <h2 className="text-base font-black text-foreground">Eligibility</h2>
          <p className="mt-2">
            EloShape runs divisions for lower-elo players. Your Riot Solo Queue rank determines
            which division you may enter. Eligibility decisions are made by EloShape staff; a valid
            Riot rank alone does not grant eligibility.
          </p>
        </section>
        <section>
          <h2 className="text-base font-black text-foreground">Fair play</h2>
          <p className="mt-2">
            Smurfing, account sharing, rank manipulation, and linking a Riot account you do not own
            are prohibited and may result in suspension. A Riot account may be linked to one
            EloShape player only.
          </p>
        </section>
        <section>
          <h2 className="text-base font-black text-foreground">Points and results</h2>
          <p className="mt-2">
            EloShape ranking points are awarded exclusively from EloShape tournament results. Riot
            Solo Queue performance never generates EloShape points and EloShape does not compute an
            alternative matchmaking rating.
          </p>
          <p className="mt-2">
            A participating solo player, or the captain of a registered team, may submit a match
            result. The opposing participant or captain can confirm that result. If the parties do
            not agree, the result enters a dispute and does not advance the bracket until EloShape
            staff resolves it.
          </p>
          <p className="mt-2">
            Staff may review submitted notes and evidence and may set the official score. The staff
            ruling recorded by EloShape controls the bracket, standings and points. Fabricated or
            misleading evidence may lead to disqualification, loss of eligibility or suspension.
          </p>
        </section>
        <section>
          <h2 className="text-base font-black text-foreground">Accounts</h2>
          <p className="mt-2">
            You are responsible for your account credentials and for the content you publish on your
            profile. Impersonating staff, Riot Games or other players is not permitted.
          </p>
        </section>
        <p className="border-t border-border pt-6 text-xs">{RIOT_LEGAL_NOTICE}</p>
      </PageContainer>
    </div>
  );
}
