import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.4";
import { createSnapshotHandler } from "./handler.ts";

// verify_jwt=false porque la credencial del bot es propia y limitada a este endpoint.
// El handler autentica antes de crear el cliente privilegiado o leer la base.
Deno.serve(
  createSnapshotHandler({
    token: Deno.env.get("DISCORD_BETA_SYNC_TOKEN"),
    readSnapshot: async () => {
      const url = Deno.env.get("SUPABASE_URL");
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!url || !key) throw new Error("Missing server configuration");
      const admin = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await admin.rpc("get_beta_discord_members");
      if (error) throw new Error("Snapshot RPC unavailable");
      return data;
    },
  }),
);
