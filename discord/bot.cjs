// bot.js
// Bot de Discord de EloShape.
//
// Comandos (solo staff):
//   !adaptar                         → adapta el servidor a estructura.js sin duplicar nada y genera ids.json
//   !torneo / !partida / !beta / !ayuda → ver LEEME.md
//   !ids                             → vuelve a generar ids.json sin cambiar el servidor
//   !equipo crear <nombre> @j1 @j2   → crea el espacio privado de un equipo y da el rol a sus integrantes
//   !equipo agregar <nombre> @j      → suma integrantes al equipo
//   !equipo quitar <nombre> @j       → saca integrantes del equipo
//
// Tickets: botón en #abrir-ticket → canal privado para el usuario y el staff asignado.
//
// Variables de entorno:
//   DISCORD_TOKEN  → token del bot (obligatorio)
//   ELOSHAPE_URL   → URL de la web; por defecto https://eloshape.com.ar
//   BETA_SYNC_ENABLED, BETA_SNAPSHOT_URL, DISCORD_BETA_SYNC_TOKEN → sincronización opcional de beta
//   DISCORD_MEMBERS_INTENT=true → requiere Server Members Intent en Developer Portal

const fs = require("fs");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const {
  RUTAS,
  ROLES,
  ROLES_STAFF,
  ROLES_JUGADOR,
  ESTRUCTURA,
  MENSAJES,
  PENDIENTES,
  TEXTO,
  VOZ,
} = require("./estructura.cjs");
const {
  ensureBetaSpace,
  ensureTournamentSpace,
  ensureMatchSpace,
  syncBetaMembers,
} = require("./competicion.cjs");
const { fetchBetaSnapshot } = require("./beta-sync.cjs");
const { fetchLinkedSnapshot, syncLinkedMembers, testLinkedMember } = require("./linked-sync.cjs");
const { applyWaitingRoom } = require("./espera.cjs");

const TOKEN = process.env.DISCORD_TOKEN || "PEGA_AQUI_TU_TOKEN";
const WEB_URL = (process.env.ELOSHAPE_URL || "https://eloshape.com.ar").replace(/\/+$/, "");
if (new URL(WEB_URL).protocol !== "https:") throw new Error("ELOSHAPE_URL debe usar HTTPS");
const PREFIJO = "!";
const ARCHIVO_IDS = path.join(__dirname, "ids.json");
const PIE_OFICIAL = "EloShape · ";

// Permisos de escritura que se quitan en canales de solo lectura
const ESCRIBIR = [
  "SendMessages",
  "SendMessagesInThreads",
  "CreatePublicThreads",
  "CreatePrivateThreads",
];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    ...(process.env.DISCORD_MEMBERS_INTENT === "true" ? [GatewayIntentBits.GuildMembers] : []),
    GatewayIntentBits.MessageContent, // Actívalo también en el Developer Portal
  ],
});

client.once("ready", () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
  if (
    process.env.BETA_SYNC_ENABLED === "true" ||
    process.env.DISCORD_LINK_SYNC_ENABLED === "true"
  ) {
    let pendiente = false;
    const tick = () => {
      if (pendiente) return;
      pendiente = true;
      encolar(async () => {
        const guildId = IDS.servidor?.id;
        if (!guildId) throw new Error("Falta servidor.id en ids.json");
        const guild = await client.guilds.fetch(guildId);
        // Cada rol se sincroniza de forma independiente: un fallo de OAuth no
        // debe impedir la actualización de la whitelist, ni al revés.
        if (process.env.DISCORD_LINK_SYNC_ENABLED === "true") {
          await sincronizarVinculadas(guild).catch(() =>
            console.error("No se pudieron sincronizar las cuentas vinculadas; se reintentará."),
          );
        }
        if (process.env.BETA_SYNC_ENABLED === "true")
          await sincronizarBeta(guild).catch(() =>
            console.error("No se pudo sincronizar la whitelist; se reintentará."),
          );
      })
        .catch(() =>
          console.error(
            "No se pudo completar la sincronización; se reintentará en el próximo ciclo.",
          ),
        )
        .finally(() => {
          pendiente = false;
        });
    };
    tick();
    setInterval(tick, 60_000).unref();
  }
});

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const igual = (a, b) => a.toLowerCase() === b.toLowerCase();

function slug(texto) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buscarCanal(guild, nombres, type, parentId) {
  return guild.channels.cache.find(
    (c) =>
      c.type === type &&
      (parentId === undefined || c.parentId === parentId) &&
      nombres.some((n) => igual(n, c.name)),
  );
}
function canalEstructura(guild, grupo, def) {
  const guardado = guild.channels.cache.get(IDS.canales?.[def.key]?.id);
  if (guardado?.type === def.type) return guardado;
  const categoria = buscarCanal(guild, [grupo.categoria], ChannelType.GuildCategory);
  return buscarCanal(guild, [def.name, ...(def.antes ?? [])], def.type, categoria?.id);
}

function buscarRol(guild, key) {
  const def = ROLES[key];
  return guild.roles.cache.find((r) => r.name === def.name);
}

