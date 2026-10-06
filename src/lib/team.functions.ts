import { createServerFn } from "@tanstack/react-start";

import {
  createAuthenticatedSupabaseClient,
  requireSupabaseAuth,
} from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

type RpcResult<T> = { data: T | null; error: { message: string } | null };

export type LaneRole = "top" | "jungle" | "mid" | "bot" | "support";

type TeamMember = {
  profileId: string;
  handle: string;
  displayName: string;
  role: "player" | "substitute";
  laneRole: LaneRole | null;
  isCaptain: boolean;
  eligibility: string;
  riotTier: string | null;
  riotRank: string | null;
  accountLevel: number | null;
  riotVerified: boolean;
};

type TeamInvite = {
  id: string;
  profileId?: string;
  handle?: string;
  displayName?: string;
  teamId?: string;
  teamSlug?: string;
  teamName?: string;
  teamTag?: string;
  role: "player" | "substitute";
  invitedBy?: string;
  createdAt: string;
};

export type TeamHub = {
  profileId: string;
  canCreateTeam: boolean;
  incomingInvites: TeamInvite[];
  team: null | {
    id: string;
    slug: string;
    name: string;
    tag: string;
    bio: string | null;
    logoUrl: string | null;
    captainProfileId: string;
    isCaptain: boolean;
    pointsSeason: number;
    wins: number;
    losses: number;
    championships: number;
    division: null | { code: string; name: string; accent: string };
    city: null | { id: string; name: string };
    members: TeamMember[];
    pendingInvites: TeamInvite[];
    eligibility: { eligible: boolean; active_players: number; reasons: Json[] };
  };
};

function clientFor(accessToken: string) {
  return createAuthenticatedSupabaseClient(accessToken);
}

function callRpc<T>(
  accessToken: string,
  fn: string,
  args?: Record<string, unknown>,
): Promise<RpcResult<T>> {
  const supabase = clientFor(accessToken);
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    values?: Record<string, unknown>,
  ) => Promise<RpcResult<T>>;
  return rpc(fn, args);
}

function friendlyTeamError(message: string) {
  const code = message.toLowerCase();
  if (code.includes("invalid_team_name"))
    return "El nombre del equipo debe tener entre 3 y 40 caracteres.";
  if (code.includes("invalid_team_tag"))
    return "La sigla del equipo debe tener de 2 a 6 letras o números.";
  if (code.includes("team_name_taken")) return "Ese nombre de equipo ya está en uso.";
  if (code.includes("team_tag_taken")) return "Esa sigla de equipo ya está en uso.";
  if (code.includes("team_identity_taken")) return "Ese nombre o sigla ya está en uso.";
  if (code.includes("already_on_team")) return "Ya estás en un equipo.";
  if (code.includes("player_not_found"))
    return "No encontramos un jugador de EloShape con ese nombre de usuario.";
  if (code.includes("cannot_invite_self")) return "Ya sos capitán del equipo.";
  if (code.includes("player_already_on_team")) return "Ese jugador ya está en un equipo.";
  if (code.includes("invite_already_pending"))
    return "Ese jugador ya tiene una invitación pendiente de tu equipo.";
  if (code.includes("invite_not_found")) return "Esa invitación de equipo ya no está disponible.";
  if (code.includes("invite_not_pending")) return "Esa invitación de equipo ya fue resuelta.";
  if (code.includes("starting_roster_full"))
    return "El plantel titular ya tiene cinco jugadores. Invitalo como suplente.";
  if (code.includes("team_captain_required")) return "Solo el capitán del equipo puede hacer eso.";
  if (code.includes("team_member_not_found")) return "Ese jugador no está en tu equipo.";
  if (code.includes("cannot_remove_captain")) return "No se puede quitar al capitán del plantel.";
  if (code.includes("captain_cannot_leave"))
    return "El capitán no puede abandonar el equipo. Primero debe transferir la capitanía o disolverlo.";
  if (code.includes("not_on_team")) return "Actualmente no estás en un equipo.";
  if (code.includes("team_bio_too_long"))
    return "La biografía del equipo no puede superar los 500 caracteres.";
  if (code.includes("team_ineligible"))
    return "Tu equipo necesita exactamente cinco titulares habilitados, con rango de Riot verificado y cuenta de nivel 30 o superior.";
  if (code.includes("region_mismatch")) return "Este equipo pertenece a otra región.";
  if (code.includes("registration_not_open") || code.includes("registration_closed"))
    return "La inscripción por equipos no está abierta.";
  if (code.includes("qualified_priority_window"))
    return "Por ahora tienen prioridad los equipos no clasificados. Tu equipo podrá inscribirse después si quedan lugares.";
  if (code.includes("tournament_full")) return "Este torneo está completo.";
  if (code.includes("already_registered")) return "Tu equipo ya está inscripto.";
  if (code.includes("solo_registration_required")) return "Este torneo no es por equipos.";
  if (code.includes("checkin_not_open"))
    return "La confirmación de asistencia del equipo todavía no está abierta.";
  if (code.includes("checkin_closed")) return "La confirmación de asistencia del equipo cerró.";
  return message;
}

