import { describe, expect, it, vi } from "vitest";
import { createLinkedSnapshotHandler } from "./handler";
const token = "a".repeat(64);
const request = (value = token) =>
  new Request("https://example.invalid", { headers: { Authorization: `Bearer ${value}` } });

describe("linked account snapshot", () => {
  it("authenticates before reading private data", async () => {
    const readSnapshot = vi.fn();
    expect(
      (await createLinkedSnapshotHandler({ token, readSnapshot })(request("wrong"))).status,
    ).toBe(401);
    expect(
      (await createLinkedSnapshotHandler({ token: undefined, readSnapshot })(request())).status,
    ).toBe(503);
    expect(readSnapshot).not.toHaveBeenCalled();
  });
  it("selects only verified IDs and never forwards private data", async () => {
    const response = await createLinkedSnapshotHandler({
      token,
      readSnapshot: async () => ({
        version: 1,
        linked_member_ids: ["1999999999999999999"],
        email: "private@example.invalid",
        access_token: "private",
      }),
    })(request());
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      version: 1,
      linked_member_ids: ["1999999999999999999"],
    });
  });
  it("fails closed when the database is unavailable or the payload is invalid", async () => {
    expect(
      (
        await createLinkedSnapshotHandler({
          token,
          readSnapshot: async () => {
            throw new Error("offline");
          },
        })(request())
      ).status,
    ).toBe(503);
    expect(
      (
        await createLinkedSnapshotHandler({
          token,
          readSnapshot: async () => ({ version: 1, linked_member_ids: [123] }),
        })(request())
      ).status,
    ).toBe(502);
  });
});
