/* eslint-disable @typescript-eslint/no-explicit-any -- Mock de la API externa de Discord. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

class ButtonBuilder {
  setCustomId() {
    return this;
  }
  setLabel() {
    return this;
  }
  setEmoji() {
    return this;
  }
  setStyle() {
    return this;
  }
  setDisabled() {
    return this;
  }
}
class ActionRowBuilder {
  addComponents() {
    return this;
  }
}

class Collection extends Map<string, any> {
  find(predicate: (value: any) => boolean) {
    return [...this.values()].find(predicate);
  }
  filter(predicate: (value: any) => boolean) {
    return new Collection([...this].filter(([, value]) => predicate(value)));
  }
}
const root = dirname(fileURLToPath(import.meta.url));
const P = Object.fromEntries(
  [
    "ViewChannel",
    "Connect",
    "Speak",
    "SendMessages",
    "ReadMessageHistory",
    "SendMessagesInThreads",
    "CreatePublicThreads",
    "CreatePrivateThreads",
    "Administrator",
  ].map((key, i) => [key, 1n << BigInt(i)]),
);
const discord = {
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle: { Success: 3, Danger: 4 },
  MessageFlags: { Ephemeral: 64 },
  ChannelType: { GuildCategory: 4, GuildText: 0, GuildVoice: 2 },
  PermissionFlagsBits: P,
  OverwriteType: { Role: 0, Member: 1 },
  GatewayIntentBits: { Guilds: 1, GuildMessages: 2, MessageContent: 3, GuildMembers: 4 },
};

function setup() {
  const events: Record<string, any> = {};
  const saved: any[] = [];
  const guildId = "1547826296149647372";
  const initial = {
    servidor: { id: guildId },
    custom: { preserved: true },
    equipos: { existing: { rol: "unchanged" } },
    roles: {},
    canales: {},
    competicion: { torneos: {}, partidas: {}, beta: {} },
  };
  let sequence = 0;
  const channels = new Collection();
  const roles = new Collection();
  const members = new Collection();
  const botId = "1500000000000000000";
  const addMember = (id: string, bot = false) => {
    const cache = new Collection();
    const member = {
      id,
      user: { bot },
      roles: {
        cache,
        add: async (r: any) => cache.set(r.id, r),
        remove: async (r: any) => cache.delete(r.id),
      },
    };
    members.set(id, member);
    return member;
  };
  const guild: any = {
    id: guildId,
    name: "EloShape",
    channels: {
      cache: channels,
      fetch: async (id?: string) => (id ? channels.get(id) : channels),
      create: async (options: any) => {
        const channel = {
          ...options,
          parentId: options.parent,
          id: String(1600000000000000000n + BigInt(++sequence)),
          edit: async (changes: any) => Object.assign(channel, changes),
          send: async () => {},
        };
        channels.set(channel.id, channel);
        return channel;
      },
    },
    roles: {
      cache: roles,
      everyone: { id: guildId },
      fetch: async (id?: string) => (id ? roles.get(id) : roles),
      create: async (options: any) => {
        const role = { ...options, id: String(1700000000000000000n + BigInt(++sequence)) };
        roles.set(role.id, role);
        return role;
      },
    },
    members: {
      me: addMember(botId, true),
      fetchMe: async () => members.get(botId),
      fetch: async (id?: string) => (id ? members.get(id) || addMember(id) : members),
    },
  };
  class Client {
    user = { tag: "test" };
    once() {}
    on(name: string, callback: any) {
      events[name] = callback;
    }
    login() {
      return Promise.resolve();
    }
  }
  const load = (file: string, custom: Record<string, any> = {}) => {
    const module = { exports: {} as any };
    runInNewContext(readFileSync(join(root, file), "utf8"), {
      module,
      exports: module.exports,
      require: (name: string) => {
        if (name === "discord.js") return { ...discord, Client };
        if (name in custom) return custom[name];
        throw new Error(`Unexpected require ${name}`);
      },
      console,
      ...custom,
    });
    return module.exports;
  };
  const structure = load("estructura.cjs");
  for (const def of Object.values(structure.ROLES) as any[]) {
    const id = String(1800000000000000000n + BigInt(roles.size));
    roles.set(id, { id, name: def.name });
  }
  const competition = load("competicion.cjs");
  const module = { exports: {} as any };
  const fakeFs = {
    existsSync: () => true,
    readFileSync: () => JSON.stringify(initial),
    writeFileSync: (_path: string, body: string) => saved.push(JSON.parse(body)),
    renameSync: () => {},
  };
  runInNewContext(
    readFileSync(join(root, "bot.cjs"), "utf8") +
      "\nmodule.exports = { IDS, exportarIds, canalEstructura };",
    {
      module,
      exports: module.exports,
      __dirname: root,
      process: { env: { DISCORD_TOKEN: "mock-token" } },
      URL,
      console: { log() {}, error() {} },
      setInterval,
      require: (name: string) =>
        ({
          fs: fakeFs,
          path: { join },
          "discord.js": { ...discord, Client },
          "./estructura.cjs": structure,
          "./competicion.cjs": competition,
          "./espera.cjs": load("espera.cjs"),
          "./beta-sync.cjs": {
            fetchBetaSnapshot: async () => {
              throw new Error("not configured");
            },
          },
          "./linked-sync.cjs": load("linked-sync.cjs"),
        })[name],
    },
  );
  const send = async (content: string, staff = true) => {
    const replies: string[] = [];
    const staffRole = roles.find((r: any) => r.name === "Staff/Admin");
    await events.messageCreate({
      content,
      guild,
      author: { bot: false },
      member: {
        guild,
        permissions: { has: () => false },
        roles: { cache: new Collection(staff ? [[staffRole.id, staffRole]] : []) },
      },
      reply: async (text: string) => replies.push(text),
    });
    return replies;
  };
  return {
    send,
    channels,
    guild,
    saved,
    api: module.exports,
    competition,
    structure,
    members,
    events,
  };
}

function ticketButton(ctx: ReturnType<typeof setup>, customId = "ticket_abrir") {
  const interaction = {
    guild: ctx.guild,
    user: { id: "1900000000000000000", username: "tester", tag: "tester" },
    member: {
      guild: ctx.guild,
      permissions: { has: () => false },
      roles: { cache: new Collection() },
    },
    customId,
    isButton: () => true,
    deferred: false,
    replied: false,
    deferReply: vi.fn(async () => {
      interaction.deferred = true;
    }),
    editReply: vi.fn(async () => {
      interaction.replied = true;
    }),
    reply: vi.fn(),
    followUp: vi.fn(),
  };
  return interaction;
}

describe("uploaded bot integration", () => {
  it("acknowledges ticket buttons before a slow channel creation and prevents duplicate tickets", async () => {
    const ctx = setup();
    ctx.channels.set("tickets", { id: "tickets", name: "🎫 TICKETS", type: 4 });
    const create = ctx.guild.channels.create;
    let finishCreation!: () => void;
    const slowRequest = new Promise<void>((resolve) => {
      finishCreation = resolve;
    });
    const first = ticketButton(ctx);
    const second = ticketButton(ctx);
    ctx.guild.channels.create = vi.fn(async (options: any) => {
      expect(first.deferred).toBe(true);
      expect(second.deferred).toBe(true);
      await slowRequest;
      return create(options);
    });
    const opening = ctx.events.interactionCreate(first);
    const repeated = ctx.events.interactionCreate(second);
    await vi.waitFor(() => expect(ctx.guild.channels.create).toHaveBeenCalledOnce());
    expect(first.editReply).not.toHaveBeenCalled();
    finishCreation();
    await Promise.all([opening, repeated]);
    expect(first.deferReply).toHaveBeenCalledWith({ flags: 64 });
    expect(first.editReply).toHaveBeenCalledWith({
      content: expect.stringContaining("Ticket abierto"),
    });
    expect(second.editReply).toHaveBeenCalledWith({
      content: expect.stringContaining("Ya tenés un ticket"),
    });
    expect(ctx.guild.channels.create).toHaveBeenCalledOnce();
    expect(first.reply).not.toHaveBeenCalled();
  });

  it("finishes the deferred reply on a creation failure and keeps the queue usable", async () => {
    const ctx = setup();
    ctx.channels.set("tickets", { id: "tickets", name: "🎫 TICKETS", type: 4 });
    const create = ctx.guild.channels.create;
    ctx.guild.channels.create = vi
      .fn()
      .mockRejectedValueOnce(new Error("Missing Permissions"))
      .mockImplementation(create);
    const failed = ticketButton(ctx);
    await ctx.events.interactionCreate(failed);
    expect(failed.editReply).toHaveBeenCalledWith({
      content: expect.stringContaining("Ocurrió un error"),
    });
    expect(failed.followUp).not.toHaveBeenCalled();
    const retry = ticketButton(ctx);
    await ctx.events.interactionCreate(retry);
    expect(retry.editReply).toHaveBeenCalledWith({
      content: expect.stringContaining("Ticket abierto"),
    });
  });

  it("answers missing setup and rejects assignment by nonstaff without changing channels", async () => {
    const ctx = setup();
    const missing = ticketButton(ctx);
    await ctx.events.interactionCreate(missing);
    expect(missing.editReply).toHaveBeenCalledWith({
      content: expect.stringContaining("no está configurado"),
    });
    const assignment = ticketButton(ctx, "ticket_asignar");
    await ctx.events.interactionCreate(assignment);
    expect(assignment.deferReply).toHaveBeenCalledWith({ flags: 64 });
    expect(assignment.editReply).toHaveBeenCalledWith({
      content: expect.stringContaining("Solo el staff"),
    });
    expect(ctx.channels.size).toBe(0);
  });

  it("creates dynamic named tournaments and two private voices per match, without duplicates", async () => {
    const ctx = setup();
    await ctx.send("!torneo crear split-rosario-2 | Split Rosario 2");
    const a = Array.from({ length: 5 }, (_, i) => `<@${1900000000000000000n + BigInt(i)}>`).join(
      " ",
    );
    const b = Array.from({ length: 5 }, (_, i) => `<@${1910000000000000000n + BigInt(i)}>`).join(
      " ",
    );
    const command = `!partida crear match-1 | split-rosario-2 | 1 | Equipo A | ${a} | Equipo B | ${b}`;
    expect((await ctx.send(command))[0]).toContain("✅");
    const count = ctx.channels.size;
    expect((await ctx.send(command))[0]).toContain("✅");
    expect(ctx.channels.size).toBe(count);
    const voices = [...ctx.channels.values()].filter((c) => c.type === 2);
    expect(voices).toHaveLength(2);
    expect(voices.every((c) => c.userLimit === 0)).toBe(true);
    const allowedMembers = (channel: any) =>
      channel.permissionOverwrites
        .filter((p: any) => p.type === 1 && p.id !== "1500000000000000000")
        .map((p: any) => p.id);
    expect(allowedMembers(voices[0])).toHaveLength(5);
    expect(allowedMembers(voices[1])).toHaveLength(5);
    expect(
      allowedMembers(voices[0]).some((id: string) => allowedMembers(voices[1]).includes(id)),
    ).toBe(false);
    expect(
      voices.every(
        (c) =>
          c.permissionOverwrites.filter((p: any) => p.type === 0 && p.allow?.includes(P.Connect))
            .length === 2,
      ),
    ).toBe(true);
    await ctx.send("!ids");
    expect(ctx.saved.at(-1).custom).toEqual({ preserved: true });
    expect(ctx.saved.at(-1).equipos.existing.rol).toBe("unchanged");
    expect(ctx.saved.at(-1).competicion.partidas["match-1"].teamAId).toBe(voices[0].id);
    expect(ctx.saved.at(-1).webUrl).toBe("https://eloshape.com.ar");
  });

  it("refuses nonstaff commands and prevents overlapping rosters", async () => {
    const ctx = setup();
    expect((await ctx.send("!torneo crear unauthorized | Invalido", false))[0]).toContain(
      "Solo el staff",
    );
    expect(ctx.channels.size).toBe(0);
    await ctx.send("!torneo crear split-1 | Split Rosario 1");
    const roster = Array.from(
      { length: 5 },
      (_, i) => `<@${1900000000000000000n + BigInt(i)}>`,
    ).join(" ");
    const count = ctx.channels.size;
    expect(
      (await ctx.send(`!partida crear match-1 | split-1 | 1 | A | ${roster} | B | ${roster}`))[0],
    ).toContain("Ocurrió un error");
    expect(ctx.channels.size).toBe(count);
  });

  it("keeps staff coordinacion separate from identically named match channels", async () => {
    const ctx = setup();
    const def = ctx.structure.ESTRUCTURA.find((g: any) => g.key === "staff");
    const channel = def.canales.find((c: any) => c.key === "coordinacion");
    ctx.channels.set("staff-category", { id: "staff-category", name: def.categoria, type: 4 });
    ctx.channels.set("match-coord", {
      id: "match-coord",
      name: "coordinacion",
      type: 0,
      parentId: "match-category",
    });
    ctx.channels.set("staff-coord", {
      id: "staff-coord",
      name: "coordinacion",
      type: 0,
      parentId: "staff-category",
    });
    expect(ctx.api.canalEstructura(ctx.guild, def, channel).id).toBe("staff-coord");
  });
});
