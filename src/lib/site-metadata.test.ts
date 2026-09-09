import { describe, expect, it } from "vitest";

import { parseSiteOrigin } from "./site-metadata";

describe("site metadata origin parsing", () => {
  it("accepts only an http(s) origin", () => {
    expect(parseSiteOrigin("https://eloshape.com.ar")).toBe("https://eloshape.com.ar");
    expect(parseSiteOrigin(" https://staging.example.com/ ")).toBe("https://staging.example.com");
  });

  it("rejects paths, credentials and non-web protocols", () => {
    expect(parseSiteOrigin("https://eloshape.com.ar/path")).toBeUndefined();
    expect(parseSiteOrigin("https://user:password@example.com")).toBeUndefined();
    expect(parseSiteOrigin("javascript:alert(1)")).toBeUndefined();
    expect(parseSiteOrigin(undefined)).toBeUndefined();
  });
});
