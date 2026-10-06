# Bot de EloShape disponible permanentemente

El bot usa una conexión persistente con Discord. Ejecutalo en un VPS o servicio
de contenedores que permita procesos permanentes. No funciona como una función
web de Vercel. Esta configuración prepara el despliegue; todavía requiere un
servidor elegido y sus credenciales. No crea ni contrata infraestructura.

## Docker Compose

1. Cloná este repositorio en el servidor y entrá en `discord`.
2. Copiá `bot-production.env.example` a `.env` y completá los secretos privados.
   Activá los intents del Developer Portal. Conservá las sincronizaciones en
   `false` hasta comprobar que producción reconoce la cuenta y la whitelist.
3. Creá `state` y copiá allí **el ids.json de tu servidor actual**.
   Guardá antes una copia. El bot no debe arrancar con IDs de otro servidor.
4. El contenedor usa el usuario 1000. Dale a ese usuario escritura sobre `state`:
   `sudo chown -R 1000:1000 state`. Protegé `.env` con `chmod 600 .env`.
5. Ejecutá `docker compose run --rm bot node diagnostico.cjs`.
   Esta prueba consulta snapshots sin modificar roles ni mostrar credenciales.
6. Detené el bot de Windows para no ejecutar dos instancias sobre el mismo servidor.
7. Iniciá con `docker compose up -d --build` y comprobá `docker compose ps`
   y `docker compose logs --tail=40 bot`.
8. Probá vinculación, beta y ticket con un jugador de prueba. Solo entonces
   activá ambas sincronizaciones en `.env` y recreá con `docker compose up -d`.

`restart: unless-stopped` reinicia el proceso tras una caída y después de reiniciar
el host, siempre que Docker arranque al iniciar el sistema. La comprobación de
salud muestra si Discord está conectado; Docker no reinicia por sí solo un
contenedor que está `unhealthy`. Investigá ese estado y configurá un monitor
del servicio elegido. Los logs tienen rotación y los IDs se conservan en `state`.

## Actualizar sin perder el servidor

Actualizá el código y ejecutá `docker compose up -d --build`.
No borres `.env`, `state` ni `ids.json`. Guardá copias de los IDs antes de usar
comandos de adaptación. Para detener: `docker compose stop`.

## Windows

`node bot.js` y `iniciar-bot.cmd` leen `.env` con Node 22 o posterior.
También podés ejecutar `node --env-file=.env diagnostico.cjs`.
Esto no garantiza disponibilidad si apagás la PC o cerrás el bot.
