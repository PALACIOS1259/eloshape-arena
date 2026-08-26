import { createServerFn } from "@tanstack/react-start";

import {
  createAuthenticatedSupabaseClient,
  requireSupabaseAuth,
} from "@/integrations/supabase/auth-middleware";

function message(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

type EntryState = {
  id: string;
  status: string;
  checkedInAt: string | null;
  canCheckIn: boolean;
  mode: "solo" | "team";
  isCaptain: boolean;
};

export const getMyTournamentEntry = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { slug: string }) => input)
  .handler(async ({ data, context }) => {
    const supabase = createAuthenticatedSupabaseClient(context.accessToken);
    const rpc = supabase.rpc.bind(supabase) as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: EntryState | null; error: { message: string } | null }>;
    const { data: entry, error } = await rpc("get_my_tournament_entry", { p_slug: data.slug });
    if (error) throw new Error(error.message);
    return entry;
  });

/** Server-validated solo registration. Team-mode registration uses team.functions.ts. */
export const registerForTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { slug: string }) => input)
  .handler(async ({ data, context }) => {
    const { registerForTournament: register } = await import("./tournament-entry.server");
    const supabase = createAuthenticatedSupabaseClient(context.accessToken);
    try {
      return {
        ok: true as const,
        entry: await register(context.userId, supabase, data.slug),
      };
    } catch (error) {
      return {
        ok: false as const,
        error: message(error, "Could not register for this tournament."),
      };
    }
  });

export const checkInToTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { slug: string }) => input)
  .handler(async ({ data, context }) => {
    const { checkInToTournament: checkIn } = await import("./tournament-entry.server");
    const supabase = createAuthenticatedSupabaseClient(context.accessToken);
    try {
      return {
        ok: true as const,
        entry: await checkIn(context.userId, supabase, data.slug),
      };
    } catch (error) {
      return { ok: false as const, error: message(error, "Could not check in.") };
    }
  });
