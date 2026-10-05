import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type BetaAccess = { enabled: boolean; allowed: boolean };
export type BetaInvitation = {
  email: string;
  discord_id: string | null;
  active: boolean;
  expires_at: string | null;
};
export type BetaAdminState = { enabled: boolean; invitations: BetaInvitation[] };

type BetaRpc = "get_beta_access" | "beta_admin_list" | "beta_admin_save" | "beta_admin_set_enabled";

export async function callBetaRpc<T>(
  client: SupabaseClient<Database>,
  name: BetaRpc,
  args?: Record<string, unknown>,
): Promise<T> {
  const rpc = client.rpc.bind(client) as unknown as (
    name: BetaRpc,
    args?: Record<string, unknown>,
  ) => Promise<{ data: T; error: { message: string } | null }>;
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

export function mayEnterDuringMaintenance(access: BetaAccess | null): boolean {
  return access?.enabled === true && access.allowed === true;
}
