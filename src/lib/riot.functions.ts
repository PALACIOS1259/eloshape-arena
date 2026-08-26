import { createServerFn } from "@tanstack/react-start";

import {
  createAuthenticatedSupabaseClient,
  requireSupabaseAuth,
} from "@/integrations/supabase/auth-middleware";

/** Riot writes live in the authenticated Supabase Edge Function, never in the browser/runtime. */

function userMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return message || "Riot data sync is temporarily unavailable.";
}

type RiotServiceStatus = {
  configured: boolean;
  trustedWritesConfigured: boolean;
  rsoEnabled: boolean;
};

type EdgeResponse<T = unknown> = {
  ok?: boolean;
  account?: T;
  error?: string;
  service?: RiotServiceStatus;
};

function edgeConfig() {
  const url = process.env["SUPABASE_URL"]?.trim();
  const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"]?.trim();
  if (!url || !publishableKey) {
    throw new Error("Supabase Edge Functions are not configured in this environment.");
  }
  return { url: url.replace(/\/$/, ""), publishableKey };
}

async function invokeRiotEdge<T>(
  accessToken: string,
  options: { method?: "GET" | "POST"; body?: Record<string, unknown> } = {},
): Promise<EdgeResponse<T>> {
  const { url, publishableKey } = edgeConfig();
  const response = await fetch(`${url}/functions/v1/riot-sync`, {
    method: options.method ?? "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  const payload = (await response.json().catch(() => ({}))) as EdgeResponse<T>;
  if (!response.ok && !payload.error) {
    payload.error = "Riot data sync is temporarily unavailable.";
  }
  return payload;
}

export const getRiotStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const result = await invokeRiotEdge(context.accessToken, { method: "GET" });
      return (
        result.service ?? {
          configured: false,
          trustedWritesConfigured: false,
          rsoEnabled: false,
        }
      );
    } catch {
      return { configured: false, trustedWritesConfigured: false, rsoEnabled: false };
    }
  });

export const getMyRiotAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadMyRiotAccount } = await import("./riot-account.server");
    const supabase = createAuthenticatedSupabaseClient(context.accessToken);
    let service: RiotServiceStatus = {
      configured: false,
      trustedWritesConfigured: false,
      rsoEnabled: false,
    };
    try {
      const status = await invokeRiotEdge(context.accessToken, { method: "GET" });
      if (status.service) service = status.service;
    } catch {
      // Reading the already-linked account still works if Riot is temporarily offline.
    }
    return {
      account: await loadMyRiotAccount(context.userId, supabase),
      service,
    };
  });

export const connectRiotAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { gameName: string; tagLine: string }) => input)
  .handler(async ({ data, context }) => {
    try {
      const result = await invokeRiotEdge(context.accessToken, {
        body: { action: "connect", gameName: data.gameName, tagLine: data.tagLine },
      });
      if (!result.ok || !result.account) {
        return { ok: false as const, error: result.error ?? "Riot data sync is temporarily unavailable." };
      }
      return { ok: true as const, account: result.account };
    } catch (error) {
      return { ok: false as const, error: userMessage(error) };
    }
  });

export const refreshRiotAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const result = await invokeRiotEdge(context.accessToken, {
        body: { action: "refresh" },
      });
      if (!result.ok || !result.account) {
        return { ok: false as const, error: result.error ?? "Riot data sync is temporarily unavailable." };
      }
      return { ok: true as const, account: result.account };
    } catch (error) {
      return { ok: false as const, error: userMessage(error) };
    }
  });
