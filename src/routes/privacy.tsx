import { createFileRoute } from "@tanstack/react-router";

import { PageContainer, PageHeading } from "@/components/layout/PageShell";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — EloShape" },
      {
        name: "description",
        content:
          "How EloShape handles player accounts, Riot account linking data and competitive records.",
      },
      { property: "og:title", content: "EloShape Privacy Policy" },
      {
        property: "og:description",
        content: "What data EloShape stores about players and Riot account links.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div>
      <PageHeading
        eyebrow="Legal"
        title="Privacy Policy"
        description="What EloShape stores, why it stores it, and what is never shown publicly."
      />
      <PageContainer className="prose-invert max-w-3xl space-y-6 py-10 text-sm text-muted-foreground">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
          Effective August 27, 2026
        </p>
        <section>
          <h2 className="text-base font-black text-foreground">Account data</h2>
          <p className="mt-2">
            EloShape accounts are managed with email and password authentication. Your email address
            is used for authentication and account recovery only and is never shown on public
            profiles or in public rankings.
          </p>
          <p className="mt-2">
            When you create an account, EloShape records the version and time of your acceptance of
            the Terms of Service and Privacy Policy.
          </p>
        </section>
        <section>
          <h2 className="text-base font-black text-foreground">Riot account linking</h2>
          <p className="mt-2">
            When you connect a Riot ID, EloShape asks the Riot Games API for your account identifier
            (PUUID) and your Solo Queue ranked snapshot. The PUUID is stored privately on our
            servers and is never exposed on public pages or through our public API. Public profiles
            may show your Riot ID, Solo Queue tier and division only.
          </p>
          <p className="mt-2">
            Linking a Riot ID through the Riot API confirms that the account exists. It does not
            prove account ownership. Ownership verification requires Riot Sign On, which is not yet
            available on EloShape.
          </p>
        </section>
        <section>
          <h2 className="text-base font-black text-foreground">Competitive records</h2>
          <p className="mt-2">
            Tournament entries, official match results, ranking points and achievements are public
            competitive records. Moderation notes and eligibility review notes are private to staff.
          </p>
          <p className="mt-2">
            When a participant reports or disputes a result, EloShape may store the proposed score,
            notes, an evidence URL supplied by the participant, confirmation or dispute status, and
            the final staff resolution. These dispute materials are limited to participating users
            and staff as needed to operate the competition; public tournament pages show the official
            competitive result rather than private dispute notes.
          </p>
        </section>
        <section>
          <h2 className="text-base font-black text-foreground">Deletion</h2>
          <p className="mt-2">
            You can request account deletion at any time. Historical tournament results may be
            retained in anonymised form to keep past brackets consistent.
          </p>
        </section>
        <p className="border-t border-border pt-6 text-xs">
          EloShape is not endorsed by Riot Games and does not reflect the views or opinions of Riot
          Games or anyone officially involved in producing or managing Riot Games properties. League
          of Legends and Riot Games are trademarks or registered trademarks of Riot Games, Inc.
          League of Legends © Riot Games, Inc.
        </p>
      </PageContainer>
    </div>
  );
}
