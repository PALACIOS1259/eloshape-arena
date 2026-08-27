/**
 * Riot Games API boundary — SERVER ONLY.
 *
 * This module is the ONLY place in EloShape that talks to Riot over HTTP.
 * Rules:
 *  - Never import it from a component, a route module, or the module scope of a
 *    `*.functions.ts` file. Load it lazily inside a server-function handler:
 *      const { fetchRiotAccount } = await import("@/lib/riot.server");
 *  - The API key is read with `process.env["RIOT_API_KEY"]` INSIDE each call.
 *    It is never logged, never returned, never placed in a query string, and
 *    never prefixed with `VITE_`.
 *
 * COMPETITIVE RULE: Riot data determines ONLY which EloShape division a player
 * is eligible for. EloShape ranking points come exclusively from EloShape
 * tournament results — never from Solo Queue.
 *
 * ---------------------------------------------------------------------------
 * FUTURE: Riot Sign On (RSO) ownership verification — NOT implemented.
 * ---------------------------------------------------------------------------
 * An API-key lookup only proves the Riot account exists. It does NOT prove the
 * EloShape user owns it. Ownership requires RSO (approved production OAuth
 * credentials), planned as:
 *   GET /api/riot/connect   -> redirect to Riot authorize (state + PKCE)
 *   GET /api/riot/callback  -> exchange code server-side, read /riot/account/v1/accounts/me,
 *                              compare PUUID with the linked account, then set
 *                              ownership_verified = true, verification_method = 'rso'.
 * Future server-only secret NAMES (values supplied by the project owner):
 *   RIOT_RSO_CLIENT_ID, RIOT_RSO_CLIENT_SECRET, RIOT_RSO_REDIRECT_URI
 * Availability is inferred by `isRsoEnabled()` — the UI must keep ownership
 * verification disabled until it returns true.
 */

export type RiotPlatform = "LA2";

export const RIOT_PLATFORMS: Record<
  RiotPlatform,
  { label: string; host: string; regional: string }
> = {
  // Extensible: add BR1/NA1/EUW1... with their regional routing host.
  LA2: {
    label: "LAS (Latin America South)",
    host: "https://la2.api.riotgames.com",
    regional: "https://americas.api.riotgames.com",
  },
};

export const DEFAULT_PLATFORM: RiotPlatform = "LA2";

/** Tiers EloShape currently runs divisions for. */
export const SUPPORTED_TIERS = ["IRON", "BRONZE", "SILVER", "GOLD"] as const;

export type RiotAccountIdentity = {
  puuid: string;
  gameName: string;
  tagLine: string;
};

export type SoloQueueSnapshot = {
  tier: string; // "UNRANKED" when Riot reports no RANKED_SOLO_5x5 entry
  rank: string | null;
  leaguePoints: number;
  wins: number;
  losses: number;
  queueType: string | null;
  fetchedAt: string;
  source: "riot" | "mock";
};

export type SummonerSnapshot = {
  summonerLevel: number;
  fetchedAt: string;
  source: "riot" | "mock";
};

export type RiotErrorCode =
  | "not_configured"
  | "invalid_riot_id"
  | "not_found"
  | "unauthorized"
  | "rate_limited"
  | "unavailable"
  | "timeout"
  | "unknown";

const USER_MESSAGE: Record<RiotErrorCode, string> = {
  not_configured: "Riot integration is not configured yet.",
  invalid_riot_id: "Check your Riot ID and tag line.",
  not_found: "We couldn't find that Riot account.",
  unauthorized: "Riot integration is temporarily unavailable.",
  rate_limited: "Riot is rate limiting us right now. Please try again in a moment.",
  unavailable: "Riot's service is temporarily unavailable. Please try again shortly.",
  timeout: "Riot did not respond in time. Please try again.",
  unknown: "Riot data sync is temporarily unavailable.",
};

export class RiotError extends Error {
  readonly code: RiotErrorCode;
  readonly retryAfterSeconds: number | null;

