import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
const require = createRequire(import.meta.url);
const { configurationIssues } = require("./config.cjs");
const env = {
  DISCORD_TOKEN: "test-token",
  DISCORD_BETA_SYNC_TOKEN: "x".repeat(32),
  ELOSHAPE_URL: "https://eloshape.com.ar",
  DISCORD_MEMBERS_INTENT: "true",
  DISCORD_LINK_SYNC_ENABLED: "true",
  BETA_SYNC_ENABLED: "true",
  DISCORD_LINKED_SNAPSHOT_URL:
    "https://hdlktzhjsswzcbgrnhql.supabase.co/functions/v1/discord-linked-snapshot",
  BETA_SNAPSHOT_URL: "https://hdlktzhjsswzcbgrnhql.supabase.co/functions/v1/discord-beta-snapshot",
};
describe("bot operational configuration", () => {
  it("accepts production and prevents automatic role removal from a staging snapshot", () => {
    expect(configurationIssues(env)).toEqual([]);
    expect(
      configurationIssues({
        ...env,
        BETA_SNAPSHOT_URL: env.BETA_SNAPSHOT_URL.replace(
          "hdlktzhjsswzcbgrnhql",
          "ujlzcdmotrihwgjshdcs",
        ),
      }).join(" "),
    ).toContain("producción");
  });
  it("reports missing secrets and intent flags without revealing any secret", () => {
    const issues: string[] = configurationIssues({
      ...env,
      DISCORD_BETA_SYNC_TOKEN: "private",
      DISCORD_MEMBERS_INTENT: "false",
    });
    expect(issues.join(" ")).toContain("DISCORD_BETA_SYNC_TOKEN");
    expect(issues.join(" ")).toContain("Server Members Intent");
    expect(issues.join(" ")).not.toContain("private");
  });
  it("allows manual testing with sync off and rejects URL credentials", () => {
    expect(configurationIssues({ DISCORD_TOKEN: "mock-token" })).toEqual([]);
    expect(
      configurationIssues({
        ...env,
        BETA_SNAPSHOT_URL:
          "https://secret:password@example.invalid/functions/v1/discord-beta-snapshot",
      }).join(" "),
    ).not.toContain("password");
    expect(
      configurationIssues({
        ...env,
        BETA_SNAPSHOT_URL:
          "https://secret:password@example.invalid/functions/v1/discord-beta-snapshot",
      }),
    ).not.toEqual([]);
  });
});
