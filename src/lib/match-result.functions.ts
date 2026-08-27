import { createServerFn } from "@tanstack/react-start";

import {
  createAuthenticatedSupabaseClient,
  requireSupabaseAuth,
} from "@/integrations/supabase/auth-middleware";

type RpcResult<T> = { data: T | null; error: { message: string } | null };

export type MatchEntrySummary = {
  id: string;
  name: string;
  teamSlug: string | null;
  playerHandle: string | null;
};

export type MatchResultState = {
  match: {
    id: string;
    roundLabel: string;
    roundIndex: number;
    bracketSlot: number;
    bestOf: number;
    status: string;
    scoreA: number;
    scoreB: number;
    winnerEntryId: string | null;
    isBye: boolean;
  };
  tournament: {
    id: string;
    slug: string;
    name: string;
    mode: string;
    status: string;
  };
  entryA: MatchEntrySummary | null;
  entryB: MatchEntrySummary | null;
  myEntryId: string | null;
  isStaff: boolean;
  claim: null | {
    id: string;
    reporterEntryId: string;
    scoreA: number;
    scoreB: number;
    evidenceUrl: string | null;
    reporterNote: string | null;
    status: "pending_confirmation" | "disputed" | "confirmed" | "resolved" | "dismissed";
    responderNote: string | null;
    respondedAt: string | null;
    resolutionNote: string | null;
    resolvedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  canSubmit: boolean;
  canRespond: boolean;
};

export type StaffMatchDispute = {
  id: string;
  matchId: string;
  status: "pending_confirmation" | "disputed";
  scoreA: number;
  scoreB: number;
  evidenceUrl: string | null;
  reporterNote: string | null;
  responderNote: string | null;
  createdAt: string;
  respondedAt: string | null;
  tournament: { id: string; slug: string; name: string };
  roundLabel: string;
  entryA: string;
  entryB: string;
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

function friendlyResultError(message: string) {
  const code = message.toLowerCase();
  if (code.includes("invalid_score")) return "That score is not valid for this best-of series.";
  if (code.includes("not_match_participant")) {
    return "Only a participating player or team captain can report this match.";
  }
  if (code.includes("match_not_found")) return "That match could not be found.";
  if (code.includes("match_not_reportable")) return "This match is not accepting result reports.";
  if (code.includes("tournament_not_active")) return "This tournament is not currently accepting results.";
  if (code.includes("tournament_finalized")) return "This tournament has already been finalized.";
  if (code.includes("result_claim_already_exists")) {
    return "The opposing participant has already submitted a result for this match.";
  }
  if (code.includes("result_claim_not_found")) return "No submitted result exists for this match.";
  if (code.includes("result_claim_not_pending")) return "This result has already been resolved.";
  if (code.includes("opponent_confirmation_required")) {
    return "The participant who submitted a result cannot confirm their own report.";
  }
  if (code.includes("dispute_note_required")) return "Explain what is wrong before opening a dispute.";
  if (code.includes("invalid_evidence_url")) return "Evidence must be a valid http or https link.";
  if (code.includes("note_too_long")) return "Result notes must be 1,000 characters or fewer.";
  if (code.includes("resolution_note_required")) return "Staff must enter a resolution note.";
  if (code.includes("result_claim_not_resolvable")) return "This result claim is no longer open.";
  if (code.includes("forbidden")) return "You do not have access to this match result.";
  return message;
}

async function run<T>(accessToken: string, fn: string, args?: Record<string, unknown>) {
  const { data, error } = await callRpc<T>(accessToken, fn, args);
  if (error) throw new Error(friendlyResultError(error.message));
  return data as T;
}

export const getMyMatchResult = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { matchId: string }) => input)
  .handler(async ({ data, context }) =>
    run<MatchResultState>(context.accessToken, "get_my_match_result", { p_match: data.matchId }),
  );

export const submitMyMatchResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      matchId: string;
      scoreA: number;
      scoreB: number;
      evidenceUrl?: string;
      note?: string;
    }) => {
      if (!Number.isInteger(input.scoreA) || !Number.isInteger(input.scoreB)) {
        throw new Error("Scores must be whole numbers.");
      }
      if (input.scoreA < 0 || input.scoreB < 0) throw new Error("Scores cannot be negative.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    try {
      const state = await run<MatchResultState>(context.accessToken, "submit_my_match_result", {
        p_match: data.matchId,
        p_score_a: data.scoreA,
        p_score_b: data.scoreB,
        p_evidence_url: data.evidenceUrl?.trim() || null,
        p_note: data.note?.trim() || null,
      });
      return { ok: true as const, state };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Could not submit the result.",
      };
    }
  });

export const respondMyMatchResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { matchId: string; confirm: boolean; note?: string }) => input)
  .handler(async ({ data, context }) => {
    try {
      const state = await run<MatchResultState>(context.accessToken, "respond_my_match_result", {
        p_match: data.matchId,
        p_confirm: data.confirm,
        p_note: data.note?.trim() || null,
      });
      return { ok: true as const, state };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Could not respond to the result.",
      };
    }
  });

export const getStaffMatchDisputes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    run<StaffMatchDispute[]>(context.accessToken, "staff_list_match_disputes"),
  );

export const resolveStaffMatchDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: { claimId: string; scoreA: number; scoreB: number; note: string }) => {
      if (!Number.isInteger(input.scoreA) || !Number.isInteger(input.scoreB)) {
        throw new Error("Scores must be whole numbers.");
      }
      if (input.scoreA < 0 || input.scoreB < 0) throw new Error("Scores cannot be negative.");
      if (input.note.trim().length < 3) throw new Error("Enter a staff resolution note.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    try {
      const state = await run<MatchResultState>(context.accessToken, "staff_resolve_match_dispute", {
        p_claim: data.claimId,
        p_score_a: data.scoreA,
        p_score_b: data.scoreB,
        p_note: data.note.trim(),
      });
      return { ok: true as const, state };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Could not resolve the dispute.",
      };
    }
  });

export const dismissStaffMatchDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { claimId: string; note: string }) => {
    if (input.note.trim().length < 3) throw new Error("Enter a staff dismissal note.");
    return input;
  })
  .handler(async ({ data, context }) => {
    try {
      const state = await run<MatchResultState>(context.accessToken, "staff_dismiss_match_dispute", {
        p_claim: data.claimId,
        p_note: data.note.trim(),
      });
      return { ok: true as const, state };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Could not dismiss the claim.",
      };
    }
  });
