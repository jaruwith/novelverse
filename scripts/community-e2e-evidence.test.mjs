import test from "node:test";
import assert from "node:assert/strict";
import {
  createCommunityE2EEvidenceState,
  requireSuccessfulCommunityEvidence,
} from "./community-e2e-evidence.mjs";

test("Community E2E evidence flags start false and partial execution cannot pass", () => {
  const state = createCommunityE2EEvidenceState();
  assert.deepEqual(state.snapshot(), {
    communityMutationConcurrencyVerified: false,
    communityLimiterAssertionsVerified: false,
  });

  state.markMutationConcurrencyVerified();
  state.markLimiterVerified("create");
  state.markLimiterVerified("like");
  assert.deepEqual(state.snapshot(), {
    communityMutationConcurrencyVerified: true,
    communityLimiterAssertionsVerified: false,
  });
  assert.throws(
    () => requireSuccessfulCommunityEvidence(state, { mockFallbackDetected: false }),
    /limiter evidence did not complete/,
  );
});

test("Community successful summary requires mutation and all limiter evidence", () => {
  const state = createCommunityE2EEvidenceState();
  state.markLimiterVerified("report");
  state.markLimiterVerified("like");
  state.markLimiterVerified("create");
  assert.throws(
    () => requireSuccessfulCommunityEvidence(state, { mockFallbackDetected: false }),
    /mutation-concurrency evidence did not complete/,
  );

  state.markMutationConcurrencyVerified();
  const summary = requireSuccessfulCommunityEvidence(state, { mockFallbackDetected: false });
  assert.deepEqual(summary, {
    communityMutationConcurrencyVerified: true,
    communityLimiterAssertionsVerified: true,
    mockFallbackDetected: false,
  });
  assert.equal(typeof summary.communityMutationConcurrencyVerified, "boolean");
  assert.equal(typeof summary.communityLimiterAssertionsVerified, "boolean");
});

test("Community failed or unknown evidence cannot produce a successful summary", () => {
  const state = createCommunityE2EEvidenceState();
  state.markMutationConcurrencyVerified();
  for (const kind of ["create", "like", "report"]) state.markLimiterVerified(kind);
  assert.throws(
    () => requireSuccessfulCommunityEvidence(state, { mockFallbackDetected: true }),
    /mock fallback/,
  );
  assert.throws(() => state.markLimiterVerified("delete"), /Unknown Community limiter/);
});

test("Community evidence state never leaks across consecutive runs", () => {
  const first = createCommunityE2EEvidenceState();
  first.markMutationConcurrencyVerified();
  for (const kind of ["create", "like", "report"]) first.markLimiterVerified(kind);
  assert.equal(requireSuccessfulCommunityEvidence(first, { mockFallbackDetected: false })
    .communityLimiterAssertionsVerified, true);

  const second = createCommunityE2EEvidenceState();
  assert.deepEqual(second.snapshot(), {
    communityMutationConcurrencyVerified: false,
    communityLimiterAssertionsVerified: false,
  });
});
