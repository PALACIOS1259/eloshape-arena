const { ChannelType, PermissionFlagsBits: P, OverwriteType } = require("discord.js");

// Un recién llegado no necesita ningún rol: @everyone representa el acceso pendiente.
const PENDING_KEYS = new Set([
  "bienvenida",
  "reglas",
  "anuncios",
  "primerosPasos",
  "vincularCuenta",
  "estadoServicio",
  "accesoBeta",
  "ayuda",
  "abrirTicket",
]);
const WRITE = [
  P.SendMessages,
  P.SendMessagesInThreads,
  P.CreatePublicThreads,
  P.CreatePrivateThreads,
];

async function applyWaitingRoom({ guild, ids, structure, staffRoleIds, channelForDefinition }) {
  const roleId = ids.competicion?.beta?.roleId;
  const roles = await guild.roles.fetch();
  if (
    !roleId ||
    !roles.has(roleId) ||
    !staffRoleIds.length ||
    staffRoleIds.some((id) => !roles.has(id))
  ) {
    throw new Error("Falta el rol Beta tester o los roles de staff; no se cambian permisos");
  }
  const me = await guild.members.fetchMe();
  const plans = [];
  const handled = new Set();
  const previouslyManaged = new Set(ids.espera?.channelIds || []);
  const supported = new Set([
    ChannelType.GuildText,
    ChannelType.GuildVoice,
    ChannelType.GuildCategory,
    ChannelType.GuildAnnouncement,
  ]);

  const overwrites = ({ pending, readOnly = false, casterId }) => [
    {
      id: guild.id,
      type: OverwriteType.Role,
      allow: pending ? [P.ViewChannel, P.ReadMessageHistory, ...(readOnly ? [] : WRITE)] : [],
      deny: [...(pending ? [] : [P.ViewChannel, P.Connect]), ...(readOnly ? WRITE : [])],
    },
    {
      id: me.id,
      type: OverwriteType.Member,
      allow: [P.ViewChannel, P.ReadMessageHistory, P.Connect, P.Speak, ...WRITE],
    },
    ...staffRoleIds.map((id) => ({
      id,
      type: OverwriteType.Role,
      allow: [P.ViewChannel, P.ReadMessageHistory, P.Connect, P.Speak, ...WRITE],
    })),
    {
      id: roleId,
      type: OverwriteType.Role,
      allow: [
        P.ViewChannel,
        P.ReadMessageHistory,
        P.Connect,
        ...(casterId ? [] : [P.Speak]),
        ...(readOnly ? [] : WRITE),
      ],
    },
    ...(casterId
      ? [
          // Beta tester habilita ver/entrar; Caster habilita hablar en Casteo/Stream.
          { id: casterId, type: OverwriteType.Role, allow: [P.Speak] },
        ]
      : []),
  ];

  for (const group of structure) {
    const category = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name === group.categoria,
    );
    if (category) handled.add(category.id);
    const privateGroup = group.acceso === "privado" || ["equipos", "tickets"].includes(group.key);
    if (category && !privateGroup) {
      plans.push({
        channel: category,
        permissions: overwrites({
          pending: group.canales.some((def) => PENDING_KEYS.has(def.key)),
        }),
      });
    }
    for (const def of group.canales) {
      const channel = channelForDefinition(group, def);
      if (!channel) continue;
      handled.add(channel.id);
      if (privateGroup || (def.acceso ?? group.acceso) === "privado") continue;
      const access = def.acceso ?? group.acceso;
      const permissions = overwrites({
        pending: PENDING_KEYS.has(def.key),
        readOnly: access === "lectura",
        casterId: access === "casters" ? ids.roles?.caster?.id : undefined,
      });
      if (access === "casters") permissions[0].deny.push(P.Speak);
      plans.push({ channel, permissions });
    }
  }

  // También cerrar las salas públicas antiguas y canales por defecto. No dar
  // acceso general a espacios que ya son privados (equipos, partidas, tickets, staff).
  for (const channel of guild.channels.cache.values()) {
    if (handled.has(channel.id) || !supported.has(channel.type)) continue;
    if (channel.id === guild.rulesChannelId) {
      plans.push({ channel, permissions: overwrites({ pending: true, readOnly: true }) });
    } else if (
      previouslyManaged.has(channel.id) ||
      channel.permissionsFor(guild.roles.everyone)?.has(P.ViewChannel)
    ) {
      plans.push({ channel, permissions: overwrites({ pending: false }) });
    }
  }
  for (const { channel, permissions } of plans) {
    // Sustituir los overwrites de estos canales generales elimina grants antiguos
    // que podrían dejar entrar a usuarios pendientes. Los espacios privados se conservan.
    await channel.permissionOverwrites.set(permissions, "EloShape: acceso pendiente / Beta tester");
  }
  ids.espera = {
    channelIds: plans.map(({ channel }) => channel.id),
    pendingKeys: [...PENDING_KEYS],
  };
  return { updated: plans.length, pendingKeys: [...PENDING_KEYS] };
}

module.exports = { applyWaitingRoom, PENDING_KEYS };
