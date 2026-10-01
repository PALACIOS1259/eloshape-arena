# Beta cerrada y salas de competición

## Estado

La migración de whitelist está aplicada y probada en Supabase staging
(`ujlzcdmotrihwgjshdcs`). Está desactivada y no tiene invitaciones reales.
Producción todavía requiere promover las migraciones y el código; mantiene el pre-lanzamiento.
El bot de Discord externo no está modificado: falta su `bot.js` para conectar el módulo.

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

| Categoría              | Canales                                           |
| ---------------------- | ------------------------------------------------- |
| 🏆 Split Chirola       | #anuncios, #reglas, #bracket, #resultados         |
| 🎮 Chirola · Partida 1 | Voz del equipo A, voz del equipo B, #coordinacion |
| 🎮 Chirola · Partida 2 | Voz del equipo C, voz del equipo D, #coordinacion |
| 🧪 BETA                | #anuncios-beta, #feedback-beta, #errores-beta     |

Las voces tienen `userLimit: 0` y permisos para los cinco integrantes del roster de cada
lado, el staff, árbitros y bot. El rival no tiene acceso a la sala contraria.
La categoría de la partida está oculta por defecto; cada canal permite solo sus participantes.
Los canales de beta permiten el rol **Beta tester** y staff; nadie más.
Los jugadores no reciben permisos de administración. No modificar ni borrar canales ajenos.

## Módulo para la IA que desarrolla el bot

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
