// Importar desde bot.js. Requiere discord.js v14 y persistencia de ids.json.
const { ChannelType, PermissionFlagsBits: P, OverwriteType } = require("discord.js");
const { listGuildMembers } = require("./member-list.cjs");

const queues = new Map();
const snowflake = /^[0-9]{17,20}$/;
const cleanName = (value) =>
  String(value)
    .replace(/[\r\n]/g, " ")
    .trim()
    .slice(0, 80);

async function serialized(guild, callback) {
  const previous = queues.get(guild.id) || Promise.resolve();
  const next = previous.catch(() => {}).then(callback);
  queues.set(guild.id, next);
  try {
    return await next;
  } finally {
    if (queues.get(guild.id) === next) queues.delete(guild.id);
  }
}

function stateFor(ids) {
  ids.competicion ||= {};
  ids.competicion.torneos ||= {};
  ids.competicion.partidas ||= {};
  ids.competicion.beta ||= {};
  return ids.competicion;
}

async function basePermissions(guild, staffRoleIds) {
  const me = await guild.members.fetchMe();
  if (!staffRoleIds.length) throw new Error("Faltan los roles de staff/árbitro");
  const roles = await guild.roles.fetch();
  for (const id of staffRoleIds) {
    if (!roles.has(id)) throw new Error(`No existe el rol de staff ${id}`);
  }
  return [
    {
      id: guild.id,
      type: OverwriteType.Role,
      deny: [
        P.ViewChannel,
        P.Connect,
        P.SendMessages,
        P.SendMessagesInThreads,
        P.CreatePublicThreads,
        P.CreatePrivateThreads,
      ],
    },
    {
      id: me.id,
      type: OverwriteType.Member,
      allow: [P.ViewChannel, P.Connect, P.Speak, P.SendMessages, P.ReadMessageHistory],
    },
    ...staffRoleIds.map((id) => ({
      id,
      type: OverwriteType.Role,
      allow: [P.ViewChannel, P.Connect, P.Speak, P.SendMessages, P.ReadMessageHistory],
    })),
  ];
}

async function ensureChannel(guild, slot, key, options, ids, persistIds) {
  let channel = slot[key] ? await guild.channels.fetch(slot[key]) : null;
  if (channel && channel.type !== options.type) {
    throw new Error(`Tipo inesperado del canal ${key}; revisar ids.json`);
  }
  if (!channel) {
    channel = await guild.channels.create(options);
    slot[key] = channel.id;
    await persistIds(ids);
  } else {
    const { type, ...editable } = options;
    await channel.edit(editable);
  }
  return channel;
}

async function betaRole(guild, ids, persistIds) {
  const state = stateFor(ids).beta;
  let role = state.roleId ? await guild.roles.fetch(state.roleId) : null;
  if (!role) {
    role = await guild.roles.create({ name: "Beta tester", color: 0x1abc9c, permissions: [] });
    state.roleId = role.id;
    await persistIds(ids);
  }
  return role;
}

async function ensureBetaSpace({ guild, ids, staffRoleIds, persistIds }) {
  return serialized(guild, async () => {
    const state = stateFor(ids).beta;
    const role = await betaRole(guild, ids, persistIds);
    const staff = await basePermissions(guild, staffRoleIds);
    const permissions = [
      ...staff,
      { id: role.id, type: OverwriteType.Role, allow: [P.ViewChannel, P.ReadMessageHistory] },
    ];
    const category = await ensureChannel(
      guild,
      state,
      "categoryId",
      {
        name: "🧪 BETA",
        type: ChannelType.GuildCategory,
        permissionOverwrites: permissions,
      },
      ids,
      persistIds,
    );
    for (const [key, name, writable] of [
      ["announcementsId", "anuncios-beta", false],
      ["feedbackId", "feedback-beta", true],
      ["bugsId", "errores-beta", true],
    ]) {
      await ensureChannel(
        guild,
        state,
        key,
        {
          name,
          type: ChannelType.GuildText,
          parent: category.id,
          permissionOverwrites: [
            ...staff,
            {
              id: role.id,
              type: OverwriteType.Role,
              allow: [P.ViewChannel, P.ReadMessageHistory, ...(writable ? [P.SendMessages] : [])],
              deny: writable ? [] : [P.SendMessages],
            },
          ],
        },
        ids,
        persistIds,
      );
    }
    return state;
  });
}

