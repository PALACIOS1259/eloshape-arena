import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

/** Dashboard payload for the signed-in user (RLS applies as that user). */
export async function loadMyDashboard(supabase: Client, userId: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      `id, handle, display_name, avatar_url, bio, points_season, points_month, wins, losses,
       tournaments_played, rank_movement, riot_id, riot_tier, riot_rank, eligibility,
       profile_completion,
       division:divisions!profiles_division_id_fkey(code, name, accent),
       city:regions!profiles_city_id_fkey(name),
       country:regions!profiles_country_id_fkey(name)`,
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) return { profile: null, entries: [], ledger: [] };

  const [entries, ledger] = await Promise.all([
    supabase
      .from("tournament_entries")
      .select(
        `id, status, placement, points_awarded,
         tournament:tournaments!tournament_entries_tournament_id_fkey(slug, name, status, starts_at)`,
      )
      .eq("profile_id", profile.id),
    supabase
      .from("ranking_points")
      .select(
        `id, points, awarded_at, rule_code, note,
         tournament:tournaments!ranking_points_tournament_id_fkey(name, slug)`,
      )
      .eq("profile_id", profile.id)
      .order("awarded_at", { ascending: false })
      .limit(10),
  ]);

  if (entries.error) throw new Error(entries.error.message);
  if (ledger.error) throw new Error(ledger.error.message);

  return { profile, entries: entries.data, ledger: ledger.data };
}
