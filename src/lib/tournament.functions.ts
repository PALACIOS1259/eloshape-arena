import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function message(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Server-validated registration. The browser only supplies a tournament slug. */
export const registerForTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data, context }) => {
    const { registerForTournament: register } = await import("./tournament-entry.server");
    try {
      return { ok: true as const, entry: await register(context.userId, data.slug) };
    } catch (error) {
      return { ok: false as const, error: message(error, "Could not register for this tournament.") };
    }
  });

export const checkInToTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data, context }) => {
    const { checkInToTournament: checkIn } = await import("./tournament-entry.server");
    try {
      return { ok: true as const, entry: await checkIn(context.userId, data.slug) };
    } catch (error) {
      return { ok: false as const, error: message(error, "Could not check in.") };
    }
  });
