import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getRequest } from "@tanstack/react-start/server";
import { createAuthenticatedSupabaseClient } from "@/integrations/supabase/auth-middleware";

/**
 * Server-side publishable (anon) client for PUBLIC read-only data.
 * RLS applies as the `anon` role. Never use this for user-owned writes.
 */
export function createPublicClient() {
  // During closed beta, directory reads must carry the caller's token too.
  // This remains a publishable-key client and preserves the existing RLS rules.
  const authorization = getRequest()?.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return createAuthenticatedSupabaseClient(authorization.slice(7).trim());
  }
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const url = process.env["SUPABASE_URL"]!;

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}
