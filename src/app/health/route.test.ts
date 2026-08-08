import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("frontend container health", () => {
  it("is dependency-free and reveals only status", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "Healthy" });
  });
});
