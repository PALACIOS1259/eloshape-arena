import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const BASE_CORS: Record<string, string> = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "https://eloshape-compete-elevate.lovable.app",
  "https://id-preview--b25a5d43-ea7c-4091-b928-2da59c732426.lovable.app",
];

const ALLOWED_ORIGINS = new Set([
  ...DEFAULT_ALLOWED_ORIGINS,
  ...(Deno.env.get("ELOSHAPE_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
]);

function isAllowedOrigin(origin: string) {
  return ALLOWED_ORIGINS.has(origin);
}

function corsHeaders(req: Request) {
  const headers: Record<string, string> = { ...BASE_CORS, Vary: "Origin" };
  const origin = req.headers.get("Origin");
  if (origin && isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

const PLATFORM = "LA2";
const PLATFORM_HOST = "https://la2.api.riotgames.com";
const REGIONAL_HOST = "https://americas.api.riotgames.com";
const SUPPORTED_TIERS = new Set(["IRON", "BRONZE", "SILVER", "GOLD"]);
const REFRESH_COOLDOWN_MS = 10 * 60 * 1000;
const MIN_ACCOUNT_LEVEL = 30;

type RiotIdentity = { puuid: string; gameName: string; tagLine: string };
type LeagueEntry = {
  queueType?: string;
  tier?: string;
  rank?: string;
  leaguePoints?: number;
  wins?: number;
  losses?: number;
};

type Snapshot = {
  tier: string;
  rank: string | null;
  leaguePoints: number;
  wins: number;
  losses: number;
  queueType: string | null;
};

class PublicError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
}

function serviceStatus() {
  return {
    configured: Boolean(Deno.env.get("RIOT_API_KEY")?.trim()),
    trustedWritesConfigured: Boolean(
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEYS"),
    ),
    rsoEnabled: false,
  };
}

function adminKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed.default ?? Object.values(parsed)[0] ?? null;
  } catch {
    return null;
  }
}

function publicKey() {
  const legacy = Deno.env.get("SUPABASE_ANON_KEY")?.trim();
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed.default ?? Object.values(parsed)[0] ?? null;
  } catch {
    return null;
  }
}