function rolesStaff(guild) {
  return ROLES_STAFF.map((k) => buscarRol(guild, k)).filter(Boolean);
}

function esStaff(member) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return rolesStaff(member.guild).some((r) => member.roles.cache.has(r.id));
}

// Convierte una lista de nombres de permisos en { Permiso: valor }
const permisos = (lista, valor) => Object.fromEntries(lista.map((p) => [p, valor]));

// Overwrites según el tipo de acceso definido en estructura.js
function overwritesPara(acceso, guild) {
  const everyone = guild.roles.everyone.id;
  const staff = rolesStaff(guild).map((r) => r.id);
  const bot = guild.members.me.id;

  switch (acceso) {
    case "lectura":
      return [
        { id: everyone, deny: ESCRIBIR },
        ...staff.map((id) => ({ id, allow: ESCRIBIR })),
        { id: bot, allow: ESCRIBIR },
      ];
    case "casters": {
      const caster = buscarRol(guild, "caster");
      return [
        { id: everyone, deny: ["Speak"] },
        ...[caster?.id, ...staff].filter(Boolean).map((id) => ({ id, allow: ["Speak"] })),
      ];
    }
    case "privado":
      return [
        { id: everyone, deny: ["ViewChannel"] },
        ...staff.map((id) => ({ id, allow: ["ViewChannel"] })),
        { id: bot, allow: ["ViewChannel", "SendMessages", "ManageChannels"] },
      ];
    default:
      return null;
  }
}

// Aplica overwrites a un canal existente sin borrar los que ya tenga
async function aplicarOverwrites(canal, lista) {
  for (const ow of lista) {
    await canal.permissionOverwrites.edit(ow.id, {
      ...permisos(ow.allow ?? [], true),
      ...permisos(ow.deny ?? [], false),
    });
  }
}

// Envía texto largo en varios mensajes (límite de 2000 caracteres de Discord)
async function enviarLargo(canal, lineas) {
  let bloque = "";
  for (const linea of lineas) {
    if ((bloque + "\n" + linea).length > 1900) {
      await canal.send(bloque);
      bloque = "";
    }
    bloque += (bloque ? "\n" : "") + linea;
  }
  if (bloque) await canal.send(bloque);
}

// Manda un aviso al canal #alertas-bot (si existe)
async function alerta(guild, texto) {
  const canal = buscarCanal(guild, ["alertas-bot"], TEXTO);
  if (canal) await canal.send(texto).catch(() => {});
}

// Fallar ante JSON corrupto: nunca reemplazar los IDs existentes por una lista vacía.
function leerIds() {
  if (!fs.existsSync(ARCHIVO_IDS)) return {};
  const datos = JSON.parse(fs.readFileSync(ARCHIVO_IDS, "utf8"));
  if (!datos || typeof datos !== "object" || Array.isArray(datos))
    throw new Error("ids.json inválido");
  return datos;
}
const IDS = leerIds();
function guardarIds(datos = IDS) {
  const temporal = ARCHIVO_IDS + ".tmp";
  fs.writeFileSync(temporal, JSON.stringify(datos, null, 2));
  fs.renameSync(temporal, ARCHIVO_IDS);
}
let cola = Promise.resolve();
function encolar(operacion) {
  const siguiente = cola.catch(() => {}).then(operacion);
  cola = siguiente;
  return siguiente;
}
function contextoCompeticion(guild) {
  return {
    guild,
    ids: IDS,
    staffRoleIds: rolesStaff(guild).map((r) => r.id),
    persistIds: guardarIds,
  };
}
async function sincronizarBeta(guild) {
  if (process.env.DISCORD_MEMBERS_INTENT !== "true")
    throw new Error("Habilitá Server Members Intent y DISCORD_MEMBERS_INTENT=true");
  const snapshot = await fetchBetaSnapshot();
  // Gate apagado = sincronización pausada, no revocación masiva.
  if (!snapshot.enabled) return { paused: true };
  return syncBetaMembers({
    ...contextoCompeticion(guild),
    approvedDiscordIds: snapshot.member_ids,
  });
}

async function sincronizarVinculadas(guild) {
  if (process.env.DISCORD_MEMBERS_INTENT !== "true")
    throw new Error("Habilitá Server Members Intent y DISCORD_MEMBERS_INTENT=true");
  const linkedDiscordIds = await fetchLinkedSnapshot();
  return syncLinkedMembers({ guild, ids: IDS, linkedDiscordIds });
}

// ---------------------------------------------------------------------------
// !adaptar
// ---------------------------------------------------------------------------

async function sincronizarRoles(guild, informe) {
  for (const def of Object.values(ROLES)) {
    const nombres = [def.name, ...(def.antes ?? [])];
    const rol =
      guild.roles.cache.find((r) => r.name === def.name) ??
      guild.roles.cache.find((r) => nombres.includes(r.name));

    if (!rol) {
      await guild.roles.create({
        name: def.name,
        colors: { primaryColor: def.color },
        hoist: def.hoist ?? false,
        permissions: [], // los permisos de staff se asignan a mano
      });
      informe.push(`➕ Rol creado: **${def.name}**`);
    } else if (rol.name !== def.name) {
      const anterior = rol.name;
      await rol.setName(def.name);
      informe.push(`✏️ Rol renombrado: ${anterior} → **${def.name}**`);
    }
  }
}

