import {
  getSessionGeneration, hasSession, subscribeToSessionChanges, upsertReadingProgress,
} from "@/features/novel-editor/api";

const recentlyRecorded = new Map<string, number>();
const inFlight = new Map<string, Promise<void>>();
const STRICT_MODE_DEDUPLICATION_MS = 5_000;

subscribeToSessionChanges(() => {
  recentlyRecorded.clear();
  inFlight.clear();
});

export function recordEpisodeProgress(storyId: string, episodeId: string, signal?: AbortSignal) {
  if (!hasSession()) return Promise.resolve();
  const sessionGeneration = getSessionGeneration();
  const now = Date.now();
  for (const [candidate, recordedAt] of recentlyRecorded) {
    if (!candidate.startsWith(`${sessionGeneration}:`) || now - recordedAt >= STRICT_MODE_DEDUPLICATION_MS)
      recentlyRecorded.delete(candidate);
  }
  const key = `${sessionGeneration}:${storyId}:${episodeId}`;
  if (Date.now() - (recentlyRecorded.get(key) ?? 0) < STRICT_MODE_DEDUPLICATION_MS) return Promise.resolve();
  const pending = inFlight.get(key);
  if (pending) return pending;
  const request = upsertReadingProgress(storyId, episodeId, signal)
    .then(() => {
      if (getSessionGeneration() === sessionGeneration) recentlyRecorded.set(key, Date.now());
    })
    .catch(() => undefined)
    .finally(() => { inFlight.delete(key); });
  inFlight.set(key, request);
  return request;
}

export function resetProgressRecordingForTests() {
  recentlyRecorded.clear();
  inFlight.clear();
}
