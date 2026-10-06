const fs = require("node:fs");
const path = require("node:path");
const envFile = path.join(__dirname, ".env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const { configurationIssues } = require("./config.cjs");
const { fetchLinkedSnapshot } = require("./linked-sync.cjs");
const { fetchBetaSnapshot } = require("./beta-sync.cjs");

async function main() {
  const issues = configurationIssues();
  if (issues.length) {
    issues.forEach((issue) => console.error(`❌ ${issue}`));
    process.exitCode = 1;
    return;
  }
  console.log("✅ Configuración local válida. El token no se muestra.");
  console.log(
    `Members Intent local: ${process.env.DISCORD_MEMBERS_INTENT === "true" ? "activo" : "desactivado"}`,
  );
  console.log(
    "Comprobá además Server Members Intent y Message Content Intent en Discord Developer Portal.",
  );
  if (process.env.DISCORD_LINKED_SNAPSHOT_URL) {
    const linked = await fetchLinkedSnapshot();
    console.log(`✅ Producción respondió: ${linked.length} cuentas vinculadas.`);
  }
  if (process.env.BETA_SNAPSHOT_URL) {
    const beta = await fetchBetaSnapshot();
    console.log(
      `✅ Beta ${beta.enabled ? "activa" : "pausada"}: ${beta.member_ids.length} identidades autorizadas.`,
    );
  }
  console.log(
    "Esta prueba no asigna ni retira roles y no confirma la jerarquía del bot en Discord.",
  );
}
main().catch(() => {
  console.error(
    "❌ Falló la conexión con los snapshots. Revisá las URLs y que el secreto coincida con producción. No se cambiaron roles.",
  );
  process.exitCode = 1;
});
