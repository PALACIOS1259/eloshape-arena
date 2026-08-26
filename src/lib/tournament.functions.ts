import { createServerFn } from "@tanstack/react-start";

import {
  createAuthenticatedSupabaseClient,
  requireSupabaseAuth,
} from "@/integrations/supabase/auth-middleware";

function message(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export const getMyTournamentEntry = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { slug: string }) => input)
  .handler(async ({ data, context }) => {
    const supabase = createAuthenticatedSupabaseClient(context.accessToken);

    const profile = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (profile.error) throw new Error(profile.error.message);
    if (!profile.data) return null;

    const tournament = await supabase
      .from("tournaments")
      .select("id, starts_at, checkin_required")
      .eq("slug", data.slug)
      .maybeSingle();
    if (tournament.error) throw new Error(tournament.error.message);
    if (!tournament.data) return null;

    const entry = await supabase
      .from("tournament_entries")
      .select("id, status, checked_in_at")
      .eq("tournament_id", tournament.data.id)
      .eq("profile_id", profile.data.id)
      .maybeSingle();
    if (entry.error) throw new Error(entry.error.message);
    if (!entry.data || entry.data.status === "withdrawn") return null;

    const startsAt = Date.parse(tournament.data.starts_at);
    const now = Date.now();
    const canCheckIn =
      tournament.data.checkin_required &&
      entry.data.status === "registered" &&
      Number.isFinite(startsAt) &&
      now >= startsAt - 60 * 60 * 1000 &&
      now <= startsAt;

    return {
      id: entry.data.id,
      status: entry.data.status,
      checkedInAt: entry.data.checked_in_at,
      canCheckIn,
    };
  });

/** Server-validated registration. The browser only supplies a tournament slug. */
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
