// estructura.js
// Definición del servidor de EloShape: roles, categorías, canales y textos oficiales.
// El bot usa este archivo con !adaptar. Editá acá y volvé a correr el comando:
// no duplica nada, solo crea lo que falta, renombra/mueve lo existente y actualiza los textos.

const { ChannelType } = require("discord.js");

const TEXTO = ChannelType.GuildText;
const VOZ = ChannelType.GuildVoice;

// ----- Rutas de la web -----
// ⚠️ Revisá que coincidan con las rutas reales de EloShape antes de publicar los textos.
// Se combinan con la URL base de la variable de entorno ELOSHAPE_URL.
const RUTAS = {
  registro: "/auth?mode=signup",
  perfil: "/dashboard",
  // Destino temporal válido. La vinculación de Discord todavía no está implementada.
  vincularDiscord: "/dashboard",
  equipos: "/teams",
  gestionarEquipo: "/team",
  inscripciones: "/tournaments",
  semiSplits: "/splits",
  // Los brackets y resultados están en la ficha de cada torneo: /tournaments/{slug}.
  brackets: "/tournaments",
  resultados: "/tournaments",
  ranking: "/rankings",
  // Los partidos se abren desde el panel; su ruta individual es /matches/{matchId}.
  partidas: "/dashboard",
  // En /teams hay que seleccionar la vista Scrim Finder; no existe /scrims.
  scrims: "/teams",
  // Página de pre-lanzamiento. No es un panel de monitoreo ni de incidentes.
  estado: "/maintenance",
  soporte: "/support",
};

// ----- Roles -----
// `antes`: nombres anteriores. Si existe un rol con ese nombre se renombra en vez de duplicarlo.
// El bot nunca toca los permisos de roles existentes; los roles nuevos se crean sin permisos.
// Los permisos de staff se asignan a mano desde Ajustes del servidor → Roles.
const ROLES = {
  staff: { name: "Staff/Admin", color: 0xe74c3c, hoist: true },
  arbitro: { name: "Árbitro", color: 0xe67e22, hoist: true },
  caster: { name: "Caster", color: 0x9b59b6, hoist: true },
  cuentaVinculada: { name: "Cuenta vinculada", color: 0x1abc9c },
  competidor: { name: "Competidor habilitado", color: 0x2ecc71, antes: ["Jugador inscripto"] },
  capitan: { name: "Capitán", color: 0x3498db, hoist: true },
  hierro: { name: "Hierro", color: 0x5d5d5d, antes: ["Iron"] },
  bronce: { name: "Bronce", color: 0x8c5a3c, antes: ["Bronze"] },
  plata: { name: "Plata", color: 0xa8b2b9, antes: ["Silver"] },
  oro: { name: "Oro", color: 0xd4af37, antes: ["Gold"] },
};

// Roles que ven la categoría STAFF y los tickets, y escriben en canales oficiales
const ROLES_STAFF = ["staff", "arbitro"];

// Roles de jugadores: se usan para verificar que no vean canales privados
const ROLES_JUGADOR = [
  "cuentaVinculada",
  "competidor",
  "capitan",
  "hierro",
  "bronce",
  "plata",
  "oro",
];

