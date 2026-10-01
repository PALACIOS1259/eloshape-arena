import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  createAuthenticatedSupabaseClient,
  requireSupabaseAuth,
} from "@/integrations/supabase/auth-middleware";
import { callBetaRpc, type BetaAdminState } from "./beta-access";

export const getBetaInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) =>
    callBetaRpc<BetaAdminState>(
      createAuthenticatedSupabaseClient(context.accessToken),
      "beta_admin_list",
    ),
  );

export const saveBetaInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(254),
        active: z.boolean(),
        discordId: z.union([z.string().regex(/^\d{17,20}$/), z.literal("")]).optional(),
        expiresAt: z.string().datetime().nullable().optional(),
      })
      .parse(input),
  )
  .handler(({ context, data }) =>
    callBetaRpc<null>(createAuthenticatedSupabaseClient(context.accessToken), "beta_admin_save", {
      p_email: data.email,
      p_active: data.active,
      p_discord_id: data.discordId || null,
      p_expires_at: data.expiresAt ?? null,
    }),
  );

export const setClosedBetaEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(({ context, data }) =>
    callBetaRpc<null>(
      createAuthenticatedSupabaseClient(context.accessToken),
      "beta_admin_set_enabled",
      { p_enabled: data.enabled },
    ),
  );
