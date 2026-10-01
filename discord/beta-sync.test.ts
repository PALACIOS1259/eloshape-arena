import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { fetchBetaSnapshot } = require("./beta-sync.cjs");
const env = {
  BETA_SNAPSHOT_URL: "https://example.invalid/snapshot",
  DISCORD_BETA_SYNC_TOKEN: "a".repeat(64),
};

describe("bot whitelist transport", () => {
  it("refuses insecure endpoints before transmitting credentials", async () => {
    const fetchImpl = vi.fn();
    await expect(
      fetchBetaSnapshot({
        env: { ...env, BETA_SNAPSHOT_URL: "http://example.invalid" },
        fetchImpl,
      }),
    ).rejects.toThrow("HTTPS");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("aborts on network, HTTP, JSON and identity validation errors", async () => {
    for (const fetchImpl of [
      async () => {
        throw new Error("timeout");
      },
      async () => new Response("Unauthorized", { status: 401 }),
      async () => new Response("not json"),
      async () => Response.json({ enabled: true, member_ids: [Number("1555024719030517781")] }),
      async () => Response.json({ enabled: true }),
    ])
      await expect(fetchBetaSnapshot({ env, fetchImpl })).rejects.toThrow();
  });
  it("accepts an explicit valid empty snapshot and preserves gate state", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ enabled: false, member_ids: [] }));
    expect(await fetchBetaSnapshot({ env, fetchImpl })).toEqual({ enabled: false, member_ids: [] });
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      redirect: "error",
      headers: { Authorization: `Bearer ${env.DISCORD_BETA_SYNC_TOKEN}` },
    });
  });
});
