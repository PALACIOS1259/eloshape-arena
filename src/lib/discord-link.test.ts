import { describe, expect, it } from "vitest";
import { validDiscordLinkRequest } from "./discord-link";

describe("Discord linking session", () => {
  it("accepts only the original player and a recent request", () => {
    const request = JSON.stringify({ userId: "original", startedAt: 1000 });
    expect(validDiscordLinkRequest(request, "original", 2000)).toBe(true);
    expect(validDiscordLinkRequest(request, "other-player", 2000)).toBe(false);
    expect(validDiscordLinkRequest(request, "original", 601000)).toBe(false);
    expect(validDiscordLinkRequest(request, "original", 999)).toBe(false);
  });
  it("rejects absent, malformed and forged requests", () => {
    for (const request of [null, "not json", "{}", '{"userId":"original","startedAt":"1000"}'])
      expect(validDiscordLinkRequest(request, "original", 2000)).toBe(false);
  });
});
