import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
const require = createRequire(import.meta.url);
const { fetchLinkedSnapshot, syncLinkedMembers } = require("./linked-sync.cjs");
const env = {
  DISCORD_LINKED_SNAPSHOT_URL: "https://example.invalid/snapshot",
  DISCORD_BETA_SYNC_TOKEN: "a".repeat(64),
};
const a = "1999999999999999999",
  b = "1999999999999999998";

describe("verified Discord role synchronization", () => {
  it("refuses insecure, failed or malformed snapshots before changing roles", async () => {
    const fetchImpl = vi.fn();
    await expect(
      fetchLinkedSnapshot({
        env: { ...env, DISCORD_LINKED_SNAPSHOT_URL: "http://example.invalid" },
        fetchImpl,
      }),
    ).rejects.toThrow("HTTPS");
    expect(fetchImpl).not.toHaveBeenCalled();
    for (const fetchImpl of [
      async () => {
        throw new Error("timeout");
      },
      async () => new Response("error", { status: 503 }),
      async () => Response.json({ version: 1 }),
      async () => Response.json({ version: 1, linked_member_ids: [123] }),
      async () => Response.json({ enabled: true, member_ids: [a] }),
    ])
      await expect(fetchLinkedSnapshot({ env, fetchImpl })).rejects.toThrow();
  });
  it("adds and removes only Cuenta vinculada, skips bots and uses the exported role ID", async () => {
    const role = { id: "linked-role", editable: true, managed: false };
    const member = (id: string, linked: boolean, bot = false) => ({
      id,
      user: { bot },
      roles: {
        cache: new Set(linked ? [role.id, "beta-role"] : ["beta-role"]),
        add: vi.fn(),
        remove: vi.fn(),
      },
    });
    const members = [member(a, false), member(b, true), member("bot", true, true)];
    const guild = {
      roles: { fetch: vi.fn(async () => role) },
      members: { fetch: vi.fn(async () => new Map(members.map((m) => [m.id, m]))) },
    };
    expect(
      await syncLinkedMembers({
        guild,
        ids: { roles: { cuentaVinculada: { id: role.id } } },
        linkedDiscordIds: [a],
      }),
    ).toEqual({ linked: 1, added: 1, removed: 1 });
    expect(guild.roles.fetch).toHaveBeenCalledWith(role.id);
    expect(members[0]!.roles.add).toHaveBeenCalledWith(role);
    expect(members[1]!.roles.remove).toHaveBeenCalledWith(role);
    expect(members[2]!.roles.remove).not.toHaveBeenCalled();
    expect(members.every((m) => m.roles.cache.has("beta-role"))).toBe(true);
    guild.roles.fetch.mockResolvedValue({ ...role, editable: false });
    guild.members.fetch.mockClear();
    await expect(
      syncLinkedMembers({
        guild,
        ids: { roles: { cuentaVinculada: { id: role.id } } },
        linkedDiscordIds: [],
      }),
    ).rejects.toThrow("gestionar");
    expect(guild.members.fetch).not.toHaveBeenCalled();
  });
  it("accepts an explicit empty snapshot for deliberate unlinking", async () => {
    expect(
      await fetchLinkedSnapshot({
        env,
        fetchImpl: async () => Response.json({ version: 1, linked_member_ids: [] }),
      }),
    ).toEqual([]);
  });
});
