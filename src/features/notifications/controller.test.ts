import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/features/novel-editor/api";
import {
  NOTIFICATION_FOCUS_STALE_MS, NOTIFICATION_MAX_BACKOFF_MS, NOTIFICATION_POLL_MS,
  NotificationsController, type NotificationsApi,
} from "./controller";
import type { NotificationItem, NotificationPage } from "./types";

const firstId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
const item = (id = firstId, readAt: string | null = null): NotificationItem => ({
  id, type: "COMMENT_REPLY_CREATED", actor: { displayName: "Reader" },
  target: { title: "Story", available: true,
    route: { href: "/stories/creator/story", family: "STORY", commentId: null } },
  outcome: null, createdAt: "2026-08-07T01:00:00Z", readAt,
});
const page = (items: NotificationItem[] = [], nextCursor: string | null = null): NotificationPage => ({ items, nextCursor });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

function api(): NotificationsApi {
  return {
    getUnreadNotificationCount: vi.fn().mockResolvedValue(0),
    getNotifications: vi.fn().mockResolvedValue(page()),
    markNotificationRead: vi.fn().mockResolvedValue(undefined),
    markAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
  };
}

describe("Notifications private controller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T02:00:00Z"));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });
  afterEach(() => vi.useRealTimers());

  it("loads immediately, polls every 30 seconds, and never overlaps count requests", async () => {
    const service = api();
    const slow = deferred<number>();
    vi.mocked(service.getUnreadNotificationCount).mockReturnValueOnce(slow.promise).mockResolvedValue(4);
    const controller = new NotificationsController(service);
    controller.setSession(true);
    expect(service.getUnreadNotificationCount).toHaveBeenCalledTimes(1);
    controller.handleFocusOrVisibility();
    expect(service.getUnreadNotificationCount).toHaveBeenCalledTimes(1);
    slow.resolve(3); await settle();
    expect(service.getUnreadNotificationCount).toHaveBeenCalledTimes(2);
    await settle();
    expect(controller.getSnapshot().unreadCount).toBe(4);
    await vi.advanceTimersByTimeAsync(NOTIFICATION_POLL_MS);
    expect(service.getUnreadNotificationCount).toHaveBeenCalledTimes(3);
    controller.destroy();
  });

  it("pauses hidden/offline and refreshes on visible focus only after the stale threshold", async () => {
    const service = api();
    const controller = new NotificationsController(service);
    controller.setSession(true); await settle();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    controller.handleOfflineOrHidden();
    await vi.advanceTimersByTimeAsync(NOTIFICATION_POLL_MS * 2);
    expect(service.getUnreadNotificationCount).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    controller.handleFocusOrVisibility(); await settle();
    expect(service.getUnreadNotificationCount).toHaveBeenCalledTimes(2);
    vi.setSystemTime(Date.now() + NOTIFICATION_FOCUS_STALE_MS - 1);
    controller.handleFocusOrVisibility(); await settle();
    expect(service.getUnreadNotificationCount).toHaveBeenCalledTimes(2);
    vi.setSystemTime(Date.now() + 2);
    controller.handleFocusOrVisibility(); await settle();
    expect(service.getUnreadNotificationCount).toHaveBeenCalledTimes(3);
    controller.destroy();
  });

  it("backs off transient failures, caps delays, honors Retry-After, and resets after success", async () => {
    const service = api();
    vi.mocked(service.getUnreadNotificationCount)
      .mockRejectedValueOnce(new ApiError(500))
      .mockRejectedValueOnce(new ApiError(429, undefined, new Headers({ "Retry-After": "60" })))
      .mockResolvedValue(2);
    const controller = new NotificationsController(service, {
      now: () => Date.now(), random: () => 0.5,
      setTimer: (callback, delay) => setTimeout(callback, delay), clearTimer: (timer) => clearTimeout(timer),
      visible: () => true, online: () => true,
    });
    controller.setSession(true); await settle();
    await vi.advanceTimersByTimeAsync(29_999);
    expect(service.getUnreadNotificationCount).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); await settle();
    expect(service.getUnreadNotificationCount).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(service.getUnreadNotificationCount).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1); await settle();
    expect(controller.getSnapshot().unreadCount).toBe(2);
    await vi.advanceTimersByTimeAsync(NOTIFICATION_POLL_MS); await settle();
    expect(service.getUnreadNotificationCount).toHaveBeenCalledTimes(4);
    expect(NOTIFICATION_MAX_BACKOFF_MS).toBe(300_000);
    controller.destroy();
  });

  it("synchronously clears private count and rejects User A success after logout", async () => {
    const service = api(); const a = deferred<number>();
    vi.mocked(service.getUnreadNotificationCount).mockReturnValueOnce(a.promise);
    const controller = new NotificationsController(service);
    controller.setSession(true);
    controller.setSession(false);
    expect(controller.getSnapshot()).toEqual(expect.objectContaining({ authenticated: false, unreadCount: null,
      items: [], markPendingIds: [] }));
    a.resolve(99); await settle();
    expect(controller.getSnapshot().unreadCount).toBeNull();
    controller.destroy();
  });

  it("rejects User A late failure after User B login and same-user relogin generations", async () => {
    const service = api(); const a = deferred<number>();
    vi.mocked(service.getUnreadNotificationCount).mockReturnValueOnce(a.promise).mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);
    const controller = new NotificationsController(service);
    controller.setSession(true);
    controller.setSession(true); await settle();
    expect(controller.getSnapshot().unreadCount).toBe(2);
    a.reject(new ApiError(500)); await settle();
    expect(controller.getSnapshot().unreadCount).toBe(2);
    controller.setSession(true); await settle();
    expect(controller.getSnapshot().unreadCount).toBe(3);
    controller.destroy();
  });

  it("treats 401 as terminal and clears feed, mutations, timers, and authentication", async () => {
    const service = api();
    vi.mocked(service.getUnreadNotificationCount).mockRejectedValueOnce(new ApiError(401));
    const controller = new NotificationsController(service);
    controller.setSession(true); await settle();
    expect(controller.getSnapshot()).toEqual(expect.objectContaining({ authenticated: false, unreadCount: null,
      items: [], markPendingIds: [], markAllPending: false }));
    await vi.advanceTimersByTimeAsync(NOTIFICATION_POLL_MS * 2);
    expect(service.getUnreadNotificationCount).toHaveBeenCalledTimes(1);
    controller.destroy();
  });

  it("rejects A initial, Load More, and filter pages after a B session transition", async () => {
    const service = api(); const a = deferred<NotificationPage>();
    vi.mocked(service.getNotifications).mockReturnValueOnce(a.promise).mockResolvedValue(page([item(secondId)]));
    const controller = new NotificationsController(service);
    controller.setSession(true); await settle(); controller.mountPage();
    controller.setSession(true); await settle(); controller.mountPage(); await settle();
    a.resolve(page([item(firstId)], "cursorA")); await settle();
    expect(controller.getSnapshot().items.map((entry) => entry.id)).toEqual([secondId]);
    expect(controller.getSnapshot().loadingMore).toBe(false);
    controller.setFilter("UNREAD"); await settle();
    expect(vi.mocked(service.getNotifications).mock.calls.at(-1)?.[0].filter).toBe("UNREAD");
    controller.destroy();
  });

  it("deduplicates keyset pages, preserves rows on incremental error, and bounds retained rows", async () => {
    const service = api();
    vi.mocked(service.getNotifications)
      .mockResolvedValueOnce(page([item(firstId)], "cursor_1"))
      .mockRejectedValueOnce(new ApiError(504))
      .mockResolvedValueOnce(page([item(firstId), item(secondId)], null));
    const controller = new NotificationsController(service);
    controller.setSession(true); await settle(); controller.mountPage(); await settle();
    await controller.loadMore();
    expect(controller.getSnapshot().items).toHaveLength(1);
    expect(controller.getSnapshot().feedError?.kind).toBe("SERVER");
    await controller.loadMore();
    expect(controller.getSnapshot().items.map((entry) => entry.id)).toEqual([firstId, secondId]);
    controller.destroy();
  });

  it("scopes independent mark-one requests and suppresses only duplicate IDs", async () => {
    const service = api(); const one = deferred<void>(); const two = deferred<void>();
    vi.mocked(service.markNotificationRead).mockReturnValueOnce(one.promise).mockReturnValueOnce(two.promise);
    const controller = new NotificationsController(service);
    controller.setSession(true); await settle(); controller.mountPage(); await settle();
    const first = controller.markRead(firstId);
    const duplicate = controller.markRead(firstId);
    const second = controller.markRead(secondId);
    expect(service.markNotificationRead).toHaveBeenCalledTimes(2);
    expect(await duplicate).toBe(false);
    one.resolve(); two.resolve(); await Promise.all([first, second]);
    expect(controller.getSnapshot().markPendingIds).toEqual([]);
    controller.destroy();
  });

  it("aborts stale polling during mark-one and reconciles badge/feed from server", async () => {
    const service = api(); const stalePoll = deferred<number>();
    vi.mocked(service.getUnreadNotificationCount)
      .mockResolvedValueOnce(5).mockReturnValueOnce(stalePoll.promise).mockResolvedValueOnce(4);
    vi.mocked(service.getNotifications).mockResolvedValue(page([item(firstId, "2026-08-07T02:00:00Z")]));
    const controller = new NotificationsController(service);
    controller.setSession(true); await settle(); controller.mountPage(); await settle();
    void controller.refreshUnreadCount(true); await settle();
    const marked = controller.markRead(firstId); await settle();
    stalePoll.resolve(99); await marked; await settle();
    expect(controller.getSnapshot().unreadCount).toBe(4);
    expect(controller.getSnapshot().items[0].readAt).not.toBeNull();
    controller.destroy();
  });

  it("preserves post-cutoff unread arrivals after mark-all through authoritative reconciliation", async () => {
    const service = api();
    vi.mocked(service.getUnreadNotificationCount).mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    vi.mocked(service.getNotifications).mockResolvedValueOnce(page([item(firstId)]))
      .mockResolvedValueOnce(page([item(secondId)]));
    const controller = new NotificationsController(service);
    controller.setSession(true); await settle(); controller.mountPage(); await settle();
    expect(await controller.markAllRead()).toBe(true);
    expect(controller.getSnapshot().unreadCount).toBe(1);
    expect(controller.getSnapshot().items.map((entry) => entry.id)).toEqual([secondId]);
    controller.destroy();
  });

  it("invalidates mark-one, mark-all, polling, and finally callbacks on a session switch", async () => {
    const service = api(); const mark = deferred<void>(); const all = deferred<void>();
    vi.mocked(service.markNotificationRead).mockReturnValue(mark.promise);
    vi.mocked(service.markAllNotificationsRead).mockReturnValue(all.promise);
    const controller = new NotificationsController(service);
    controller.setSession(true); await settle(); controller.mountPage(); await settle();
    const markPromise = controller.markRead(firstId); const allPromise = controller.markAllRead();
    controller.setSession(true); await settle();
    mark.resolve(); all.resolve(); await Promise.all([markPromise, allPromise]);
    expect(controller.getSnapshot()).toEqual(expect.objectContaining({ authenticated: true,
      markPendingIds: [], markAllPending: false, items: [] }));
    controller.destroy();
  });

  it("cancels timers and requests on unmount/destroy without stale loading callbacks", async () => {
    const service = api(); const feed = deferred<NotificationPage>();
    vi.mocked(service.getNotifications).mockReturnValue(feed.promise);
    const controller = new NotificationsController(service);
    controller.setSession(true); await settle(); const unmount = controller.mountPage();
    const signal = vi.mocked(service.getNotifications).mock.calls[0][0].signal!;
    unmount();
    expect(signal.aborted).toBe(true);
    feed.resolve(page([item()])); await settle();
    expect(controller.getSnapshot()).toEqual(expect.objectContaining({ pageMounted: false, items: [],
      loadingMore: false }));
    controller.destroy();
    await vi.advanceTimersByTimeAsync(NOTIFICATION_MAX_BACKOFF_MS);
  });
});
