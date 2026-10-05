@echo off
setlocal
cd /d "%~dp0"
if not exist .env (
  echo Falta .env. Configura tus credenciales privadas antes de iniciar.
  pause
  exit /b 1
)
rem .env es la fuente de configuracion; no heredar valores viejos de CMD.
for %%V in (DISCORD_TOKEN DISCORD_BETA_SYNC_TOKEN ELOSHAPE_URL DISCORD_LINKED_SNAPSHOT_URL BETA_SNAPSHOT_URL DISCORD_MEMBERS_INTENT DISCORD_LINK_SYNC_ENABLED BETA_SYNC_ENABLED) do set "%%V="
node --env-file=.env bot.js
pause
endlocal
