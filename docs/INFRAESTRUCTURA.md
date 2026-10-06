# Infraestructura de EloShape — 6 de octubre de 2026

## Implementado

- Web y migraciones versionadas; CI valida aplicación, permisos de base y bot.
- Beta cerrada: correos aprobados desde administración; consulta del estado de
  registro/confirmación; confirmación manual solo para invitados activos.
- Confirmaciones por correo se mantienen habilitadas; el jugador puede reenviar.
- Endpoints de Discord desplegados y protegidos con secreto exclusivo del bot.
- `/api/health` comprueba una lectura anónima de base sin publicar datos privados.
- GitHub Actions comprueba web y base cada 30 minutos. Los fallos aparecen en
  Actions. Las notificaciones dependen de las preferencias de GitHub del dueño;
  este flujo no envía mensajes a Discord ni a terceros.
- Contenedor del bot: dependencias fijadas, usuario sin privilegios, estado
  persistente, reinicio tras una caída, señal de salud y logs con rotación.

## Configuración externa pendiente

### Discord OAuth en producción

En **eloshape-arena**, referencia **hdlktzhjsswzcbgrnhql**:

1. Habilitar Discord en Authentication → Sign In / Providers.
2. Client ID: `1555020054142128278`. Client Secret: el secreto OAuth de la
   aplicación de Discord, **no** el token del bot ni el secreto de sincronización.
3. Registrar en Discord el callback exacto:
   `https://hdlktzhjsswzcbgrnhql.supabase.co/auth/v1/callback`.
4. Autorizar en Supabase `https://eloshape.com.ar/auth/discord` y
   `https://eloshape.com.ar/auth`. Habilitar vinculación manual de identidades.
5. Vincular desde una sesión existente de EloShape. No crear una segunda cuenta
   entrando directamente con Discord.
6. Ejecutar el diagnóstico del bot y probar asignación y retirada de roles.

La herramienta de base de datos no permite gestionar estas credenciales/configuraciones
de Auth. Requiere Dashboard o una credencial privada de Management API.

### Correos

Aplicar SMTP y plantillas según `AUTH_EMAIL_SETUP.md`. Comprobar confirmación,
recuperación y cambio de correo con una casilla real del responsable. La
confirmación manual no prueba la entrega SMTP ni reemplaza esa verificación.

### Bot 24 horas

Elegir un host para procesos permanentes y aplicar `discord/ALOJAMIENTO.md`.
No se ha contratado ni creado un servidor. Primero desactivar la instancia de
Windows para evitar operaciones concurrentes sobre los mismos IDs.

### Backups y recuperación

No asumir que hay backups por el solo hecho de que el proyecto esté activo.
Revisar Database → Backups en producción: plan, último backup, antigüedad y
retención. Descargar o conservar las copias fuera del servidor del bot y del
repositorio. Auth y Storage requieren revisar el alcance del backup; los objetos
de Storage y la configuración de proveedor/secretos no deben darse por cubiertos
por un volcado SQL. Comprobar una restauración en un proyecto aislado o staging,
sin sobrescribir producción. Documentar fecha, resultado y responsable.

## Prueba de aceptación con un invitado real

1. Aprobar su correo en administración y compartir el enlace de registro.
2. Registrar y confirmar. Comprobar llegada del mail; probar reenvío.
3. Vincular Discord desde el dashboard. El bot debe asignar Cuenta vinculada.
4. Invitación activa + correo confirmado + OAuth verificado debe dar Beta tester.
5. Una persona sin invitación ve solo bienvenida, acceso beta y soporte.
6. Abrir un ticket; usuario y staff ven el canal, otro jugador no lo ve.
7. Revocar la invitación: retirar Beta tester y bloquear la web, aunque el JWT
   anterior todavía exista. Desvincular Discord: retirar Cuenta vinculada.
8. Confirmar que un usuario común no accede a controles administrativos.

La sincronización usa snapshots de producción; no activar automáticamente
snapshots de staging sobre el servidor público. Las voces de partidas ya existen
por comandos; la automatización competitiva desde rosters/eventos sigue siendo
una etapa distinta de este cierre de infraestructura.
