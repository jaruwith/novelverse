import { describe, expect, it } from "vitest";
import { draftFingerprint, validateCommentDraft } from "./validation";

describe("Comment advisory validation", () => {
  it("normalizes newlines/NFC and counts Unicode scalars rather than UTF-16 units", () => {
    const result = validateCommentDraft("กา\r\n🙂e\u0301");
    expect(result.normalizedBody).toBe("กา\n🙂é");
    expect(result.scalarCount).toBe(5);
    expect(result.lineCount).toBe(2);
    expect(result.error).toBeNull();
  });

  it("supports Thai, emoji, combining and astral text while enforcing scalar and line limits", () => {
    expect(validateCommentDraft("ภาษาไทย 👩‍🚀 𐐷").error).toBeNull();
    expect(validateCommentDraft("🙂".repeat(4_001)).error).toMatch(/4,000/);
    expect(validateCommentDraft(Array.from({ length: 41 }, () => "บรรทัด").join("\n")).error).toMatch(/40/);
    expect(validateCommentDraft("\ud800").error).toMatch(/Unicode/);
    expect(validateCommentDraft("safe\u202eevil").error).toMatch(/direction-formatting/);
    expect(validateCommentDraft("safe\u0000evil").error).toMatch(/control/);
    expect(validateCommentDraft("safe\u200djoin").error).toBeNull();
  });

  it("keeps literal HTML-like text and binds retry identity to normalized payload and spoiler", () => {
    expect(validateCommentDraft("&lt;b&gt;literal&lt;/b&gt;").normalizedBody).toContain("&lt;b&gt;");
    expect(draftFingerprint({ body: "a\r\nb", isSpoiler: false }))
      .toBe(draftFingerprint({ body: "a\nb", isSpoiler: false }));
    expect(draftFingerprint({ body: "a", isSpoiler: false }))
      .not.toBe(draftFingerprint({ body: "a", isSpoiler: true }));
  });
});
