# Discord público con beta cerrada

## Estado al 5 de octubre de 2026

La web vinculó una cuenta real en staging y el bot confirmó esa identidad en el
servidor real. La prueba encontró el rol Cuenta vinculada existente: no prueba
todavía asignación ni retirada automáticas para jugadores.

Las 12 migraciones de producto están aplicadas en producción, sin copiar datos de
staging. Las funciones discord-linked-snapshot y discord-beta-snapshot están
desplegadas. Riot sincroniza bajo el mismo control de acceso a beta. Producción
conserva 3 perfiles, 1 equipo, 5 torneos y 0 partidos. Beta desactivada, cero invitados.

## Instalar y publicar la invitación

1. Parar el bot, guardar una copia de su carpeta y copiar los archivos de esta entrega.
2. Conservar ids.json y .env: la entrega no incluye tokens ni reemplaza esos archivos.
3. Iniciar con `node --env-file=.env bot.js` o abrir iniciar-bot.cmd.
4. Ejecutar !adaptar desde una cuenta administradora para actualizar reglas,
   bienvenida y permisos de espera. No asigna testers ni borra canales antiguos.
5. Ejecutar !invitacion: crea o reutiliza una invitación permanente a bienvenida.
   Compartir ese enlace es seguro; nunca compartir .env o tokens.
6. Probar la invitación con una cuenta sin roles. Solo debe ver información,
   acceso-beta y soporte; comunidad, torneos, voces y staff deben quedar ocultos.
7. La publicación puede invitar a entrar al Discord y esperar la beta. No anunciar
   todavía registro público ni inscripción a torneos.

## Activar Cuenta vinculada en producción

1. Discord Developer Portal > OAuth2: agregar
   https://hdlktzhjsswzcbgrnhql.supabase.co/auth/v1/callback.
2. Supabase producción hdlktzhjsswzcbgrnhql > Authentication > Sign In / Providers:
   habilitar Discord con Client ID 1555020054142128278 y Client Secret privado.
   Habilitar Allow manual linking. No usar el token del bot como Client Secret.
3. En URL Configuration agregar https://eloshape.com.ar/auth/discord.
4. En Edge Functions > Secrets guardar DISCORD_BETA_SYNC_TOKEN, con una clave
   aleatoria privada de al menos 32 caracteres. Esa misma clave va en .env del bot.
5. Actualizar .env usando los endpoints de bot-production.env.example, dejando
   ambas sincronizaciones false. Nunca sincronizar el servidor real con staging.
6. Vincular tu Discord desde la cuenta EloShape de producción y ejecutar
   !vinculadas probar. Debe confirmar tu propia identidad productiva.
7. Activar Server Members Intent en Developer Portal. Colocar el bot por encima
   de Cuenta vinculada y Beta tester y comprobar Manage Roles.
8. Cambiar DISCORD_MEMBERS_INTENT=true y DISCORD_LINK_SYNC_ENABLED=true;
   reiniciar. Asigna/retira Cuenta vinculada al iniciar y cada minuto mientras esté online.
9. Probar un jugador autorizado que vincule y desvincule: debe recibir y perder
   únicamente Cuenta vinculada. No concede Beta tester ni elegibilidad.

## Primeros testers

El administrador aprueba sus correos en /admin. No necesita copiar IDs: el backend
combina invitación activa/no vencida, correo confirmado y Discord OAuth verificado.
Los IDs escritos a mano y user_metadata no autorizan roles. Las tablas de whitelist
y los snapshots no son públicos.

Mantener mantenimiento habilitado. Cuando haya testers reales y los controles estén
verificados, activar beta cerrada en /admin, establecer BETA_SYNC_ENABLED=true y
reiniciar. !beta sincronizar permite comprobar una reconciliación. Una revocación,
vencimiento o desvinculación excluye al jugador del próximo snapshot y retira Beta tester.
Apagar beta pausa la sincronización y conserva los roles; no equivale a revocarlos.

El bot debe permanecer online. Cerrar su ventana o apagar la PC detiene comandos,
tickets y sincronización; las invitaciones y permisos ya guardados por Discord persisten.
Las voces de rosters y publicaciones automáticas siguen pendientes de conectar a la web.
