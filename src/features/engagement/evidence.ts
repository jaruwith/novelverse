export function buildOrderedContentEvidence(contentIds: Array<string | undefined>, rawProgress: number) {
  const progressPercent = Math.min(100, Math.max(0, rawProgress));
  const index = Math.min(contentIds.length - 1,
    Math.floor((progressPercent / 100) * contentIds.length));
  return {
    evidenceType: "PROGRESS" as const,
    progressPercent,
    reachedContentId: contentIds[index],
    reachedPosition: index + 1,
    totalItems: contentIds.length,
    finalContentReached: index === contentIds.length - 1 && progressPercent >= 95,
  };
}

export const unsupportedVideoEvidence = () => ({
  evidenceType: "HEARTBEAT" as const,
  progressPercent: 0,
});
