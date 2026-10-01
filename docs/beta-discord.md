# Beta cerrada y salas de competición

## Estado

La migración de whitelist está aplicada y probada en Supabase staging
(`ujlzcdmotrihwgjshdcs`). Está desactivada y no tiene invitaciones reales.
Producción todavía requiere promover las migraciones y el código; mantiene el pre-lanzamiento.
El `bot.js` recibido está integrado en `discord/bot.cjs`, junto con su estructura y
comandos de competición. Instalación externa: `discord/LEEME.md`. No se ha ejecutado en
el servidor Discord real. La sincronización de whitelist requiere configurar el secreto
del endpoint `discord-beta-snapshot` y el entorno del bot antes de activarla.
La función está desplegada en staging con el secreto pendiente: falla cerrada (503),
sin publicar la lista.

## Acceso de beta

La lista se administra desde `/admin`: correo normalizado, ID de Discord opcional verificado
por el staff, revocación y vencimiento. Solo un administrador puede cambiarla.
Los miembros del staff con correo confirmado conservan acceso para operar la beta.

Para iniciar beta: cargar los correos, desplegar con `VITE_MAINTENANCE_MODE=true` y activar
la beta desde el panel. El público conserva `/maintenance`; los invitados entran desde
`/auth` y deben confirmar su email. Una invitación no concede elegibilidad competitiva.
Desactivar la beta restaura las reglas normales de acceso a las API.

La migración incluye un control en la Data API, políticas RLS restrictivas y un trigger
de signup; el frontend y los handlers autenticados verifican la misma lista.
El middleware y `riot-sync` requieren la migración antes de desplegar su código.
La lista no usa `user_metadata`, no se incluye en variables `VITE_*` y no se revela a jugadores.

Los tests de `supabase/tests/closed_beta.test.sql` se ejecutan en una transacción que revierte
todo: invitado, no invitado, email sin confirmar, metadata falsa, revocación, expiración,
signup, RLS, autorización administrativa y snapshot exclusivo de backend.

## Organización de Discord

Discord usa categorías de un solo nivel. El nombre identifica el torneo y la partida.
Crear espacios únicamente para torneos activos y partidas próximas/en juego.

| Categoría                | Canales                                           |
| ------------------------ | ------------------------------------------------- |
| 🏆 Split Rosario 2       | #anuncios, #reglas, #bracket, #resultados         |
| 🎮 Rosario 2 · Partida 1 | Voz del equipo A, voz del equipo B, #coordinacion |
| 🎮 Rosario 2 · Partida 2 | Voz del equipo C, voz del equipo D, #coordinacion |
| 🧪 BETA                  | #anuncios-beta, #feedback-beta, #errores-beta     |

Las voces tienen `userLimit: 0` y permisos para los cinco integrantes del roster de cada
lado, el staff, árbitros y bot. El rival no tiene acceso a la sala contraria.
La categoría de la partida está oculta por defecto; cada canal permite solo sus participantes.
Los canales de beta permiten el rol **Beta tester** y staff; nadie más.
Los jugadores no reciben permisos de administración. No modificar ni borrar canales ajenos.

## Integración del bot

Copiar `discord/competicion.cjs` al directorio del bot e importarlo desde `bot.js`:

```js
const {
  ensureBetaSpace,
  ensureTournamentSpace,
  ensureMatchSpace,
  syncBetaMembers,
} = require("./competicion.cjs");
```

Todas las funciones reciben `guild`, el objeto real `ids` cargado desde `ids.json` y
`persistIds(ids)`, que debe guardar ese mismo objeto. El módulo agrega la propiedad
`competicion` sin reemplazar las claves existentes y persiste cada ID inmediatamente.
Las operaciones se serializan por servidor y repiten ediciones sin crear nuevos canales.
Los comandos que llamen a estas funciones deben ser exclusivos del staff.

Roles de staff del servidor actual:

```js
const staffRoleIds = ["1555024719030517781", "1555024717679689799"];
```

