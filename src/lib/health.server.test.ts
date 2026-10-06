import { describe, expect, it, vi } from "vitest";
import { healthResponse } from "./health.server";
const env = { SUPABASE_URL: "https://example.invalid", SUPABASE_PUBLISHABLE_KEY: "public-key" };
describe("public infrastructure health", () => {
  it("returns only health and uses anonymous credentials", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ enabled: true, allowed: false, sensitive: "hidden" }));
    const response = await healthResponse(env, fetchImpl);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const init = fetchImpl.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
  });
  it("fails closed on unavailable or malformed database responses", async () => {
    for (const value of [
      Response.json({ error: "private details" }, { status: 500 }),
      Response.json({}),
    ]) {
      const response = await healthResponse(env, vi.fn<typeof fetch>().mockResolvedValue(value));
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ ok: false });
    }
    expect((await healthResponse({})).status).toBe(503);
  });
});
