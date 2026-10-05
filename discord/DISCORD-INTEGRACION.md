# Conexión de Discord con EloShape

Aplicación: **1555020054142128278**. Servidor: **1547826296149647372**.
El Client ID es público. El Client Secret de OAuth y el token del bot son credenciales
distintas: guardalos directamente en sus configuraciones privadas, nunca en el chat,
en Git ni en `ids.json`. La clave pública de General Information no es el Client Secret.

## Estado de esta entrega

Código de vinculación/desvinculación en `/dashboard`, callback `/auth/discord`, endpoint
limitado y sincronización del rol preparados en staging. No se abre la beta ni se
promueve automáticamente a main. No hay una prueba OAuth real hasta configurar el
proveedor y autorizar una cuenta de prueba.

La migración fue aplicada y `discord-linked-snapshot` desplegado solo en staging.
Al verificar el 5 de octubre, Discord estaba deshabilitado en Auth y el endpoint
respondía `503 sync_not_configured` por falta de su secreto. Ambos se configuran
directamente en Supabase; no se incluyen credenciales en esta entrega.

## 1. Discord Developer Portal → OAuth2

En la aplicación indicada, agregá los callbacks de Supabase a Redirects:

- Staging: `https://ujlzcdmotrihwgjshdcs.supabase.co/auth/v1/callback`
- Producción, cuando se promueva: `https://hdlktzhjsswzcbgrnhql.supabase.co/auth/v1/callback`

Guardá los cambios. Copiá el Client Secret desde OAuth2 solo para introducirlo directamente
en Supabase. No se necesita invitar nuevamente al bot al servidor ni solicitar `guilds.join`.
El flujo confirma identidad; no agrega automáticamente a una persona al servidor.

## 2. Supabase → Authentication

Primero usá el proyecto staging **ujlzcdmotrihwgjshdcs**.

En Sign In / Providers, activá Discord y cargá:

- Client ID: `1555020054142128278`
- Client Secret: el de OAuth2, guardado directamente en ese panel.

Habilitá **Allow manual linking**. La web usa `linkIdentity`, no crea otra cuenta para
el jugador. En URL Configuration agregá a Redirect URLs:

`https://eloshape-arena-git-staging-iron-metrics.vercel.app/auth/discord`

Cuando se promueva a main, repetí la configuración en el proyecto productivo, con:

`https://eloshape.com.ar/auth/discord`

No intercambies los callbacks ni claves entre proyectos. Mantener manual linking
habilitado no habilita por sí solo el registro ni concede acceso a la beta.

## 3. Endpoint privado del bot

La migración `discord_verified_link_snapshot` permite que el backend lea únicamente
IDs OAuth vinculados a perfiles. Los jugadores no pueden llamar esa RPC ni editar
su fuente (`auth.identities`) para obtener el rol. El endpoint se autentica antes de
leer datos y nunca entrega correos, contraseñas ni tokens OAuth.

Usa el secreto limitado `DISCORD_BETA_SYNC_TOKEN` del bot, compartido con los Secrets
de Edge Functions del mismo proyecto. Debe tener al menos 32 caracteres aleatorios.
Si ya existe para beta, se reutiliza sin mostrarlo. El bot no necesita service_role.

## 4. Configuración local del bot

Conservá `ids.json`, ejecutá `!ids` si falta `roles.cuentaVinculada.id` y colocá el rol
del bot por encima de **Cuenta vinculada**, con Manage Roles. Activá **Server Members
Intent** en Developer Portal → Bot. Message Content Intent ya lo requieren los comandos.

Ejemplo para CMD de Windows, después de configurar el secreto en Supabase:

```bat
set "DISCORD_MEMBERS_INTENT=true"
set "DISCORD_LINK_SYNC_ENABLED=true"
set "DISCORD_LINKED_SNAPSHOT_URL=https://ujlzcdmotrihwgjshdcs.supabase.co/functions/v1/discord-linked-snapshot"
set "DISCORD_BETA_SYNC_TOKEN=TU_SECRETO_LIMITADO_DEL_BOT"
node bot.js
```

Durante una prueba con staging, usá un servidor de prueba separado y sus propios IDs.
No conectes datos de staging al servidor real: una lista de prueba vacía retiraría
roles Cuenta vinculada existentes. Para el servidor real, habilitá la sincronización
solo después de promover y comprobar el endpoint productivo `hdlktzhjsswzcbgrnhql`.
También podés usar Node 22 con `node --env-file=.env bot.js`; `set` dura solo esa ventana.

No actives `BETA_SYNC_ENABLED` para probar Cuenta vinculada. Son sincronizaciones independientes.

## 5. Verificación real

1. Ingresá con una cuenta EloShape de prueba autorizada para staging.
2. En el perfil elegí Vincular Discord y autorizá en Discord. Verificá que volvés a la
   misma cuenta EloShape y aparece Discord vinculado.
3. En el servidor de prueba, ejecutá `!vinculadas sincronizar`. Debe asignar únicamente
   Cuenta vinculada; no Beta tester, Capitán, división ni Competidor habilitado.
4. Desvinculá desde el perfil y repetí la sincronización: debe retirar el rol.
5. Probá un error de endpoint: no debe interpretarlo como una lista vacía ni retirar roles.

Entrar al servidor no da Cuenta vinculada. La identidad debe autorizarse en la web.
Si el bot está apagado, no actualiza roles hasta volver a iniciar.

## Datos para General Information

Los enlaces públicos actuales son `https://eloshape.com.ar/terms` y
`https://eloshape.com.ar/privacy`. Revisá y publicá en main la cobertura específica
de Discord antes de activar la integración productiva o usarlos para esa revisión.
No pongas nada en Interactions Endpoint URL ni Linked Roles Verification URL para
esta implementación: el bot usa Gateway y un rol normal, no Discord Linked Roles.
La invitación permanente al servidor sigue pendiente para agregarla al sitio.
