import { createServerFn } from "@tanstack/react-start";

import {
  createAuthenticatedSupabaseClient,
  requireSupabaseAuth,
} from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

export type LaneRole = "top" | "jungle" | "mid" | "bot" | "support";

type RpcResult<T> = { data: T | null; error: { message: string } | null };

function friendly(message: string) {
  const code = message.toLowerCase();
  if (code.includes("team_captain_required")) return "Solo el capitán del equipo puede hacer eso.";
  if (code.includes("team_member_not_found")) return "Ese jugador no está en tu equipo.";
  if (code.includes("invalid_team_role")) return "Elegí titular o suplente.";
  if (code.includes("invalid_lane_role"))
    return "Elegí superior, jungla, central, tirador o soporte.";
  if (code.includes("starting_roster_full")) return "El plantel titular ya tiene cinco jugadores.";
  if (code.includes("captain_must_be_starter")) return "El capitán debe permanecer como titular.";
  if (code.includes("already_team_captain")) return "Ese jugador ya es capitán del equipo.";
  if (code.includes("roster_locked_for_tournament"))
    return "Los cambios de plantel están bloqueados mientras el equipo tenga asistencia confirmada en un torneo activo.";
  if (code.includes("team_active_tournament"))
    return "No podés disolver el equipo mientras tenga asistencia confirmada o esté compitiendo en un torneo activo.";
  return message;
}

async function rpc<T>(accessToken: string, fn: string, args: Record<string, unknown>) {
  const supabase = createAuthenticatedSupabaseClient(accessToken);
  const call = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    values?: Record<string, unknown>,
  ) => Promise<RpcResult<T>>;
  const { data, error } = await call(fn, args);
  if (error) throw new Error(friendly(error.message));
  return data as T;
}

export const updateMyTeamMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { handle: string; role: "player" | "substitute" }) => input)
  .handler(async ({ data, context }) => {
    try {
      return {
        ok: true as const,
        data: await rpc<Json>(context.accessToken, "update_my_team_member_role", {
          p_handle: data.handle,
          p_role: data.role,
        }),
      };
    } catch (error) {
      return {
        ok: false as const,
        error:
          error instanceof Error ? error.message : "No se pudo actualizar la función del plantel.",
      };
    }
  });

export const updateMyTeamMemberLaneRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { handle: string; laneRole: LaneRole | null }) => input)
  .handler(async ({ data, context }) => {
    try {
      return {
        ok: true as const,
        data: await rpc<Json>(context.accessToken, "update_my_team_member_lane_role", {
          p_handle: data.handle,
          p_lane_role: data.laneRole ?? "",
        }),
      };
    } catch (error) {
      return {
        ok: false as const,
        error:
          error instanceof Error ? error.message : "No se pudo actualizar la posición de juego.",
      };
    }
  });

export const transferMyTeamCaptain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { handle: string }) => input)
  .handler(async ({ data, context }) => {
    try {
      return {
        ok: true as const,
        data: await rpc<Json>(context.accessToken, "transfer_my_team_captain", {
          p_handle: data.handle,
        }),
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "No se pudo transferir la capitanía.",
      };
    }
  });

export const archiveMyTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      return {
        ok: true as const,
        data: await rpc<Json>(context.accessToken, "archive_my_team", {}),
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "No se pudo disolver el equipo.",
      };
    }
  });
