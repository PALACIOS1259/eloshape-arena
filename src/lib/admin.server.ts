import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

/** Staff overview: counts plus the moderation queues. RLS applies as the caller. */
export async function loadAdminOverview(supabase: Client) {
  const [players, teams, tournaments, reports, reviews] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("teams").select("id", { count: "exact", head: true }),
    supabase.from("tournaments").select("id", { count: "exact", head: true }),
    supabase
      .from("reports")
      .select(
        `id, kind, status, reason, created_at,
         reported:profiles!reports_reported_profile_id_fkey(handle, display_name)`,
      )
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("eligibility_reviews")
      .select(
        `id, status, reason, created_at,
         profile:profiles!eligibility_reviews_profile_id_fkey(handle, display_name, riot_tier, riot_rank)`,
      )
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (reports.error) throw new Error(reports.error.message);
  if (reviews.error) throw new Error(reviews.error.message);

  return {
    counts: {
      players: players.count ?? 0,
      teams: teams.count ?? 0,
      tournaments: tournaments.count ?? 0,
    },
    reports: reports.data ?? [],
    reviews: reviews.data ?? [],
  };
}
