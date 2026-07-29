import { describe, expect, it } from "vitest";
import {
  hasPublishableText,
  serializeBlocks,
  validateBlocksForSave,
  type EditorBlock,
} from "./types";

const blocks: EditorBlock[] = [
  { localKey: "local-1", type: "TEXT", textContent: "ย่อหน้าแรก\nย่อหน้าสอง", mediaAssetId: null },
  { localKey: "local-2", type: "DIVIDER", textContent: null, mediaAssetId: null },
  { localKey: "local-3", type: "IMAGE", textContent: null, mediaAssetId: "asset-1" },
];

describe("content serialization", () => {
  it("preserves order and strips frontend-only local keys", () => {
    expect(serializeBlocks(blocks)).toEqual([
      { type: "TEXT", textContent: "ย่อหน้าแรก\nย่อหน้าสอง", mediaAssetId: null },
      { type: "DIVIDER", textContent: null, mediaAssetId: null },
      { type: "IMAGE", textContent: null, mediaAssetId: "asset-1" },
    ]);
  });

  it("requires non-empty text for publishing", () => {
    expect(hasPublishableText(blocks)).toBe(true);
    expect(hasPublishableText([{ localKey: "x", type: "TEXT", textContent: "  ", mediaAssetId: null }])).toBe(false);
  });

  it("rejects empty text", () => {
    expect(validateBlocksForSave([{ localKey: "x", type: "TEXT", textContent: "", mediaAssetId: null }])).toContain("ว่าง");
  });
});
