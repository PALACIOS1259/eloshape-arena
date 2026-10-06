// Safe diagnostics: never include credential values in errors or output.
function configurationIssues(env = process.env) {
  const issues = [];
  if (!env.DISCORD_TOKEN || /^(PEG[A-Z_]*|TU_TOKEN)/i.test(env.DISCORD_TOKEN))
    issues.push("Falta DISCORD_TOKEN en .env.");
  const flags = ["DISCORD_MEMBERS_INTENT", "DISCORD_LINK_SYNC_ENABLED", "BETA_SYNC_ENABLED"];
  for (const name of flags) {
    if (env[name] && !["true", "false"].includes(env[name]))
      issues.push(`${name} debe ser true o false.`);
  }
  const enabled = [];
  if (env.DISCORD_LINK_SYNC_ENABLED === "true") enabled.push("DISCORD_LINKED_SNAPSHOT_URL");
  if (env.BETA_SYNC_ENABLED === "true") enabled.push("BETA_SNAPSHOT_URL");
  if (enabled.length) {
    if (env.DISCORD_MEMBERS_INTENT !== "true")
      issues.push(
        "Para sincronizar roles, configurá DISCORD_MEMBERS_INTENT=true y activá Server Members Intent en Discord.",
      );
    if (
      !env.DISCORD_BETA_SYNC_TOKEN ||
      env.DISCORD_BETA_SYNC_TOKEN.length < 32 ||
      /^PEGAR_/i.test(env.DISCORD_BETA_SYNC_TOKEN)
    )
      issues.push("Falta un DISCORD_BETA_SYNC_TOKEN válido, igual al secreto de Supabase.");
    const hosts = new Set();
    for (const name of enabled) {
      try {
        const url = new URL(env[name]);
        const expected =
          name === "BETA_SNAPSHOT_URL" ? "discord-beta-snapshot" : "discord-linked-snapshot";
        if (
          url.protocol !== "https:" ||
          url.username ||
          url.password ||
          url.search ||
          url.hash ||
          url.pathname !== `/functions/v1/${expected}`
        )
          throw new Error("invalid");
        hosts.add(url.host);
        if (
          (env.ELOSHAPE_URL || "https://eloshape.com.ar").replace(/\/+$/, "") ===
            "https://eloshape.com.ar" &&
          url.host !== "hdlktzhjsswzcbgrnhql.supabase.co"
        )
          issues.push(
            `${name} debe apuntar a Supabase producción cuando la sincronización automática usa eloshape.com.ar.`,
          );
      } catch {
        issues.push(`Falta ${name} o su URL no es válida.`);
      }
    }
    if (hosts.size > 1) issues.push("Los snapshots deben pertenecer al mismo proyecto Supabase.");
  }
  return issues;
}
module.exports = { configurationIssues };
