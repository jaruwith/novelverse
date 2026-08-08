import { ApiError } from "@/features/novel-editor/api";
import {
  getNotifications, getUnreadNotificationCount, markAllNotificationsRead, markNotificationRead,
  NOTIFICATION_PAGE_SIZE,
} from "./api";
import type { NotificationFilter, NotificationItem } from "./types";

export const NOTIFICATION_POLL_MS = 30_000;
export const NOTIFICATION_FOCUS_STALE_MS = 15_000;
export const NOTIFICATION_MAX_BACKOFF_MS = 300_000;
export const NOTIFICATION_MAX_RETAINED_ITEMS = 100;

export type NotificationErrorKind = "NETWORK" | "VALIDATION" | "UNAUTHORIZED" | "FORBIDDEN" |
  "NOT_FOUND" | "RATE_LIMIT" | "SERVER" | "UNKNOWN";

export type NotificationUiError = {
  kind: NotificationErrorKind;
  message: string;
  retryAfterSeconds: number | null;
};

export type NotificationsSnapshot = {
  sessionGeneration: number;
  authenticated: boolean;
  eligible: boolean | null;
  unreadCount: number | null;
  countRefreshing: boolean;
  countError: NotificationUiError | null;
  pageMounted: boolean;
  filter: NotificationFilter;
  items: NotificationItem[];
  nextCursor: string | null;
  feedStatus: "idle" | "loading" | "ready" | "error";
  feedError: NotificationUiError | null;
  loadingMore: boolean;
  markPendingIds: string[];
  markErrors: Record<string, NotificationUiError>;
  markAllPending: boolean;
  markAllError: NotificationUiError | null;
  announcement: string;
};

export type NotificationsApi = {
  getNotifications: typeof getNotifications;
  getUnreadNotificationCount: typeof getUnreadNotificationCount;
  markNotificationRead: typeof markNotificationRead;
  markAllNotificationsRead: typeof markAllNotificationsRead;
};

export type NotificationsRuntime = {
  now: () => number;
  random: () => number;
  setTimer: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clearTimer: (timer: ReturnType<typeof setTimeout>) => void;
  visible: () => boolean;
  online: () => boolean;
};

const defaultApi: NotificationsApi = {
  getNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead,
};

const browserRuntime: NotificationsRuntime = {
  now: () => Date.now(), random: () => Math.random(),
  setTimer: (callback, delay) => setTimeout(callback, delay), clearTimer: (timer) => clearTimeout(timer),
  visible: () => typeof document === "undefined" || document.visibilityState === "visible",
  online: () => typeof navigator === "undefined" || navigator.onLine,
};

const initialSnapshot = (): NotificationsSnapshot => ({
  sessionGeneration: 0, authenticated: false, eligible: null, unreadCount: null,
  countRefreshing: false, countError: null,
  pageMounted: false, filter: "ALL", items: [], nextCursor: null, feedStatus: "idle", feedError: null,
  loadingMore: false, markPendingIds: [], markErrors: {}, markAllPending: false, markAllError: null,
  announcement: "",
});

function retryAfterSeconds(error: ApiError, now: number): number | null {
  const raw = error.headers.get("Retry-After")?.trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Math.min(300, Math.max(1, Number(raw)));
  const date = Date.parse(raw);
  return Number.isNaN(date) ? null : Math.min(300, Math.max(1, Math.ceil((date - now) / 1_000)));
}

