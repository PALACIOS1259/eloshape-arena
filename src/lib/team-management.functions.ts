import { createServerFn } from "@tanstack/react-start";

import {
  createAuthenticatedSupabaseClient,
  requireSupabaseAuth,
} from "@/integrations/supabase/auth-middleware";

type RpcResult<T> = { data: T | null; error: { message: string } | null };

function friendly(message: string) {
  const code = message.toLowerCase();
  if (code.includes("team_captain_required")) return "Only the team captain can do that.";
  if (code.includes("team_member_not_found")) return "That player is not on your team.";
  if (code.includes("invalid_team_role")) return "Choose Starter or Substitute.";
  if (code.includes("starting_roster_full")) return "The starting roster already has five players.";
  if (code.includes("captain_must_be_starter")) return "The team captain must remain a starter.";
  if (code.includes("already_team_captain")) return "That player is already the team captain.";
  if (code.includes("roster_locked_for_tournament")) return "Roster changes are locked while your team is checked in to an active tournament.";
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
        data: await rpc<Record<string, unknown>>(context.accessToken, "update_my_team_member_role", {
          p_handle: data.handle,
          p_role: data.role,
        }),
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Could not update roster role.",
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
        data: await rpc<Record<string, unknown>>(context.accessToken, "transfer_my_team_captain", {
          p_handle: data.handle,
        }),
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Could not transfer team captaincy.",
      };
    }
  });
