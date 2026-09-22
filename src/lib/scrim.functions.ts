import { createServerFn } from "@tanstack/react-start";

import {
  createAuthenticatedSupabaseClient,
  requireSupabaseAuth,
} from "@/integrations/supabase/auth-middleware";
import { createPublicClient } from "@/lib/supabase-public.server";

type RpcResult<T> = { data: T | null; error: { message: string } | null };

export type ScrimTeam = {
  id: string;
  slug: string;
  name: string;
  tag: string;
  logoUrl: string | null;
  division: null | { code: string; name: string; accent: string };
  city?: null | { id: string; name: string };
};

export type ScrimPost = {
  id: string;
  startsAt: string;
  endsAt: string | null;
  bestOf: 1 | 3 | 5;
  note: string | null;
  status: "open" | "matched" | "completed";
  scoreTeam: number | null;
  scoreOpponent: number | null;
  winnerTeamId: string | null;
  team: ScrimTeam;
  opponent: ScrimTeam | null;
  challengeCount: number;
};

export type ScrimHub = {
  profileId: string;
  team: null | {
    id: string;
    slug: string;
    name: string;
    tag: string;
    isCaptain: boolean;
  };
  incomingChallenges: Array<{
    id: string;
    scrimId: string;
    status: string;
    createdAt: string;
    challenger: { id: string; slug: string; name: string; tag: string };
  }>;
  outgoingChallenges: Array<{
    id: string;
    scrimId: string;
    status: string;
    createdAt: string;
  }>;
  ownScrims: Array<{
    id: string;
    startsAt: string;
    bestOf: number;
    status: string;
    opponentTeamId: string | null;
    scoreTeam: number | null;
    scoreOpponent: number | null;
  }>;
};

function friendlyScrimError(raw: string) {
  const code = raw.toLowerCase();
  if (code.includes("team_captain_required")) return "Only a team captain can do that.";
  if (code.includes("scrim_start_too_soon"))
    return "Schedule the scrim at least 10 minutes from now.";
  if (code.includes("invalid_scrim_window")) return "The end time must be after the start time.";
  if (code.includes("invalid_best_of")) return "Scrims can be Bo1, Bo3 or Bo5.";
  if (code.includes("scrim_note_too_long")) return "Scrim notes are limited to 240 characters.";
  if (code.includes("scrim_not_found")) return "That scrim is no longer available.";
  if (code.includes("scrim_not_open")) return "That scrim is no longer open for challenges.";
  if (code.includes("scrim_already_started")) return "That scrim has already started.";
  if (code.includes("cannot_challenge_own_scrim")) return "You cannot challenge your own team.";
  if (code.includes("scrim_challenge_not_found")) return "That challenge no longer exists.";
  if (code.includes("scrim_challenge_not_pending"))
    return "That challenge has already been handled.";
  if (code.includes("scrim_completed")) return "Completed scrims cannot be cancelled.";
  if (code.includes("scrim_not_reportable")) return "This scrim is not ready for a result.";
  if (code.includes("not_scrim_participant")) return "Your team is not part of this scrim.";
  if (code.includes("invalid_scrim_score"))
    return "Enter a valid final score for the selected Best-of format.";
  return raw;
}

function authRpc<T>(
  accessToken: string,
  fn: string,
  args?: Record<string, unknown>,
): Promise<RpcResult<T>> {
  const supabase = createAuthenticatedSupabaseClient(accessToken);
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    values?: Record<string, unknown>,
  ) => Promise<RpcResult<T>>;
  return rpc(fn, args);
}

async function runAuth<T>(
  accessToken: string,
  fn: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await authRpc<T>(accessToken, fn, args);
  if (error) throw new Error(friendlyScrimError(error.message));
  return data as T;
}

export const listScrims = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createPublicClient();
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    values?: Record<string, unknown>,
  ) => Promise<RpcResult<ScrimPost[]>>;
  const { data, error } = await rpc("list_scrims");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getMyScrimHub = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => runAuth<ScrimHub>(context.accessToken, "get_my_scrim_hub"));

export const createMyScrim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: { startsAt: string; endsAt?: string | null; bestOf: 1 | 3 | 5; note?: string }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    try {
      return {
        ok: true as const,
        data: await runAuth<{ id: string; status: string }>(
          context.accessToken,
          "create_my_scrim",
          {
            p_starts_at: data.startsAt,
            p_ends_at: data.endsAt ?? null,
            p_best_of: data.bestOf,
            p_note: data.note ?? null,
          },
        ),
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Could not create scrim.",
      };
    }
  });

export const challengeScrim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { scrimId: string }) => input)
  .handler(async ({ data, context }) => {
    try {
      return {
        ok: true as const,
        data: await runAuth<{ id: string; status: string }>(
          context.accessToken,
          "challenge_scrim",
          { p_scrim: data.scrimId },
        ),
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Could not challenge this scrim.",
      };
    }
  });

export const respondScrimChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { challengeId: string; accept: boolean }) => input)
  .handler(async ({ data, context }) => {
    try {
      return {
        ok: true as const,
        data: await runAuth<{ status: string }>(context.accessToken, "respond_scrim_challenge", {
          p_challenge: data.challengeId,
          p_accept: data.accept,
        }),
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Could not update this challenge.",
      };
    }
  });

export const cancelMyScrim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { scrimId: string }) => input)
  .handler(async ({ data, context }) => {
    try {
      return {
        ok: true as const,
        data: await runAuth<{ status: string }>(context.accessToken, "cancel_my_scrim", {
          p_scrim: data.scrimId,
        }),
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Could not cancel this scrim.",
      };
    }
  });

export const reportMyScrimResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { scrimId: string; scoreTeam: number; scoreOpponent: number }) => input)
  .handler(async ({ data, context }) => {
    try {
      return {
        ok: true as const,
        data: await runAuth<{ status: string; winnerTeamId: string }>(
          context.accessToken,
          "report_my_scrim_result",
          {
            p_scrim: data.scrimId,
            p_score_team: data.scoreTeam,
            p_score_opponent: data.scoreOpponent,
          },
        ),
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Could not report this scrim result.",
      };
    }
  });
