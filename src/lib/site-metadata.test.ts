import { describe, expect, it } from "vitest";

import { parseSiteOrigin, shouldNoIndexSite } from "./site-metadata";

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

describe("site indexing policy", () => {
  it("allows indexing only on the public production origin outside maintenance", () => {
    expect(shouldNoIndexSite("https://eloshape.com.ar", false)).toBe(false);
    expect(shouldNoIndexSite("https://eloshape.com.ar", true)).toBe(true);
    expect(shouldNoIndexSite("https://eloshape-staging.vercel.app", false)).toBe(true);
  });

  it("does not interfere with localhost when no canonical origin is configured", () => {
    expect(shouldNoIndexSite(undefined, false)).toBe(false);
  });
});