  constructor(code: RiotErrorCode, retryAfterSeconds: number | null = null) {
    super(USER_MESSAGE[code]);
    this.name = "RiotError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  get userMessage() {
    return USER_MESSAGE[this.code];
  }
}

const TIMEOUT_MS = 9000;

function apiKey(): string | null {
  // Read at call time, never at module scope.
  return process.env["RIOT_API_KEY"]?.trim() || null;
}

/** True when a Riot API key is present in the server environment. */
export function isRiotConfigured(): boolean {
  return apiKey() !== null || isMockMode();
}

/** Explicit development/test mock mode. Production behaviour is always real. */
export function isMockMode(): boolean {
  return process.env["RIOT_MOCK_MODE"] === "1";
}

/** RSO is only enabled once real OAuth credentials exist. */
export function isRsoEnabled(): boolean {
  return Boolean(process.env["RIOT_RSO_CLIENT_ID"] && process.env["RIOT_RSO_CLIENT_SECRET"]);
}

export function validateRiotId(gameName: string, tagLine: string) {
  const name = (gameName ?? "").trim();
  const tag = (tagLine ?? "").replace(/^#/, "").trim();
  if (name.length < 3 || name.length > 16) throw new RiotError("invalid_riot_id");
  if (tag.length < 2 || tag.length > 5) throw new RiotError("invalid_riot_id");
  if (!/^[\p{L}\p{N} _.-]+$/u.test(name)) throw new RiotError("invalid_riot_id");
  if (!/^[\p{L}\p{N}]+$/u.test(tag)) throw new RiotError("invalid_riot_id");
  return { gameName: name, tagLine: tag };
}

type RiotFetchResult = { status: number; body: unknown; retryAfter: number | null };

async function riotFetch(url: string, key: string): Promise<RiotFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      // Header only. The key never appears in a URL and is never logged.
      headers: { "X-Riot-Token": key, Accept: "application/json" },
      signal: controller.signal,
    });
    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfter = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : null;
    let body: unknown = null;
    const text = await response.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }
    return {
      status: response.status,
      body,
      retryAfter: Number.isFinite(retryAfter) ? retryAfter : null,
    };
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw new RiotError("timeout");
    // Log safe metadata only — never headers or credentials.
    console.error("[riot] network failure", { name: (error as Error)?.name });
    throw new RiotError("unavailable");
  } finally {
    clearTimeout(timer);
  }
}

function throwForStatus(status: number, retryAfter: number | null): never {
  if (status === 400) throw new RiotError("invalid_riot_id");
  if (status === 401 || status === 403) {
    console.error("[riot] credential rejected by Riot API", { status });
    throw new RiotError("unauthorized");
  }
  if (status === 404) throw new RiotError("not_found");
  if (status === 429) throw new RiotError("rate_limited", retryAfter ?? 30);
  if (status >= 500) throw new RiotError("unavailable");
  console.error("[riot] unexpected status", { status });
  throw new RiotError("unknown");
}

