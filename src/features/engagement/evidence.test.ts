import { describe, expect, it } from "vitest";
import { buildOrderedContentEvidence, unsupportedVideoEvidence } from "./evidence";

describe("reader engagement evidence adapters", () => {
  it("uses the actual ordered NOVEL block and only marks the real final block", () => {
    expect(buildOrderedContentEvidence(["block-1", "block-2"], 49)).toMatchObject({
      reachedContentId: "block-1", reachedPosition: 1, totalItems: 2,
      finalContentReached: false,
    });
    expect(buildOrderedContentEvidence(["block-1", "block-2"], 100)).toMatchObject({
      reachedContentId: "block-2", reachedPosition: 2, totalItems: 2,
      finalContentReached: true, progressPercent: 100,
    });
  });

  it("uses the actual ordered COMIC page and bounds coverage", () => {
    expect(buildOrderedContentEvidence(["page-1", "page-2", "page-3"], 70)).toMatchObject({
      reachedContentId: "page-3", reachedPosition: 3, totalItems: 3,
      finalContentReached: false,
    });
    expect(buildOrderedContentEvidence(["page-1"], 130)).toMatchObject({
      reachedContentId: "page-1", progressPercent: 100, finalContentReached: true,
    });
  });

  it("never fabricates VIDEO playback, qualification, or completion evidence", () => {
    expect(unsupportedVideoEvidence()).toEqual({
      evidenceType: "HEARTBEAT", progressPercent: 0,
    });
  });
});
