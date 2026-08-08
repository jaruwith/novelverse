import { ApiError, apiRequest } from "@/features/novel-editor/api";
import {
  parseNotificationPage, parseNotificationProblemDetails, parseNotificationUuid,
  parseUnreadNotificationCount, type NotificationFilter, type NotificationPage,
} from "./types";

export const NOTIFICATION_PAGE_SIZE = 20;
export const NOTIFICATION_MAX_PAGE_SIZE = 50;

async function json(response: Response): Promise<unknown> {
  try {
    return await response.json() as unknown;
  } catch {
    throw new ApiError(0, { detail: "The Notifications server returned an unreadable response." });
  }
}

function validateFilter(filter: NotificationFilter): NotificationFilter {
  if (filter !== "ALL" && filter !== "UNREAD")
    throw new TypeError("Unsupported Notifications filter.");
  return filter;
}

function validatePageSize(pageSize: number) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > NOTIFICATION_MAX_PAGE_SIZE)
    throw new TypeError("Notifications page size must be between 1 and 50.");
}

function validateCursor(cursor: string | null) {
  if (cursor !== null && !/^[A-Za-z0-9_-]{1,2048}$/.test(cursor))
    throw new TypeError("Notifications cursor must be the raw server cursor.");
}

export async function getNotifications(input: {
  filter: NotificationFilter;
  pageSize?: number;
  cursor?: string | null;
  signal?: AbortSignal;
}): Promise<NotificationPage> {
  const filter = validateFilter(input.filter);
  const pageSize = input.pageSize ?? NOTIFICATION_PAGE_SIZE;
  const cursor = input.cursor ?? null;
  validatePageSize(pageSize);
  validateCursor(cursor);
  const query = new URLSearchParams({ filter, pageSize: String(pageSize) });
  if (cursor !== null) query.set("cursor", cursor);
  const response = await apiRequest(`/api/v1/notifications?${query}`, {
    signal: input.signal, cache: "no-store",
  });
  return parseNotificationPage(await json(response), pageSize);
}

export async function getUnreadNotificationCount(signal?: AbortSignal): Promise<number> {
  const response = await apiRequest("/api/v1/notifications/unread-count", { signal, cache: "no-store" });
  return parseUnreadNotificationCount(await json(response));
}

export async function markNotificationRead(notificationId: string, signal?: AbortSignal): Promise<void> {
  const id = parseNotificationUuid(notificationId, "notificationId");
  const response = await apiRequest(`/api/v1/notifications/${id}/read`, {
    method: "PUT", signal, cache: "no-store",
  });
  if (response.status !== 204)
    throw new ApiError(0, { detail: "The mark-read response did not match the Notifications contract." });
}

export async function markAllNotificationsRead(signal?: AbortSignal): Promise<void> {
  const response = await apiRequest("/api/v1/notifications/read-all", {
    method: "PUT", signal, cache: "no-store",
  });
  if (response.status !== 204)
    throw new ApiError(0, { detail: "The mark-all response did not match the Notifications contract." });
}

export function safeNotificationProblem(error: unknown) {
  if (!(error instanceof ApiError) || error.problem === undefined) return undefined;
  try {
    return parseNotificationProblemDetails(error.problem);
  } catch {
    return undefined;
  }
}