async function sincronizarCanales(guild, informe) {
  for (const grupo of ESTRUCTURA) {
    let categoria = buscarCanal(guild, [grupo.categoria], ChannelType.GuildCategory);
    const owCategoria = overwritesPara(grupo.acceso, guild);

    if (!categoria) {
      categoria = await guild.channels.create({
        name: grupo.categoria,
        type: ChannelType.GuildCategory,
        permissionOverwrites: owCategoria ?? undefined,
      });
      informe.push(`➕ Categoría creada: **${grupo.categoria}**`);
    } else if (owCategoria) {
      await aplicarOverwrites(categoria, owCategoria);
    }

    for (const def of grupo.canales) {
      const acceso = def.acceso ?? grupo.acceso;
      const ow = overwritesPara(acceso, guild);
      const canal = canalEstructura(guild, grupo, def);

      if (!canal) {
        if (def.soloSiExiste) {
          informe.push(
            `ℹ️ No existe #${def.name} (no se crea porque es un canal propio de Discord)`,
          );
          continue;
        }
        await guild.channels.create({
          name: def.name,
          type: def.type,
          parent: categoria.id,
          topic: def.topic,
          userLimit: def.userLimit,
          permissionOverwrites: ow ?? [...categoria.permissionOverwrites.cache.values()],
        });
        informe.push(`➕ Canal creado: **${def.name}** en ${grupo.categoria}`);
        continue;
      }

      if (!igual(canal.name, def.name)) {
        const anterior = canal.name;
        await canal.setName(def.name);
        informe.push(`✏️ Canal renombrado: ${anterior} → **${def.name}**`);
      }
      if (canal.parentId !== categoria.id) {
        // En categorías privadas se sincronizan los permisos para que el canal quede oculto
        await canal.setParent(categoria.id, { lockPermissions: grupo.acceso === "privado" });
        informe.push(`📦 Canal movido: **${def.name}** → ${grupo.categoria}`);
      }
      if (ow) await aplicarOverwrites(canal, ow);
      if (def.topic && canal.type === TEXTO && canal.topic !== def.topic)
        await canal.setTopic(def.topic);
      if (def.userLimit !== undefined && canal.userLimit !== def.userLimit)
        await canal.setUserLimit(def.userLimit);
    }
  }
}

// Mapa clave → id de todos los canales definidos, para reemplazar <#clave> en los textos
function mapaCanales(guild) {
  const mapa = {};
  for (const grupo of ESTRUCTURA) {
    for (const def of grupo.canales) {
      const canal = canalEstructura(guild, grupo, def);
      if (canal) mapa[def.key] = canal.id;
    }
  }
  return mapa;
}

// Publica (o actualiza si ya existe) un mensaje oficial fijado del bot
async function publicarOficial(canal, clave, embed, components = []) {
  embed.setFooter({ text: PIE_OFICIAL + clave }).setColor(0x5865f2);
  const recientes = await canal.messages.fetch({ limit: 50 });
  const previo = recientes.find(
    (m) =>
      m.author.id === canal.client.user.id && m.embeds[0]?.footer?.text === PIE_OFICIAL + clave,
  );

  if (previo) {
    await previo.edit({ embeds: [embed], components });
    return "actualizado";
  }
  const enviado = await canal.send({ embeds: [embed], components });
  await enviado.pin().catch(() => {});
  return "publicado";
}

async function publicarTextos(guild, informe) {
  const ids = mapaCanales(guild);
  const url = (ruta) => WEB_URL + RUTAS[ruta];
  const enlazar = (texto) =>
    texto.replace(/<#(\w+)>/g, (m, key) => (ids[key] ? `<#${ids[key]}>` : m));

  // Panel de tickets (no depende de la web)
  const canalTickets = guild.channels.cache.get(ids.abrirTicket);
  if (canalTickets) {
    const embed = new EmbedBuilder()
      .setTitle("🎫 Abrir un ticket")
      .setDescription(
        "Tocá el botón para abrir un canal **privado** con el staff.\n" +
          "El staff recibe tu consulta y puede asignarla a una persona para atenderte. No publiques tus datos en los canales generales.\n\n" +
          `Para consultas generales usá <#${ids.ayuda ?? ""}>.`,
      );
    const fila = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_abrir")
        .setLabel("Abrir ticket")
        .setEmoji("🎫")
        .setStyle(ButtonStyle.Primary),
    );
    const r = await publicarOficial(canalTickets, "abrir-ticket", embed, [fila]);
    informe.push(`📌 Panel de tickets ${r} en #abrir-ticket`);
  }

  if (!WEB_URL) {
    informe.push("⏸️ Textos oficiales sin publicar: falta definir ELOSHAPE_URL (ver PENDIENTES).");
    return;
  }

  for (const grupo of ESTRUCTURA) {
    for (const def of grupo.canales) {
      if (!def.mensaje || !ids[def.key]) continue;
      const { titulo, texto } = MENSAJES[def.mensaje](url);
      const embed = new EmbedBuilder().setTitle(titulo).setDescription(enlazar(texto));
      const r = await publicarOficial(guild.channels.cache.get(ids[def.key]), def.mensaje, embed);
      informe.push(`📌 Texto oficial ${r} en #${def.name}`);
    }
  }
}