async function run<T>(accessToken: string, fn: string, args?: Record<string, unknown>) {
  const { data, error } = await callRpc<T>(accessToken, fn, args);
  if (error) throw new Error(friendlyTeamError(error.message));
  return data as T;
}

export const getMyTeamHub = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => run<TeamHub>(context.accessToken, "get_my_team_hub"));

export const createMyTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { name: string; tag: string }) => input)
  .handler(async ({ data, context }) => {
    try {
      return {
        ok: true as const,
        data: await run<Json>(context.accessToken, "create_my_team", {
          p_name: data.name,
          p_tag: data.tag,
        }),
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "No se pudo crear el equipo.",
      };
    }
  });

export const updateMyTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { name: string; tag: string; bio: string }) => input)
  .handler(async ({ data, context }) => {
    try {
      return {
        ok: true as const,
        data: await run<Json>(context.accessToken, "update_my_team", {
          p_name: data.name,
          p_tag: data.tag,
          p_bio: data.bio,
        }),
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "No se pudo actualizar el equipo.",
      };
    }
  });

export const inviteMyTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { handle: string; role: "player" | "substitute" }) => input)
  .handler(async ({ data, context }) => {
    try {
      return {
        ok: true as const,
        data: await run<Json>(context.accessToken, "invite_my_team_member", {
          p_handle: data.handle,
          p_role: data.role,
        }),
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "No se pudo invitar al jugador.",
      };
    }
  });

export const respondMyTeamInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { inviteId: string; accept: boolean }) => input)
  .handler(async ({ data, context }) => {
    try {
      return {
        ok: true as const,
        data: await run<Json>(context.accessToken, "respond_my_team_invite", {
          p_invite_id: data.inviteId,
          p_accept: data.accept,
        }),
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "No se pudo responder a la invitación.",
      };
    }
  });

export const cancelMyTeamInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { inviteId: string }) => input)
  .handler(async ({ data, context }) => {
    try {
      return {
        ok: true as const,
        data: await run<Json>(context.accessToken, "cancel_my_team_invite", {
          p_invite_id: data.inviteId,
        }),
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "No se pudo cancelar la invitación.",
      };
    }
  });

export const removeMyTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { handle: string }) => input)
  .handler(async ({ data, context }) => {
    try {
      return {
        ok: true as const,
        data: await run<Json>(context.accessToken, "remove_my_team_member", {
          p_handle: data.handle,
        }),
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "No se pudo quitar al jugador.",
      };
    }
  });

export const leaveMyTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      return { ok: true as const, data: await run<Json>(context.accessToken, "leave_my_team") };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "No se pudo abandonar el equipo.",
      };
    }
  });

export const registerMyTeamForTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { slug: string }) => input)
  .handler(async ({ data, context }) => {
    try {
      return {
        ok: true as const,
        entry: await run<Json>(context.accessToken, "register_my_team_tournament", {
          p_slug: data.slug,
        }),
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "No se pudo inscribir al equipo.",
      };
    }
  });

export const checkInMyTeamToTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { slug: string }) => input)
  .handler(async ({ data, context }) => {
    try {
      return {
        ok: true as const,
        entry: await run<Json>(context.accessToken, "check_in_my_team_tournament", {
          p_slug: data.slug,
        }),
      };
    } catch (error) {
      return {
        ok: false as const,
        error:
          error instanceof Error ? error.message : "No se pudo confirmar la asistencia del equipo.",
      };
    }
  });