// ----- Categorías y canales -----
// acceso:
//   'lectura'  → los jugadores leen pero no escriben; staff y árbitros sí
//   'casters'  → canal de voz donde solo hablan casters y staff
//   'privado'  → oculto para todos menos el staff
// soloSiExiste: no se crea, solo se mueve si ya está (canales propios de Discord)
// mensaje: clave del texto oficial que el bot publica y fija en el canal
const ESTRUCTURA = [
  {
    key: "info",
    categoria: "📢 INFO",
    canales: [
      { key: "bienvenida", name: "bienvenida", type: TEXTO, acceso: "lectura" },
      { key: "reglas", name: "reglas", type: TEXTO, acceso: "lectura" },
      { key: "anuncios", name: "anuncios", type: TEXTO, acceso: "lectura" },
      { key: "calendario", name: "calendario", type: TEXTO, acceso: "lectura" },
      {
        key: "primerosPasos",
        name: "primeros-pasos",
        type: TEXTO,
        acceso: "lectura",
        mensaje: "primerosPasos",
        topic: "Cómo crear tu cuenta, vincular Riot y formar un equipo",
      },
      {
        key: "vincularCuenta",
        name: "vincular-cuenta",
        type: TEXTO,
        acceso: "lectura",
        mensaje: "vincularCuenta",
        topic: "Cómo conectar Discord con EloShape",
      },
      {
        key: "estadoServicio",
        name: "estado-del-servicio",
        type: TEXTO,
        acceso: "lectura",
        mensaje: "estadoServicio",
        topic: "Mantenimientos e incidentes de EloShape",
      },
    ],
  },
  {
    key: "torneos",
    categoria: "🏆 TORNEOS",
    canales: [
      {
        key: "inscripciones",
        name: "inscripciones",
        type: TEXTO,
        acceso: "lectura",
        mensaje: "inscripciones",
        topic: "Información oficial de inscripciones",
      },
      {
        key: "semiSplits",
        name: "semi-splits",
        type: TEXTO,
        acceso: "lectura",
        mensaje: "semiSplits",
        topic: "Información oficial de semi-splits",
      },
      {
        key: "brackets",
        name: "brackets",
        type: TEXTO,
        acceso: "lectura",
        mensaje: "brackets",
        topic: "Brackets oficiales",
      },
      {
        key: "resultados",
        name: "resultados",
        type: TEXTO,
        acceso: "lectura",
        mensaje: "resultados",
        topic: "Resultados oficiales confirmados en la web",
      },
      {
        key: "ranking",
        name: "ranking",
        type: TEXTO,
        acceso: "lectura",
        mensaje: "ranking",
        topic: "Ranking oficial",
      },
      {
        key: "reportarPartida",
        name: "reportar-partida",
        type: TEXTO,
        acceso: "lectura",
        mensaje: "reportarPartida",
        topic: "Los resultados se reportan y confirman solo desde la web",
      },
    ],
  },
  {
    key: "comunidad",
    categoria: "💬 COMUNIDAD",
    canales: [
      { key: "general", name: "general", type: TEXTO },
      {
        key: "buscarEquipo",
        name: "buscar-equipo",
        type: TEXTO,
        topic: "LFT: jugadores que buscan equipo",
      },
      {
        key: "buscarJugadores",
        name: "buscar-jugadores",
        type: TEXTO,
        mensaje: "buscarJugadores",
        topic: "LFP: capitanes que necesitan completar su roster",
      },
      {
        key: "scrims",
        name: "scrims",
        type: TEXTO,
        mensaje: "scrims",
        topic: "Buscá rivales de práctica. Incluí el enlace a tu publicación en la web",
      },
      { key: "clips", name: "clips", type: TEXTO },
      { key: "memes", name: "memes", type: TEXTO },
    ],
  },
  {
    key: "mejorar",
    categoria: "🎓 MEJORAR",
    canales: [
      { key: "coaching", name: "coaching", type: TEXTO },
      { key: "buildsYRunas", name: "builds-y-runas", type: TEXTO },
      { key: "vods", name: "vods", type: TEXTO },
    ],
  },
  {
    key: "soporte",
    categoria: "🆘 SOPORTE",
    canales: [
      { key: "ayuda", name: "ayuda", type: TEXTO, topic: "Consultas generales" },
      {
        key: "abrirTicket",
        name: "abrir-ticket",
        type: TEXTO,
        acceso: "lectura",
        topic: "Tocá el botón para abrir un ticket privado con el staff",
      },
    ],
  },
  {
    key: "voz",
    categoria: "🔊 VOZ",
    canales: [
      { key: "lobby", name: "Lobby", type: VOZ },
      // Las partidas se crean con !partida: una categoría y dos voces privadas.
      { key: "casteo", name: "Casteo/Stream", type: VOZ, acceso: "casters" },
    ],
  },
  {
    // Acá el bot crea los espacios privados de cada equipo con !equipo crear
    key: "equipos",
    categoria: "🛡️ EQUIPOS",
    canales: [],
  },
  {
    // Acá el bot crea los tickets privados
    key: "tickets",
    categoria: "🎫 TICKETS",
    acceso: "privado",
    canales: [],
  },
  {
    key: "staff",
    categoria: "🔒 STAFF",
    acceso: "privado",
    canales: [
      {
        key: "coordinacion",
        name: "coordinacion",
        type: TEXTO,
        topic: "Coordinación general del staff",
      },
      {
        key: "operacionTorneos",
        name: "operacion-torneos",
        type: TEXTO,
        topic: "Operación del día a día de los torneos",
      },
      {
        key: "disputas",
        name: "disputas",
        type: TEXTO,
        topic: "Disputas de resultados y sanciones",
      },
      {
        key: "alertasBot",
        name: "alertas-bot",
        type: TEXTO,
        topic: "Errores y avisos automáticos del bot",
      },
      { key: "moderatorOnly", name: "moderator-only", type: TEXTO, soloSiExiste: true },
    ],
  },
];

