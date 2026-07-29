import { hasSession, upsertReadingProgress } from "@/features/novel-editor/api";

const recentlyRecorded = new Map<string, number>();
const inFlight = new Map<string, Promise<void>>();
const STRICT_MODE_DEDUPLICATION_MS = 5_000;

export function recordEpisodeProgress(storyId: string, episodeId: string) {
  if (!hasSession()) return Promise.resolve();
  const key = `${storyId}:${episodeId}`;
  if (Date.now() - (recentlyRecorded.get(key) ?? 0) < STRICT_MODE_DEDUPLICATION_MS) return Promise.resolve();
  const pending = inFlight.get(key);
  if (pending) return pending;
  const request = upsertReadingProgress(storyId, episodeId)
    .then(() => { recentlyRecorded.set(key, Date.now()); })
    .catch(() => undefined)
    .finally(() => { inFlight.delete(key); });
  inFlight.set(key, request);
  return request;
}

export function resetProgressRecordingForTests() {
  recentlyRecorded.clear();
  inFlight.clear();
}
