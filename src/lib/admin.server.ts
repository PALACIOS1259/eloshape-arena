/**
 * Staff moderation reads/writes — SERVER ONLY.
 *
 * All staff access is scoped to the authenticated caller. RLS and narrow
 * SECURITY DEFINER RPCs are the authorization boundary; no service-role
 * credential is required by localhost or the web runtime.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type AuthenticatedSupabaseClient = SupabaseClient<Database>;
type RpcError = { message: string };
type RpcResult<T> = { data: T | null; error: RpcError | null };

function callRpc<T>(
  supabase: AuthenticatedSupabaseClient,
  fn: string,
  args?: Record<string, unknown>,
): Promise<RpcResult<T>> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<RpcResult<T>>;
  return rpc(fn, args);
}

export async function loadStaffRoles(supabase: AuthenticatedSupabaseClient, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((row) => row.role);
  return { isAdmin: roles.includes("admin"), isModerator: roles.includes("moderator") };
}

export async function loadAdminOverview(supabase: AuthenticatedSupabaseClient) {
  const [players, teams, tournaments, reports, reviews, riot] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("teams").select("id", { count: "exact", head: true }),
    supabase.from("tournaments").select("id", { count: "exact", head: true }),
    supabase
      .from("reports")
      .select(
        `id, status, reason, details, created_at,
         reported:profiles!reports_reported_profile_id_fkey(handle, display_name)`,
      )
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("eligibility_reviews")
      .select(
        `id, status, reason, notes, created_at,
         profile:profiles!eligibility_reviews_profile_id_fkey(id, handle, display_name, riot_tier, riot_rank, eligibility)`,
      )
      .order("created_at", { ascending: false })
      .limit(20),
    // Safe Riot review projection: no PUUID, no credentials.
    supabase
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

  for (const result of [players, teams, tournaments, reports, reviews, riot]) {
    if (result.error) throw new Error(result.error.message);
  }

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

/** Manual staff eligibility decision through a narrow auth.uid()-scoped RPC. */
export async function decideEligibility(
  supabase: AuthenticatedSupabaseClient,
  args: {
    profileId: string;
    status: EligibilityDecision;
    reason: string;
  },
) {
  const { data, error } = await callRpc<Record<string, unknown>>(
    supabase,
    "staff_set_player_eligibility",
    {
      p_profile: args.profileId,
      p_status: args.status,
      p_reason: args.reason,
    },
  );
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Could not update eligibility.");
  }

  const id = typeof data["id"] === "string" ? data["id"] : args.profileId;
  const handle = typeof data["handle"] === "string" ? data["handle"] : "";
  const eligibility = typeof data["eligibility"] === "string" ? data["eligibility"] : args.status;

  return { id, handle, eligibility };
}