export function notificationError(reason: unknown, now = Date.now()): NotificationUiError {
  if (!(reason instanceof ApiError)) return {
    kind: "UNKNOWN", retryAfterSeconds: null,
    message: "ไม่สามารถโหลดการแจ้งเตือนได้ในขณะนี้ กรุณาลองอีกครั้ง",
  };
  if (reason.status === 0) return { kind: "NETWORK", retryAfterSeconds: null,
    message: "การเชื่อมต่อขัดข้อง ข้อมูลที่ยืนยันแล้วจะยังคงแสดงอยู่" };
  if (reason.status === 400) return { kind: "VALIDATION", retryAfterSeconds: null,
    message: "คำขอการแจ้งเตือนไม่ถูกต้อง กรุณาเริ่มโหลดรายการใหม่" };
  if (reason.status === 401) return { kind: "UNAUTHORIZED", retryAfterSeconds: null,
    message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง" };
  if (reason.status === 403) return { kind: "FORBIDDEN", retryAfterSeconds: null,
    message: "บัญชีนี้ยังไม่พร้อมใช้งานศูนย์การแจ้งเตือน" };
  if (reason.status === 404) return { kind: "NOT_FOUND", retryAfterSeconds: null,
    message: "การแจ้งเตือนนี้ไม่พร้อมใช้งานแล้ว" };
  if (reason.status === 429) {
    const retry = retryAfterSeconds(reason, now);
    return { kind: "RATE_LIMIT", retryAfterSeconds: retry,
      message: retry ? `มีคำขอมากเกินไป กรุณาลองอีกครั้งใน ${retry} วินาที`
        : "มีคำขอมากเกินไป กรุณาลองอีกครั้งภายหลัง" };
  }
  if (reason.status >= 500) return { kind: "SERVER", retryAfterSeconds: null,
    message: "ระบบการแจ้งเตือนขัดข้องชั่วคราว ข้อมูลที่ยืนยันแล้วจะยังคงแสดงอยู่" };
  return { kind: "UNKNOWN", retryAfterSeconds: null, message: "ไม่สามารถดำเนินการกับการแจ้งเตือนได้" };
}

export function notificationBackoffMs(failure: number, random: () => number) {
  const steps = [30_000, 60_000, 120_000, 300_000];
  const base = steps[Math.min(Math.max(0, failure - 1), steps.length - 1)];
  const jittered = Math.round(base * (0.9 + Math.min(1, Math.max(0, random())) * 0.2));
  return Math.min(NOTIFICATION_MAX_BACKOFF_MS, jittered);
}

type OwnedRequest = { id: number; session: number; route: number | null; controller: AbortController };
type MarkRequest = OwnedRequest & { notificationId: string };

export class NotificationsController {
  private snapshot = initialSnapshot();
  private readonly serverSnapshot = initialSnapshot();
  private readonly listeners = new Set<() => void>();
  private session = 0;
  private route = 0;
  private requestId = 0;
  private destroyed = false;
  private countRequest: OwnedRequest | null = null;
  private feedRequest: OwnedRequest | null = null;
  private readonly markRequests = new Map<string, MarkRequest>();
  private markAllRequest: OwnedRequest | null = null;
  private countTimer: ReturnType<typeof setTimeout> | null = null;
  private countQueued = false;
  private countFailure = 0;
  private countLastSuccess = 0;
  private countNextAllowed = 0;
  private feedLastSuccess = 0;

  constructor(private readonly api: NotificationsApi = defaultApi,
    private readonly runtime: NotificationsRuntime = browserRuntime) {}

  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => this.serverSnapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private commit(patch: Partial<NotificationsSnapshot>) {
    if (this.destroyed) return;
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private current(request: OwnedRequest) {
    return !this.destroyed && !request.controller.signal.aborted && request.session === this.session &&
      (request.route === null || request.route === this.route);
  }

  private begin(route: number | null = this.route): OwnedRequest {
    return { id: ++this.requestId, session: this.session, route, controller: new AbortController() };
  }

  private cancelCountTimer() {
    if (this.countTimer !== null) this.runtime.clearTimer(this.countTimer);
    this.countTimer = null;
  }

  private abortAll() {
    this.cancelCountTimer();
    this.countRequest?.controller.abort();
    this.feedRequest?.controller.abort();
    this.markRequests.forEach((request) => request.controller.abort());
    this.markAllRequest?.controller.abort();
    this.countRequest = null; this.feedRequest = null; this.markAllRequest = null;
    this.markRequests.clear(); this.countQueued = false;
  }

  private terminatePrivateState(error: NotificationUiError) {
    this.session += 1; this.route += 1; this.abortAll();
    this.snapshot = { ...initialSnapshot(), sessionGeneration: this.session,
      authenticated: false, countError: error };
    this.listeners.forEach((listener) => listener());
  }

  setSession(authenticated: boolean) {
    this.session += 1; this.route += 1; this.abortAll();
    this.countFailure = 0; this.countLastSuccess = 0; this.feedLastSuccess = 0; this.countNextAllowed = 0;
    this.snapshot = { ...initialSnapshot(), sessionGeneration: this.session, authenticated };
    this.listeners.forEach((listener) => listener());
    if (authenticated) void this.refreshUnreadCount(true);
  }

  mountPage() {
    this.route += 1;
    const ownedRoute = this.route;
    this.abortPageOperations();
    this.commit({ pageMounted: true, filter: "ALL", items: [], nextCursor: null,
      feedStatus: this.snapshot.authenticated ? "loading" : "idle", feedError: null,
      loadingMore: false, markPendingIds: [], markErrors: {}, markAllPending: false, markAllError: null });
    if (this.snapshot.authenticated) void this.requestFeed(null, true, false, ownedRoute);
    return () => {
      if (this.route !== ownedRoute) return;
      this.route += 1; this.abortPageOperations();
      this.commit({ pageMounted: false, items: [], nextCursor: null, feedStatus: "idle", feedError: null,
        loadingMore: false, markPendingIds: [], markErrors: {}, markAllPending: false, markAllError: null,
        announcement: "" });
    };
  }

  private abortPageOperations() {
    this.feedRequest?.controller.abort(); this.feedRequest = null;
    this.markRequests.forEach((request) => request.controller.abort()); this.markRequests.clear();
    this.markAllRequest?.controller.abort(); this.markAllRequest = null;
  }

  setFilter(filter: NotificationFilter) {
    if ((filter !== "ALL" && filter !== "UNREAD") || filter === this.snapshot.filter) return;
    this.route += 1; const ownedRoute = this.route; this.abortPageOperations();
    this.commit({ filter, items: [], nextCursor: null, feedStatus: "loading", feedError: null,
      loadingMore: false, markPendingIds: [], markErrors: {}, markAllPending: false, markAllError: null,
      announcement: "" });
    if (this.snapshot.authenticated) void this.requestFeed(null, true, false, ownedRoute);
  }

  private canPoll() {
    return this.snapshot.authenticated && this.runtime.visible() && this.runtime.online();
  }

  private scheduleCount(delay: number, restrictUntilTimer = false) {
    this.cancelCountTimer();
    if (!this.canPoll()) return;
    const bounded = Math.max(0, Math.min(NOTIFICATION_MAX_BACKOFF_MS, delay));
    if (restrictUntilTimer) this.countNextAllowed = this.runtime.now() + bounded;
    this.countTimer = this.runtime.setTimer(() => {
      this.countTimer = null;
      void this.refreshUnreadCount();
    }, bounded);
  }

  async refreshUnreadCount(force = false): Promise<void> {
    if (!this.canPoll()) return;
    if (!force && this.runtime.now() < this.countNextAllowed) {
      this.scheduleCount(this.countNextAllowed - this.runtime.now());
      return;
    }
    if (this.countRequest) { this.countQueued = this.countQueued || force; return; }
    const request = this.begin(null);
    this.countRequest = request;
    this.cancelCountTimer();
    this.commit({ countRefreshing: true, countError: null });
    let delay = NOTIFICATION_POLL_MS;
    let restrictUntilTimer = false;
    try {
      const count = await this.api.getUnreadNotificationCount(request.controller.signal);
      if (!this.current(request) || this.countRequest?.id !== request.id) return;
      this.countFailure = 0; this.countLastSuccess = this.runtime.now();
      this.countNextAllowed = 0;
      this.commit({ unreadCount: count, countRefreshing: false, countError: null, eligible: true });
    } catch (reason) {
      if (!this.current(request) || this.countRequest?.id !== request.id) return;
      const error = notificationError(reason, this.runtime.now());
      if (error.kind === "FORBIDDEN") {
        this.commit({ eligible: false, unreadCount: null, countRefreshing: false, countError: error,
          items: [], nextCursor: null, feedStatus: "error", feedError: error });
        return;
      }
      if (error.kind === "UNAUTHORIZED") {
        this.terminatePrivateState(error);
        return;
      }
      this.countFailure += 1;
      delay = error.retryAfterSeconds !== null ? error.retryAfterSeconds * 1_000
        : notificationBackoffMs(this.countFailure, this.runtime.random);
      restrictUntilTimer = true;
      this.commit({ countRefreshing: false, countError: error });
    } finally {
      if (this.countRequest?.id === request.id) this.countRequest = null;
      if (!this.current(request)) return;
      if (this.countQueued) {
        this.countQueued = false; this.countNextAllowed = 0;
        void this.refreshUnreadCount(true);
      } else if (this.snapshot.eligible !== false) this.scheduleCount(delay, restrictUntilTimer);
    }
  }

  private abortCountForMutation() {
    this.cancelCountTimer(); this.countNextAllowed = 0;
    if (this.countRequest) { this.countRequest.controller.abort(); this.countRequest = null; }
    this.commit({ countRefreshing: false });
  }

  async refreshFeed(announce = false) {
    if (!this.snapshot.pageMounted || !this.snapshot.authenticated) return;
    await this.requestFeed(null, true, announce, this.route);
  }

  async loadMore() {
    const cursor = this.snapshot.nextCursor;
    if (!cursor || this.snapshot.loadingMore || !this.snapshot.authenticated) return;
    await this.requestFeed(cursor, false, true, this.route);
  }

  private async requestFeed(cursor: string | null, reset: boolean, announce: boolean, ownedRoute: number) {
    if (!this.snapshot.authenticated || !this.snapshot.pageMounted || this.snapshot.eligible === false) return;
    if (this.feedRequest) {
      if (!reset) return;
      this.feedRequest.controller.abort(); this.feedRequest = null;
    }
    const request = this.begin(ownedRoute);
    this.feedRequest = request;
    if (reset) this.commit({ feedStatus: this.snapshot.items.length ? "ready" : "loading", feedError: null });
    else this.commit({ loadingMore: true, feedError: null });
    try {
      const page = await this.api.getNotifications({ filter: this.snapshot.filter,
        pageSize: NOTIFICATION_PAGE_SIZE, cursor, signal: request.controller.signal });
      if (!this.current(request) || this.feedRequest?.id !== request.id) return;
      const existing = reset ? [] : this.snapshot.items;
      const ids = new Set(existing.map((item) => item.id));
      const items = [...existing, ...page.items.filter((item) => !ids.has(item.id))]
        .slice(0, NOTIFICATION_MAX_RETAINED_ITEMS);
      const nextCursor = items.length >= NOTIFICATION_MAX_RETAINED_ITEMS ? null : page.nextCursor;
      this.feedLastSuccess = this.runtime.now();
      this.commit({ items, nextCursor, feedStatus: "ready", feedError: null, loadingMore: false, eligible: true,
        announcement: announce ? (reset ? "รีเฟรชรายการแจ้งเตือนแล้ว" : `โหลดเพิ่ม ${page.items.length} รายการ`) : this.snapshot.announcement });
    } catch (reason) {
      if (!this.current(request) || this.feedRequest?.id !== request.id) return;
      const error = notificationError(reason, this.runtime.now());
      if (error.kind === "UNAUTHORIZED") { this.terminatePrivateState(error); return; }
      if (error.kind === "FORBIDDEN") this.commit({ eligible: false, items: [], nextCursor: null,
        feedStatus: "error", feedError: error, loadingMore: false });
      else this.commit({ feedStatus: this.snapshot.items.length ? "ready" : "error", feedError: error,
        loadingMore: false });
    } finally {
      if (this.feedRequest?.id === request.id) this.feedRequest = null;
    }
  }

  private async reconcileMutation() {
    await Promise.all([this.refreshUnreadCount(true), this.refreshFeed(false)]);
  }

  async markRead(notificationId: string): Promise<boolean> {
    if (!this.snapshot.authenticated || this.markRequests.has(notificationId)) return false;
    const request = { ...this.begin(), notificationId };
    this.markRequests.set(notificationId, request);
    this.abortCountForMutation();
    const errors = { ...this.snapshot.markErrors }; delete errors[notificationId];
    this.commit({ markPendingIds: [...this.markRequests.keys()], markErrors: errors });
    try {
      await this.api.markNotificationRead(notificationId, request.controller.signal);
      if (!this.current(request) || this.markRequests.get(notificationId)?.id !== request.id) return false;
      await this.reconcileMutation();
      if (!this.current(request)) return false;
      this.commit({ announcement: "ทำเครื่องหมายว่าอ่านแล้ว" });
      return true;
    } catch (reason) {
      if (!this.current(request) || this.markRequests.get(notificationId)?.id !== request.id) return false;
      const error = notificationError(reason, this.runtime.now());
      if (error.kind === "UNAUTHORIZED") { this.terminatePrivateState(error); return false; }
      if (error.kind === "NOT_FOUND") await this.reconcileMutation();
      if (this.current(request)) this.commit({ markErrors: { ...this.snapshot.markErrors, [notificationId]: error } });
      return false;
    } finally {
      if (this.markRequests.get(notificationId)?.id === request.id) {
        this.markRequests.delete(notificationId);
        this.commit({ markPendingIds: [...this.markRequests.keys()] });
      }
    }
  }

  async markAllRead(): Promise<boolean> {
    if (!this.snapshot.authenticated || this.markAllRequest) return false;
    const request = this.begin(); this.markAllRequest = request; this.abortCountForMutation();
    this.commit({ markAllPending: true, markAllError: null });
    try {
      await this.api.markAllNotificationsRead(request.controller.signal);
      if (!this.current(request) || this.markAllRequest?.id !== request.id) return false;
      await this.reconcileMutation();
      if (!this.current(request)) return false;
      this.commit({ announcement: "อัปเดตสถานะอ่านทั้งหมดจากเซิร์ฟเวอร์แล้ว" });
      return true;
    } catch (reason) {
      if (!this.current(request) || this.markAllRequest?.id !== request.id) return false;
      const error = notificationError(reason, this.runtime.now());
      if (error.kind === "UNAUTHORIZED") { this.terminatePrivateState(error); return false; }
      this.commit({ markAllError: error });
      return false;
    } finally {
      if (this.markAllRequest?.id === request.id) {
        this.markAllRequest = null; this.commit({ markAllPending: false });
      }
    }
  }

  handleFocusOrVisibility() {
    if (!this.canPoll()) { this.cancelCountTimer(); return; }
    const now = this.runtime.now();
    if (now >= this.countNextAllowed && (!this.countLastSuccess || now - this.countLastSuccess >= NOTIFICATION_FOCUS_STALE_MS))
      void this.refreshUnreadCount(true);
    else if (!this.countRequest) this.scheduleCount(Math.max(0, this.countNextAllowed - now));
    if (this.snapshot.pageMounted && (!this.feedLastSuccess || now - this.feedLastSuccess >= NOTIFICATION_FOCUS_STALE_MS))
      void this.refreshFeed(false);
  }

  handleOfflineOrHidden() {
    if (!this.canPoll()) this.cancelCountTimer();
  }

  destroy() {
    this.destroyed = true; this.session += 1; this.route += 1; this.abortAll(); this.listeners.clear();
  }
}
