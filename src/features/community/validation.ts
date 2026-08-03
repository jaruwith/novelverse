export type CommentDraft = { body: string; isSpoiler: boolean };
export type CommentDraftValidation = {
  normalizedBody: string;
  scalarCount: number;
  lineCount: number;
  error: string | null;
};

export function validateCommentDraft(body: string): CommentDraftValidation {
  const newlineNormalized = body.replace(/\r\n?/g, "\n");
  let normalizedBody = newlineNormalized;
  try {
    normalizedBody = newlineNormalized.normalize("NFC");
  } catch {
    return { normalizedBody: newlineNormalized, scalarCount: 0, lineCount: 0,
      error: "Comment contains invalid Unicode text." };
  }
  const scalars = Array.from(normalizedBody);
  const lineCount = normalizedBody.split("\n").length;
  if (/\p{Cs}/u.test(normalizedBody))
    return { normalizedBody, scalarCount: scalars.length, lineCount, error: "Comment contains invalid Unicode text." };
  if (scalars.some((scalar) =>
    (/\p{Cc}/u.test(scalar) && scalar !== "\n") ||
    (/\p{Cf}/u.test(scalar) && scalar !== "\u200c" && scalar !== "\u200d")))
    return { normalizedBody, scalarCount: scalars.length, lineCount,
      error: "Comment contains unsupported control or direction-formatting characters." };
  if (!normalizedBody.trim())
    return { normalizedBody, scalarCount: scalars.length, lineCount, error: "Enter a Comment before submitting." };
  if (scalars.length > 4_000)
    return { normalizedBody, scalarCount: scalars.length, lineCount, error: "Comment must not exceed 4,000 characters." };
  if (lineCount > 40)
    return { normalizedBody, scalarCount: scalars.length, lineCount, error: "Comment must not exceed 40 lines." };
  return { normalizedBody, scalarCount: scalars.length, lineCount, error: null };
}

export function draftFingerprint(draft: CommentDraft) {
  const validation = validateCommentDraft(draft.body);
  return `${validation.normalizedBody.length}:${validation.normalizedBody}:${draft.isSpoiler ? 1 : 0}`;
}
