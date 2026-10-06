// Deno Edge entrypoint; handler.ts is tested locally with injected dependencies.
import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { createEmailAdminHandler } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const backend = createClient(url, serviceKey, options);

Deno.serve(
  createEmailAdminHandler({
    authorize: async (token) => {
      const { data: identity, error: authError } = await backend.auth.getUser(token);
      if (authError || !identity.user || identity.user.is_anonymous) return null;
      const scoped = createClient(url, anonKey, {
        ...options,
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data, error } = await scoped.rpc("beta_admin_list");
      if (error || !data || !Array.isArray(data.invitations)) return null;
      return { actorId: identity.user.id, invitations: data.invitations };
    },
    readUser: async (id) => {
      const { data, error } = await backend.auth.admin.getUserById(id);
      if (error) throw new Error("auth_unavailable");
      return data.user;
    },
    audit: async (actorId, userId, action) => {
      const { error } = await backend.from("competition_audit_log").insert({
        actor_user_id: actorId,
        action,
        entity_type: "beta_account",
        entity_id: userId,
      });
      if (error) throw new Error("audit_unavailable");
    },
    confirm: async (id, email) => {
      const { data, error } = await backend.auth.admin.updateUserById(id, {
        email,
        email_confirm: true,
      });
      if (error || !data.user?.email_confirmed_at) throw new Error("auth_update_failed");
    },
  }),
);
