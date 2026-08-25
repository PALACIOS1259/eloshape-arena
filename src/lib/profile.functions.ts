import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Identity-only profile edits. Competitive columns are never accepted here. */
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { handle?: string; displayName?: string; bio?: string; avatarUrl?: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const { updateMyProfile: update } = await import("./profile.server");
    try {
      return { ok: true as const, profile: await update(context.userId, data) };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Could not update your profile.",
      };
    }
  });

/** Selecting a city resolves province/country/region server-side. */
export const updateMyLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { cityId: string }) => input)
  .handler(async ({ data, context }) => {
    const { updateMyLocation: update } = await import("./profile.server");
    try {
      return { ok: true as const, location: await update(context.userId, data.cityId) };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Could not update your location.",
      };
    }
  });
