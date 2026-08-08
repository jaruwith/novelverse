import { beforeEach, describe, expect, it, vi } from "vitest";
import * as shared from "@/features/novel-editor/api";
import {
  getNotifications, getUnreadNotificationCount, markAllNotificationsRead, markNotificationRead,
} from "./api";

vi.mock("@/features/novel-editor/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/novel-editor/api")>(), apiRequest: vi.fn(),
}));

const id = "11111111-1111-4111-8111-111111111111";
const response = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), init);

describe("Notifications authenticated API client", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses exact endpoints, raw cursor encoding once, AbortSignal, and no UserId", async () => {
    const signal = new AbortController().signal;
    vi.mocked(shared.apiRequest)
      .mockResolvedValueOnce(response({ items: [], nextCursor: null }))
      .mockResolvedValueOnce(response({ unreadCount: 7 }));
    await getNotifications({ filter: "UNREAD", cursor: "opaque_-1", pageSize: 20, signal });
    await getUnreadNotificationCount(signal);
    expect(shared.apiRequest).toHaveBeenNthCalledWith(1,
      "/api/v1/notifications?filter=UNREAD&pageSize=20&cursor=opaque_-1",
      { signal, cache: "no-store" });
    expect(shared.apiRequest).toHaveBeenNthCalledWith(2, "/api/v1/notifications/unread-count",
      { signal, cache: "no-store" });
    expect(JSON.stringify(vi.mocked(shared.apiRequest).mock.calls)).not.toMatch(/userId/i);
  });

  it("uses PUT and requires the runtime 204 contract for mark operations", async () => {
    const signal = new AbortController().signal;
    vi.mocked(shared.apiRequest)
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await markNotificationRead(id, signal);
    await markAllNotificationsRead(signal);
    expect(shared.apiRequest).toHaveBeenNthCalledWith(1, `/api/v1/notifications/${id}/read`,
      { method: "PUT", signal, cache: "no-store" });
    expect(shared.apiRequest).toHaveBeenNthCalledWith(2, "/api/v1/notifications/read-all",
      { method: "PUT", signal, cache: "no-store" });
  });

  it("rejects client tampering before network access", async () => {
    await expect(getNotifications({ filter: "ALL", pageSize: 51 })).rejects.toThrow(/between 1 and 50/);
    await expect(getNotifications({ filter: "ALL", cursor: "bad/cursor" })).rejects.toThrow(/raw server cursor/);
    await expect(markNotificationRead("not-a-guid")).rejects.toThrow(/notificationId/);
    expect(shared.apiRequest).not.toHaveBeenCalled();
  });
});