function validateRiotId(gameNameInput: string, tagLineInput: string) {
  const gameName = String(gameNameInput ?? "").trim();
  const tagLine = String(tagLineInput ?? "")
    .replace(/^#/, "")
    .trim();
  if (gameName.length < 3 || gameName.length > 16 || tagLine.length < 2 || tagLine.length > 5) {
    throw new PublicError("invalid_riot_id", "Check your Riot ID and tag line.");
  }
  if (!/^[\p{L}\p{N} _.-]+$/u.test(gameName) || !/^[\p{L}\p{N}]+$/u.test(tagLine)) {
    throw new PublicError("invalid_riot_id", "Check your Riot ID and tag line.");
  }
  return { gameName, tagLine };
}

async function riotFetch(url: string) {
  const key = Deno.env.get("RIOT_API_KEY")?.trim();
  if (!key) throw new PublicError("not_configured", "Riot integration is not configured yet.", 503);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, {
      headers: { "X-Riot-Token": key, Accept: "application/json" },
      signal: controller.signal,
    });
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }
    if (response.ok) return body;
    if (response.status === 400)
      throw new PublicError("invalid_riot_id", "Check your Riot ID and tag line.");
    if (response.status === 404)
      throw new PublicError("not_found", "We couldn't find that Riot account.", 404);
    if (response.status === 429)
      throw new PublicError(
        "rate_limited",
        "Riot is rate limiting us right now. Please try again in a moment.",
        429,
      );
    if (response.status === 401 || response.status === 403)
      throw new PublicError(
        "riot_unauthorized",
        "Riot integration is temporarily unavailable.",
        503,
      );
    if (response.status >= 500)
      throw new PublicError(
        "riot_unavailable",
        "Riot's service is temporarily unavailable. Please try again shortly.",
        503,
      );
    throw new PublicError("riot_error", "Riot data sync is temporarily unavailable.", 502);
  } catch (error) {
    if (error instanceof PublicError) throw error;
    if ((error as Error)?.name === "AbortError") {
      throw new PublicError("riot_timeout", "Riot did not respond in time. Please try again.", 504);
    }
    throw new PublicError(
      "riot_unavailable",
      "Riot's service is temporarily unavailable. Please try again shortly.",
      503,
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchIdentity(gameName: string, tagLine: string): Promise<RiotIdentity> {
  const body = (await riotFetch(
    `${REGIONAL_HOST}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
  )) as { puuid?: string; gameName?: string; tagLine?: string } | null;
  if (!body?.puuid) throw new PublicError("not_found", "We couldn't find that Riot account.", 404);
  return {
    puuid: body.puuid,
    gameName: body.gameName ?? gameName,
    tagLine: body.tagLine ?? tagLine,
  };
}

async function fetchSnapshot(puuid: string): Promise<Snapshot> {
  const body = await riotFetch(
    `${PLATFORM_HOST}/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`,
  );
  const entries = Array.isArray(body) ? (body as LeagueEntry[]) : [];
  const solo = entries.find((entry) => entry.queueType === "RANKED_SOLO_5x5");
  if (!solo?.tier) {
    return {
      tier: "UNRANKED",
      rank: null,
      leaguePoints: 0,
      wins: 0,
      losses: 0,
      queueType: null,
    };
  }
  return {
    tier: solo.tier.toUpperCase(),
    rank: solo.rank ?? null,
    leaguePoints: solo.leaguePoints ?? 0,
    wins: solo.wins ?? 0,
    losses: solo.losses ?? 0,
    queueType: "RANKED_SOLO_5x5",
  };
}

async function fetchAccountLevel(puuid: string) {
  const body = (await riotFetch(
    `${PLATFORM_HOST}/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`,
  )) as { summonerLevel?: number } | null;
  if (!body || typeof body.summonerLevel !== "number" || !Number.isFinite(body.summonerLevel)) {
    throw new PublicError("riot_error", "Riot data sync is temporarily unavailable.", 502);
  }
  return body.summonerLevel;
}

function connectionNotice(tier: string, accountLevel: number | null) {
  if (tier === "UNRANKED") {
    return "Riot reports no Solo Queue rank yet. Play your ranked placements to unlock a division.";
  }
  if (!SUPPORTED_TIERS.has(tier)) {
    return "Your Riot rank is currently outside EloShape's available competitive divisions.";
  }
  if (accountLevel !== null && accountLevel < MIN_ACCOUNT_LEVEL) {
    return `Riot account level ${MIN_ACCOUNT_LEVEL} is required to compete. Your current level is ${accountLevel}.`;
  }
  return null;
}

function shapeAccount(row: any, profile: any, fromCache: boolean, noticeOverride?: string | null) {
  const tier = row.solo_tier ?? "UNRANKED";
  return {
    riotId: row.riot_id,
    gameName: row.game_name ?? row.riot_id?.split("#")[0] ?? "",
    tagLine: row.tag_line ?? row.riot_id?.split("#")[1] ?? "",
    platform: row.platform ?? PLATFORM,
    ranked:
      tier === "UNRANKED"
        ? null
        : {
            tier,
            rank: row.solo_rank ?? null,
            leaguePoints: row.solo_lp ?? 0,
            wins: row.wins ?? 0,
            losses: row.losses ?? 0,
            queueType: row.queue_type ?? null,
          },
    divisionCode: profile?.division?.code ?? null,
    divisionName: profile?.division?.name ?? null,
    tierSupported: SUPPORTED_TIERS.has(tier),
    accountLevel: row.account_level ?? null,
    accountLevelSyncedAt: row.account_level_synced_at ?? null,
    dataVerified: Boolean(row.data_verified),
    ownershipVerified: Boolean(row.ownership_verified),
    verificationMethod: row.verification_method ?? "api_key_lookup",
    lastSyncedAt: row.last_synced_at ?? null,
    eligibility: profile?.eligibility ?? "pending_review",
    notice: noticeOverride ?? connectionNotice(tier, row.account_level ?? null),
    fromCache,
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && !isAllowedOrigin(origin)) {
    return new Response(
      JSON.stringify({ ok: false, code: "origin_not_allowed", error: "Origin not allowed." }),
      { status: 403, headers: { ...BASE_CORS, Vary: "Origin" } },
    );
  }
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const status = serviceStatus();
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) throw new PublicError("unauthorized", "Sign in to continue.", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = publicKey();
    const secretKey = adminKey();
    if (!anonKey || !secretKey) {
      throw new PublicError(
        "backend_not_configured",
        "Secure Riot linking is temporarily unavailable.",
        503,
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) {
      throw new PublicError("unauthorized", "Sign in to continue.", 401);
    }

    if (req.method === "GET") return json(req, { service: status });
    if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

    const input = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = input.action === "refresh" ? "refresh" : "connect";

    const ensured = await userClient.rpc("ensure_my_profile");
    if (ensured.error || !ensured.data) {
      throw new PublicError("profile_error", "Could not load your EloShape profile.", 500);
    }
    const profileId = String(ensured.data);

    const existingResult = await admin
      .from("riot_accounts")
      .select(
        "id, profile_id, riot_id, game_name, tag_line, puuid, platform, solo_tier, solo_rank, solo_lp, wins, losses, queue_type, account_level, account_level_synced_at, data_verified, ownership_verified, verification_method, last_synced_at",
      )
      .eq("profile_id", profileId)
      .maybeSingle();
    if (existingResult.error) {
      throw new PublicError("database_error", "Riot data sync is temporarily unavailable.", 500);
    }
    const existing = existingResult.data;

    if (action === "refresh" && !existing) {
      throw new PublicError("not_linked", "No Riot account is linked yet.", 404);
    }

    if (action === "refresh" && existing?.last_synced_at && existing.account_level !== null) {
      const elapsed = Date.now() - Date.parse(existing.last_synced_at);
      if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < REFRESH_COOLDOWN_MS) {
        const profileResult = await admin
          .from("profiles")
          .select("eligibility, division:divisions!profiles_division_id_fkey(code, name)")
          .eq("id", profileId)
          .single();
        const wait = Math.ceil((REFRESH_COOLDOWN_MS - elapsed) / 60000);
        return json(req, {
          ok: true,
          account: shapeAccount(
            existing,
            profileResult.data,
            true,
            `Riot data was just synced. Try again in ${wait} min.`,
          ),
          service: status,
        });
      }
    }

    let identity: RiotIdentity;
    if (action === "connect") {
      const valid = validateRiotId(String(input.gameName ?? ""), String(input.tagLine ?? ""));
      identity = await fetchIdentity(valid.gameName, valid.tagLine);
    } else {
      const gameName = existing!.game_name ?? existing!.riot_id?.split("#")[0] ?? "";
      const tagLine = existing!.tag_line ?? existing!.riot_id?.split("#")[1] ?? "";
      identity = existing!.puuid
        ? { puuid: existing!.puuid, gameName, tagLine }
        : await fetchIdentity(gameName, tagLine);
    }

    const duplicate = await admin
      .from("riot_accounts")
      .select("profile_id")
      .eq("puuid", identity.puuid)
      .neq("profile_id", profileId)
      .maybeSingle();
    if (duplicate.error) {
      throw new PublicError("database_error", "Riot data sync is temporarily unavailable.", 500);
    }
    if (duplicate.data) {
      throw new PublicError(
        "already_linked",
        "That Riot account is already linked to another EloShape player.",
        409,
      );
    }

    const [snapshot, accountLevel] = await Promise.all([
      fetchSnapshot(identity.puuid),
      fetchAccountLevel(identity.puuid),
    ]);
    const now = new Date().toISOString();
    const riotId = `${identity.gameName}#${identity.tagLine}`;

    let division: { id: string; code: string; name: string } | null = null;
    if (SUPPORTED_TIERS.has(snapshot.tier)) {
      const divisionResult = await admin
        .from("divisions")
        .select("id, code, name")
        .contains("riot_tiers", [snapshot.tier])
        .maybeSingle();
      if (divisionResult.error) {
        throw new PublicError("database_error", "Riot data sync is temporarily unavailable.", 500);
      }
      division = divisionResult.data;
    }

    const before = await admin
      .from("profiles")
      .select("id, eligibility, division_id")
      .eq("id", profileId)
      .single();
    if (before.error) {
      throw new PublicError("profile_error", "Could not load your EloShape profile.", 500);
    }

    const upsert = await admin
      .from("riot_accounts")
      .upsert(
        {
          profile_id: profileId,
          riot_id: riotId,
          game_name: identity.gameName,
          tag_line: identity.tagLine,
          puuid: identity.puuid,
          platform: PLATFORM,
          solo_tier: snapshot.tier,
          solo_rank: snapshot.rank,
          solo_lp: snapshot.leaguePoints,
          wins: snapshot.wins,
          losses: snapshot.losses,
          queue_type: snapshot.queueType,
          account_level: accountLevel,
          account_level_synced_at: now,
          verified: true,
          data_verified: true,
          ownership_verified: false,
          verification_method: "api_key_lookup",
          last_synced_at: now,
          last_sync_status: "ok",
          last_sync_error_code: null,
        },
        { onConflict: "profile_id" },
      )
      .select("*")
      .single();
    if (upsert.error) throw new PublicError("database_error", "Could not save Riot data.", 500);

    const divisionChanged = Boolean(
      before.data.division_id && division?.id && before.data.division_id !== division.id,
    );
    let eligibility = before.data.eligibility;
    if (eligibility !== "suspended" && eligibility !== "rejected") {
      if (!existing || divisionChanged || eligibility !== "eligible") {
        eligibility = "pending_review";
      }
    }

    const profilePatch: Record<string, unknown> = {
      riot_id: riotId,
      riot_tier: snapshot.tier === "UNRANKED" ? null : snapshot.tier,
      riot_rank: snapshot.rank,
      eligibility,
    };
    if (division) profilePatch.division_id = division.id;

    const profileUpdate = await admin.from("profiles").update(profilePatch).eq("id", profileId);
    if (profileUpdate.error) {
      throw new PublicError("profile_error", "Could not update your EloShape profile.", 500);
    }

    if (!existing || divisionChanged) {
      await admin.from("eligibility_reviews").insert({
        profile_id: profileId,
        status: "pending_review",
        reason: !existing ? "Riot account linked" : "Riot division change",
        notes: `Riot Solo Queue tier reported as ${snapshot.tier}. Ownership not verified (RSO unavailable).`,
      });
    }

    await userClient.rpc("recalculate_my_profile_completion");

    const profileAfter = await admin
      .from("profiles")
      .select("eligibility, division:divisions!profiles_division_id_fkey(code, name)")
      .eq("id", profileId)
      .single();

    return json(req, {
      ok: true,
      account: shapeAccount(upsert.data, profileAfter.data, false),
      service: status,
    });
  } catch (error) {
    if (error instanceof PublicError) {
      return json(
        req,
        { ok: false, code: error.code, error: error.message, service: serviceStatus() },
        error.status,
      );
    }
    console.error("[riot-sync] unexpected error", { name: (error as Error)?.name });
    return json(
      req,
      {
        ok: false,
        code: "unknown",
        error: "Riot data sync is temporarily unavailable.",
        service: serviceStatus(),
      },
      500,
    );
  }
});
