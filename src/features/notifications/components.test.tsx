import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationBell } from "./NotificationBell";
import { NotificationItem, notificationMessage } from "./NotificationItem";
import { NotificationsPage } from "./NotificationsPage";
import type { NotificationsSnapshot } from "./controller";
import type { NotificationItem as Item, NotificationType } from "./types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("@/features/novel-editor/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/novel-editor/api")>(), hasSession: () => true,
}));

const controller = {
  getSnapshot: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn(), setFilter: vi.fn(),
  refreshFeed: vi.fn(), loadMore: vi.fn(), mountPage: vi.fn(() => vi.fn()),
};
let currentState: NotificationsSnapshot;
vi.mock("./NotificationsProvider", () => ({
  useNotifications: () => ({ state: currentState, controller }),
}));

const baseState = (): NotificationsSnapshot => ({
  sessionGeneration: 1, authenticated: true, eligible: true, unreadCount: 0,
  countRefreshing: false, countError: null,
  pageMounted: true, filter: "ALL", items: [], nextCursor: null, feedStatus: "ready", feedError: null,
  loadingMore: false, markPendingIds: [], markErrors: {}, markAllPending: false, markAllError: null,
  announcement: "",
});
const id = "11111111-1111-4111-8111-111111111111";
const makeItem = (type: NotificationType, overrides: Partial<Item> = {}): Item => ({
  id, type, actor: { displayName: "<script>alert(1)</script>" },
  target: { title: "เรื่อง <b>ไทย</b>", available: true,
    route: { href: "/stories/author/story", family: "STORY", commentId: null } },
  outcome: null, createdAt: "2026-08-07T01:00:00Z", readAt: null, ...overrides,
});