// Comprueba que los canales privados no sean visibles para jugadores
// y que los canales de solo lectura no permitan escribir
function verificarPermisos(guild, informe) {
  const jugadores = [
    guild.roles.everyone,
    ...ROLES_JUGADOR.map((k) => buscarRol(guild, k)).filter(Boolean),
  ];
  let problemas = 0;

  for (const grupo of ESTRUCTURA) {
    const categoria = buscarCanal(guild, [grupo.categoria], ChannelType.GuildCategory);
    if (!categoria) continue;

    // Canales privados: toda la categoría, incluidos canales que no estén en estructura.js
    if (grupo.acceso === "privado") {
      const canales = [
        categoria,
        ...guild.channels.cache.filter((c) => c.parentId === categoria.id).values(),
      ];
      for (const canal of canales) {
        const visibles = jugadores.filter((r) =>
          canal.permissionsFor(r).has(PermissionFlagsBits.ViewChannel),
        );
        if (visibles.length) {
          problemas++;
          informe.push(
            `⚠️ **${canal.name}** es visible para: ${visibles.map((r) => r.name).join(", ")}`,
          );
        }
      }
    }

    for (const def of grupo.canales) {
      if ((def.acceso ?? grupo.acceso) !== "lectura") continue;
      const canal = canalEstructura(guild, grupo, def);
      if (!canal) continue;
      const escriben = jugadores.filter((r) =>
        canal.permissionsFor(r).has(PermissionFlagsBits.SendMessages),
      );
      if (escriben.length) {
        problemas++;
        informe.push(
          `⚠️ En #${def.name} pueden escribir: ${escriben.map((r) => r.name).join(", ")}`,
        );
      }
    }
  }

  const modOnly = buscarCanal(guild, ["moderator-only"], TEXTO);
  if (modOnly) {
    const visible = jugadores.some((r) =>
      modOnly.permissionsFor(r).has(PermissionFlagsBits.ViewChannel),
    );
    informe.push(
      visible
        ? "⚠️ #moderator-only es visible para jugadores"
        : "🔒 Verificado: #moderator-only está oculto para jugadores",
    );
  }

  informe.push(
    problemas
      ? `⚠️ Problemas de permisos: ${problemas}`
      : "🔒 Verificado: canales privados ocultos y canales oficiales en solo lectura",
  );
}

// Genera ids.json con todos los IDs de roles y canales
function exportarIds(guild) {
  const previo = IDS;
  const datos = {
    ...previo,
    servidor: { id: guild.id, nombre: guild.name },
    generado: new Date().toISOString(),
    webUrl: WEB_URL || null,
    roles: {},
    categorias: {},
    canales: {},
    equipos: previo.equipos ?? {},
    sinGestionar: [],
    pendientes: [
      ...PENDIENTES,
      ...(WEB_URL
        ? []
        : [
            "Definir ELOSHAPE_URL y revisar RUTAS en estructura.js para publicar los textos oficiales.",
          ]),
    ],
  };

  for (const key of Object.keys(ROLES)) {
    const rol = buscarRol(guild, key);
    datos.roles[key] = rol ? { id: rol.id, nombre: rol.name } : null;
  }

  const gestionados = new Set();
  for (const grupo of ESTRUCTURA) {
    const categoria = buscarCanal(guild, [grupo.categoria], ChannelType.GuildCategory);
    datos.categorias[grupo.key] = categoria ? { id: categoria.id, nombre: categoria.name } : null;
    if (categoria) gestionados.add(categoria.id);

    for (const def of grupo.canales) {
      const canal = canalEstructura(guild, grupo, def);
      datos.canales[def.key] = canal
        ? { id: canal.id, nombre: canal.name, tipo: def.type === VOZ ? "voz" : "texto" }
        : null;
      if (canal) gestionados.add(canal.id);
    }
  }

  const dinamicos = previo.competicion || {};
  for (const slot of [
    ...Object.values(dinamicos.torneos || {}),
    ...Object.values(dinamicos.partidas || {}),
    dinamicos.beta || {},
  ]) {
    for (const [key, id] of Object.entries(slot))
      if (key.endsWith("Id") && key !== "roleId") gestionados.add(id);
  }
  // Canales que existen en el servidor pero no están en estructura.js (se conservan tal cual)
  const idsEquipos = Object.values(datos.equipos).flatMap((e) => [e.texto, e.voz]);
  for (const canal of guild.channels.cache.values()) {
    if (gestionados.has(canal.id) || idsEquipos.includes(canal.id)) continue;
    if (canal.parent && ["🛡️ EQUIPOS", "🎫 TICKETS"].includes(canal.parent.name)) continue;
    datos.sinGestionar.push({
      id: canal.id,
      nombre: canal.name,
      categoria: canal.parent?.name ?? null,
    });
  }

  Object.assign(IDS, datos);
  guardarIds();
  return IDS;
}

