import { describe, expect, it } from "vitest";
import {
  createNotificationsE2EEvidenceState, requireSuccessfulNotificationsEvidence,
} from "./notifications-e2e-evidence.mjs";

const fields = [
  "notificationBellVerified", "notificationPollingVerified", "notificationReadStateVerified",
  "notificationSessionIsolationVerified", "notificationProducerFlowVerified",
  "notificationAccessibilityVerified",
];

describe("Notifications E2E evidence summary", () => {
  it("defaults every assertion-backed result to the boolean false", () => {
    const snapshot = createNotificationsE2EEvidenceState().snapshot();
    expect(Object.values(snapshot)).toEqual(Array(fields.length).fill(false));
    expect(Object.values(snapshot).every((value) => typeof value === "boolean")).toBe(true);
  });

  it("keeps partial flows false and blocks a successful summary", () => {
    const state = createNotificationsE2EEvidenceState();
    state.mark("notificationBellVerified");
    expect(state.snapshot().notificationPollingVerified).toBe(false);
    expect(() => requireSuccessfulNotificationsEvidence(state, { mockFallbackDetected: false }))
      .toThrow(/notificationPollingVerified/);
  });

  it("sets only the relevant assertion and rejects unknown optimistic fields", () => {
    const state = createNotificationsE2EEvidenceState();
    state.mark("notificationReadStateVerified");
    expect(state.snapshot()).toEqual(expect.objectContaining({ notificationReadStateVerified: true,
      notificationBellVerified: false }));
    expect(() => state.mark("allPassed")).toThrow(/Unknown/);
  });

  it("requires every flag and no mock fallback", () => {
    const state = createNotificationsE2EEvidenceState();
    fields.forEach((field) => state.mark(field));
    expect(() => requireSuccessfulNotificationsEvidence(state, { mockFallbackDetected: true })).toThrow(/mock/);
    expect(requireSuccessfulNotificationsEvidence(state, { mockFallbackDetected: false }))
      .toEqual({ ...state.snapshot(), mockFallbackDetected: false });
  });

  it("isolates consecutive runs with no stale module state", () => {
    const first = createNotificationsE2EEvidenceState();
    fields.forEach((field) => first.mark(field));
    const second = createNotificationsE2EEvidenceState();
    expect(Object.values(first.snapshot()).every(Boolean)).toBe(true);
    expect(Object.values(second.snapshot()).every((value) => value === false)).toBe(true);
  });
});
