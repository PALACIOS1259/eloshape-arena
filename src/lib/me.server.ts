/**
 * Signed-in player dashboard payload — SERVER ONLY.
 *
 * The profile is resolved from the auth user id (and provisioned if missing),
 * so a freshly registered user can never land on a profile-less dashboard.
 * The Riot PUUID is never part of this payload.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { ensureProfile, onboardingSteps } from "./profile.server";
import { loadMyRiotAccount, riotServiceStatus } from "./riot-account.server";

export async function loadMyDashboard(userId: string) {
  const profileId = await ensureProfile(userId);

  const { data: profile, error } = await supabaseAdmin
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
    supabaseAdmin
      .from("tournament_entries")
      .select(
        `id, status, placement, points_awarded,
         tournament:tournaments!tournament_entries_tournament_id_fkey(slug, name, status, starts_at)`,
      )
      .eq("profile_id", profileId),
    supabaseAdmin
      .from("ranking_points")
      .select(
        `id, points, awarded_at, rule_code, note,
         tournament:tournaments!ranking_points_tournament_id_fkey(name, slug)`,
      )
      .eq("profile_id", profileId)
      .order("awarded_at", { ascending: false })
      .limit(10),
    loadMyRiotAccount(userId),
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
