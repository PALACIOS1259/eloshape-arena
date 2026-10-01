# Actualización del bot de EloShape

Todavía no hay testers: no cargues correos ni actives la beta. `!adaptar` y `!beta preparar`
crean el espacio de beta sin dar el rol a ningún jugador.

## Instalar sobre tu bot actual

1. Detené el bot con Ctrl+C y guardá una copia de tu carpeta.
2. Copiá `bot.js`, `estructura.cjs`, `competicion.cjs`, `beta-sync.cjs` y `espera.cjs` en esa carpeta.
   Conservá tu `ids.json` y tu configuración de `DISCORD_TOKEN`. El bot nuevo lee esos IDs.
   `estructura.js` anterior deja de usarse: la configuración nueva se llama `estructura.cjs`.
3. Arrancá con `node bot.js` usando Node 22 o posterior y tu instalación de discord.js v14.
4. En Discord, ejecutá `!adaptar` con tu cuenta administradora. Después, `!ayuda`.

La URL predeterminada es https://eloshape.com.ar. Si necesitás otra, definí `ELOSHAPE_URL`.
No se incluye ningún token en estos archivos. El bot conserva equipos, tickets, IDs y canales
anteriores; no borra las voces Partida 1–8. Las nuevas partidas usan voces separadas.
Los comandos nuevos funcionan únicamente en el servidor que figura en `ids.json`.

## Split o torneo con nombre variable

El nombre lo elegís vos; Rosario 1 y Rosario 2 son ejemplos. El ID debe ser el identificador
estable de la entidad de la web, no el número visible de la partida.

```text
!torneo crear ID_DE_LA_WEB | Split Rosario 2
```

Crea una categoría con anuncios, reglas, bracket y resultados. Inicialmente la ve el staff.
Podés sumar participantes con el mismo comando, sin duplicar canales:

```text
!torneo crear ID_DE_LA_WEB | Split Rosario 2 | @jugador1 @jugador2
```

Los participantes también se agregan al crear las partidas. El bot prepara los canales;
el contenido específico de reglas, bracket y resultados todavía lo publica el staff.

## Partida 5 contra 5

```text
!partida crear ID_PARTIDA_WEB | ID_DE_LA_WEB | 1 | Nombre equipo A | @a1 @a2 @a3 @a4 @a5 | Nombre equipo B | @b1 @b2 @b3 @b4 @b5
```

Reemplazá cada @ por una mención real. Se requieren cinco personas distintas por lado,
que estén en el servidor. La partida tiene una categoría propia con las dos voces y un
canal de coordinación. Cada jugador accede solo a la voz de su equipo. Staff y Árbitro
pueden entrar a ambas. No hay cupo que impida entrar al árbitro.
Repetir el mismo ID actualiza los canales existentes. Usar otro ID crea otra partida.
No reutilices el ID de una partida para otra. Discord permite categorías de un solo nivel;
el nombre identifica el torneo y el número de partida.

Este comando es un puente manual: todavía falta verificar la vinculación de cuentas de
Discord en la web antes de automatizar la creación desde los rosters. No se inventan
asociaciones entre correos, nombres de jugador e IDs de Discord.

## Whitelist, cuando tengas testers

La whitelist está implementada en staging y sigue vacía y desactivada. Producción todavía
requiere promover las migraciones y el código. En la web, el administrador agrega correos
e IDs de Discord verificados al panel de beta. Ser tester no concede elegibilidad competitiva.

El código incluye un endpoint exclusivo para que el bot consulte IDs aprobados, sin correos:
`discord-beta-snapshot`. Está protegido con un secreto propio del bot; la clave privilegiada
de Supabase se queda en el backend. El endpoint y su configuración se preparan en staging
antes de activar la sincronización. No está activado en producción.

Configuración del proceso del bot, solo al conectar ese endpoint:

```text
DISCORD_MEMBERS_INTENT=true
BETA_SYNC_ENABLED=true
BETA_SNAPSHOT_URL=https://PROYECTO.supabase.co/functions/v1/discord-beta-snapshot
DISCORD_BETA_SYNC_TOKEN=SECRETO_PROPIO_COMPARTIDO_CON_EL_BACKEND
```

El token debe tener al menos 32 caracteres y se guarda fuera del código. Nunca mandes
credenciales por Discord ni las agregues a `ids.json`. Para usar un archivo de entorno
local con Node 22: `node --env-file=.env bot.js`; los valores deben ser reales, no estos ejemplos.
Activá **Server Members Intent** en Discord Developer Portal antes de poner esa variable
en true. El bot ya requiere **Message Content Intent** para los comandos existentes.
Su rol debe quedar por encima de **Beta tester** para poder asignarlo o retirarlo.

`!beta preparar` crea canales de beta sin asignar accesos. `!beta sincronizar` consulta la
whitelist una vez. Con sincronización habilitada, también consulta al iniciar y cada minuto.
Un fallo de red, credenciales o formato aborta la consulta sin convertirla en una lista vacía.
Con beta desactivada en la web, la sincronización pausa y conserva los roles.
No actives `BETA_SYNC_ENABLED` hasta configurar y probar el endpoint.

## Vista de espera en Discord

Después de ejecutar `!adaptar`, quien no tenga **Beta tester** solo verá:

- Bienvenida, reglas, anuncios y primeros pasos.
- Vincular cuenta, estado del servicio y el nuevo `#acceso-beta`.
- Ayuda y el panel para abrir un ticket privado.

Al asignar **Beta tester**, se habilitan los canales generales de comunidad, torneos
y voz. Staff/Admin y Árbitro conservan acceso para operar. Durante esta etapa, el staff
puede asignar el rol manualmente al aprobar a alguien; la sincronización automática sigue
requiriendo configurar el endpoint y activar la beta en la web. Asignar el rol en Discord
no agrega por sí solo el correo a la whitelist de la web.

Los espacios privados de equipos, partidas, tickets y staff conservan sus permisos propios:
ser tester no abre automáticamente las voces de otro equipo. Los canales públicos antiguos
(Partida 1–8, General, Sala de Voz y similares) también se restringen para que los nuevos
miembros no entren por esos accesos. El canal oficial de reglas de Comunidad sigue público.

`!adaptar` reemplaza los permisos específicos de los canales generales que controla esta
vista; elimina grants antiguos que permitirían saltar la espera. No borra canales ni
asigna testers. Revisá con una cuenta sin roles y otra con Beta tester después de aplicarlo.
No se necesita un rol Pendiente ni Server Members Intent para esta vista.

## Mensajes y reglamento del servidor

Esta versión incluye 25 mensajes oficiales y el panel de tickets: bienvenida, reglas
generales, reglamento competitivo, acceso de beta, primeros pasos, avisos, calendario,
reclutamiento, scrims, resultados/ranking, ayuda y guías de comunidad. `!adaptar` los
publica o actualiza con las menciones reales a canales y la URL de EloShape.
El reglamento competitivo tiene su canal de solo lectura dentro de TORNEOS.

`TEXTOS-DEL-SERVIDOR.md` reúne el texto completo para revisar o editar. Los mensajes que
publica el bot están definidos en `estructura.cjs`; editar solo el Markdown no modifica
lo publicado. `GUIA-DEL-TORNEO.md` contiene plantillas de anuncios y reglas particulares
por evento. Completá formato, horarios y condiciones reales antes de abrir inscripciones.
No se agregaron fechas, premios, costos ni sanciones competitivas automáticas.
