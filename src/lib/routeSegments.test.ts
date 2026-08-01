import { describe, expect, it } from "vitest";
import { decodeRouteSegmentOnce } from "./routeSegments";

describe("decodeRouteSegmentOnce", () => {
  it("leaves raw Unicode and ASCII application slugs unchanged", () => {
    expect(decodeRouteSegmentOnce("test-นิยาย")).toBe("test-นิยาย");
    expect(decodeRouteSegmentOnce("local-creator")).toBe("local-creator");
  });

  it("decodes one valid URL segment including spaces and special characters", () => {
    expect(decodeRouteSegmentOnce("test-%E0%B8%99%E0%B8%B4%E0%B8%A2%E0%B8%B2%E0%B8%A2"))
      .toBe("test-นิยาย");
    expect(decodeRouteSegmentOnce("space%20and%2Bplus%26more"))
      .toBe("space and+plus&more");
  });

  it("does not repeatedly decode and safely rejects malformed percent encoding", () => {
    expect(decodeRouteSegmentOnce("value%2520once")).toBe("value%20once");
    expect(decodeRouteSegmentOnce("bad%E0%A4%A")).toBeNull();
    expect(decodeRouteSegmentOnce("bad%value")).toBeNull();
  });
});
