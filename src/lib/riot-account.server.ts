/**
 * Riot account linking — SERVER ONLY.
 *
 * Trusted logic between `riot.server.ts` (the Riot HTTP boundary) and the
 * database. All writes use the service role because players are not permitted
 * to write `riot_accounts`, competitive profile columns or eligibility.
 *
 * The profile is ALWAYS derived from the signed-in auth user id.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

import { ensureProfile, recalculateProfileCompletion } from "./profile.server";
import {
  DEFAULT_PLATFORM,
  RiotError,
  SUPPORTED_TIERS,
  fetchRiotAccount,
  fetchSoloQueueSnapshot,
  fetchSummonerSnapshot,
  isRiotConfigured,
  isRsoEnabled,
  type RiotPlatform,
  type SoloQueueSnapshot,
  type SummonerSnapshot,
} from "./riot.server";

/** Minimum time between Riot requests for the same account. */
export const REFRESH_COOLDOWN_MS = 10 * 60 * 1000;
export const DEFAULT_MIN_RIOT_ACCOUNT_LEVEL = 30;

export type RiotConnectionResult = {
  riotId: string;
  gameName: string;
  tagLine: string;
  platform: string;
  ranked: {
    tier: string;
    rank: string | null;
    leaguePoints: number;
    wins: number;
    losses: number;
    queueType: string | null;
  } | null;
  divisionCode: string | null;
  divisionName: string | null;
  tierSupported: boolean;
  accountLevel: number | null;
  accountLevelSyncedAt: string | null;
  dataVerified: boolean;
  ownershipVerified: boolean;
  verificationMethod: string;
  lastSyncedAt: string | null;
  eligibility: string;
  notice: string | null;
  fromCache: boolean;
};

export type RiotServiceStatus = {
  configured: boolean;
  rsoEnabled: boolean;
};

export function riotServiceStatus(): RiotServiceStatus {
  return { configured: isRiotConfigured(), rsoEnabled: isRsoEnabled() };
}

/** Safe, non-PUUID view of the signed-in player's Riot connection. */
export async function loadMyRiotAccount(userId: string): Promise<RiotConnectionResult | null> {
  const profileId = await ensureProfile(userId);
  const { data, error } = await supabaseAdmin
    .from("riot_accounts")
    .select(
      `riot_id, game_name, tag_line, platform, solo_tier, solo_rank, solo_lp, wins, losses,
       queue_type, account_level, account_level_synced_at, data_verified, ownership_verified,
       verification_method, last_synced_at`,
    )
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const profile = await supabaseAdmin
    .from("profiles")
    .select("eligibility, division:divisions!profiles_division_id_fkey(code, name)")
    .eq("id", profileId)
    .single();

  const tier = data.solo_tier ?? "UNRANKED";
  return {
    riotId: data.riot_id,
    gameName: data.game_name ?? data.riot_id.split("#")[0] ?? data.riot_id,
    tagLine: data.tag_line ?? data.riot_id.split("#")[1] ?? "",
    platform: data.platform,
    ranked:
      tier === "UNRANKED"
        ? null
        : {
            tier,
            rank: data.solo_rank,
            leaguePoints: data.solo_lp ?? 0,
            wins: data.wins,
            losses: data.losses,
            queueType: data.queue_type,
          },
    divisionCode: profile.data?.division?.code ?? null,
    divisionName: profile.data?.division?.name ?? null,
    tierSupported: isSupportedTier(tier),
    accountLevel: data.account_level,
    accountLevelSyncedAt: data.account_level_synced_at,
    dataVerified: data.data_verified,
    ownershipVerified: data.ownership_verified,
    verificationMethod: data.verification_method,
    lastSyncedAt: data.last_synced_at,
    eligibility: profile.data?.eligibility ?? "pending_review",
    notice: connectionNotice(tier, data.account_level),
    fromCache: true,
  };
}

function isSupportedTier(tier: string | null) {
  if (!tier) return false;
  return (SUPPORTED_TIERS as readonly string[]).includes(tier.toUpperCase());
}

function unsupportedNotice(tier: string | null) {
  if (!tier || tier === "UNRANKED") {
    return "Riot reports no Solo Queue rank yet. Play your ranked placements to unlock a division.";
  }
  if (!isSupportedTier(tier)) {
    return "Your Riot rank is currently outside EloShape's available competitive divisions.";
  }
  return null;
}

function connectionNotice(tier: string | null, accountLevel: number | null) {
  const rankNotice = unsupportedNotice(tier);
  if (rankNotice) return rankNotice;
  if (accountLevel !== null && accountLevel < DEFAULT_MIN_RIOT_ACCOUNT_LEVEL) {
    return `Riot account level ${DEFAULT_MIN_RIOT_ACCOUNT_LEVEL} is required to compete. Your current level is ${accountLevel}.`;
  }
  return null;
}

