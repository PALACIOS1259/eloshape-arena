/**
 * Staff moderation reads/writes — SERVER ONLY.
 *
 * Callers are authorised in `admin.functions.ts` (role read through the caller's
 * own RLS-scoped client) BEFORE any of these privileged helpers run.
 * Riot API credentials are never surfaced here; the PUUID is never returned.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function loadStaffRoles(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((row) => row.role);
  return { isAdmin: roles.includes("admin"), isModerator: roles.includes("moderator") };
}

export async function loadAdminOverview() {
  const [players, teams, tournaments, reports, reviews, riot] = await Promise.all([
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("teams").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("tournaments").select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("reports")
      .select(
        `id, status, reason, details, created_at,
         reported:profiles!reports_reported_profile_id_fkey(handle, display_name)`,
      )
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("eligibility_reviews")
      .select(
        `id, status, reason, notes, created_at,
         profile:profiles!eligibility_reviews_profile_id_fkey(id, handle, display_name, riot_tier, riot_rank, eligibility)`,
      )
      .order("created_at", { ascending: false })
      .limit(20),
    // Safe Riot review projection: no PUUID, no credentials.
    supabaseAdmin
      .from("riot_accounts")
      .select(
        `id, riot_id, platform, solo_tier, solo_rank, solo_lp, data_verified, ownership_verified,
         verification_method, last_synced_at, last_sync_status, created_at,
         profile:profiles!riot_accounts_profile_id_fkey(id, handle, display_name, eligibility,
           division:divisions!profiles_division_id_fkey(code, name))`,
      )
      .order("last_synced_at", { ascending: false, nullsFirst: false })
      .limit(25),
  ]);

  if (reports.error) throw new Error(reports.error.message);
  if (reviews.error) throw new Error(reviews.error.message);
  if (riot.error) throw new Error(riot.error.message);

  return {
    counts: {
      players: players.count ?? 0,
      teams: teams.count ?? 0,
      tournaments: tournaments.count ?? 0,
    },
    reports: reports.data ?? [],
    reviews: reviews.data ?? [],
    riotAccounts: riot.data ?? [],
  };
}

export type EligibilityDecision = "eligible" | "pending_review" | "rejected" | "suspended";

/** Manual staff eligibility decision — the only path that may set `eligible`. */
export async function decideEligibility(args: {
  reviewerUserId: string;
  profileId: string;
  status: EligibilityDecision;
  reason: string;
}) {
  const profile = await supabaseAdmin
    .from("profiles")
    .update({ eligibility: args.status })
    .eq("id", args.profileId)
    .select("id, handle, eligibility")
    .single();
  if (profile.error) throw new Error(profile.error.message);

  const review = await supabaseAdmin.from("eligibility_reviews").insert({
    profile_id: args.profileId,
    status: args.status,
    reason: args.reason.slice(0, 200) || "Staff decision",
    reviewed_by: args.reviewerUserId,
  });
  if (review.error) throw new Error(review.error.message);

  return profile.data;
}
