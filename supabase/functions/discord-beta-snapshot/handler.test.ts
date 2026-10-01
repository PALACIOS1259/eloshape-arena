import { describe, expect, it, vi } from "vitest";
import { createSnapshotHandler } from "./handler";

const token = "a".repeat(64);
const request = (credential?: string) =>
  new Request("https://example.invalid/snapshot", {
    headers: credential ? { Authorization: `Bearer ${credential}` } : {},
  });

describe("Discord beta snapshot authorization", () => {
  it("rejects missing/wrong credentials before accessing privileged data", async () => {
    const readSnapshot = vi.fn();
    const handle = createSnapshotHandler({ token, readSnapshot });
    expect((await handle(request())).status).toBe(401);
    expect((await handle(request("b".repeat(64)))).status).toBe(401);
    expect(readSnapshot).not.toHaveBeenCalled();
  });

  it("fails closed without a configured secret", async () => {
    const readSnapshot = vi.fn();
    const handle = createSnapshotHandler({ token: undefined, readSnapshot });
    expect((await handle(request(token))).status).toBe(503);
    expect(readSnapshot).not.toHaveBeenCalled();
  });

  it("returns only approved Discord IDs, without invitation emails", async () => {
    const handle = createSnapshotHandler({
      token,
      readSnapshot: async () => ({
        enabled: true,
        member_ids: ["1547826296149647372"],
        email: "private@example.invalid",
      }),
    });
    const response = await handle(request(token));
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ enabled: true, member_ids: ["1547826296149647372"] });
  });

  it("never fabricates an empty whitelist after a backend failure", async () => {
    const handle = createSnapshotHandler({
      token,
      readSnapshot: async () => {
        throw new Error("database down");
      },
    });
    const response = await handle(request(token));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "snapshot_unavailable" });
  });

  it("rejects malformed snapshots and other HTTP methods", async () => {
    const handle = createSnapshotHandler({
      token,
      readSnapshot: async () => ({ enabled: true, member_ids: [123] }),
    });
    expect((await handle(request(token))).status).toBe(502);
    expect((await handle(new Request("https://example.invalid", { method: "POST" }))).status).toBe(
      405,
    );
  });
});
