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
  if (code.includes("riot_account_missing"))
    return "Conectá tu cuenta de Riot antes de inscribirte.";
  if (code.includes("riot_rank_unverified"))
    return "Primero se debe verificar tu rango clasificatorio de Solo/Dúo.";
  if (code.includes("account_level_below_minimum"))
    return "Tu cuenta de Riot no alcanza el nivel mínimo de este torneo.";
  if (code.includes("platform_mismatch"))
    return "Tu cuenta de Riot está vinculada a otro servidor.";
  if (code.includes("division_mismatch")) return "Este cuadro corresponde a otra división.";
  if (code.includes("region_mismatch")) return "Este cuadro está limitado a otra región.";
  if (code.includes("account_suspended")) return "Tu cuenta está suspendida.";
  if (code.includes("eligibility_rejected"))
    return "Tu elegibilidad competitiva fue rechazada. Contactá a moderación.";
  if (code.includes("eligibility_pending_review"))
    return "Tu elegibilidad competitiva sigue pendiente de revisión.";
  if (code.includes("registration_not_open")) return "La inscripción no está abierta.";
  if (code.includes("registration_closed")) return "La inscripción cerró.";
  if (code.includes("tournament_full")) return "Este torneo está completo.";
  if (code.includes("already_registered")) return "Ya estás inscripto en este torneo.";
  if (code.includes("team_registration_required"))
    return "Este torneo requiere inscripción por equipos.";
  if (code.includes("tournament_not_found")) return "Torneo no encontrado.";
  if (code.includes("checkin_not_open")) return "La confirmación de asistencia todavía no abrió.";
  if (code.includes("checkin_closed")) return "La confirmación de asistencia cerró.";
  if (code.includes("checkin_not_required")) return "Este torneo no requiere confirmar asistencia.";
  if (code.includes("not_registered")) return "No estás inscripto en este torneo.";
  if (code.includes("entry_not_checkin_eligible"))
    return "No se puede confirmar la asistencia de esta inscripción.";
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
    throw new Error("No se pudo inscribir al torneo.");
  }

  const entryId = typeof data["entry_id"] === "string" ? data["entry_id"] : "";
  const status = typeof data["status"] === "string" ? data["status"] : "registered";
  const tournamentSlugResult =
    typeof data["tournament_slug"] === "string" ? data["tournament_slug"] : tournamentSlug;
  const tournamentName =
    typeof data["tournament_name"] === "string" ? data["tournament_name"] : tournamentSlug;

  if (!entryId) throw new Error("No se pudo inscribir al torneo.");

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
    throw new Error("No se pudo confirmar asistencia.");
  }

  const entryId = typeof data["entry_id"] === "string" ? data["entry_id"] : "";
  const status = typeof data["status"] === "string" ? data["status"] : "checked_in";
  if (!entryId) throw new Error("No se pudo confirmar asistencia.");
  return { entryId, status };
}
