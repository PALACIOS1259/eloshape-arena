import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";

import {
  createAuthenticatedSupabaseClient,
  requireSupabaseAuth,
} from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type StaffSplitOps = {
  split: {
    id: string;
    slug: string;
    name: string;
    status: string;
    playoffSize: number;
    qualificationSlotsPerQualifier: number;
    startsAt: string;
    endsAt: string;
    disputeDeadlineAt: string | null;
    playoffRevealAt: string | null;
  };
  qualifiers: Array<{
    id: string;
    slug: string;
    name: string;
    status: string;
    qualifierIndex: number | null;
    startsAt: string;
    participantsCount: number;
    maxParticipants: number | null;
    entriesLockedAt: string | null;
    bracketGeneratedAt: string | null;
    finalizedAt: string | null;
    activeQualificationGrants: number;
  }>;
  qualifications: Array<{
    id: string;
    teamId: string;
    teamSlug: string;
    teamName: string;
    teamTag: string;
    status: string;
    qualificationPosition: number;
    playoffSeed: number | null;
    qualifiedAt: string;
    sourceTournamentId: string | null;
    sourceTournamentName: string | null;
    sourceQualifierIndex: number | null;
    replacesTeamId: string | null;
    replacesTeamName: string | null;
  }>;
  standings: Array<{
    team_id: string;
    team_slug: string;
    team_name: string;
    team_tag: string;
    points: number;
    wins: number;
    losses: number;
    tournaments_played: number;
    qualification_status: string | null;
    qualification_position: number | null;
  }>;
  replacementCandidates: Array<{
    team_id: string;
    team_slug: string;
    team_name: string;
    team_tag: string;
    points: number;
    wins: number;
    losses: number;
    tournaments_played: number;
  }>;
  playoffTournament: null | {
    id: string;
    slug: string;
    name: string;
    status: string;
    participantsCount: number;
    entriesLockedAt: string | null;
    bracketGeneratedAt: string | null;
    finalizedAt: string | null;
  };
  readiness: {
    qualifierCount: number;
    finalizedQualifierCount: number;
    allQualifiersFinalized: boolean;
    qualifiedCount: number;
    playoffSize: number;
    fullPlayoffField: boolean;
    canEnterSeeding: boolean;
    canGeneratePlayoffs: boolean;
    canGenerateShortPlayoffs: boolean;
  };
};

async function assertStaff(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((row) => row.role);
  if (!roles.includes("admin") && !roles.includes("moderator")) throw new Error("Forbidden");
}

export const getStaffSplitOps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { splitId: string }) => input)
  .handler(async ({ data, context }) => {
    const supabase = createAuthenticatedSupabaseClient(context.accessToken);
    await assertStaff(supabase, context.userId);
    const rpc = supabase.rpc.bind(supabase) as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: StaffSplitOps | null; error: { message: string } | null }>;
    const result = await rpc("staff_get_split_ops", { p_split: data.splitId });
    if (result.error) throw new Error(result.error.message);
    if (!result.data) throw new Error("Split not found.");
    return result.data;
  });
