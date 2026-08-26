import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Riot server functions. Thin wrappers only — no runtime helper lives at module
 * scope, and nothing Riot-related is imported outside a handler.
 */

function userMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return message || "Riot data sync is temporarily unavailable.";
}

export const getRiotStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { riotServiceStatus } = await import("./riot-account.server");
  return riotServiceStatus();
});

export const getMyRiotAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadMyRiotAccount, riotServiceStatus } = await import("./riot-account.server");
    return {
      account: await loadMyRiotAccount(context.userId, context.supabase),
      service: riotServiceStatus(),
    };
  });

export const connectRiotAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { gameName: string; tagLine: string }) => input)
  .handler(async ({ data, context }) => {
    const mod = await import("./riot-account.server");
    try {
      const account = await mod.connectRiotAccount(context.userId, {
        gameName: data.gameName,
        tagLine: data.tagLine,
      });
      return { ok: true as const, account };
    } catch (error) {
      return { ok: false as const, error: userMessage(error) };
    }
  });

export const refreshRiotAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const mod = await import("./riot-account.server");
    try {
      return { ok: true as const, account: await mod.refreshRiotAccount(context.userId) };
    } catch (error) {
      return { ok: false as const, error: userMessage(error) };
    }
  });
