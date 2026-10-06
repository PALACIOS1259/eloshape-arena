import { describe, expect, it } from "vitest";

import {
  divisionLabel,
  formatDate,
  formatDateTime,
  formatPoints,
  placementLabel,
  riotRankLabel,
  roundName,
  statusLabel,
  tournamentFormat,
} from "./format";

describe("date formatting", () => {
  it("uses the circuit timezone for tournament times", () => {
    expect(formatDateTime("2026-09-05T22:00:00Z")).toContain("19:00");
  });

  it("uses the circuit timezone when UTC and Argentina fall on different dates", () => {
    expect(formatDate("2026-09-01T01:00:00Z")).toContain("31 de ago");
  });
});

describe("Spanish display of stored competition values", () => {
  it("localizes API ranks and divisions without changing their codes", () => {
    const division = { code: "silver", name: "Silver" };
    expect(divisionLabel(division)).toBe("Plata");
    expect(division.code).toBe("silver");
    expect(riotRankLabel("GOLD", "II")).toBe("Oro II");
    expect(riotRankLabel(null, null)).toBe("Sin rango");
  });

  it("handles existing English round and format records", () => {
    expect(roundName("Quarterfinal")).toBe("Cuartos de final");
    expect(tournamentFormat("Single elimination Bo1 / Bo3 finals")).toBe(
      "Eliminación directa al mejor de 1 / al mejor de 3 en finales",
    );
    expect(statusLabel("pending_confirmation")).toBe("Pendiente de confirmación");
    expect(statusLabel("in_review")).toBe("En revisión");
  });

  it("uses Argentine number formatting and Spanish placeholders", () => {
    expect(formatPoints(12500)).toBe("12.500");
    expect(placementLabel(21)).toBe("21.º");
    expect(formatDate(null)).toBe("A confirmar");
  });
});
