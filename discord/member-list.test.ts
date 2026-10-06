import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { listGuildMembers } = require("./member-list.cjs");
const { syncLinkedMembers } = require("./linked-sync.cjs");
const { syncBetaMembers } = require("./competicion.cjs");

const role = { id: "beta-or-linked", editable: true, managed: false };
const base = 1900000000000000000n;
const member = (n: number) => ({
  id: String(base + BigInt(n)),
  user: { bot: false },
  roles: { cache: new Set([role.id]), add: vi.fn(), remove: vi.fn() },
});
const page = (start: number, size: number) =>
  new Map(
    Array.from({ length: size }, (_, i) => {
      const m = member(start + i);
      return [m.id, m] as const;
    }),
  );

describe("complete REST member listing", () => {
  it("collects later pages using the highest snowflake without a gateway fetch", async () => {
    const first = page(0, 1000);
    const second = page(1000, 2);
    const list = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const fetch = vi.fn(() => {
      throw new Error("opcode 8 rate limited");
    });
    const result = await listGuildMembers({ members: { list, fetch } });
    expect(result.size).toBe(1002);
    expect(result.has(String(base + 1001n))).toBe(true);
    expect(list.mock.calls).toEqual([
      [{ limit: 1000 }],
      [{ limit: 1000, after: String(base + 999n) }],
    ]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("handles an exact full page followed by an empty page", async () => {
    const list = vi.fn().mockResolvedValueOnce(page(0, 1000)).mockResolvedValueOnce(new Map());
    expect((await listGuildMembers({ members: { list } })).size).toBe(1000);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("aborts if Discord repeats a full page instead of looping forever", async () => {
    const list = vi.fn().mockResolvedValue(page(0, 1000));
    await expect(listGuildMembers({ members: { list } })).rejects.toThrow("no se cambian roles");
    expect(list).toHaveBeenCalledTimes(2);
  });

  for (const kind of ["linked", "beta"] as const) {
    it(`preserves every ${kind} role if a later page fails`, async () => {
      const first = page(0, 1000);
      const list = vi
        .fn()
        .mockResolvedValueOnce(first)
        .mockRejectedValueOnce(new Error("HTTP failure"));
      const guild = { id: "guild", roles: { fetch: async () => role }, members: { list } };
      const ids = {
        roles: { cuentaVinculada: { id: role.id } },
        competicion: { beta: { roleId: role.id } },
      };
      const run = () =>
        kind === "linked"
          ? syncLinkedMembers({ guild, ids, linkedDiscordIds: [] })
          : syncBetaMembers({ guild, ids, approvedDiscordIds: [], persistIds: vi.fn() });
      await expect(run()).rejects.toThrow("HTTP failure");
      for (const m of first.values()) {
        expect(m.roles.add).not.toHaveBeenCalled();
        expect(m.roles.remove).not.toHaveBeenCalled();
      }
    });
  }

  it("assigns and revokes beta roles through REST while preserving other roles", async () => {
    const approved = member(0),
      revoked = member(1),
      bot = member(2);
    approved.roles.cache.delete(role.id);
    approved.roles.cache.add("other-role");
    revoked.roles.cache.add("other-role");
    bot.user.bot = true;
    const members = new Map([approved, revoked, bot].map((m) => [m.id, m]));
    const fetch = vi.fn(() => {
      throw new Error("opcode 8 rate limited");
    });
    const guild = {
      id: "beta-guild",
      roles: { fetch: async () => role },
      members: { list: async () => members, fetch },
    };
    expect(
      await syncBetaMembers({
        guild,
        ids: { competicion: { beta: { roleId: role.id } } },
        approvedDiscordIds: [approved.id],
        persistIds: vi.fn(),
      }),
    ).toEqual({ approved: 1 });
    expect(approved.roles.add).toHaveBeenCalledWith(role);
    expect(revoked.roles.remove).toHaveBeenCalledWith(role);
    expect(bot.roles.remove).not.toHaveBeenCalled();
    expect(approved.roles.cache.has("other-role")).toBe(true);
    expect(revoked.roles.cache.has("other-role")).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
});
