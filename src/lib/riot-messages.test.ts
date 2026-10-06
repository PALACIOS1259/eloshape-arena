import { describe, expect, it } from "vitest";
import { riotErrorMessage, riotNotice } from "./riot-messages";

describe("Riot messages returned by the deployed API", () => {
  it("preserves the wait duration and account level requirements", () => {
    expect(riotNotice("Riot data was just synced. Try again in 7 min.")).toContain("7 min.");
    expect(
      riotNotice("Riot account level 30 is required to compete. Your current level is 12."),
    ).toBe("Se requiere nivel de cuenta de Riot 30 para competir. Tu nivel actual es 12.");
    expect(riotNotice(null)).toBeNull();
  });

  it("uses the API error code for an actionable Spanish message", () => {
    expect(riotErrorMessage("already_linked")).toContain("otro jugador");
    expect(riotErrorMessage("rate_limited")).toContain("limitando");
    expect(riotErrorMessage("unknown")).toContain("no está disponible temporalmente");
  });
});
