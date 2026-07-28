import { beforeEach, describe, expect, it, vi } from "vitest";
import { EngagementSessionController } from "./controller";
import { endEngagementSession, sendEngagementActivity, startEngagementSession } from "@/features/novel-editor/api";

vi.mock("@/features/novel-editor/api", () => ({
  startEngagementSession: vi.fn(),
  sendEngagementActivity: vi.fn(),
  endEngagementSession: vi.fn(),
}));

const start = vi.mocked(startEngagementSession);
const activity = vi.mocked(sendEngagementActivity);
const end = vi.mocked(endEngagementSession);

describe("EngagementSessionController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    start.mockResolvedValue({
      sessionId: "session-1", targetType: "EPISODE", startedAt: new Date().toISOString(),
      heartbeatIntervalSeconds: 30, inactivityTimeoutSeconds: 120,
      countedNewView: true, qualified: false, completed: false,
    });
    activity.mockResolvedValue(undefined);
    end.mockResolvedValue(undefined);
  });

  it("starts once, includes stable lifecycle state, schedules 30 seconds, and ends best effort", async () => {
    const controller = new EngagementSessionController(
      { targetType: "EPISODE", targetId: "episode-1" },
      () => ({ evidenceType: "PROGRESS", progressPercent: 96, reachedContentId: "block-1", finalContentReached: true }));
    await controller.start();
    expect(start).toHaveBeenCalledTimes(1);
    const startBody = start.mock.calls[0][0];
    expect(startBody.clientSessionKey).toBeTruthy();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(activity).toHaveBeenCalledWith("session-1", expect.objectContaining({
      clientSessionKey: startBody.clientSessionKey, reportedActiveSeconds: 30,
      progressPercent: 96, reachedContentId: "block-1",
    }));
    await controller.stop();
    expect(end).toHaveBeenCalledWith("session-1");
  });

  it("deduplicates concurrent lifecycle starts and uses fresh request idempotency keys", async () => {
    let resolveStart!: (value: Awaited<ReturnType<typeof startEngagementSession>>) => void;
    start.mockImplementationOnce(() => new Promise((resolve) => { resolveStart = resolve; }));
    const controller = new EngagementSessionController({ targetType: "STORY", targetId: "story-1" });
    const first = controller.start();
    const second = controller.start();
    expect(start).toHaveBeenCalledTimes(1);
    resolveStart({
      sessionId: "session-1", targetType: "STORY", startedAt: new Date().toISOString(),
      heartbeatIntervalSeconds: 30, inactivityTimeoutSeconds: 120,
      countedNewView: true, qualified: false, completed: false,
    });
    await Promise.all([first, second]);
    const lifecycleKey = start.mock.calls[0][0].clientSessionKey;
    const startIdempotency = start.mock.calls[0][0].idempotencyKey;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(activity.mock.calls[0][1].clientSessionKey).toBe(lifecycleKey);
    expect(activity.mock.calls[0][1].idempotencyKey).not.toBe(startIdempotency);
    await vi.advanceTimersByTimeAsync(29_000);
    window.dispatchEvent(new Event("pointerdown"));
    await vi.advanceTimersByTimeAsync(1_000);
    expect(activity.mock.calls[1][1].sequence).toBeGreaterThan(activity.mock.calls[0][1].sequence);
    expect(activity.mock.calls[1][1].idempotencyKey).not.toBe(activity.mock.calls[0][1].idempotencyKey);
    await controller.stop();
  });

  it("pauses when hidden or idle and resumes after real interaction", async () => {
    const controller = new EngagementSessionController({ targetType: "STORY", targetId: "story-1" });
    await controller.start();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(activity).not.toHaveBeenCalled();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await vi.advanceTimersByTimeAsync(61_000);
    const before = activity.mock.calls.length;
    window.dispatchEvent(new Event("pointerdown"));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(activity.mock.calls.length).toBeGreaterThan(before);
    await controller.stop();
  });

  it("silently stops after three consecutive tracking failures without blocking content", async () => {
    activity.mockRejectedValue(new Error("unavailable"));
    const controller = new EngagementSessionController({ targetType: "STORY", targetId: "story-1" });
    await controller.start();
    for (let attempt = 0; attempt < 3; attempt++) {
      window.dispatchEvent(new Event("pointerdown"));
      await vi.advanceTimersByTimeAsync(30_000);
    }
    expect(activity).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(activity).toHaveBeenCalledTimes(3);
    await controller.stop();
  });

  it.each([404, 409])("stops silently after terminal HTTP %s", async (status) => {
    activity.mockRejectedValue({ status });
    const controller = new EngagementSessionController({ targetType: "STORY", targetId: "story-1" });
    await controller.start();
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(activity).toHaveBeenCalledTimes(1);
    await controller.stop();
  });

  it("backs off after 429 without retrying infinitely", async () => {
    activity.mockRejectedValueOnce({ status: 429 }).mockResolvedValue(undefined);
    const controller = new EngagementSessionController({ targetType: "STORY", targetId: "story-1" });
    await controller.start();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(activity).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(activity).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event("pointerdown"));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(activity).toHaveBeenCalledTimes(2);
    await controller.stop();
  });

  it("keeps end cleanup best effort", async () => {
    end.mockRejectedValue(new Error("offline"));
    const controller = new EngagementSessionController({ targetType: "STORY", targetId: "story-1" });
    await controller.start();
    await expect(controller.stop()).resolves.toBeUndefined();
  });

  it("does not start while content document is hidden and stores no identity", async () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    const local = vi.spyOn(Storage.prototype, "setItem");
    const controller = new EngagementSessionController({ targetType: "STORY", targetId: "story-1" });
    await controller.start();
    expect(start).not.toHaveBeenCalled();
    expect(local).not.toHaveBeenCalled();
    local.mockRestore();
  });
});
