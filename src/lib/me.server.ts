/**
 * Signed-in player dashboard payload — SERVER ONLY.
 *
 * Dashboard reads run with the authenticated user's Supabase client. This keeps
 * RLS active and allows local development with only the publishable key.
 * Riot PUUID is never part of this payload; Riot writes run in an Edge Function.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { ensureProfile, onboardingSteps } from "./profile.server";
import { loadMyRiotAccount } from "./riot-account.server";

type AuthenticatedSupabaseClient = SupabaseClient<Database>;
type RiotServiceStatus = {
  configured: boolean;
  trustedWritesConfigured: boolean;
  rsoEnabled: boolean;
};

async function loadRiotEdgeStatus(accessToken: string): Promise<RiotServiceStatus> {
  const fallback = { configured: false, trustedWritesConfigured: false, rsoEnabled: false };
  const url = process.env["SUPABASE_URL"]?.trim();
  const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"]?.trim();
  if (!url || !publishableKey || !accessToken) return fallback;

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/functions/v1/riot-sync`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: publishableKey,
      },
    });
    const payload = (await response.json().catch(() => ({}))) as {
      service?: RiotServiceStatus;
    };
    return payload.service ?? fallback;
  } catch {
    return fallback;
  }
}

export async function loadMyDashboard(
  userId: string,
  supabase: AuthenticatedSupabaseClient,
  accessToken: string,
) {
  const profileId = await ensureProfile(userId, supabase);

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      `id, handle, display_name, avatar_url, bio, points_season, points_month, wins, losses,
       tournaments_played, rank_movement, riot_id, riot_tier, riot_rank, eligibility,
       profile_completion, city_id,
       division:divisions!profiles_division_id_fkey(code, name, accent),
       city:regions!profiles_city_id_fkey(id, name),
       province:regions!profiles_province_id_fkey(name),
       country:regions!profiles_country_id_fkey(name),
       region:regions!profiles_region_id_fkey(name)`,
    )
    .eq("id", profileId)
    .single();
  if (error) throw new Error(error.message);

  const [entries, ledger, riot, riotService] = await Promise.all([
    supabase
      .from("tournament_entries")
      .select(
        `id, status, placement, points_awarded,
         tournament:tournaments!tournament_entries_tournament_id_fkey(slug, name, status, starts_at)`,
      )
      .eq("profile_id", profileId),
    supabase
      .from("ranking_points")
      .select(
        `id, points, awarded_at, rule_code, note,
         tournament:tournaments!ranking_points_tournament_id_fkey(name, slug)`,
      )
      .eq("profile_id", profileId)
      .order("awarded_at", { ascending: false })
      .limit(10),
    loadMyRiotAccount(userId, supabase),
    loadRiotEdgeStatus(accessToken),
  ]);

  if (entries.error) throw new Error(entries.error.message);
  if (ledger.error) throw new Error(ledger.error.message);

  return {
    profile,
    entries: entries.data,
    ledger: ledger.data,
    riot,
    riotService,
    onboarding: onboardingSteps({
      handle: profile.handle,
      cityId: profile.city_id,
      riotLinked: Boolean(riot?.dataVerified),
      riotTier: profile.riot_tier,
      divisionCode: profile.division?.code ?? null,
      eligibility: profile.eligibility,
    }),
  };
}