/** ACCOUNT-V1 lookup via the regional routing host (americas for LAS). */
export async function fetchRiotAccount(
  gameNameInput: string,
  tagLineInput: string,
  platform: RiotPlatform = DEFAULT_PLATFORM,
): Promise<RiotAccountIdentity> {
  const { gameName, tagLine } = validateRiotId(gameNameInput, tagLineInput);

  if (isMockMode()) return mockIdentity(gameName, tagLine);

  const key = apiKey();
  if (!key) throw new RiotError("not_configured");

  const base = RIOT_PLATFORMS[platform].regional;
  const url = `${base}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  const { status, body, retryAfter } = await riotFetch(url, key);
  if (status !== 200) throwForStatus(status, retryAfter);

  const account = body as { puuid?: string; gameName?: string; tagLine?: string } | null;
  if (!account?.puuid) throw new RiotError("not_found");
  return {
    puuid: account.puuid,
    gameName: account.gameName ?? gameName,
    tagLine: account.tagLine ?? tagLine,
  };
}

type LeagueEntry = {
  queueType?: string;
  tier?: string;
  rank?: string;
  leaguePoints?: number;
  wins?: number;
  losses?: number;
};

/** LEAGUE-V4 solo queue snapshot via the platform routing host (la2 for LAS). */
export async function fetchSoloQueueSnapshot(
  puuid: string,
  platform: RiotPlatform = DEFAULT_PLATFORM,
): Promise<SoloQueueSnapshot> {
  if (isMockMode()) return mockSnapshot(puuid);

  const key = apiKey();
  if (!key) throw new RiotError("not_configured");

  const base = RIOT_PLATFORMS[platform].host;
  const url = `${base}/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`;
  const { status, body, retryAfter } = await riotFetch(url, key);
  if (status !== 200) throwForStatus(status, retryAfter);

  const entries = Array.isArray(body) ? (body as LeagueEntry[]) : [];
  const solo = entries.find((entry) => entry.queueType === "RANKED_SOLO_5x5");

  if (!solo?.tier) return unrankedSnapshot("riot");

  return {
    tier: solo.tier.toUpperCase(),
    rank: solo.rank ?? null,
    leaguePoints: solo.leaguePoints ?? 0,
    wins: solo.wins ?? 0,
    losses: solo.losses ?? 0,
    queueType: "RANKED_SOLO_5x5",
    fetchedAt: new Date().toISOString(),
    source: "riot",
  };
}

type RiotSummonerResponse = {
  puuid?: string;
  summonerLevel?: number;
};

/** SUMMONER-V4 account-level snapshot via the platform routing host. */
export async function fetchSummonerSnapshot(
  puuid: string,
  platform: RiotPlatform = DEFAULT_PLATFORM,
): Promise<SummonerSnapshot> {
  if (isMockMode()) return mockSummonerSnapshot(puuid);

  const key = apiKey();
  if (!key) throw new RiotError("not_configured");

  const base = RIOT_PLATFORMS[platform].host;
  const url = `${base}/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`;
  const { status, body, retryAfter } = await riotFetch(url, key);
  if (status !== 200) throwForStatus(status, retryAfter);

  const summoner = body as RiotSummonerResponse | null;
  if (
    !summoner ||
    typeof summoner.summonerLevel !== "number" ||
    !Number.isFinite(summoner.summonerLevel) ||
    summoner.summonerLevel < 0
  ) {
    throw new RiotError("unknown");
  }

  return {
    summonerLevel: summoner.summonerLevel,
    fetchedAt: new Date().toISOString(),
    source: "riot",
  };
}

function unrankedSnapshot(source: "riot" | "mock"): SoloQueueSnapshot {
  return {
    tier: "UNRANKED",
    rank: null,
    leaguePoints: 0,
    wins: 0,
    losses: 0,
    queueType: null,
    fetchedAt: new Date().toISOString(),
    source,
  };
}

// --- development mock mode (RIOT_MOCK_MODE=1) --------------------------------

function seedOf(value: string) {
  return [...value].reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function mockIdentity(gameName: string, tagLine: string): RiotAccountIdentity {
  return {
    puuid: `mock-${seedOf(`${gameName}#${tagLine}`).toString(16)}`,
    gameName,
    tagLine,
  };
}

function mockSnapshot(puuid: string): SoloQueueSnapshot {
  const seed = seedOf(puuid);
  const ranks = ["I", "II", "III", "IV"];
  return {
    tier: SUPPORTED_TIERS[seed % SUPPORTED_TIERS.length]!,
    rank: ranks[seed % ranks.length]!,
    leaguePoints: seed % 100,
    wins: 20 + (seed % 40),
    losses: 15 + (seed % 30),
    queueType: "RANKED_SOLO_5x5",
    fetchedAt: new Date().toISOString(),
    source: "mock",
  };
}

function mockSummonerSnapshot(_puuid: string): SummonerSnapshot {
  return {
    summonerLevel: 100,
    fetchedAt: new Date().toISOString(),
    source: "mock",
  };
}