async function adaptarServidor(message) {
  const guild = message.guild;
  const informe = [];
  await message.reply("⏳ Adaptando el servidor de EloShape...");

  await guild.channels.fetch();
  await guild.roles.fetch();
  await guild.members.fetchMe();
  await sincronizarRoles(guild, informe);
  await sincronizarCanales(guild, informe);
  await publicarTextos(guild, informe);
  await ensureBetaSpace(contextoCompeticion(guild));
  informe.push("🧪 Espacio de beta preparado; no se agregan testers con !adaptar.");
  // Guardar el mapa antes de aplicar el acceso, también en la primera instalación.
  exportarIds(guild);
  const espera = await applyWaitingRoom({
    ...contextoCompeticion(guild),
    structure: ESTRUCTURA,
    channelForDefinition: (grupo, def) => canalEstructura(guild, grupo, def),
  });
  informe.push(
    `🔐 Acceso pendiente aplicado: ${espera.updated} canales/categorías. Solo Beta tester y staff ven comunidad, torneos y voz.`,
  );
  verificarPermisos(guild, informe);
  const datos = exportarIds(guild);

  if (datos.sinGestionar.length) {
    informe.push(
      `ℹ️ Canales conservados que no están en la estructura: ${datos.sinGestionar.map((c) => c.nombre).join(", ")}`,
    );
  }
  informe.push(
    "",
    "**Pendientes (sin conexión con la web todavía):**",
    ...datos.pendientes.map((p) => `⏸️ ${p}`),
  );
  informe.push(
    "",
    `📄 IDs guardados en \`ids.json\` (${Object.keys(datos.roles).length} roles, ${Object.keys(datos.canales).length} canales).`,
  );

  await enviarLargo(message.channel, ["✅ **Servidor adaptado**", ...informe]);
  await alerta(guild, `🛠️ ${message.author} ejecutó !adaptar.`);
}

// ---------------------------------------------------------------------------
// !equipo
// ---------------------------------------------------------------------------

async function comandoEquipo(message, args) {
  const guild = message.guild;
  const sub = (args[0] ?? "").toLowerCase();
  const nombre = args
    .slice(1)
    .filter((a) => !/^<@!?\d+>$/.test(a))
    .join(" ")
    .trim();
  const miembros = [...message.mentions.members.values()];

  if (!["crear", "agregar", "quitar"].includes(sub) || !nombre) {
    return message.reply("Uso: `!equipo crear|agregar|quitar <nombre del equipo> @jugador ...`");
  }

  const nombreRol = `Equipo · ${nombre}`;
  let rol = guild.roles.cache.find((r) => igual(r.name, nombreRol));

  if (sub === "crear") {
    if (rol) return message.reply(`❌ El equipo **${nombre}** ya existe.`);
    const categoria = buscarCanal(guild, ["🛡️ EQUIPOS"], ChannelType.GuildCategory);
    if (!categoria)
      return message.reply("❌ Falta la categoría 🛡️ EQUIPOS. Ejecutá `!adaptar` primero.");

    rol = await guild.roles.create({ name: nombreRol, permissions: [] });
    const permisosEquipo = [
      { id: guild.roles.everyone.id, deny: ["ViewChannel"] },
      {
        id: rol.id,
        allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "Connect", "Speak"],
      },
      ...rolesStaff(guild).map((r) => ({ id: r.id, allow: ["ViewChannel", "Connect"] })),
      { id: guild.members.me.id, allow: ["ViewChannel", "SendMessages", "Connect"] },
    ];
    const texto = await guild.channels.create({
      name: `equipo-${slug(nombre)}`,
      type: TEXTO,
      parent: categoria.id,
      permissionOverwrites: permisosEquipo,
    });
    const voz = await guild.channels.create({
      name: `🔒 ${nombre}`,
      type: VOZ,
      parent: categoria.id,
      permissionOverwrites: permisosEquipo,
    });

    for (const m of miembros) await m.roles.add(rol);

    // Guarda los IDs del equipo en ids.json
    const datos = IDS;
    datos.equipos = {
      ...(datos.equipos ?? {}),
      [slug(nombre)]: { nombre, rol: rol.id, texto: texto.id, voz: voz.id },
    };
    guardarIds();

    await alerta(guild, `🛡️ Equipo **${nombre}** creado por ${message.author}.`);
    return message.reply(
      `✅ Equipo **${nombre}** creado: ${texto} y ${voz}.\n` +
        `Integrantes: ${miembros.length ? miembros.join(", ") : "ninguno todavía (usá `!equipo agregar`)"}\n` +
        `IDs → rol \`${rol.id}\`, texto \`${texto.id}\`, voz \`${voz.id}\``,
    );
  }

  if (!rol) return message.reply(`❌ No existe el equipo **${nombre}**.`);
  if (!miembros.length) return message.reply("❌ Mencioná al menos un jugador.");

  for (const m of miembros) {
    if (sub === "agregar") await m.roles.add(rol);
    else await m.roles.remove(rol);
  }
  return message.reply(
    `✅ ${sub === "agregar" ? "Agregados a" : "Quitados de"} **${nombre}**: ${miembros.join(", ")}`,
  );
}