// ----- Textos oficiales -----
// Cada función recibe `url(ruta)` y devuelve { titulo, texto }.
const MENSAJES = {
  primerosPasos: (url) => ({
    titulo: "🚀 Primeros pasos en EloShape",
    texto: [
      "EloShape está en pre-lanzamiento. Durante el mantenimiento, la web pública muestra “Próximamente” y el acceso a la plataforma todavía no está abierto.",
      `**1. Cuando se habilite el acceso**, creá tu cuenta en ${url("registro")}.`,
      `**2. Vinculá tu cuenta de Riot** desde tu panel: ${url("perfil")}.`,
      "**3. La conexión de Discord con la web está pendiente.** Avisaremos en <#vincularCuenta> cuando esté disponible.",
      `**4. Explorá los equipos** en ${url("equipos")} y gestioná el tuyo en ${url("gestionarEquipo")}. Para reclutar, usá <#buscarEquipo> o <#buscarJugadores>.`,
      "**5. Consultá <#inscripciones> cuando se anuncie la apertura de torneos.",
    ].join("\n\n"),
  }),
  vincularCuenta: (url) => ({
    titulo: "🔗 Vincular Discord con EloShape — próximamente",
    texto: [
      "La vinculación de Discord con la web todavía no está disponible. Actualmente no existe un botón “Conectar Discord”.",
      "Cuando se implemente, la cuenta se conectará mediante autorización de Discord y el bot podrá asignar el rol **Cuenta vinculada**.",
      "Mientras tanto, pertenecer al servidor no verifica ni vincula tu cuenta de EloShape.",
      "No compartas contraseñas ni tokens. Si necesitás ayuda, usá <#abrirTicket>.",
    ].join("\n\n"),
  }),
  estadoServicio: (url) => ({
    titulo: "🛠️ Estado del servicio",
    texto: [
      "EloShape está en pre-lanzamiento. Los avisos de mantenimiento e incidentes se publican en este canal.",
      `La página de “Próximamente” está en ${url("estado")}. No es un panel de estado automático.`,
      "Si tenés un problema, avisá en <#abrirTicket>.",
    ].join("\n\n"),
  }),
  inscripciones: (url) => ({
    titulo: "📝 Inscripciones",
    texto: [
      "La apertura de inscripciones se anunciará cuando termine el pre-lanzamiento.",
      `Los torneos y sus requisitos se consultan en ${url("inscripciones")}. Las inscripciones se realizan desde la web.`,
      "La web valida división, región, elegibilidad, cuenta de Riot, roster y demás requisitos del torneo. Si exige check-in, también hay que completarlo.",
      "La vinculación de Discord todavía no está implementada y no debe anunciarse como requisito activo.",
      "El rol **Competidor habilitado** representará la elegibilidad competitiva aprobada del perfil; inscribirse en un torneo no equivale a recibir esa aprobación.",
    ].join("\n\n"),
  }),
  semiSplits: (url) => ({
    titulo: "📅 Semi-splits",
    texto: `Fechas, formato, qualifiers y playoffs: ${url("semiSplits")}\n\nDisponibles cuando se habilite el acceso. Las consultas van a <#ayuda>.`,
  }),
  brackets: (url) => ({
    titulo: "🗂️ Brackets oficiales",
    texto: `Entrá a ${url("brackets")} y abrí el torneo correspondiente para ver su bracket. Los cruces oficiales se gestionan desde la web.`,
  }),
  resultados: (url) => ({
    titulo: "✅ Resultados oficiales",
    texto: `Acá se publicarán resultados confirmados oficialmente. Consultá los partidos y resultados dentro de cada torneo en ${url("resultados")}. La publicación automática en Discord está pendiente.`,
  }),
  ranking: (url) => ({
    titulo: "📊 Ranking oficial",
    texto: `El ranking oficial está en ${url("ranking")}. Los puntos se obtienen por resultados oficiales del circuito; los scrims no otorgan puntos.`,
  }),
  reportarPartida: (url) => ({
    titulo: "🎮 Cómo reportar una partida",
    texto: [
      `**1.** Abrí tu panel en ${url("partidas")} y seleccioná la partida correspondiente. Cada partido tiene su enlace propio /matches/{identificador}.`,
      "**2.** El participante autorizado —el capitán del roster registrado, en torneos por equipos— carga el marcador. Puede agregar una nota y un enlace de evidencia opcional.",
      "**3.** El rival autorizado confirma el resultado o abre una disputa desde la misma página.",
      "**4.** El resultado se hace oficial al confirmarse o al resolverse por el staff mediante las herramientas de la web.",
      "**Los mensajes en Discord no modifican el resultado oficial.** Para ayuda, usá <#abrirTicket>.",
    ].join("\n\n"),
  }),
  buscarJugadores: (url) => ({
    titulo: "🔎 Buscar jugadores",
    texto: [
      "Canal para capitanes que necesitan completar su roster.",
      "Formato sugerido: posición que buscás, división, horarios y enlace a tu equipo.",
      `Gestioná integrantes e invitaciones en ${url("gestionarEquipo")}. El directorio público está en ${url("equipos")}.`,
    ].join("\n\n"),
  }),
  scrims: (url) => ({
    titulo: "⚔️ Scrims",
    texto: [
      `Cuando esté habilitada la plataforma, entrá a ${url("scrims")} y seleccioná **Scrim Finder**.`,
      "Los capitanes pueden publicar disponibilidad y desafiar equipos. El capitán anfitrión acepta o rechaza el desafío desde la web.",
      "Formato sugerido para coordinar acá: división, fecha, hora, BO1/BO3/BO5 y nombre o referencia de la publicación. Actualmente no existe un enlace individual propio para cada scrim.",
      "Los scrims son práctica: no modifican puntos, rankings ni clasificación a playoffs. Su publicación automática en Discord está pendiente.",
    ].join("\n\n"),
  }),
};

