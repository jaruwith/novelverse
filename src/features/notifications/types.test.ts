import { describe, expect, it } from "vitest";
import {
  NotificationContractError, parseNotificationItem, parseNotificationPage,
  parseNotificationProblemDetails, parseNotificationRoute, parseUnreadNotificationCount,
} from "./types";

const id = "11111111-1111-4111-8111-111111111111";
const item = (overrides: Record<string, unknown> = {}) => ({
  id, type: "COMMENT_REPLY_CREATED", actorDisplayName: "นักอ่าน", targetTitle: "เรื่องไทย",
  targetRoute: "/stories/%E0%B8%99%E0%B8%B1%E0%B8%81%E0%B9%80%E0%B8%82%E0%B8%B5%E0%B8%A2%E0%B8%99/%E0%B9%80%E0%B8%A3%E0%B8%B7%E0%B9%88%E0%B8%AD%E0%B8%87#comment-22222222-2222-4222-8222-222222222222",
  outcome: null, createdAt: "2026-08-07T01:02:03.123456Z", readAt: null, ...overrides,
});

describe("Notifications runtime contract parsers", () => {
  it("normalizes the flattened runtime projection into safe typed actor and target values", () => {
    const parsed = parseNotificationItem(item());
    expect(parsed.actor).toEqual({ displayName: "นักอ่าน" });
    expect(parsed.target.route).toEqual(expect.objectContaining({ family: "STORY",
      commentId: "22222222-2222-4222-8222-222222222222" }));
    expect(parsed.readAt).toBeNull();
  });

  it.each([
    "https://evil.example/steal", "//evil.example/steal", "javascript:alert(1)", "data:text/html,x",
    "/login?next=https://evil.example", "/stories/a/%252F", "/unknown/a/b", "/stories/a/b#other",
  ])("rejects unsafe or unsupported route %s", (route) => {
    expect(() => parseNotificationRoute(route)).toThrow(NotificationContractError);
  });

  it.each([
    ["story", "/stories/author/story", "STORY"],
    ["novel", "/read-novel/author/story/episode", "NOVEL"],
    ["comic Thai", "/read-comic/%E0%B8%84%E0%B8%99/%E0%B9%80%E0%B8%A3%E0%B8%B7%E0%B9%88%E0%B8%AD%E0%B8%87/%E0%B8%95%E0%B8%AD%E0%B8%99", "COMIC"],
    ["video emoji", "/watch-video/writer/story/%F0%9F%99%82", "VIDEO"],
  ])("accepts a canonical single-encoded %s route", (_name, route, family) => {
    expect(parseNotificationRoute(route)).toEqual({ href: route, family, commentId: null });
  });

  it("rejects unknown enums, private fields, impossible read state, and malformed UUIDs", () => {
    expect(() => parseNotificationItem(item({ type: "STORY_LIKE_CREATED" }))).toThrow();
    expect(() => parseNotificationItem({ ...item(), userId: id })).toThrow(/fields/);
    expect(() => parseNotificationItem(item({ id: "not-a-guid" }))).toThrow();
    expect(() => parseNotificationItem(item({ readAt: "2026-08-06T01:00:00Z" }))).toThrow(/order/);
  });

  it("enforces moderation projection privacy and outcome combinations", () => {
    expect(parseNotificationItem(item({ type: "MODERATION_REPORT_RESOLVED", actorDisplayName: null,
      targetTitle: null, targetRoute: null, outcome: "DISMISSED" })).outcome).toBe("DISMISSED");
    expect(() => parseNotificationItem(item({ type: "MODERATION_REPORT_RESOLVED",
      actorDisplayName: "Moderator", outcome: "ACTION_TAKEN" }))).toThrow(/projection/);
    expect(() => parseNotificationItem(item({ outcome: "HIDDEN" }))).toThrow(/outcome/);
  });

  it("bounds, orders, and deduplicates server pages while treating cursors as opaque", () => {
    const second = item({ id: "22222222-2222-4222-8222-222222222222", createdAt: "2026-08-07T01:01:00Z" });
    expect(parseNotificationPage({ items: [item(), second], nextCursor: null }, 20).items).toHaveLength(2);
    expect(() => parseNotificationPage({ items: [second, item()], nextCursor: null }, 20)).toThrow(/order/);
    expect(() => parseNotificationPage({ items: [item(), item()], nextCursor: null }, 20)).toThrow(/duplicate/);
    expect(() => parseNotificationPage({ items: [], nextCursor: "bad/cursor" }, 20)).toThrow(/Cursor/);
  });

  it("accepts only a nonnegative safe integer unread count", () => {
    expect(parseUnreadNotificationCount({ unreadCount: 123 })).toBe(123);
    for (const value of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, "2"]) {
      expect(() => parseUnreadNotificationCount({ unreadCount: value })).toThrow();
    }
  });

  it("parses safe Problem Details fields but drops trace identifiers", () => {
    expect(parseNotificationProblemDetails({ type: "about:blank", title: "Too many", status: 429,
      detail: "Retry later", traceId: "private-trace" })).toEqual({
      type: "about:blank", title: "Too many", status: 429, detail: "Retry later",
      instance: undefined, errorCode: undefined, errors: undefined,
    });
  });
});
