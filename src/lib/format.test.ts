import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime } from "./format";

describe("date formatting", () => {
  it("uses the circuit timezone for tournament times", () => {
    expect(formatDateTime("2026-09-05T22:00:00Z")).toContain("19:00");
  });

  it("uses the circuit timezone when UTC and Argentina fall on different dates", () => {
    expect(formatDate("2026-09-01T01:00:00Z")).toContain("31 Aug");
  });
});
