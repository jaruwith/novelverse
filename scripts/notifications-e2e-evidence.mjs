const fields = [
  "notificationBellVerified",
  "notificationPollingVerified",
  "notificationReadStateVerified",
  "notificationSessionIsolationVerified",
  "notificationProducerFlowVerified",
  "notificationAccessibilityVerified",
];

export function createNotificationsE2EEvidenceState() {
  const state = Object.fromEntries(fields.map((field) => [field, false]));
  return {
    snapshot: () => ({ ...state }),
    mark(field) {
      if (!fields.includes(field)) throw new Error(`Unknown Notifications evidence field: ${field}`);
      state[field] = true;
    },
  };
}

export function requireSuccessfulNotificationsEvidence(evidence, { mockFallbackDetected }) {
  const snapshot = evidence.snapshot();
  for (const field of fields) {
    if (snapshot[field] !== true) throw new Error(`Notifications E2E evidence incomplete: ${field}.`);
  }
  if (mockFallbackDetected !== false) throw new Error("Notifications E2E detected a mock fallback.");
  return { ...snapshot, mockFallbackDetected: false };
}
