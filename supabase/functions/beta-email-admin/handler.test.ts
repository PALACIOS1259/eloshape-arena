import { describe, expect, it, vi } from "vitest";
import { createEmailAdminHandler, type EmailAdminDependencies } from "./handler";

const email = "tester@example.invalid";
function setup() {
  const entry = { email, active: true, expires_at: null as string | null, user_id: "invited-id" };
  const deps: EmailAdminDependencies = {
    authorize: vi.fn(async () => ({ actorId: "admin-id", invitations: [entry] })),
    readUser: vi.fn(async () => ({ email })),
    audit: vi.fn(async () => {}),
    confirm: vi.fn(async () => {}),
    now: () => Date.parse("2026-10-06T12:00:00Z"),
  };
  const call = (
    body: unknown = { action: "confirm", email },
    authorization = "Bearer valid-session",
  ) =>
    createEmailAdminHandler(deps)(
      new Request("https://example.invalid", {
        method: "POST",
        headers: { Authorization: authorization },
        body: JSON.stringify(body),
      }),
    );
  return { deps, entry, call };
}

describe("admin beta email confirmation", () => {
  it("rejects absent sessions and nonadmins before any privileged account access", async () => {
    const { deps, call } = setup();
    expect((await call(undefined, "")).status).toBe(401);
    vi.mocked(deps.authorize).mockResolvedValue(null);
    expect((await call()).status).toBe(403);
    expect(deps.readUser).not.toHaveBeenCalled();
    expect(deps.confirm).not.toHaveBeenCalled();
  });
  it("uses the approved account ID, ignores a forged caller ID, and audits before Auth", async () => {
    const { deps, call } = setup();
    const response = await call({
      action: "confirm",
      email: " TESTER@example.invalid ",
      userId: "victim-id",
    });
    expect(response.status).toBe(200);
    expect(deps.confirm).toHaveBeenCalledWith("invited-id", email);
    expect(vi.mocked(deps.audit).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(deps.confirm).mock.invocationCallOrder[0],
    );
    expect(deps.audit).toHaveBeenLastCalledWith(
      "admin-id",
      "invited-id",
      "beta_email_confirmed_by_admin",
    );
  });
  it("rejects noninvited, revoked, expired and unregistered accounts", async () => {
    for (const change of [
      { email: "other@example.invalid" },
      { active: false },
      { expires_at: "2026-10-06T11:59:00Z" },
      { user_id: "" },
    ]) {
      const { deps, entry, call } = setup();
      Object.assign(entry, change);
      expect((await call()).status).toBe(409);
      expect(deps.confirm).not.toHaveBeenCalled();
    }
  });
  it("rejects changed emails, anonymous accounts, bans and failed audit writes", async () => {
    for (const user of [
      { email: "other@example.invalid" },
      { email, is_anonymous: true },
      { email, banned_until: "2027-01-01T00:00:00Z" },
    ]) {
      const { deps, call } = setup();
      vi.mocked(deps.readUser).mockResolvedValue(user);
      expect((await call()).status).toBe(409);
      expect(deps.confirm).not.toHaveBeenCalled();
    }
    const { deps, call } = setup();
    vi.mocked(deps.audit).mockRejectedValue(new Error("sensitive database details"));
    const response = await call();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("sensitive");
    expect(deps.confirm).not.toHaveBeenCalled();
  });
  it("is idempotent and preserves a successful Auth action if its completion log fails", async () => {
    const { deps, call } = setup();
    vi.mocked(deps.readUser).mockResolvedValueOnce({ email, email_confirmed_at: "2026-10-06" });
    expect(await (await call()).json()).toEqual({ ok: true, alreadyConfirmed: true });
    expect(deps.confirm).not.toHaveBeenCalled();
    vi.mocked(deps.audit).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("down"));
    expect(await (await call()).json()).toEqual({ ok: true, auditPending: true });
    expect(deps.confirm).toHaveBeenCalledOnce();
  });
  it("rejects malformed input and unsupported methods", async () => {
    const { deps, call } = setup();
    expect((await call({ email, action: "delete" })).status).toBe(400);
    expect(
      (await createEmailAdminHandler(deps)(new Request("https://example.invalid"))).status,
    ).toBe(405);
    expect(deps.confirm).not.toHaveBeenCalled();
  });
});