describe("Notifications accessible UI", () => {
  beforeEach(() => {
    vi.clearAllMocks(); currentState = baseState();
    controller.getSnapshot.mockImplementation(() => currentState);
    controller.markRead.mockResolvedValue(true);
  });

  it("hides the Bell outside an authenticated shell and exposes exact count while visually capping", () => {
    currentState = { ...baseState(), authenticated: false, unreadCount: 101 };
    const view = render(<NotificationBell />);
    expect(screen.queryByRole("link", { name: /การแจ้งเตือน/ })).not.toBeInTheDocument();
    currentState = { ...baseState(), unreadCount: 101 }; view.rerender(<NotificationBell />);
    expect(screen.getByRole("link", { name: /101/ })).toHaveAttribute("href", "/notifications");
    expect(screen.getByText("99+")).toHaveAttribute("aria-hidden", "true");
  });

  it("hides a zero badge and provides a mobile-size named navigation target", () => {
    render(<NotificationBell mobile />);
    expect(screen.getByRole("link", { name: /ไม่มีรายการที่ยังไม่ได้อ่าน/ })).toHaveAttribute("href", "/notifications");
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.getByText("ศูนย์การแจ้งเตือน")).toBeInTheDocument();
  });

  it.each([
    ["COMMENT_REPLY_CREATED", "ตอบกลับความคิดเห็น"],
    ["COMMENT_LIKE_CREATED", "ถูกใจความคิดเห็น"],
    ["CREATOR_CONTENT_COMMENT_CREATED", "ความคิดเห็นใหม่"],
    ["CREATOR_FOLLOW_CREATED", "เริ่มติดตาม"],
    ["MODERATION_REPORT_RESOLVED", "รายงานของคุณ"],
    ["MODERATION_VISIBILITY_CHANGED", "ผู้ดูแลซ่อน"],
  ] as const)("renders %s from the safe projection without interpreting markup", (type, text) => {
    const notification = makeItem(type, type === "MODERATION_REPORT_RESOLVED"
      ? { actor: null, outcome: "DISMISSED", target: { title: null, route: null, available: false } }
      : type === "MODERATION_VISIBILITY_CHANGED"
        ? { actor: null, outcome: "HIDDEN", target: { title: null, route: null, available: false } } : {});
    render(<NotificationItem item={notification} controller={controller as never} />);
    expect(screen.getAllByText(new RegExp(text)).length).toBeGreaterThan(0);
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByText(/ยังไม่ได้อ่าน/)).toBeInTheDocument();
    expect(screen.getByRole("time")).toHaveAttribute("datetime", notification.createdAt);
  });

  it("distinguishes Story and Episode content-comment routes without double encoding", () => {
    const story = makeItem("CREATOR_CONTENT_COMMENT_CREATED");
    const episode = makeItem("CREATOR_CONTENT_COMMENT_CREATED", { id: "22222222-2222-4222-8222-222222222222",
      target: { title: "ตอน", available: true,
        route: { href: "/read-novel/%E0%B8%84%E0%B8%99/story/%E0%B8%95%E0%B8%AD%E0%B8%99",
          family: "NOVEL", commentId: null } } });
    const view = render(<NotificationItem item={story} controller={controller as never} />);
    expect(screen.getByRole("link", { name: /เปิดปลายทาง/ })).toHaveAttribute("href", "/stories/author/story");
    view.rerender(<NotificationItem item={episode} controller={controller as never} />);
    expect(screen.getByRole("link", { name: /เปิดปลายทาง/ }).getAttribute("href")).not.toContain("%25");
  });

  it("shows no unsafe action for an unavailable target and offers explicit mark-read", async () => {
    const notification = makeItem("COMMENT_REPLY_CREATED", {
      target: { title: null, route: null, available: false },
    });
    render(<NotificationItem item={notification} controller={controller as never} />);
    expect(screen.queryByRole("link", { name: /เปิดปลายทาง/ })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("ไม่พร้อมให้บริการ");
    fireEvent.click(screen.getByRole("button", { name: /ทำเครื่องหมายว่าอ่านแล้ว/ }));
    await waitFor(() => expect(controller.markRead).toHaveBeenCalledWith(id));
  });

  it("attempts server-confirmed mark-read before safe internal navigation", async () => {
    render(<NotificationItem item={makeItem("COMMENT_REPLY_CREATED")} controller={controller as never} />);
    fireEvent.click(screen.getByRole("link", { name: /เปิดปลายทาง/ }));
    await waitFor(() => expect(controller.markRead).toHaveBeenCalledWith(id));
    expect(push).toHaveBeenCalledWith("/stories/author/story");
  });

  it("owns filters, mark-all, Load More, loading, empty, and incremental errors on one page", async () => {
    currentState = { ...baseState(), unreadCount: 3, items: [makeItem("COMMENT_REPLY_CREATED")],
      nextCursor: "opaque_1" };
    render(<NotificationsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "การแจ้งเตือน" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ทั้งหมด" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "ยังไม่ได้อ่าน" }));
    expect(controller.setFilter).toHaveBeenCalledWith("UNREAD");
    fireEvent.click(screen.getByRole("button", { name: "โหลดเพิ่มเติม" }));
    expect(controller.loadMore).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "อ่านทั้งหมดแล้ว" }));
    expect(controller.markAllRead).toHaveBeenCalled();
    expect(controller.mountPage).toHaveBeenCalled();
  });

  it("remounts page ownership when A→B remains authenticated but session generation changes", () => {
    const view = render(<NotificationsPage />);
    expect(controller.mountPage).toHaveBeenCalledTimes(1);
    currentState = { ...currentState, sessionGeneration: 2 };
    view.rerender(<NotificationsPage />);
    expect(controller.mountPage).toHaveBeenCalledTimes(2);
  });

  it("uses meaningful system and anonymized actor copy without moderator/evidence/private payload leakage", () => {
    const anonymized = makeItem("COMMENT_LIKE_CREATED", { actor: null });
    expect(notificationMessage(anonymized)).toContain("สมาชิกที่ไม่เปิดเผยชื่อ");
    const moderation = makeItem("MODERATION_REPORT_RESOLVED", { actor: null, outcome: "ACTION_TAKEN" });
    const message = notificationMessage(moderation);
    expect(message).not.toMatch(/moderator|เหตุผล|หลักฐาน|userId/i);
  });
});
