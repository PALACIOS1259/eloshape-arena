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
  inicio: "/",
  terminos: "/terms",
  privacidad: "/privacy",
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
      {
        key: "accesoBeta",
        name: "acceso-beta",
        type: TEXTO,
        acceso: "lectura",
        mensaje: "accesoBeta",
        topic: "Información de acceso y espera de aprobación para la beta",
      },
      {
        key: "bienvenida",
        mensaje: "bienvenida",
        name: "bienvenida",
        type: TEXTO,
        acceso: "lectura",
      },
      { key: "reglas", mensaje: "reglas", name: "reglas", type: TEXTO, acceso: "lectura" },
      { key: "anuncios", mensaje: "anuncios", name: "anuncios", type: TEXTO, acceso: "lectura" },
      {
        key: "calendario",
        mensaje: "calendario",
        name: "calendario",
        type: TEXTO,
        acceso: "lectura",
      },
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
        key: "reglamentoCompetitivo",
        name: "reglamento-competitivo",
        type: TEXTO,
        acceso: "lectura",
        mensaje: "reglamentoCompetitivo",
        topic: "Reglas base de competición; cada torneo publica sus condiciones específicas",
      },
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
      { key: "general", mensaje: "general", name: "general", type: TEXTO },
      {
        key: "buscarEquipo",
        mensaje: "buscarEquipo",
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
      { key: "clips", mensaje: "clips", name: "clips", type: TEXTO },
      { key: "memes", mensaje: "memes", name: "memes", type: TEXTO },
    ],
  },
  {
    key: "mejorar",
    categoria: "🎓 MEJORAR",
    canales: [
      { key: "coaching", mensaje: "coaching", name: "coaching", type: TEXTO },
      { key: "buildsYRunas", mensaje: "buildsYRunas", name: "builds-y-runas", type: TEXTO },
      { key: "vods", mensaje: "vods", name: "vods", type: TEXTO },
    ],
  },
  {
    key: "soporte",
    categoria: "🆘 SOPORTE",
    canales: [
      { key: "ayuda", mensaje: "ayuda", name: "ayuda", type: TEXTO, topic: "Consultas generales" },
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
  bienvenida: (url) => ({
    titulo: "👋 Bienvenido a EloShape",
    texto: [
      "**Tu equipo. Tu división. Tu circuito.** EloShape reúne jugadores de League of Legends que quieren competir, practicar y mejorar en equipo.",
      "Empezá por <#reglas> y <#primerosPasos>. Si todavía no tenés el rol **Beta tester**, es normal que veas pocos canales: estás en la zona de bienvenida y acceso.",
      "Consultá <#accesoBeta> para conocer cómo funciona la aprobación. Entrar al servidor no te agrega automáticamente a la whitelist ni te inscribe en un torneo.",
      "Cuando te aprueben, vas a poder participar en comunidad, buscar equipo y coordinar prácticas. Las salas privadas de cada equipo y partida se habilitan solo a sus integrantes y al staff.",
      `**Web oficial:** ${url("inicio")}\n**Novedades:** <#anuncios> · **Ayuda:** <#ayuda> · **Soporte privado:** <#abrirTicket>`,
      "Competí con respeto. Ayudá a construir un circuito al que den ganas de volver.",
    ].join("\n\n"),
  }),
  reglas: (url) => ({
    titulo: "📜 Reglas del servidor",
    texto: [
      "**1 · Respeto.** No se permite acoso, discriminación, amenazas, humillaciones ni ataques personales. La rivalidad queda dentro del juego.",
      "**2 · Privacidad y seguridad.** No publiques datos personales de otra persona, capturas de conversaciones privadas sin permiso, contraseñas ni tokens. No suplantes jugadores, equipos o staff.",
      "**3 · Contenido apropiado.** No compartas contenido sexual, violencia explícita, enlaces maliciosos, estafas ni archivos sospechosos.",
      "**4 · Cada tema en su canal.** Evitá spam, mensajes repetidos y menciones masivas. Publicidad, ventas e invitaciones a otros servidores requieren autorización del staff.",
      "**5 · Acceso y roles.** La aprobación de beta y la habilitación para competir son procesos distintos. No intentes eludir permisos, usar cuentas ajenas ni hacerte pasar por un miembro aprobado.",
      "**6 · Juego limpio.** No se permiten trampas, scripts, explotación deliberada de fallos, boosting, account sharing, manipulación de división o acuerdos para falsear resultados.",
      "**7 · Conflictos.** Reportá problemas por <#abrirTicket>; no organices ataques ni discusiones públicas contra otros jugadores. El staff revisa el contexto y la evidencia.",
      "**8 · Moderación.** Según gravedad y reincidencia, el staff puede advertir, restringir participación o retirar acceso al servidor. El motivo de la medida se comunica a la persona afectada y puede revisarse por ticket.",
      `Al participar, respetá estas reglas. Los términos de la plataforma y la política de privacidad se consultan en ${url("terminos")} y ${url("privacidad")}. Los cambios de reglas se anuncian en <#anuncios>.`,
    ].join("\n\n"),
  }),
  reglamentoCompetitivo: () => ({
    titulo: "🏆 Reglamento base de competición",
    texto: [
      "**1 · Inscripción oficial.** La inscripción y el check-in, cuando corresponda, se realizan en la web. Un mensaje en Discord, un rol o una invitación al servidor no reemplazan estos pasos.",
      "**2 · Cuenta y elegibilidad.** Cada jugador participa con su propia cuenta de Riot y debe cumplir división, región y requisitos publicados para el torneo. No se admiten suplantación, cuentas prestadas ni datos falsos para obtener ventaja.",
      "**3 · Roster registrado.** En 5 contra 5 juegan cinco integrantes por lado del roster registrado y bloqueado para ese torneo. Cambiar el equipo en la web después del cierre no modifica ese roster. Los cambios se validan antes del cierre; no se incorporan jugadores ajenos al roster bloqueado.",
      "**4 · Condiciones del evento.** Antes de competir, leé las reglas del torneo: formato de serie, servidor, horarios, check-in, preparación del lobby, pausas y tolerancia de llegada. La hora debe incluir zona horaria. No supongas que un torneo usa las condiciones de otro.",
      "**5 · Coordinación y voces.** Cada capitán coordina a su equipo. Usá la voz asignada a tu lado y el canal de coordinación de la partida. No ingreses a la voz rival ni difundas sus comunicaciones; staff y árbitros pueden entrar para supervisar.",
      "**6 · Incidentes.** Avisá de una desconexión, ausencia, fallo de plataforma o problema de lobby al árbitro o por ticket. No acuerdes unilateralmente una pausa, una repetición o un walkover. El staff debe registrar la decisión y su motivo.",
      "**7 · Resultados.** El participante autorizado reporta el marcador en la página de la partida; el rival autorizado confirma o disputa. Guardá capturas y datos del encuentro. No confirmes un resultado falso ni publiques un marcador como oficial antes de su validación.",
      "**8 · Disputas.** Explicá hechos, ID de partida, equipos y evidencia por el flujo de disputa de la web y, si necesitás asistencia, por ticket. Un mensaje en Discord no cambia el resultado. No alteres ni fabriques evidencia.",
      "**9 · Integridad.** Están prohibidos los resultados pactados, pérdida intencional para beneficiar a terceros y cualquier intento de manipular puntos o clasificación. Las prácticas y scrims no otorgan puntos del circuito.",
      "**10 · Resolución.** El staff evalúa incidencias y aplica las medidas previstas en las reglas publicadas del evento. Si falta una condición o hay contradicciones, pedí aclaración antes de jugar; no se presume un castigo o plazo que no fue anunciado.",
    ].join("\n\n"),
  }),
  anuncios: () => ({
    titulo: "📢 Anuncios oficiales",
    texto: [
      "Acá se publican novedades de EloShape: invitaciones a beta, aperturas de torneos, cambios de reglas y avisos de la organización.",
      "Una convocatoria debe indicar a quién está dirigida, qué se abre, fecha y hora con zona horaria, requisitos y enlace oficial. Sin anuncio de apertura no hay una fecha de acceso prometida.",
      "El staff no te va a pedir contraseñas, tokens ni pagos por mensaje privado para habilitar un rol. Ante una cuenta sospechosa, usá <#abrirTicket>.",
      "Para consultas usá <#ayuda>; para datos personales o problemas con tu cuenta, abrí un ticket. Este canal es de solo lectura para jugadores.",
    ].join("\n\n"),
  }),
  calendario: (url) => ({
    titulo: "🗓️ Calendario del circuito",
    texto: [
      `Consultá los eventos en ${url("inscripciones")} y los splits en ${url("semiSplits")}.`,
      "Cada convocatoria debe indicar fecha, hora y zona horaria, apertura/cierre de inscripción y ventana de check-in si corresponde. Revisá el horario del evento; no asumas que coincide con tu hora local.",
      "Cualquier reprogramación se comunica en <#anuncios> y en los canales del torneo. No hay fechas confirmadas por el solo hecho de crear un canal.",
    ].join("\n\n"),
  }),
  general: () => ({
    titulo: "💬 Comunidad EloShape",
    texto:
      "Presentate, charlá y compartí lo que estás jugando. Respetá <#reglas> y evitá spam.\n\nPara buscar equipo usá <#buscarEquipo>; para reclutar, <#buscarJugadores>; para practicar, <#scrims>. Las consultas privadas y reportes van a <#abrirTicket>.",
  }),
  buscarEquipo: (url) => ({
    titulo: "🛡️ Busco equipo · LFT",
    texto: [
      "Publicá posición principal/secundaria, división, región/servidor, disponibilidad con zona horaria y qué tipo de equipo buscás. Compartí tu perfil público si lo tenés disponible.",
      "**Ejemplo:** Support / Mid · Oro · LAS · martes y jueves 20:00–23:00 ART · busco equipo para competir y practicar.",
      `Directorio de equipos: ${url("equipos")}. La incorporación se confirma por los mecanismos del equipo en la web; responder una publicación no te agrega a un roster de torneo.`,
      "No publiques tu correo, teléfono ni credenciales. Evitá repetir el mismo aviso; actualizá el que ya publicaste.",
    ].join("\n\n"),
  }),
  clips: () => ({
    titulo: "🎬 Clips y jugadas",
    texto:
      "Compartí tus mejores jugadas con campeón, contexto y un enlace seguro. Dale crédito al autor si el contenido no es tuyo.\n\nNo uses clips para hostigar a una persona ni publiques comunicaciones privadas sin permiso. Evitá duplicados y respetá <#reglas>.",
  }),
  memes: () => ({
    titulo: "😄 Memes de la comunidad",
    texto:
      "Humor sobre el juego y el circuito, con respeto. Nada de acoso, discriminación, contenido sexual ni datos personales.\n\nEvitá spam y no uses una broma para convertir a otro miembro en blanco de ataques. Si alguien pide que pares, frená.",
  }),
  coaching: () => ({
    titulo: "🎓 Aprender y mejorar",
    texto:
      "Para pedir ayuda, indicá posición, campeón, división y qué querés mejorar. Si respondés, explicá el motivo de tu consejo y mantené un trato respetuoso.\n\nNo se permiten ofertas de boosting ni acceso a cuentas ajenas. Servicios pagos y publicidad requieren autorización del staff. Las dudas de resultados o sanciones van a <#abrirTicket>.",
  }),
  buildsYRunas: () => ({
    titulo: "🧩 Builds y runas",
    texto:
      "Compartí campeón, posición, parche y situación de partida. Explicá cuándo funciona tu propuesta y sus limitaciones.\n\nSi usás una guía ajena, indicá la fuente. No presentes consejos de un parche anterior como si fueran actuales y no compartas scripts ni herramientas de trampa.",
  }),
  vods: () => ({
    titulo: "📼 Revisión de partidas · VODs",
    texto:
      "Compartí un enlace seguro, campeón/posición, parche y los minutos que querés revisar. Planteá una pregunta concreta: visión, decisiones, peleas o manejo de oleadas.\n\nSubí material que tengas permiso de compartir; ocultá datos personales. Las devoluciones deben centrarse en decisiones de juego, sin ataques al jugador.",
  }),
  ayuda: () => ({
    titulo: "🆘 Cómo pedir ayuda",
    texto:
      "Para dudas generales, contanos qué intentabas hacer y en qué parte te trabaste. Revisá <#primerosPasos> y <#accesoBeta> antes de consultar por acceso.\n\nPara tu cuenta, correo de invitación, denuncias o evidencia sensible, usá <#abrirTicket>. No publiques contraseñas, tokens ni datos personales acá. Un ticket es una consulta; no garantiza una invitación ni un plazo de respuesta.",
  }),
  accesoBeta: () => ({
    titulo: "🧪 Acceso a la beta de EloShape",
    texto: [
      "Estás en el espacio de bienvenida. Hasta recibir el rol **Beta tester**, solo vas a ver los canales de información, acceso y soporte.",
      "Las invitaciones se anuncian por el staff en <#anuncios>. Entrar al servidor no registra una solicitud ni aprueba automáticamente tu cuenta.",
      "El rol **Beta tester** habilita los canales generales de comunidad, torneos y voz. La aprobación del correo para entrar a la web y el rol de Discord son distintos: el staff debe verificar ambos.",
      "Los espacios privados de equipos, partidas y staff mantienen sus permisos propios. Ser tester no te habilita automáticamente para competir.",
      "Si necesitás ayuda con tu acceso, usá <#abrirTicket>. No publiques contraseñas ni tokens.",
    ].join("\n\n"),
  }),
  primerosPasos: (url) => ({
    titulo: "🚀 Primeros pasos en EloShape",
    texto: [
      "**Si estás esperando acceso:** leé <#reglas>, revisá <#accesoBeta> y seguí <#anuncios>. No intentes inscribirte ni reclamar roles competitivos antes de ser aprobado.",
      `**1. Cuando el staff confirme tu invitación y se habilite la beta**, usá el correo aprobado para crear tu cuenta en ${url("registro")} y confirmá el email. Si ya tenés cuenta, iniciá sesión con ese correo.`,
      `**2. Vinculá tu cuenta de Riot** desde tu panel: ${url("perfil")}.`,
      "**3. La conexión de Discord con la web está pendiente.** Avisaremos en <#vincularCuenta> cuando esté disponible.",
      `**4. Explorá los equipos** en ${url("equipos")} y gestioná el tuyo en ${url("gestionarEquipo")}. Para reclutar, usá <#buscarEquipo> o <#buscarJugadores>.`,
      "**5.** Leé <#reglamentoCompetitivo> y los requisitos del torneo en <#inscripciones>. Completá inscripción y check-in cuando corresponda. Ser tester no equivale a estar habilitado para competir.",
    ].join("\n\n"),
  }),
  vincularCuenta: (url) => ({
    titulo: "🔗 Vincular Discord con EloShape — próximamente",
    texto: [
      "Durante esta etapa, coordiná la verificación de tu cuenta con el staff por <#abrirTicket>. No alcanza con entrar al servidor para vincular tu identidad con EloShape.",
      "Las instrucciones para conectar Discord directamente desde la web se publicarán acá cuando esa opción esté disponible. Seguí ese proceso antes de reclamar el rol **Cuenta vinculada**.",
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
      "Si tenés una duda sobre elegibilidad o identidad de tu cuenta, consultá por <#abrirTicket> antes del cierre de inscripción.",
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
