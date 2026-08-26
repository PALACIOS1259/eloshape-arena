import { createServerFn } from "@tanstack/react-start";

import {
  createAuthenticatedSupabaseClient,
  requireSupabaseAuth,
} from "@/integrations/supabase/auth-middleware";

export const getMyDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadMyDashboard } = await import("./me.server");
    const supabase = createAuthenticatedSupabaseClient(context.accessToken);
    return loadMyDashboard(context.userId, supabase);
  });