// Comandos provisionales de staff: los IDs corresponden a las entidades de la web.
// La automatización de rosters requiere vinculación de identidad Discord verificada.
const idWeb = (value) =>
  /^[a-zA-Z0-9_-]{1,100}$/.test(value) &&
  !["__proto__", "constructor", "prototype"].includes(value);
function menciones(texto) {
  const ids = [...texto.matchAll(/<@!?(\d{17,20})>/g)].map((m) => m[1]);
  if (texto.replace(/<@!?\d{17,20}>/g, "").trim())
    throw new Error("Usá menciones de jugadores, sin otros textos en el roster");
  return [...new Set(ids)];
}
async function comandoTorneo(message, texto) {
  const [cabecera, nombre, participantes = ""] = texto.split("|").map((x) => x.trim());
  const [accion, id] = cabecera.split(/\s+/);
  if (accion !== "crear" || !idWeb(id || "") || !nombre || texto.split("|").length > 3)
    return message.reply(
      "Uso: `!torneo crear ID_WEB | Nombre del split | @participantes` (participantes opcionales).",
    );
  const memberIds = menciones(participantes);
  for (const memberId of memberIds) {
    if ((await message.guild.members.fetch(memberId)).user.bot)
      throw new Error("Los participantes deben ser jugadores, no bots");
  }
  const anterior = IDS.competicion?.torneos?.[id];
  const participantIds = [...new Set([...(anterior?.participantIds || []), ...memberIds])];
  const slot = await ensureTournamentSpace({
    ...contextoCompeticion(message.guild),
    tournamentId: id,
    name: nombre,
    participantIds,
  });
  Object.assign(slot, { name: nombre, participantIds });
  guardarIds();
  return message.reply(
    `✅ **${nombre}** preparado: <#${slot.announcementsId}> y <#${slot.rulesId}>. ID de web: \`${id}\`.`,
  );
}
async function comandoPartida(message, texto) {
  const campos = texto.split("|").map((x) => x.trim());
  const [cabecera, tournamentId, numero, nameA, rosterA, nameB, rosterB] = campos;
  const [accion, matchId] = (cabecera || "").split(/\s+/);
  if (
    accion !== "crear" ||
    campos.length !== 7 ||
    !idWeb(matchId || "") ||
    !idWeb(tournamentId || "") ||
    !/^\d+$/.test(numero) ||
    !nameA ||
    !nameB
  )
    return message.reply(
      "Uso: `!partida crear ID_PARTIDA | ID_TORNEO | N | Nombre A | @5 jugadores | Nombre B | @5 jugadores`.",
    );
  const torneo = IDS.competicion?.torneos?.[tournamentId];
  if (!torneo?.name) return message.reply("Primero creá ese torneo con `!torneo crear`.");
  const teamA = { name: nameA, memberIds: menciones(rosterA) };
  const teamB = { name: nameB, memberIds: menciones(rosterB) };
  const participantIds = [
    ...new Set([...(torneo.participantIds || []), ...teamA.memberIds, ...teamB.memberIds]),
  ];
  if (participantIds.length + rolesStaff(message.guild).length + 2 > 100)
    throw new Error("El torneo supera el límite de permisos de Discord");
  const existente = IDS.competicion?.partidas?.[matchId];
  if (existente?.tournamentId && existente.tournamentId !== tournamentId)
    throw new Error("Ese ID de partida ya pertenece a otro torneo");
  const slot = await ensureMatchSpace({
    ...contextoCompeticion(message.guild),
    matchId,
    tournamentName: torneo.name,
    number: Number(numero),
    teamA,
    teamB,
  });
  await ensureTournamentSpace({
    ...contextoCompeticion(message.guild),
    tournamentId,
    name: torneo.name,
    participantIds,
  });
  Object.assign(torneo, { participantIds });
  Object.assign(slot, { tournamentId, number: Number(numero), teamA, teamB });
  guardarIds();
  return message.reply(
    `✅ Partida ${numero} de **${torneo.name}**: <#${slot.teamAId}> y <#${slot.teamBId}>. Cinco jugadores por lado y acceso para staff/árbitro.`,
  );
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

const leerTopic = (topic, campo) => (topic ?? "").match(new RegExp(`${campo}:(\\d+)`))?.[1] ?? null;

function botonesTicket(desactivados = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_asignar")
      .setLabel("Asignarme")
      .setEmoji("🙋")
      .setStyle(ButtonStyle.Success)
      .setDisabled(desactivados),
    new ButtonBuilder()
      .setCustomId("ticket_cerrar")
      .setLabel("Cerrar ticket")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(desactivados),
  );
}

