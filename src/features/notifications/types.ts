export const NOTIFICATION_TYPES = [
  "COMMENT_REPLY_CREATED",
  "COMMENT_LIKE_CREATED",
  "CREATOR_CONTENT_COMMENT_CREATED",
  "CREATOR_FOLLOW_CREATED",
  "MODERATION_REPORT_RESOLVED",
  "MODERATION_VISIBILITY_CHANGED",
] as const;

export type NotificationType = typeof NOTIFICATION_TYPES[number];
export type NotificationFilter = "ALL" | "UNREAD";
export type NotificationOutcome = "DISMISSED" | "ACTION_TAKEN" | "HIDDEN" | "RESTORED";
export type NotificationRouteFamily = "STORY" | "NOVEL" | "COMIC" | "VIDEO";

export type SafeNotificationRoute = {
  href: string;
  family: NotificationRouteFamily;
  commentId: string | null;
};

export type NotificationActor = { displayName: string };
export type NotificationTarget = {
  title: string | null;
  route: SafeNotificationRoute | null;
  available: boolean;
};

export type NotificationItem = {
  id: string;
  type: NotificationType;
  actor: NotificationActor | null;
  target: NotificationTarget;
  outcome: NotificationOutcome | null;
  createdAt: string;
  readAt: string | null;
};

export type NotificationPage = {
  items: NotificationItem[];
  nextCursor: string | null;
};

export type NotificationProblemDetails = {
  type?: string | null;
  title?: string | null;
  status?: number | null;
  detail?: string | null;
  instance?: string | null;
  errorCode?: string;
  errors?: Record<string, string[]>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|\+00:00)$/;
const CURSOR = /^[A-Za-z0-9_-]{1,2048}$/;
const COMMENT_FRAGMENT = /^comment-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

export class NotificationContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotificationContractError";
  }
}

function invalid(name: string): never {
  throw new NotificationContractError(`Malformed Notifications response: ${name}.`);
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(name);
  return value as Record<string, unknown>;
}

function exactKeys(source: Record<string, unknown>, allowed: readonly string[], name: string) {
  const accepted = new Set(allowed);
  if (Object.keys(source).some((key) => !accepted.has(key))) invalid(`${name} fields`);
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string") invalid(name);
  return value as string;
}

function nullablePlainText(value: unknown, name: string, maximum: number): string | null {
  if (value === null) return null;
  const result = requiredString(value, name);
  if (!result || result !== result.trim() || result.length > maximum || /[\u0000-\u001f\u007f]/u.test(result))
    invalid(name);
  return result;
}

export function parseNotificationUuid(value: unknown, name = "id"): string {
  const result = requiredString(value, name);
  if (!UUID.test(result)) invalid(name);
  return result.toLowerCase();
}

function timestamp(value: unknown, name: string, nullable = false): string | null {
  if (nullable && value === null) return null;
  const result = requiredString(value, name);
  if (!UTC_TIMESTAMP.test(result) || Number.isNaN(Date.parse(result))) invalid(name);
  return result;
}

