import { describe, expect, it } from "vitest";
import { normalizePublicApiBase } from "./api-url";

describe("deployment API base resolution", () => {
  it("defaults to same-origin requests for a promotable image", () => {
    expect(normalizePublicApiBase(undefined)).toBe("");
    expect(normalizePublicApiBase("   ")).toBe("");
  });

  it("retains an explicit local development origin and removes trailing slashes", () => {
    expect(normalizePublicApiBase("http://localhost:5039/"))
      .toBe("http://localhost:5039");
  });

  it("rejects credentials and non-HTTP public configuration", () => {
    expect(() => normalizePublicApiBase("javascript:alert(1)")).toThrow();
    expect(() => normalizePublicApiBase("https://user:password@example.test")).toThrow();
  });
});
