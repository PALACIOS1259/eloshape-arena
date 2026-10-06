const fs = require("node:fs");
const path = require("node:path");
try {
  const state = JSON.parse(
    fs.readFileSync(process.env.BOT_HEALTH_FILE || path.join(__dirname, "bot-health.json"), "utf8"),
  );
  if (!state.ready || !Number.isFinite(state.updatedAt) || Date.now() - state.updatedAt > 90_000)
    process.exitCode = 1;
} catch {
  process.exitCode = 1;
}
