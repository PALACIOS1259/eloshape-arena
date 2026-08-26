/**
 * Tournament registration and check-in — SERVER ONLY.
 *
 * Normal player writes use authenticated SECURITY DEFINER RPCs. PostgreSQL
 * derives auth.uid(), validates eligibility/geography/capacity/timing and owns
 * the transaction, so neither localhost nor production needs a service-role
 * credential for these player actions.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type AuthenticatedSupabaseClient = SupabaseClient<Database>;
type RpcError = { message: string };
type RpcResult<T> = { data: T | null; error: RpcError | null };

export type RegistrationResult = {
  entryId: string;
  status: string;
  tournamentSlug: string;
  tournamentName: string;
};

function callRpc<T>(
  supabase: AuthenticatedSupabaseClient,
  fn: string,
  args?: Record<string, unknown>,
): Promise<RpcResult<T>> {
  // SupabaseClient.rpc() relies on `this.rest`; keep the method bound to the
  // client instance or registration/check-in crashes before reaching Postgres.
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<RpcResult<T>>;
  return rpc(fn, args);
}

function friendlyRpcError(message: string) {
  const code = message.toLowerCase();
  if (code.includes("riot_account_missing")) return "Connect your Riot account before registering.";
  if (code.includes("riot_rank_unverified")) return "Your Riot Solo Queue rank must be verified first.";
  if (code.includes("account_level_below_minimum")) return "Your Riot account does not meet this tournament's minimum account level.";
  if (code.includes("platform_mismatch")) return "Your Riot account is linked to a different server/platform.";
  if (code.includes("division_mismatch")) return "This bracket is for another division.";
  if (code.includes("region_mismatch")) return "This bracket is restricted to another region.";
  if (code.includes("account_suspended")) return "Your account is suspended.";
  if (code.includes("eligibility_rejected")) return "Your competitive eligibility was rejected. Contact moderation.";
  if (code.includes("eligibility_pending_review")) return "Your competitive eligibility is still pending review.";
  if (code.includes("registration_not_open")) return "Registration is not open.";
  if (code.includes("registration_closed")) return "Registration has closed.";
  if (code.includes("tournament_full")) return "This tournament is full.";
  if (code.includes("already_registered")) return "You are already registered for this tournament.";
  if (code.includes("team_registration_required")) return "This tournament requires team registration.";
  if (code.includes("tournament_not_found")) return "Tournament not found.";
  if (code.includes("checkin_not_open")) return "Check-in has not opened yet.";
  if (code.includes("checkin_closed")) return "Check-in has closed.";
  if (code.includes("checkin_not_required")) return "This tournament does not require check-in.";
  if (code.includes("not_registered")) return "You are not registered for this tournament.";
  if (code.includes("entry_not_checkin_eligible")) return "This entry cannot be checked in.";
  return message;
}

export async function registerForTournament(
  _userId: string,
  supabase: AuthenticatedSupabaseClient,
  tournamentSlug: string,
): Promise<RegistrationResult> {
  const { data, error } = await callRpc<Record<string, unknown>>(
    supabase,
    "register_my_tournament",
    { p_slug: tournamentSlug },
  );
  if (error) throw new Error(friendlyRpcError(error.message));
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Could not register for this tournament.");
  }

  const entryId = typeof data["entry_id"] === "string" ? data["entry_id"] : "";
  const status = typeof data["status"] === "string" ? data["status"] : "registered";
  const tournamentSlugResult =
    typeof data["tournament_slug"] === "string" ? data["tournament_slug"] : tournamentSlug;
  const tournamentName =
    typeof data["tournament_name"] === "string" ? data["tournament_name"] : tournamentSlug;

  if (!entryId) throw new Error("Could not register for this tournament.");

  return {
    entryId,
    status,
    tournamentSlug: tournamentSlugResult,
    tournamentName,
  };
}

export async function checkInToTournament(
  _userId: string,
  supabase: AuthenticatedSupabaseClient,
  tournamentSlug: string,
) {
  const { data, error } = await callRpc<Record<string, unknown>>(
    supabase,
    "check_in_my_tournament",
    { p_slug: tournamentSlug },
  );
  if (error) throw new Error(friendlyRpcError(error.message));
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Could not check in.");
  }

  const entryId = typeof data["entry_id"] === "string" ? data["entry_id"] : "";
  const status = typeof data["status"] === "string" ? data["status"] : "checked_in";
  if (!entryId) throw new Error("Could not check in.");
  return { entryId, status };
}