async function abrirTicket(interaction) {
  const guild = interaction.guild;
  const user = interaction.user;
  const categoria = buscarCanal(guild, ["🎫 TICKETS"], ChannelType.GuildCategory);
  if (!categoria) {
    return interaction.editReply({
      content: "❌ El sistema de tickets no está configurado.",
    });
  }

  const abierto = guild.channels.cache.find(
    (c) =>
      c.parentId === categoria.id &&
      leerTopic(c.topic, "usuario") === user.id &&
      !c.name.startsWith("cerrado-"),
  );
  if (abierto) {
    return interaction.editReply({
      content: `Ya tenés un ticket abierto: ${abierto}`,
    });
  }

  const staff = rolesStaff(guild);
  // Mientras nadie lo asuma, lo ve todo el staff para poder tomarlo
  const canal = await guild.channels.create({
    name: `ticket-${slug(user.username) || user.id}`,
    type: TEXTO,
    parent: categoria.id,
    topic: `usuario:${user.id} | asignado:ninguno`,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: ["ViewChannel"] },
      ...staff.map((r) => ({
        id: r.id,
        allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
      })),
      { id: user.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "AttachFiles"] },
      { id: guild.members.me.id, allow: ["ViewChannel", "SendMessages", "ManageChannels"] },
    ],
  });

  await canal.send({
    content:
      `${user} gracias por escribir. Contanos tu consulta con el mayor detalle posible.\n` +
      `${staff.map((r) => `<@&${r.id}>`).join(" ")}: alguien del staff tiene que tocar **Asignarme** para tomar el ticket.`,
    components: [botonesTicket()],
  });

  await interaction.editReply({
    content: `✅ Ticket abierto: ${canal}`,
  });
  await alerta(guild, `🎫 Nuevo ticket de ${user.tag}: ${canal}`);
}

async function asignarTicket(interaction) {
  const canal = interaction.channel;
  const member = interaction.member;
  if (!esStaff(member)) {
    return interaction.editReply({
      content: "❌ Solo el staff puede asignarse tickets.",
    });
  }
  const usuario = leerTopic(canal.topic, "usuario");
  const asignado = leerTopic(canal.topic, "asignado");
  if (asignado) {
    return interaction.editReply({
      content: `Este ticket ya está asignado a <@${asignado}>.`,
    });
  }

  // Desde ahora solo lo ven el usuario y el staff asignado
  for (const rol of rolesStaff(interaction.guild)) await canal.permissionOverwrites.delete(rol.id);
  await canal.permissionOverwrites.edit(member.id, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    AttachFiles: true,
  });
  await canal.setTopic(`usuario:${usuario} | asignado:${member.id}`);

  await interaction.editReply(
    `🙋 ${member} tomó el ticket. Desde ahora solo lo ven <@${usuario}> y ${member}.`,
  );
  await alerta(interaction.guild, `🙋 ${member.user.tag} tomó ${canal}`);
}

