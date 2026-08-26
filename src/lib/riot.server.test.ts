import { afterEach, describe, expect, it } from "vitest";

import { fetchSummonerSnapshot, isRiotConfigured } from "./riot.server";

const originalMockMode = process.env["RIOT_MOCK_MODE"];

afterEach(() => {
  if (originalMockMode === undefined) delete process.env["RIOT_MOCK_MODE"];
  else process.env["RIOT_MOCK_MODE"] = originalMockMode;
});

describe("Riot Summoner-v4 snapshot", () => {
  it("returns a deterministic development account level in mock mode", async () => {
    process.env["RIOT_MOCK_MODE"] = "1";

    expect(isRiotConfigured()).toBe(true);
    const snapshot = await fetchSummonerSnapshot("mock-player-puuid", "LA2");

    expect(snapshot).toMatchObject({
      summonerLevel: 100,
      source: "mock",
    });
    expect(Number.isNaN(Date.parse(snapshot.fetchedAt))).toBe(false);
  });
});
