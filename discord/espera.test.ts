/* eslint-disable @typescript-eslint/no-explicit-any -- Simulación de permisos de Discord. */
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const flags = [
  "ViewChannel",
  "Connect",
  "Speak",
  "SendMessages",
  "SendMessagesInThreads",
  "CreatePublicThreads",
  "CreatePrivateThreads",
  "ReadMessageHistory",
];
const P = Object.fromEntries(flags.map((name, i) => [name, 1 << i]));
class Collection extends Map<string, any> {
  find(fn: (value: any) => boolean) {
    return [...this.values()].find(fn);
  }
}
const module = { exports: {} as any };
runInNewContext(readFileSync(new URL("./espera.cjs", import.meta.url), "utf8"), {
  module,
  require: () => ({
    ChannelType: { GuildText: 0, GuildVoice: 2, GuildCategory: 4, GuildAnnouncement: 5 },
    PermissionFlagsBits: P,
    OverwriteType: { Role: 0, Member: 1 },
  }),
});
const { applyWaitingRoom } = module.exports;

function can(channel: any, flag: number, roleIds: string[] = [], memberId = "user") {
  let result = 255;
  const apply = (rows: any[]) => {
    let deny = 0;
    let allow = 0;
    for (const row of rows) {
      for (const p of row.deny || []) deny |= p;
      for (const p of row.allow || []) allow |= p;
    }
    result = (result & ~deny) | allow;
  };
  const rows = channel.rows || [];
  apply(rows.filter((r: any) => r.id === "guild"));
  apply(rows.filter((r: any) => r.type === 0 && roleIds.includes(r.id)));
  apply(rows.filter((r: any) => r.type === 1 && r.id === memberId));
  return (result & flag) === flag;
}
function setup() {
  const channels = new Collection();
  const add = (id: string, name: string, type = 0, publicChannel = true) => {
    const channel: any = {
      id,
      name,
      type,
      rows: publicChannel
        ? [{ id: "old-role", type: 0, allow: [P.ViewChannel] }]
        : [
            { id: "guild", type: 0, deny: [P.ViewChannel] },
            { id: "owner", type: 1, allow: [P.ViewChannel] },
          ],
      permissionOverwrites: {
        set: vi.fn(async (rows: any) => {
          channel.rows = rows;
        }),
      },
      permissionsFor: () => ({ has: (flag: number) => can(channel, flag) }),
    };
    channels.set(id, channel);
    return channel;
  };
  add("info", "INFO", 4);
  add("community", "COMUNIDAD", 4);
  add("welcome", "bienvenida");
  add("beta-info", "acceso-beta");
  add("general", "general");
  add("caster", "Casteo/Stream", 2);
  add("old-voice", "Partida 1", 2);
  add("official-rules", "rules");
  add("private-ticket", "ticket", 0, false);
  const roles = new Map(["beta", "staff", "ref", "caster-role"].map((id) => [id, { id }]));
  const guild = {
    id: "guild",
    rulesChannelId: "official-rules",
    channels: { cache: channels },
    roles: { everyone: { id: "guild" }, fetch: async () => roles },
    members: { fetchMe: async () => ({ id: "bot" }) },
  };
  const ids: any = {
    roles: { caster: { id: "caster-role" } },
    competicion: { beta: { roleId: "beta" } },
  };
  const structure = [
    {
      key: "info",
      categoria: "INFO",
      canales: [
        { key: "bienvenida", id: "welcome", acceso: "lectura" },
        { key: "accesoBeta", id: "beta-info", acceso: "lectura" },
      ],
    },
    {
      key: "comunidad",
      categoria: "COMUNIDAD",
      canales: [
        { key: "general", id: "general" },
        { key: "casteo", id: "caster", acceso: "casters" },
      ],
    },
  ];
  const run = () =>
    applyWaitingRoom({
      guild,
      ids,
      structure,
      staffRoleIds: ["staff", "ref"],
      channelForDefinition: (_group: any, def: any) => channels.get(def.id),
    });
  return { channels, ids, run, roles };
}

describe("pending whitelist visibility", () => {
  it("limits pending members to onboarding, closes old public rooms and preserves private tickets", async () => {
    const { channels, run } = setup();
    const privateRows = channels.get("private-ticket").rows;
    await run();
    for (const id of ["welcome", "beta-info", "official-rules"])
      expect(can(channels.get(id), P.ViewChannel!)).toBe(true);
    for (const id of ["general", "caster", "old-voice"]) {
      expect(can(channels.get(id), P.ViewChannel!, ["old-role"])).toBe(false);
      expect(can(channels.get(id), P.ViewChannel!, ["beta"])).toBe(true);
      expect(can(channels.get(id), P.ViewChannel!, ["staff"])).toBe(true);
      expect(can(channels.get(id), P.Connect!, ["ref"])).toBe(true);
    }
    expect(can(channels.get("welcome"), P.SendMessages!, ["beta"])).toBe(false);
    expect(can(channels.get("welcome"), P.SendMessages!, ["staff"])).toBe(true);
    expect(can(channels.get("general"), P.SendMessages!, ["beta"])).toBe(true);
    expect(can(channels.get("caster"), P.Speak!, ["beta"])).toBe(false);
    expect(can(channels.get("caster"), P.Speak!, ["beta", "caster-role"])).toBe(true);
    expect(channels.get("private-ticket").rows).toBe(privateRows);
    expect(channels.get("private-ticket").permissionOverwrites.set).not.toHaveBeenCalled();
  });
  it("updates formerly public legacy rooms on repeat runs and does not create channels", async () => {
    const { channels, ids, run } = setup();
    const count = channels.size;
    await run();
    await run();
    expect(channels.size).toBe(count);
    expect(channels.get("old-voice").permissionOverwrites.set).toHaveBeenCalledTimes(2);
    expect(ids.espera.channelIds).toContain("old-voice");
    expect(ids.espera.pendingKeys).toContain("accesoBeta");
  });
  it("fails before changing permissions if the approval role is missing", async () => {
    const { channels, roles, run } = setup();
    roles.delete("beta");
    await expect(run()).rejects.toThrow("Beta tester");
    expect(
      [...channels.values()].every((c) => c.permissionOverwrites.set.mock.calls.length === 0),
    ).toBe(true);
  });
});