async function cerrarTicket(interaction) {
  const canal = interaction.channel;
  const usuario = leerTopic(canal.topic, "usuario");
  const asignado = leerTopic(canal.topic, "asignado");
  const puede =
    interaction.user.id === usuario ||
    interaction.user.id === asignado ||
    esStaff(interaction.member);
  if (!puede) {
    return interaction.reply({
      content: "❌ No podés cerrar este ticket.",
      flags: MessageFlags.Ephemeral,
    });
  }

  // No se borra: queda archivado y oculto para el usuario; el staff lo elimina a mano si quiere
  await interaction.update({ components: [botonesTicket(true)] });
  if (usuario) await canal.permissionOverwrites.edit(usuario, { ViewChannel: false });
  await canal.setName(`cerrado-${canal.name.replace(/^ticket-/, "")}`);
  await canal.send(`🔒 Ticket cerrado por ${interaction.user}.`);
  await alerta(interaction.guild, `🔒 ${interaction.user.tag} cerró ${canal}`);
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

client.on("messageCreate", async (message) => {
  // Ignorar bots y mensajes fuera de un servidor
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIJO)) return;

  const [comando, ...args] = message.content.slice(PREFIJO.length).trim().split(/\s+/);
  const nombre = comando.toLowerCase();
  if (
    ![
      "adaptar",
      "crearserver",
      "ids",
      "equipo",
      "torneo",
      "partida",
      "beta",
      "vinculadas",
      "invitacion",
      "ayuda",
    ].includes(nombre)
  )
    return;
  if (IDS.servidor?.id && message.guild.id !== IDS.servidor.id) return;
  await encolar(async () => {
    try {
      await message.guild.roles.fetch();
      await message.guild.channels.fetch();
      await message.guild.members.fetchMe();
      if (!esStaff(message.member)) {
        return message.reply("❌ Solo el staff puede usar este comando.");
      }

      switch (nombre) {
        case "invitacion": {
          if (!message.member.permissions.has(PermissionFlagsBits.Administrator))
            return message.reply("❌ Solo un administrador puede crear la invitación pública.");
          const channel = message.guild.channels.cache.get(IDS.canales?.bienvenida?.id);
          if (!channel || channel.type !== TEXTO)
            throw new Error("Falta #bienvenida en ids.json; ejecutá !adaptar");
          const invite = await channel.createInvite({
            maxAge: 0,
            maxUses: 0,
            temporary: false,
            unique: false,
            reason: "EloShape: invitación pública a la zona de bienvenida",
          });
          IDS.invitacion = { code: invite.code, url: invite.url, channelId: channel.id };
          guardarIds();
          return message.reply(
            `✅ Invitación permanente: ${invite.url}\nEntrar no concede Beta tester ni Cuenta vinculada.`,
          );
        }
        case "adaptar":
        case "crearserver": {
          if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply("❌ Solo un administrador puede adaptar el servidor.");
          }
          if (!message.guild.members.me.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply(
              "❌ Necesito el permiso **Administrador** para adaptar canales, roles y permisos.",
            );
          }
          return await adaptarServidor(message);
        }
        case "ids": {
          const datos = exportarIds(message.guild);
          return message.reply(
            `📄 \`ids.json\` actualizado: ${Object.keys(datos.roles).length} roles y ${Object.keys(datos.canales).length} canales.`,
          );
        }
        case "equipo":
          return await comandoEquipo(message, args);
        case "torneo":
          return await comandoTorneo(message, args.join(" "));
        case "partida":
          return await comandoPartida(message, args.join(" "));
        case "beta":
          if (!message.member.permissions.has(PermissionFlagsBits.Administrator))
            return message.reply("❌ Solo un administrador puede operar la beta.");
          if (args[0] === "sincronizar") {
            const estado = await sincronizarBeta(message.guild);
            return message.reply(
              estado.paused
                ? "⏸️ Beta desactivada en la web; roles conservados."
                : `✅ Whitelist sincronizada: ${estado.approved} IDs aprobados.`,
            );
          }
          if (args[0] === "preparar") {
            await ensureBetaSpace(contextoCompeticion(message.guild));
            return message.reply("✅ Beta preparada. No se dieron accesos a jugadores.");
          }
          return message.reply(
            "Usá `!beta preparar` o `!beta sincronizar`. Los invitados se administran en la web.",
          );
        case "vinculadas": {
          if (!message.member.permissions.has(PermissionFlagsBits.Administrator))
            return message.reply("❌ Solo un administrador puede sincronizar cuentas.");
          if (args[0] === "probar") {
            if (args.length !== 1)
              return message.reply("Usá `!vinculadas probar` sin mencionar otros usuarios.");
            const linkedDiscordIds = await fetchLinkedSnapshot();
            const result = await testLinkedMember({
              guild: message.guild,
              ids: IDS,
              linkedDiscordIds,
              memberId: message.author.id,
            });
            return message.reply(
              result.added
                ? "✅ Identidad verificada: Cuenta vinculada asignado a tu usuario."
                : "✅ Identidad verificada: tu usuario ya tiene Cuenta vinculada.",
            );
          }
          if (args[0] !== "sincronizar")
            return message.reply("Usá `!vinculadas probar` o `!vinculadas sincronizar`.");
          const result = await sincronizarVinculadas(message.guild);
          return message.reply(
            `✅ Cuentas vinculadas: ${result.added} roles asignados, ${result.removed} retirados.`,
          );
        }
        case "ayuda":
          return message.reply(
            "Staff: `!adaptar`, `!ids`, `!invitacion`, `!equipo`, `!torneo crear ID_WEB | Nombre | @participantes`, `!partida crear ID_PARTIDA | ID_TORNEO | N | Nombre A | @5 jugadores | Nombre B | @5 jugadores`, `!beta preparar`, `!beta sincronizar`, `!vinculadas probar`, `!vinculadas sincronizar`.",
          );
      }
    } catch (error) {
      console.error(`Error en !${comando}:`, error);
      await message
        .reply("❌ Ocurrió un error. Revisá #alertas-bot o la consola del bot.")
        .catch(() => {});
      await alerta(message.guild, `❌ Error en \`!${comando}\`: ${error.message}`);
    }
  });
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton() || !interaction.guild) return;
  if (IDS.servidor?.id && interaction.guild.id !== IDS.servidor.id) return;

  try {
    switch (interaction.customId) {
      case "ticket_abrir":
        // Discord exige confirmar el botón antes de crear canales o esperar la cola.
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        return await encolar(() => abrirTicket(interaction));
      case "ticket_asignar":
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        return await encolar(() => asignarTicket(interaction));
      case "ticket_cerrar":
        return await cerrarTicket(interaction);
    }
  } catch (error) {
    console.error(`Error en el botón ${interaction.customId}:`, error);
    const respuesta = {
      content: "❌ Ocurrió un error. El staff ya fue avisado.",
    };
    if (interaction.deferred && !interaction.replied)
      await interaction.editReply(respuesta).catch(() => {});
    else if (interaction.replied)
      await interaction.followUp({ ...respuesta, flags: MessageFlags.Ephemeral }).catch(() => {});
    else await interaction.reply({ ...respuesta, flags: MessageFlags.Ephemeral }).catch(() => {});
    await alerta(
      interaction.guild,
      `❌ Error en el botón \`${interaction.customId}\`: ${error.message}`,
    ).catch(() => {});
  }
});

if (!TOKEN || TOKEN === "PEGA_AQUI_TU_TOKEN")
  throw new Error("Definí DISCORD_TOKEN en el entorno del bot");
client
  .login(TOKEN)
  .catch(() =>
    console.error(
      "No se pudo conectar a Discord. Revisá el token y los intents en Developer Portal.",
    ),
  );