/** Resolve the EloShape division for a Riot tier using the divisions table. */
async function divisionForTier(tier: string | null) {
  if (!tier || !isSupportedTier(tier)) return null;
  const { data, error } = await supabaseAdmin
    .from("divisions")
    .select("id, code, name, riot_tiers")
    .contains("riot_tiers", [tier.toUpperCase()])
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function connectRiotAccount(
  userId: string,
  input: { gameName: string; tagLine: string; platform?: RiotPlatform },
): Promise<RiotConnectionResult> {
  if (!isRiotConfigured()) throw new RiotError("not_configured");
  const platform = input.platform ?? DEFAULT_PLATFORM;
  const profileId = await ensureProfile(userId);

  const identity = await fetchRiotAccount(input.gameName, input.tagLine, platform);

  // A real Riot account may only belong to one EloShape player.
  const existing = await supabaseAdmin
    .from("riot_accounts")
    .select("id, profile_id")
    .eq("puuid", identity.puuid)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data && existing.data.profile_id !== profileId) {
    throw new Error("That Riot account is already linked to another EloShape player.");
  }

  const [snapshot, summoner] = await Promise.all([
    fetchSoloQueueSnapshot(identity.puuid, platform),
    fetchSummonerSnapshot(identity.puuid, platform),
  ]);
  return persistSnapshot({
    profileId,
    platform,
    identity,
    snapshot,
    summoner,
    fromCache: false,
  });
}

export async function refreshRiotAccount(userId: string): Promise<RiotConnectionResult> {
  const profileId = await ensureProfile(userId);
  const account = await supabaseAdmin
    .from("riot_accounts")
    .select("id, riot_id, game_name, tag_line, puuid, platform, account_level, last_synced_at")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (account.error) throw new Error(account.error.message);
  if (!account.data) throw new Error("No Riot account is linked yet.");

  const lastSynced = account.data.last_synced_at ? Date.parse(account.data.last_synced_at) : 0;
  const elapsed = Date.now() - lastSynced;
  // Existing links created before account-level sync was added may have a fresh
  // rank snapshot but no level. Let those accounts bypass the cooldown once so
  // Summoner-v4 can backfill the missing eligibility input immediately.
  if (elapsed < REFRESH_COOLDOWN_MS && account.data.account_level !== null) {
    const cached = await loadMyRiotAccount(userId);
    if (cached) {
      const wait = Math.ceil((REFRESH_COOLDOWN_MS - elapsed) / 60000);
      return {
        ...cached,
        notice: cached.notice ?? `Riot data was just synced. Try again in ${wait} min.`,
      };
    }
  }

  if (!isRiotConfigured()) throw new RiotError("not_configured");
  const platform = (account.data.platform as RiotPlatform) ?? DEFAULT_PLATFORM;

  let puuid = account.data.puuid;
  let gameName = account.data.game_name ?? account.data.riot_id.split("#")[0] ?? "";
  let tagLine = account.data.tag_line ?? account.data.riot_id.split("#")[1] ?? "";
  if (!puuid) {
    const identity = await fetchRiotAccount(gameName, tagLine, platform);
    puuid = identity.puuid;
    gameName = identity.gameName;
    tagLine = identity.tagLine;
  }

  const [snapshot, summoner] = await Promise.all([
    fetchSoloQueueSnapshot(puuid, platform),
    fetchSummonerSnapshot(puuid, platform),
  ]);
  return persistSnapshot({
    profileId,
    platform,
    identity: { puuid, gameName, tagLine },
    snapshot,
    summoner,
    fromCache: false,
  });
}