`ensureMatchSpace` recibe `matchId` estable de la web, nombre de torneo, número y:

```js
teamA: { name: 'Nombre real A', memberIds: [/* 5 IDs verificados */] },
teamB: { name: 'Nombre real B', memberIds: [/* 5 IDs verificados */] },
```

No asociar un nombre de usuario ingresado por el jugador directamente a un ID de Discord.
Por ahora, la asociación de invitaciones puede verificarla el staff. La vinculación OAuth
de cuentas con Discord sigue pendiente y debe comprobar identidad antes de automatizar rosters.

La RPC `get_beta_discord_members()` devuelve `{ enabled, member_ids }` sin emails y solo
puede ejecutarse desde un backend autorizado con `service_role`. No entregar esa credencial
al navegador. Conectar el bot a un endpoint protegido del backend o consultar desde su
proceso de servidor con credenciales guardadas en su entorno.
Un fallo al consultar debe abortar: no llamar `syncBetaMembers` con una lista vacía artificial.
Los cambios de whitelist deben sincronizarse al aprobar/revocar y reconciliarse periódicamente;
el bot requiere **Server Members Intent** y un rol superior a **Beta tester**.

El módulo conserva los antiguos canales Partida 1–8. Tras conectar el nuevo flujo, el staff
puede retirarlos cuando estén vacíos. El archivado/eliminación de torneos no se implementa
sin una política acordada, para conservar resultados e historial.

## Endpoint de sincronización

`supabase/functions/discord-beta-snapshot` acepta GET autenticado con
`Authorization: Bearer DISCORD_BETA_SYNC_TOKEN`. La credencial, de al menos 32 caracteres,
es propia de este endpoint y se configura como secreto en Supabase y en el proceso del bot.
No usar el token de Discord ni una clave pública de Supabase para esta función.
`verify_jwt=false` es intencional: el handler implementa autenticación antes de consultar
la RPC privilegiada. Si falta el secreto responde 503 y no lee la base.
El endpoint devuelve exclusivamente `{ enabled, member_ids }`, sin correos y con no-store.

El bot llama al endpoint con timeout y sin seguir redirecciones. Rechaza snapshots inválidos
o errores antes de asignar/quitar roles. Si enabled=false, pausa la reconciliación.
No configura ni activa la beta desde Discord. Los cambios de la lista siguen siendo exclusivos
del administrador de la web. No se cargaron invitados, ni se habilitó sincronización en
producción. Los comandos manuales de torneo y partida no consultan rosters de Supabase.

Los tests de transporte y autenticación verifican errores de red, snapshots malformados,
credenciales inválidas, ausencia de secreto y ausencia de correos en las respuestas.
Los tests del bot verifican separación de voces, acceso del staff, prohibición a jugadores
no autorizados, preservación de IDs/equipos y nombres dinámicos sin duplicados.

## Espera de whitelist en Discord

`discord/espera.cjs` aplica una vista para miembros sin el rol Beta tester. Solo permite
onboarding, reglas, anuncios, acceso-beta, estado, ayuda y apertura de tickets. Los
canales generales restantes y las salas públicas antiguas requieren Beta tester o staff.
Las categorías de partidas, equipos, beta, staff y tickets mantienen sus permisos privados
y no se habilitan a todos los testers. Los canales generales controlados reemplazan sus
overwrite grants anteriores para evitar accesos residuales; sus IDs se guardan en
ids.espera.channelIds para repetir la configuración. El canal de reglas de Comunidad
permanece visible. No se creó una cola de solicitudes ni se dieron aprobaciones.

La vista funciona con @everyone y Beta tester sin asignar un rol adicional al ingresar,
y no requiere Members Intent. La asignación automática sigue pendiente de configurar
el secreto del endpoint y el bot; el staff puede asignar el rol manualmente. La aprobación
de la web y el rol Discord son estados distintos hasta conectar la reconciliación.
