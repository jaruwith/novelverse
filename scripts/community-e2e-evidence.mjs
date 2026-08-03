const limiterKinds = Object.freeze(["create", "like", "report"]);

export function createCommunityE2EEvidenceState() {
  let mutationConcurrencyVerified = false;
  const verifiedLimiters = new Set();

  return Object.freeze({
    markMutationConcurrencyVerified() {
      mutationConcurrencyVerified = true;
    },
    markLimiterVerified(kind) {
      if (!limiterKinds.includes(kind)) {
        throw new Error(`Unknown Community limiter evidence kind: ${kind}`);
      }
      verifiedLimiters.add(kind);
    },
    snapshot() {
      return {
        communityMutationConcurrencyVerified: mutationConcurrencyVerified,
        communityLimiterAssertionsVerified: limiterKinds.every((kind) => verifiedLimiters.has(kind)),
      };
    },
  });
}

export function requireSuccessfulCommunityEvidence(state, { mockFallbackDetected }) {
  const evidence = state.snapshot();
  if (!evidence.communityMutationConcurrencyVerified) {
    throw new Error("Community mutation-concurrency evidence did not complete.");
  }
  if (!evidence.communityLimiterAssertionsVerified) {
    throw new Error("Community Create/Like/Report limiter evidence did not complete.");
  }
  if (mockFallbackDetected !== false) {
    throw new Error("Community real-stack evidence detected or did not exclude a mock fallback.");
  }
  return { ...evidence, mockFallbackDetected: false };
}