function canonicalRouteSegment(value: string, name: string) {
  if (!value || value.length > 512 || /[\\/?#\u0000-\u001f\u007f]/u.test(value)) invalid(name);
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    invalid(name);
  }
  if (!decoded || /[\\/?#\u0000-\u001f\u007f]/u.test(decoded) || /%[0-9a-f]{2}/i.test(decoded)) invalid(name);
  const normalized = (source: string) => source.replace(/%[0-9a-f]{2}/gi, (part) => part.toUpperCase());
  if (normalized(encodeURIComponent(decoded)) !== normalized(value)) invalid(name);
}

export function parseNotificationRoute(value: unknown): SafeNotificationRoute | null {
  if (value === null) return null;
  const href = requiredString(value, "targetRoute");
  if (!href || href.length > 512 || href.includes("?") || href.startsWith("//") || href.includes("\\") ||
      /[\u0000-\u001f\u007f]/u.test(href)) invalid("targetRoute");
  const hashIndex = href.indexOf("#");
  const path = hashIndex < 0 ? href : href.slice(0, hashIndex);
  const fragment = hashIndex < 0 ? null : href.slice(hashIndex + 1);
  if (hashIndex >= 0 && href.indexOf("#", hashIndex + 1) >= 0) invalid("targetRoute fragment");
  const comment = fragment === null ? null : COMMENT_FRAGMENT.exec(fragment);
  if (fragment !== null && !comment) invalid("targetRoute fragment");
  const segments = path.split("/");
  if (segments[0] !== "") invalid("targetRoute path");
  const family = segments[1] === "stories" && segments.length === 4 ? "STORY"
    : segments[1] === "read-novel" && segments.length === 5 ? "NOVEL"
      : segments[1] === "read-comic" && segments.length === 5 ? "COMIC"
        : segments[1] === "watch-video" && segments.length === 5 ? "VIDEO" : null;
  if (!family) invalid("targetRoute family");
  segments.slice(2).forEach((segment, index) => canonicalRouteSegment(segment, `targetRoute segment ${index + 1}`));
  return { href, family, commentId: comment?.[1].toLowerCase() ?? null };
}

function notificationType(value: unknown): NotificationType {
  if (typeof value !== "string" || !(NOTIFICATION_TYPES as readonly string[]).includes(value)) invalid("type");
  return value as NotificationType;
}

function outcome(value: unknown): NotificationOutcome | null {
  if (value === null) return null;
  if (value !== "DISMISSED" && value !== "ACTION_TAKEN" && value !== "HIDDEN" && value !== "RESTORED")
    invalid("outcome");
  return value;
}

export function parseNotificationItem(value: unknown): NotificationItem {
  const source = record(value, "item");
  exactKeys(source, [
    "id", "type", "actorDisplayName", "targetTitle", "targetRoute", "outcome", "createdAt", "readAt",
  ], "item");
  const type = notificationType(source.type);
  const actorDisplayName = nullablePlainText(source.actorDisplayName, "actorDisplayName", 100);
  const targetTitle = nullablePlainText(source.targetTitle, "targetTitle", 200);
  const route = parseNotificationRoute(source.targetRoute);
  const parsedOutcome = outcome(source.outcome);
  const createdAt = timestamp(source.createdAt, "createdAt")!;
  const readAt = timestamp(source.readAt, "readAt", true);
  if (readAt !== null && Date.parse(readAt) < Date.parse(createdAt)) invalid("readAt order");
  if (type === "CREATOR_FOLLOW_CREATED" && (targetTitle !== null || route !== null || parsedOutcome !== null))
    invalid("Follow projection");
  if (type === "MODERATION_REPORT_RESOLVED") {
    if (actorDisplayName !== null || (parsedOutcome !== "DISMISSED" && parsedOutcome !== "ACTION_TAKEN"))
      invalid("report outcome projection");
  } else if (type === "MODERATION_VISIBILITY_CHANGED") {
    if (actorDisplayName !== null || (parsedOutcome !== "HIDDEN" && parsedOutcome !== "RESTORED"))
      invalid("visibility outcome projection");
  } else if (parsedOutcome !== null) {
    invalid("non-moderation outcome");
  }
  return {
    id: parseNotificationUuid(source.id), type,
    actor: actorDisplayName === null ? null : { displayName: actorDisplayName },
    target: { title: targetTitle, route, available: route !== null },
    outcome: parsedOutcome, createdAt, readAt,
  };
}

export function parseNotificationPage(value: unknown, expectedPageSize = 20): NotificationPage {
  if (!Number.isInteger(expectedPageSize) || expectedPageSize < 1 || expectedPageSize > 50) invalid("pageSize");
  const source = record(value, "page");
  exactKeys(source, ["items", "nextCursor"], "page");
  if (!Array.isArray(source.items) || source.items.length > expectedPageSize) invalid("items");
  const items = source.items.map(parseNotificationItem);
  if (new Set(items.map((item) => item.id)).size !== items.length) invalid("duplicate ids");
  for (let index = 1; index < items.length; index += 1)
    if (Date.parse(items[index - 1].createdAt) < Date.parse(items[index].createdAt)) invalid("item order");
  const nextCursor = source.nextCursor === null ? null : requiredString(source.nextCursor, "nextCursor");
  if (nextCursor !== null && !CURSOR.test(nextCursor)) invalid("nextCursor");
  if (items.length < expectedPageSize && nextCursor !== null) invalid("cursor continuation");
  return { items, nextCursor };
}

export function parseUnreadNotificationCount(value: unknown): number {
  const source = record(value, "unread count");
  exactKeys(source, ["unreadCount"], "unread count");
  if (!Number.isSafeInteger(source.unreadCount) || (source.unreadCount as number) < 0) invalid("unreadCount");
  return source.unreadCount as number;
}

export function parseNotificationProblemDetails(value: unknown): NotificationProblemDetails {
  const source = record(value, "Problem Details");
  exactKeys(source, ["type", "title", "status", "detail", "instance", "errorCode", "errors", "traceId"],
    "Problem Details");
  const optionalText = (entry: unknown, name: string) => entry === undefined || entry === null
    ? entry as undefined | null : nullablePlainText(entry, name, 2_000);
  const status = source.status === undefined || source.status === null ? source.status as undefined | null
    : Number.isInteger(source.status) && (source.status as number) >= 0 ? source.status as number : invalid("status");
  let errors: Record<string, string[]> | undefined;
  if (source.errors !== undefined) {
    const errorSource = record(source.errors, "errors");
    errors = {};
    for (const [key, messages] of Object.entries(errorSource)) {
      if (!key || !Array.isArray(messages) || messages.some((message) => typeof message !== "string")) invalid("errors");
      errors[key] = [...messages] as string[];
    }
  }
  return {
    type: optionalText(source.type, "problem type"), title: optionalText(source.title, "problem title"),
    status, detail: optionalText(source.detail, "problem detail"), instance: optionalText(source.instance, "instance"),
    errorCode: source.errorCode === undefined ? undefined : requiredString(source.errorCode, "errorCode"), errors,
  };
}
