import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
const require = createRequire(import.meta.url);
const { fetchLinkedSnapshot, syncLinkedMembers, testLinkedMember } = require("./linked-sync.cjs");
const env = {
  DISCORD_LINKED_SNAPSHOT_URL: "https://example.invalid/snapshot",
  DISCORD_BETA_SYNC_TOKEN: "a".repeat(64),
};
const a = "1999999999999999999",
  b = "1999999999999999998";

describe("verified Discord role synchronization", () => {
  it("limits a self-test to one verified member without bulk fetching or revocations", async () => {
    const role = { id: "linked-role", editable: true, managed: false };
    const member = {
      user: { bot: false },
      roles: { cache: new Set(), add: vi.fn(), remove: vi.fn() },
    };
    const guild = {
      roles: { fetch: vi.fn(async () => role) },
      members: { fetch: vi.fn(async () => member) },
    };
    const ids = { roles: { cuentaVinculada: { id: role.id } } };
    expect(await testLinkedMember({ guild, ids, linkedDiscordIds: [a], memberId: a })).toEqual({
      added: true,
    });
    expect(guild.members.fetch).toHaveBeenCalledWith(a);
    expect(guild.members.fetch).toHaveBeenCalledTimes(1);
    expect(member.roles.add).toHaveBeenCalledWith(role);
    expect(member.roles.remove).not.toHaveBeenCalled();
    member.roles.cache.add(role.id);
    member.roles.add.mockClear();
    expect(await testLinkedMember({ guild, ids, linkedDiscordIds: [a], memberId: a })).toEqual({
      added: false,
    });
    expect(member.roles.add).not.toHaveBeenCalled();
  });
  it("rejects a self-test for an unlinked identity before accessing Discord", async () => {
    const guild = { roles: { fetch: vi.fn() }, members: { fetch: vi.fn() } };
    await expect(
      testLinkedMember({ guild, ids: {}, linkedDiscordIds: [a], memberId: b }),
    ).rejects.toThrow("no aparece vinculada");
    expect(guild.roles.fetch).not.toHaveBeenCalled();
    expect(guild.members.fetch).not.toHaveBeenCalled();
  });
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
      members: {
        list: vi.fn(async () => new Map(members.map((m) => [m.id, m]))),
        fetch: vi.fn(() => {
          throw new Error("opcode 8 was rate limited");
        }),
      },
    };
    expect(
      await syncLinkedMembers({
        guild,
        ids: { roles: { cuentaVinculada: { id: role.id } } },
        linkedDiscordIds: [a],
      }),
    ).toEqual({ linked: 1, added: 1, removed: 1 });
    expect(guild.roles.fetch).toHaveBeenCalledWith(role.id);
    expect(guild.members.fetch).not.toHaveBeenCalled();
    expect(members[0]!.roles.add).toHaveBeenCalledWith(role);
    expect(members[1]!.roles.remove).toHaveBeenCalledWith(role);
    expect(members[2]!.roles.remove).not.toHaveBeenCalled();
    expect(members.every((m) => m.roles.cache.has("beta-role"))).toBe(true);
    guild.roles.fetch.mockResolvedValue({ ...role, editable: false });
    guild.members.list.mockClear();
    await expect(
      syncLinkedMembers({
        guild,
        ids: { roles: { cuentaVinculada: { id: role.id } } },
        linkedDiscordIds: [],
      }),
    ).rejects.toThrow("gestionar");
    expect(guild.members.list).not.toHaveBeenCalled();
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
