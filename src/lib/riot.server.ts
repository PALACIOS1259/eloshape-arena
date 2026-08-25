/**
 * Riot Games API abstraction — SERVER ONLY.
 *
 * ============================================================================
 * TODO: PRODUCTION RIOT INTEGRATION (not implemented in the MVP)
 * ============================================================================
 * This module is the single boundary through which EloShape will ever talk to
 * Riot. Nothing here may be imported from a component, a route module, or any
 * `*.functions.ts` module scope. Import it lazily inside a server-function
 * handler:
 *
 *   const { fetchSoloQueueRank } = await import("@/lib/riot.server");
 *
 * Secrets:
 *  - The Riot API key MUST live in a server-side secret named `RIOT_API_KEY`
 *    (Project Settings -> Secrets) and MUST be read with
 *    `process.env['RIOT_API_KEY']` *inside* a handler — never at module scope,
 *    never via `import.meta.env`, never prefixed with `VITE_`.
 *  - RSO (Riot Sign On) client id/secret will also be server-only secrets.
 *
 * Planned steps:
 *  1. Register the product with Riot and obtain a production API key.
 *  2. Implement RSO OAuth: /authorize redirect -> callback server route under
 *     `src/routes/api/public/riot/callback.ts` -> exchange code for tokens
 *     server-side -> store `puuid` on `riot_accounts` (never the tokens in the
 *     browser).
 *  3. Implement `GET /lol/league/v4/entries/by-puuid/{puuid}` to read the
 *     RANKED_SOLO_5x5 tier and persist it on `riot_accounts`.
 *  4. Add a scheduled refresh (pg_cron -> `/api/public/hooks/riot-sync`) to
 *     re-verify ranks and flag division mismatches for eligibility review.
 *  5. Respect Riot rate limits with a queue and cache responses.
 *
 * IMPORTANT COMPETITIVE RULE: Riot data is used ONLY to determine which
 * EloShape division a player is eligible for. EloShape ranking points are
 * never derived from Riot Solo Queue matches — only from EloShape tournament
 * results.
 * ============================================================================
 */

export type RiotTier = "IRON" | "BRONZE" | "SILVER" | "GOLD";

export type SoloQueueSnapshot = {
  puuid: string;
  riotId: string;
  tier: RiotTier | string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  fetchedAt: string;
  source: "mock" | "riot";
};

/** Divisions a Solo Queue tier makes a player eligible for. */
export const DIVISION_FOR_TIER: Record<string, string> = {
  IRON: "iron",
  BRONZE: "bronze",
  SILVER: "silver",
  GOLD: "gold",
};

export function divisionForTier(tier: string | null | undefined): string | null {
  if (!tier) return null;
  return DIVISION_FOR_TIER[tier.toUpperCase()] ?? null;
}

function requireApiKey(): string | null {
  // Read inside the call, never at module scope.
  return process.env["RIOT_API_KEY"] ?? null;
}

/**
 * MVP stub. Returns a deterministic mock snapshot so the "Connect Riot Account"
 * flow can be designed and tested without any credential. Once `RIOT_API_KEY`
 * exists this becomes a real request to the platform routing host
 * (e.g. https://la2.api.riotgames.com) with the `X-Riot-Token` header.
 */
export async function fetchSoloQueueRank(riotId: string): Promise<SoloQueueSnapshot> {
  const apiKey = requireApiKey();

  if (apiKey) {
    // TODO: replace the stub below with the real account-v1 + league-v4 calls.
    // const account = await fetch(`https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${name}/${tagLine}`, { headers: { "X-Riot-Token": apiKey } })
    // const entries = await fetch(`https://la2.api.riotgames.com/lol/league/v4/entries/by-puuid/${account.puuid}`, { headers: { "X-Riot-Token": apiKey } })
  }

  const tiers: RiotTier[] = ["IRON", "BRONZE", "SILVER", "GOLD"];
  const seed = [...riotId].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const ranks = ["I", "II", "III", "IV"];

  return {
    puuid: `mock-${seed.toString(16)}`,
    riotId,
    tier: tiers[seed % tiers.length]!,
    rank: ranks[seed % ranks.length]!,
    leaguePoints: seed % 100,
    wins: 20 + (seed % 40),
    losses: 15 + (seed % 30),
    fetchedAt: new Date().toISOString(),
    source: "mock",
  };
}
