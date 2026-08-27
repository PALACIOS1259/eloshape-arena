import { createServerFn } from "@tanstack/react-start";

import {
  createAuthenticatedSupabaseClient,
  requireSupabaseAuth,
} from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

type RpcResult<T> = { data: T | null; error: { message: string } | null };

type TeamMember = {
  profileId: string;
  handle: string;
  displayName: string;
  role: "player" | "substitute";
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
  if (code.includes("invalid_team_name")) return "Team name must be between 3 and 40 characters.";
  if (code.includes("invalid_team_tag")) return "Team tag must be 2–6 letters or numbers.";
  if (code.includes("team_name_taken")) return "That team name is already taken.";
  if (code.includes("team_tag_taken")) return "That team tag is already taken.";
  if (code.includes("team_identity_taken")) return "That team name or tag is already taken.";
  if (code.includes("already_on_team")) return "You are already on a team.";
  if (code.includes("player_not_found")) return "No EloShape player was found with that handle.";
  if (code.includes("cannot_invite_self")) return "You are already the team captain.";
  if (code.includes("player_already_on_team")) return "That player is already on a team.";
  if (code.includes("invite_already_pending"))
    return "That player already has a pending invite from your team.";
  if (code.includes("invite_not_found")) return "That team invitation is no longer available.";
  if (code.includes("invite_not_pending")) return "That team invitation has already been resolved.";
  if (code.includes("starting_roster_full"))
    return "The starting roster already has five players. Invite them as a substitute instead.";
  if (code.includes("team_captain_required")) return "Only the team captain can do that.";
  if (code.includes("team_member_not_found")) return "That player is not on your team.";
  if (code.includes("cannot_remove_captain"))
    return "The captain cannot be removed from the roster.";
  if (code.includes("captain_cannot_leave"))
    return "The captain cannot leave the team. Captain transfer/disbanding comes next.";
  if (code.includes("not_on_team")) return "You are not currently on a team.";
  if (code.includes("team_bio_too_long")) return "Team bio must be 500 characters or fewer.";
  if (code.includes("team_ineligible"))
    return "Your team needs exactly five eligible starters with verified Riot rank and account level 30+.";
  if (code.includes("region_mismatch")) return "This team is based outside the tournament region.";
  if (code.includes("registration_not_open") || code.includes("registration_closed"))
    return "Team registration is not open.";
  if (code.includes("tournament_full")) return "This tournament is full.";
  if (code.includes("already_registered")) return "Your team is already registered.";
  if (code.includes("solo_registration_required")) return "This is not a team-mode tournament.";
  if (code.includes("checkin_not_open")) return "Team check-in has not opened yet.";
  if (code.includes("checkin_closed")) return "Team check-in has closed.";
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
        error: error instanceof Error ? error.message : "Could not create team.",
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
        error: error instanceof Error ? error.message : "Could not update team.",
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
        error: error instanceof Error ? error.message : "Could not invite player.",
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
        error: error instanceof Error ? error.message : "Could not respond to invite.",
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
        error: error instanceof Error ? error.message : "Could not cancel invite.",
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
        error: error instanceof Error ? error.message : "Could not remove player.",
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
        error: error instanceof Error ? error.message : "Could not leave team.",
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
        error: error instanceof Error ? error.message : "Could not register team.",
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
        error: error instanceof Error ? error.message : "Could not check in team.",
      };
    }
  });
