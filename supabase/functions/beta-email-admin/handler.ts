type Invitation = {
  email: string;
  active: boolean;
  expires_at: string | null;
  user_id?: string | null;
  email_confirmed_at?: string | null;
};
export type EmailAdminDependencies = {
  authorize: (token: string) => Promise<{ actorId: string; invitations: Invitation[] } | null>;
  readUser: (id: string) => Promise<{
    email?: string;
    email_confirmed_at?: string;
    is_anonymous?: boolean;
    banned_until?: string;
  } | null>;
  audit: (actorId: string, userId: string, action: string) => Promise<void>;
  confirm: (userId: string, email: string) => Promise<void>;
  now?: () => number;
};

// Authentication is checked against Auth and admin membership against the
// database. Neither user_metadata nor a caller-supplied user ID grants access.
export function createEmailAdminHandler(deps: EmailAdminDependencies) {
  return async (request: Request): Promise<Response> => {
    const respond = (value: unknown, status = 200) =>
      Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
    if (request.method !== "POST") return respond({ error: "method_not_allowed" }, 405);
    const token = request.headers.get("Authorization")?.match(/^Bearer (\S+)$/)?.[1];
    if (!token) return respond({ error: "unauthorized" }, 401);
    try {
      const admin = await deps.authorize(token);
      if (!admin) return respond({ error: "forbidden" }, 403);
      let body: unknown;
      try {
        const raw = await request.text();
        if (raw.length > 1024) return respond({ error: "invalid_request" }, 400);
        body = JSON.parse(raw);
      } catch {
        return respond({ error: "invalid_request" }, 400);
      }
      if (
        !body ||
        typeof body !== "object" ||
        !("email" in body) ||
        typeof body.email !== "string" ||
        body.email.length > 254 ||
        !("action" in body) ||
        body.action !== "confirm"
      )
        return respond({ error: "invalid_request" }, 400);
      const email = body.email.trim().toLowerCase();
      const entry = admin.invitations.find((row) => row.email === email);
      const now = deps.now?.() ?? Date.now();
      if (
        !entry?.active ||
        !entry.user_id ||
        (entry.expires_at && Date.parse(entry.expires_at) <= now)
      )
        return respond({ error: "active_invitation_required" }, 409);
      const user = await deps.readUser(entry.user_id);
      if (
        !user?.email ||
        user.email.trim().toLowerCase() !== email ||
        user.is_anonymous ||
        (user.banned_until && Date.parse(user.banned_until) > now)
      )
        return respond({ error: "account_not_available" }, 409);
      if (user.email_confirmed_at) return respond({ ok: true, alreadyConfirmed: true });
      await deps.audit(admin.actorId, entry.user_id, "beta_email_confirmation_requested");
      await deps.confirm(entry.user_id, user.email);
      // Auth is a separate service: preserve the recorded intent if the final
      // audit write fails, and report the confirmed account without false failure.
      try {
        await deps.audit(admin.actorId, entry.user_id, "beta_email_confirmed_by_admin");
      } catch {
        return respond({ ok: true, auditPending: true });
      }
      return respond({ ok: true });
    } catch {
      return respond({ error: "confirmation_failed" }, 503);
    }
  };
}
