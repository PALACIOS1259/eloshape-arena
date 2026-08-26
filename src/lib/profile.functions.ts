import { createServerFn } from "@tanstack/react-start";

import {
  createAuthenticatedSupabaseClient,
  requireSupabaseAuth,
} from "@/integrations/supabase/auth-middleware";

/** Identity-only profile edits. Competitive columns are never accepted here. */
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: { handle?: string; displayName?: string; bio?: string; avatarUrl?: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const { updateMyProfile: update } = await import("./profile.server");
    try {
      const supabase = createAuthenticatedSupabaseClient(context.accessToken);
      return {
        ok: true as const,
        profile: await update(context.userId, supabase, data),
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Could not update your profile.",
      };
    }
  });

/** Selecting a city resolves province/country/region inside a trusted DB wrapper. */
export const updateMyLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { cityId: string }) => input)
  .handler(async ({ data, context }) => {
    const { updateMyLocation: update } = await import("./profile.server");
    try {
      const supabase = createAuthenticatedSupabaseClient(context.accessToken);
      return {
        ok: true as const,
        location: await update(context.userId, supabase, data.cityId),
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Could not update your location.",
      };
    }
  });
