/**
 * Signed-in player dashboard payload — SERVER ONLY.
 *
 * Dashboard reads run with the authenticated user's Supabase client. This keeps
 * RLS active and allows local development with only the publishable key; the
 * service-role secret is not required just to view a player's own dashboard.
 * Riot PUUID is never part of this payload.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { ensureProfile, onboardingSteps } from "./profile.server";
import { loadMyRiotAccount, riotServiceStatus } from "./riot-account.server";

type AuthenticatedSupabaseClient = SupabaseClient<Database>;

export async function loadMyDashboard(userId: string, supabase: AuthenticatedSupabaseClient) {
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

  const [entries, ledger, riot] = await Promise.all([
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
  ]);

  if (entries.error) throw new Error(entries.error.message);
  if (ledger.error) throw new Error(ledger.error.message);

  return {
    profile,
    entries: entries.data,
    ledger: ledger.data,
    riot,
    riotService: riotServiceStatus(),
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
