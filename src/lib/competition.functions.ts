import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";

import {
  createAuthenticatedSupabaseClient,
  requireSupabaseAuth,
} from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

async function assertStaff(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((row) => row.role);
  if (!roles.includes("admin") && !roles.includes("moderator")) throw new Error("Forbidden");
  return { isAdmin: roles.includes("admin") };
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function guarded<T>(run: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true as const, data: await run() };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Operation failed.";
    return { ok: false as const, error: message };
  }
}

function clientFor(accessToken: string) {
  return createAuthenticatedSupabaseClient(accessToken);
}

export const getTournamentOps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tournamentId: string }) => input)
  .handler(async ({ data, context }) => {
    const supabase = clientFor(context.accessToken);
    await assertStaff(supabase, context.userId);
    const { loadTournamentOps } = await import("./competition.server");
    return loadTournamentOps(supabase, data.tournamentId);
  });

export const lockEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tournamentId: string }) => input)
  .handler(async ({ data, context }) =>
    guarded(async () => {
      const supabase = clientFor(context.accessToken);
      await assertStaff(supabase, context.userId);
      const { lockTournamentEntries } = await import("./competition.server");
      return lockTournamentEntries(supabase, data.tournamentId);
    }),
  );

export const generateBracket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: { tournamentId: string; bestOf?: number; roundBestOf?: Record<number, number> }) =>
      input,
  )
  .handler(async ({ data, context }) =>
    guarded(async () => {
      const supabase = clientFor(context.accessToken);
      await assertStaff(supabase, context.userId);
      const { generateTournamentBracket } = await import("./competition.server");
      return generateTournamentBracket(supabase, data.tournamentId, {
        bestOf: data.bestOf ?? 1,
        roundBestOf: data.roundBestOf ?? {},
      });
    }),
  );

export const submitMatchResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { matchId: string; scoreA: number; scoreB: number }) => {
    if (!Number.isInteger(input.scoreA) || !Number.isInteger(input.scoreB)) {
      throw new Error("Scores must be whole numbers.");
    }
    if (input.scoreA < 0 || input.scoreB < 0) throw new Error("Scores cannot be negative.");
    return input;
  })
  .handler(async ({ data, context }) =>
    guarded(async () => {
      const supabase = clientFor(context.accessToken);
      await assertStaff(supabase, context.userId);
      const { reportMatchResult } = await import("./competition.server");
      return reportMatchResult(supabase, data.matchId, data.scoreA, data.scoreB);
    }),
  );

export const recordMatchWalkover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { matchId: string; winnerEntryId: string; note: string }) => {
    const note = input.note.trim();
    if (note.length < 3 || note.length > 1000) {
      throw new Error("A walkover reason between 3 and 1000 characters is required.");
    }
    return { ...input, note };
  })
  .handler(async ({ data, context }) =>
    guarded(async () => {
      const supabase = clientFor(context.accessToken);
      await assertStaff(supabase, context.userId);
      const { recordMatchWalkover: record } = await import("./competition.server");
      return record(supabase, data.matchId, data.winnerEntryId, data.note);
    }),
  );

export const closeTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tournamentId: string }) => input)
  .handler(async ({ data, context }) =>
    guarded(async () => {
      const supabase = clientFor(context.accessToken);
      await assertStaff(supabase, context.userId);
      const { finalizeTournament } = await import("./competition.server");
      return finalizeTournament(supabase, data.tournamentId);
    }),
  );

export const replaceQualifier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { splitId: string; teamId: string }) => input)
  .handler(async ({ data, context }) =>
    guarded(async () => {
      const supabase = clientFor(context.accessToken);
      await assertStaff(supabase, context.userId);
      const { replaceWithdrawnQualifier } = await import("./competition.server");
      return replaceWithdrawnQualifier(supabase, data.splitId, data.teamId);
    }),
  );

export const advanceSplitStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { splitId: string; status: string }) => input)
  .handler(async ({ data, context }) =>
    guarded(async () => {
      const supabase = clientFor(context.accessToken);
      await assertStaff(supabase, context.userId);
      const { setSplitStatus } = await import("./competition.server");
      return setSplitStatus(supabase, data.splitId, data.status);
    }),
  );

export const buildSplitPlayoffs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: { splitId: string; bestOf?: number; allowShortField?: boolean; reason?: string }) => {
      if (input.allowShortField && !input.reason?.trim()) {
        throw new Error("An override reason is required for a short playoff field.");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) =>
    guarded(async () => {
      const supabase = clientFor(context.accessToken);
      await assertStaff(supabase, context.userId);
      const { generateSplitPlayoffs } = await import("./competition.server");
      const reason = data.reason?.trim();
      return generateSplitPlayoffs(supabase, data.splitId, {
        bestOf: data.bestOf ?? 3,
        allowShortField: data.allowShortField ?? false,
        ...(reason ? { reason } : {}),
      });
    }),
  );

export const getStaffSplits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = clientFor(context.accessToken);
    await assertStaff(supabase, context.userId);
    const [splits, tournaments] = await Promise.all([
      supabase
        .from("competitive_splits")
        .select("id, slug, name, status, starts_at, ends_at, playoff_size, playoff_reveal_at")
        .order("starts_at", { ascending: false }),
      supabase
        .from("tournaments")
        .select(
          "id, slug, name, status, split_id, qualifier_index, split_phase, entries_locked_at, bracket_generated_at, finalized_at, participants_count",
        )
        .order("starts_at", { ascending: false })
        .limit(50),
    ]);
    return { splits: splits.data ?? [], tournaments: tournaments.data ?? [] };
  });