async function persistSnapshot(args: {
  profileId: string;
  platform: RiotPlatform;
  identity: { puuid: string; gameName: string; tagLine: string };
  snapshot: SoloQueueSnapshot;
  summoner: SummonerSnapshot;
  fromCache: boolean;
}): Promise<RiotConnectionResult> {
  const { profileId, platform, identity, snapshot, summoner } = args;
  const riotId = `${identity.gameName}#${identity.tagLine}`;
  const tier = snapshot.tier;
  const division = await divisionForTier(tier);
  const lastSyncedAt = newestTimestamp(snapshot.fetchedAt, summoner.fetchedAt);

  const profileBefore = await supabaseAdmin
    .from("profiles")
    .select("id, eligibility, division_id")
    .eq("id", profileId)
    .single();
  if (profileBefore.error) throw new Error(profileBefore.error.message);

  const upsert = await supabaseAdmin
    .from("riot_accounts")
    .upsert(
      {
        profile_id: profileId,
        riot_id: riotId,
        game_name: identity.gameName,
        tag_line: identity.tagLine,
        puuid: identity.puuid,
        platform,
        solo_tier: tier,
        solo_rank: snapshot.rank,
        solo_lp: snapshot.leaguePoints,
        wins: snapshot.wins,
        losses: snapshot.losses,
        queue_type: snapshot.queueType,
        account_level: summoner.summonerLevel,
        account_level_synced_at: summoner.fetchedAt,
        verified: true,
        data_verified: true,
        // Ownership is only ever proven by RSO, which is not available yet.
        ownership_verified: false,
        verification_method: "api_key_lookup",
        last_synced_at: lastSyncedAt,
        last_sync_status: "ok",
        last_sync_error_code: null,
      },
      { onConflict: "profile_id" },
    )
    .select("id")
    .single();
  if (upsert.error) throw new Error(upsert.error.message);

  // Safe public projection on the profile — never the PUUID.
  const profilePatch: Database["public"]["Tables"]["profiles"]["Update"] = {
    riot_id: riotId,
    riot_tier: tier === "UNRANKED" ? null : tier,
    riot_rank: snapshot.rank,
  };
  if (division) profilePatch["division_id"] = division.id;

  const updated = await supabaseAdmin.from("profiles").update(profilePatch).eq("id", profileId);
  if (updated.error) {
    // Keep state consistent: record the failed sync rather than leaving a half-applied link.
    await supabaseAdmin
      .from("riot_accounts")
      .update({ last_sync_status: "profile_update_failed" })
      .eq("id", upsert.data.id);
    throw new Error(updated.error.message);
  }

  const eligibility = await reviewEligibility({
    profileId,
    currentEligibility: profileBefore.data.eligibility,
    previousDivisionId: profileBefore.data.division_id,
    nextDivisionId: division?.id ?? null,
    tier,
  });

  await recalculateProfileCompletion(profileId);

  return {
    riotId,
    gameName: identity.gameName,
    tagLine: identity.tagLine,
    platform,
    ranked:
      tier === "UNRANKED"
        ? null
        : {
            tier,
            rank: snapshot.rank,
            leaguePoints: snapshot.leaguePoints,
            wins: snapshot.wins,
            losses: snapshot.losses,
            queueType: snapshot.queueType,
          },
    divisionCode: division?.code ?? null,
    divisionName: division?.name ?? null,
    tierSupported: isSupportedTier(tier),
    accountLevel: summoner.summonerLevel,
    accountLevelSyncedAt: summoner.fetchedAt,
    dataVerified: true,
    ownershipVerified: false,
    verificationMethod: "api_key_lookup",
    lastSyncedAt,
    eligibility,
    notice: connectionNotice(tier, summoner.summonerLevel),
    fromCache: false,
  };
}

function newestTimestamp(...timestamps: string[]) {
  const newest = Math.max(...timestamps.map((value) => Date.parse(value)).filter(Number.isFinite));
  return Number.isFinite(newest) ? new Date(newest).toISOString() : new Date().toISOString();
}

/**
 * Riot rank is ONE input to eligibility, never the decision.
 * - `pending_review` is never auto-promoted to `eligible`.
 * - `suspended` / `rejected` are never cleared by a Riot refresh.
 * - A division change while entered in upcoming brackets is flagged for review.
 */
async function reviewEligibility(args: {
  profileId: string;
  currentEligibility: string;
  previousDivisionId: string | null;
  nextDivisionId: string | null;
  tier: string;
}) {
  const { profileId, currentEligibility, previousDivisionId, nextDivisionId, tier } = args;

  const existingReview = await supabaseAdmin
    .from("eligibility_reviews")
    .select("id")
    .eq("profile_id", profileId)
    .limit(1)
    .maybeSingle();

  const divisionChanged =
    previousDivisionId !== null && nextDivisionId !== null && previousDivisionId !== nextDivisionId;

  if (!existingReview.data) {
    await supabaseAdmin.from("eligibility_reviews").insert({
      profile_id: profileId,
      status: currentEligibility === "eligible" ? "eligible" : "pending_review",
      reason: "Riot account linked",
      notes: `Riot Solo Queue tier reported as ${tier}. Ownership not verified (RSO unavailable).`,
    });
  } else if (divisionChanged) {
    await supabaseAdmin.from("eligibility_reviews").insert({
      profile_id: profileId,
      status: "pending_review",
      reason: "Riot division change",
      notes: `Riot tier now ${tier}; division eligibility changed and requires review.`,
    });
  }

  // Suspensions/rejections survive Riot refreshes.
  if (currentEligibility === "suspended" || currentEligibility === "rejected") {
    return currentEligibility;
  }

  if (divisionChanged && currentEligibility === "eligible") {
    const upcoming = await supabaseAdmin
      .from("tournament_entries")
      .select(
        "id, tournament:tournaments!tournament_entries_tournament_id_fkey(status, division_id)",
      )
      .eq("profile_id", profileId)
      .in("status", ["registered", "checked_in"]);
    const affected = (upcoming.data ?? []).some(
      (entry) =>
        entry.tournament &&
        entry.tournament.division_id === previousDivisionId &&
        ["registration_open", "registration_closed", "live"].includes(entry.tournament.status),
    );
    if (affected) {
      await supabaseAdmin
        .from("profiles")
        .update({ eligibility: "pending_review" })
        .eq("id", profileId);
      return "pending_review";
    }
  }

  return currentEligibility;
}
