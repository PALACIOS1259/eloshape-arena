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
  const isAdmin = roles.includes("admin");
  const isModerator = roles.includes("moderator");
  if (!isAdmin && !isModerator) throw new Error("Forbidden");
  return { isAdmin, isModerator };
}

export const getMyStaffStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = createAuthenticatedSupabaseClient(context.accessToken);
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (data ?? []).map((row) => row.role);
    return { isAdmin: roles.includes("admin"), isModerator: roles.includes("moderator") };
  });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = createAuthenticatedSupabaseClient(context.accessToken);
    const { isAdmin } = await assertStaff(supabase, context.userId);
    const { loadAdminOverview } = await import("./admin.server");
    return { ...(await loadAdminOverview(supabase)), isAdmin };
  });

export const setPlayerEligibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      profileId: string;
      status: "eligible" | "pending_review" | "rejected" | "suspended";
      reason: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    try {
      const supabase = createAuthenticatedSupabaseClient(context.accessToken);
      await assertStaff(supabase, context.userId);
      const { decideEligibility } = await import("./admin.server");
      const profile = await decideEligibility(supabase, {
        profileId: data.profileId,
        status: data.status,
        reason: data.reason,
      });
      return { ok: true as const, profile };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Could not update eligibility.",
      };
    }
  });
