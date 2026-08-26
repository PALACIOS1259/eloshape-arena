import { createServerFn } from "@tanstack/react-start";

import {
  createAuthenticatedSupabaseClient,
  requireSupabaseAuth,
} from "@/integrations/supabase/auth-middleware";

export type TeamCandidate = {
  profileId: string;
  handle: string;
  displayName: string;
  eligibility: string;
  riotTier: string | null;
  riotRank: string | null;
  accountLevel: number | null;
  riotVerified: boolean;
  divisionCode: string | null;
  divisionName: string | null;
  cityName: string | null;
  ready: boolean;
};

type RpcResult<T> = { data: T | null; error: { message: string } | null };

export const searchMyTeamCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { query?: string; limit?: number }) => input)
  .handler(async ({ data, context }) => {
    const supabase = createAuthenticatedSupabaseClient(context.accessToken);
    const rpc = supabase.rpc.bind(supabase) as unknown as (
      name: string,
      values?: Record<string, unknown>,
    ) => Promise<RpcResult<TeamCandidate[]>>;

    const { data: candidates, error } = await rpc("search_my_team_candidates", {
      p_query: data?.query ?? "",
      p_limit: data?.limit ?? 12,
    });

    if (error) throw new Error(error.message);
    return candidates ?? [];
  });
