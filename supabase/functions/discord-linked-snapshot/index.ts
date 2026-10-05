import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.4";
import { createLinkedSnapshotHandler } from "./handler.ts";

// Custom limited bot credential, checked before creating a privileged client.
Deno.serve(
  createLinkedSnapshotHandler({
    token: Deno.env.get("DISCORD_BETA_SYNC_TOKEN"),
    readSnapshot: async () => {
      const url = Deno.env.get("SUPABASE_URL");
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!url || !key) throw new Error("Missing server configuration");
      const admin = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await admin.rpc("get_verified_discord_links");
      if (error) throw new Error("Snapshot RPC unavailable");
      return data;
    },
  }),
);