// ----- Automatizaciones pendientes -----
// Se listan en ids.json y en la respuesta de !adaptar.
const PENDIENTES = [
  'Implementar la vinculación de Discord en la web y asignar "Cuenta vinculada" tras verificarla; retirarlo al desvincular. Hoy la vinculación no existe.',
  'Asignar "Competidor habilitado" según profiles.eligibility=eligible; retirarlo al perder la elegibilidad. La inscripción a un torneo es un estado distinto (hoy: a mano).',
  'Asignar y retirar "Capitán" según el equipo y la división (Hierro/Bronce/Plata/Oro) según el perfil de la web (hoy: a mano).',
  "Crear y actualizar los espacios privados de equipo según los rosters de la web (hoy: !equipo crear/agregar/quitar).",
  "Publicar brackets, resultados confirmados y ranking automáticamente desde la web (hoy: los canales enlazan a la web).",
  "Publicar en #scrims las nuevas publicaciones de la web (hoy: los jugadores pegan el enlace).",
  "Publicar mantenimientos e incidentes en #estado-del-servicio desde la web (hoy: a mano).",
  "Enviar disputas abiertas en la web a #disputas (hoy: tickets o aviso manual).",
];

module.exports = {
  RUTAS,
  ROLES,
  ROLES_STAFF,
  ROLES_JUGADOR,
  ESTRUCTURA,
  MENSAJES,
  PENDIENTES,
  TEXTO,
  VOZ,
};