async function ensureTournamentSpace({
  guild,
  ids,
  tournamentId,
  name,
  participantIds,
  staffRoleIds,
  persistIds,
}) {
  if (
    !/^[a-zA-Z0-9_-]{1,100}$/.test(tournamentId || "") ||
    ["__proto__", "constructor", "prototype"].includes(tournamentId) ||
    !cleanName(name || "")
  )
    throw new Error("Falta identificador o nombre del torneo");
  if (!Array.isArray(participantIds) || participantIds.some((id) => !snowflake.test(id))) {
    throw new Error("Los participantes deben ser IDs de Discord verificados");
  }
  // Discord admite hasta 100 overwrites por canal: everyone + bot + staff + jugadores.
  if (new Set(participantIds).size + new Set(staffRoleIds).size + 2 > 100) {
    throw new Error("El torneo supera 100 permisos por canal; requiere un rol de participantes");
  }
  return serialized(guild, async () => {
    const state = stateFor(ids).torneos;
    const slot = (state[tournamentId] ||= {});
    const staff = await basePermissions(guild, staffRoleIds);
    const participants = [...new Set(participantIds)].map((id) => ({
      id,
      type: OverwriteType.Member,
      allow: [P.ViewChannel, P.ReadMessageHistory],
    }));
    const permissions = [...staff, ...participants];
    const category = await ensureChannel(
      guild,
      slot,
      "categoryId",
      {
        name: `🏆 ${cleanName(name)}`,
        type: ChannelType.GuildCategory,
        permissionOverwrites: permissions,
      },
      ids,
      persistIds,
    );
    for (const [key, channelName] of [
      ["announcementsId", "anuncios"],
      ["rulesId", "reglas"],
      ["bracketId", "bracket"],
      ["resultsId", "resultados"],
    ]) {
      await ensureChannel(
        guild,
        slot,
        key,
        {
          name: channelName,
          type: ChannelType.GuildText,
          parent: category.id,
          permissionOverwrites: permissions,
        },
        ids,
        persistIds,
      );
    }
    return slot;
  });
}

async function ensureMatchSpace({
  guild,
  ids,
  matchId,
  tournamentName,
  number,
  teamA,
  teamB,
  staffRoleIds,
  persistIds,
}) {
  if (
    !/^[a-zA-Z0-9_-]{1,100}$/.test(matchId || "") ||
    ["__proto__", "constructor", "prototype"].includes(matchId) ||
    !Number.isSafeInteger(number) ||
    number < 1 ||
    !cleanName(tournamentName || "") ||
    !teamA?.name ||
    !teamB?.name
  )
    throw new Error("Partida inválida");
  const a = [...new Set(teamA.memberIds || [])];
  const b = [...new Set(teamB.memberIds || [])];
  if (
    a.length !== 5 ||
    b.length !== 5 ||
    [...a, ...b].some((id) => !snowflake.test(id)) ||
    a.some((id) => b.includes(id))
  ) {
    throw new Error(
      "La partida requiere dos rosters distintos de 5 jugadores con Discord verificado",
    );
  }
  return serialized(guild, async () => {
    const slot = (stateFor(ids).partidas[matchId] ||= {});
    for (const id of [...a, ...b]) {
      const member = await guild.members.fetch(id);
      if (member.user.bot) throw new Error("El roster debe contener jugadores, no bots");
    }
    const staff = await basePermissions(guild, staffRoleIds);
    const category = await ensureChannel(
      guild,
      slot,
      "categoryId",
      {
        name: `🎮 ${cleanName(tournamentName)} · Partida ${number}`.slice(0, 100),
        type: ChannelType.GuildCategory,
        permissionOverwrites: staff,
      },
      ids,
      persistIds,
    );
    for (const [key, team, memberIds] of [
      ["teamAId", teamA, a],
      ["teamBId", teamB, b],
    ]) {
      await ensureChannel(
        guild,
        slot,
        key,
        {
          name: cleanName(team.name),
          type: ChannelType.GuildVoice,
          parent: category.id,
          userLimit: 0,
          permissionOverwrites: [
            ...staff,
            ...memberIds.map((id) => ({
              id,
              type: OverwriteType.Member,
              allow: [P.ViewChannel, P.Connect, P.Speak],
            })),
          ],
        },
        ids,
        persistIds,
      );
    }
    await ensureChannel(
      guild,
      slot,
      "coordinationId",
      {
        name: "coordinacion",
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          ...staff,
          ...[...a, ...b].map((id) => ({
            id,
            type: OverwriteType.Member,
            allow: [P.ViewChannel, P.ReadMessageHistory, P.SendMessages],
          })),
        ],
      },
      ids,
      persistIds,
    );
    return slot;
  });
}

// Llamar únicamente con un snapshot válido recibido del backend.
// Un error de red debe abortar la sincronización, nunca convertirse en una lista vacía.
async function syncBetaMembers({ guild, ids, approvedDiscordIds, persistIds }) {
  if (!Array.isArray(approvedDiscordIds) || approvedDiscordIds.some((id) => !snowflake.test(id))) {
    throw new Error("Snapshot de whitelist inválido");
  }
  return serialized(guild, async () => {
    const role = await betaRole(guild, ids, persistIds);
    const approved = new Set(approvedDiscordIds);
    // Requiere Server Members Intent habilitado para sincronización completa.
    const members = await listGuildMembers(guild);
    for (const member of members.values()) {
      if (member.user.bot) continue;
      const hasRole = member.roles.cache.has(role.id);
      if (approved.has(member.id) && !hasRole) await member.roles.add(role);
      if (!approved.has(member.id) && hasRole) await member.roles.remove(role);
    }
    return { approved: approved.size };
  });
}

module.exports = { ensureBetaSpace, ensureTournamentSpace, ensureMatchSpace, syncBetaMembers };
