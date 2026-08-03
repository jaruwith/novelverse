export type CommunitySort = "OLDEST" | "NEWEST";

export type CommunityTarget =
  | { kind: "STORY"; creatorSlug: string; storySlug: string }
  | { kind: "EPISODE"; creatorSlug: string; storySlug: string; episodeSlug: string };

export type CommentAuthor = {
  displayName: string;
  creatorSlug: string | null;
  isCreator: boolean;
};

export type CommentProjection = {
  id: string;
  parentCommentId: string | null;
  body: string | null;
  isSpoiler: boolean;
  isTombstone: boolean;
  author: CommentAuthor | null;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  isOwnedByViewer: boolean;
  canEdit: boolean;
  canDelete: boolean;
  editTag: string | null;
  likeCount: number;
  isLikedByViewer: boolean;
  canLike: boolean;
  replyCount: number;
};

export type CommentLikeResult = {
  commentId: string;
  likeCount: number;
  isLikedByViewer: boolean;
  canLike: boolean;
};

export type CommentReportReason = "SPAM" | "COPYRIGHT" | "HARASSMENT" | "HATE" |
  "SEXUAL_CONTENT" | "VIOLENCE" | "SELF_HARM" | "MISINFORMATION" |
  "IMPERSONATION" | "PRIVACY" | "OTHER";

export type CommentReportResult = { id: string; status: "OPEN"; createdAt: string };

export type CommentPage = {
  target: CommunityTarget;
  items: CommentProjection[];
  nextCursor: string | null;
  hasMore: boolean;
  sort: CommunitySort;
  pageSize: number;
};

export type CreateCommentResult = {
  comment: CommentProjection;
  replayed: boolean;
  etag: string | null;
};

export type EditCommentResult = { comment: CommentProjection; etag: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EDIT_TAG = /^"comment-([0-9a-f-]{36})-v(0|[1-9][0-9]*)"$/i;

export class CommunityContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommunityContractError";
  }
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid(name);
  return value as Record<string, unknown>;
}

function exactKeys(source: Record<string, unknown>, allowed: readonly string[], name: string) {
  const allowedKeys = new Set(allowed);
  if (Object.keys(source).some((key) => !allowedKeys.has(key))) throw invalid(`${name} fields`);
}

function string(value: unknown, name: string, nullable = false): string | null {
  if (nullable && value === null) return null;
  if (typeof value !== "string") throw invalid(name);
  return value;
}

function boolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw invalid(name);
  return value;
}

function integer(value: unknown, name: string, minimum = 0): number {
  if (!Number.isInteger(value) || (value as number) < minimum) throw invalid(name);
  return value as number;
}

function uuid(value: unknown, name: string): string {
  const result = string(value, name)!;
  if (!UUID.test(result)) throw invalid(name);
  return result;
}

function timestamp(value: unknown, name: string, nullable = false): string | null {
  const result = string(value, name, nullable);
  if (result !== null && (!/^\d{4}-\d{2}-\d{2}T/.test(result) || Number.isNaN(Date.parse(result))))
    throw invalid(name);
  return result;
}

function slug(value: unknown, name: string): string {
  const result = string(value, name)!;
  if (!result || result.length > 200 || /[\u0000-\u001f\u007f]/u.test(result)) throw invalid(name);
  return result;
}

function nullableUuid(value: unknown, name: string): string | null {
  return value === null ? null : uuid(value, name);
}

function invalid(name: string) {
  return new CommunityContractError(`Malformed Community response: ${name}.`);
}

export function sameTarget(left: CommunityTarget, right: CommunityTarget) {
  return left.kind === right.kind && left.creatorSlug === right.creatorSlug &&
    left.storySlug === right.storySlug &&
    (left.kind === "STORY" || right.kind === "STORY" || left.episodeSlug === right.episodeSlug);
}

export function targetKey(target: CommunityTarget) {
  return target.kind === "STORY"
    ? `STORY:${target.creatorSlug}:${target.storySlug}`
    : `EPISODE:${target.creatorSlug}:${target.storySlug}:${target.episodeSlug}`;
}

export function parseCommunityTarget(value: unknown): CommunityTarget {
  const source = record(value, "target");
  exactKeys(source, ["kind", "creatorSlug", "storySlug", "episodeSlug"], "target");
  const kind = string(source.kind, "target.kind");
  const creatorSlug = slug(source.creatorSlug, "target.creatorSlug");
  const storySlug = slug(source.storySlug, "target.storySlug");
  if (kind === "STORY") {
    if (source.episodeSlug !== null) throw invalid("target.episodeSlug");
    return { kind, creatorSlug, storySlug };
  }
  if (kind === "EPISODE") return {
    kind, creatorSlug, storySlug, episodeSlug: slug(source.episodeSlug, "target.episodeSlug"),
  };
  throw invalid("target.kind");
}

function parseAuthor(value: unknown): CommentAuthor {
  const source = record(value, "author");
  exactKeys(source, ["displayName", "creatorSlug", "isCreator"], "author");
  const displayName = string(source.displayName, "author.displayName")!;
  if (!displayName.trim()) throw invalid("author.displayName");
  return {
    displayName,
    creatorSlug: source.creatorSlug === null ? null : slug(source.creatorSlug, "author.creatorSlug"),
    isCreator: boolean(source.isCreator, "author.isCreator"),
  };
}

export function parseComment(value: unknown, expectedParent: string | null,
  viewerAuthenticated = true): CommentProjection {
  const source = record(value, "comment");
  exactKeys(source, [
    "id", "parentCommentId", "body", "isSpoiler", "isTombstone", "author", "createdAt",
    "updatedAt", "editedAt", "deletedAt", "isOwnedByViewer", "canEdit", "canDelete",
    "editTag", "likeCount", "isLikedByViewer", "canLike", "replyCount",
  ], "comment");
  const id = uuid(source.id, "comment.id");
  const parentCommentId = nullableUuid(source.parentCommentId, "comment.parentCommentId");
  if (parentCommentId !== expectedParent) throw invalid("comment.parentCommentId");
  const body = string(source.body, "comment.body", true);
  const isSpoiler = boolean(source.isSpoiler, "comment.isSpoiler");
  const isTombstone = boolean(source.isTombstone, "comment.isTombstone");
  const author = source.author === null ? null : parseAuthor(source.author);
  const isOwnedByViewer = boolean(source.isOwnedByViewer, "comment.isOwnedByViewer");
  const canEdit = boolean(source.canEdit, "comment.canEdit");
  const canDelete = boolean(source.canDelete, "comment.canDelete");
  const editTag = string(source.editTag, "comment.editTag", true);
  const likeCount = integer(source.likeCount, "comment.likeCount");
  const isLikedByViewer = boolean(source.isLikedByViewer, "comment.isLikedByViewer");
  const canLike = boolean(source.canLike, "comment.canLike");
  if (editTag !== null) {
    const match = EDIT_TAG.exec(editTag);
    if (!match || match[1].toLowerCase() !== id.toLowerCase()) throw invalid("comment.editTag");
  }
  if (canEdit && (!isOwnedByViewer || editTag === null)) throw invalid("comment.canEdit");
  if (canDelete && (!isOwnedByViewer || editTag === null)) throw invalid("comment.canDelete");
  if (!isOwnedByViewer && editTag !== null) throw invalid("comment.editTag ownership");
  if (!canEdit && !canDelete && editTag !== null) throw invalid("comment.editTag capability");
  if ((!viewerAuthenticated && (isLikedByViewer || canLike)) ||
      (isOwnedByViewer && (isLikedByViewer || canLike)))
    throw invalid("comment Like capability");
  const deletedAt = timestamp(source.deletedAt, "comment.deletedAt", true);
  if (isTombstone) {
    if (body !== null || author !== null || isSpoiler || isOwnedByViewer || canEdit || canDelete ||
      editTag !== null || likeCount !== 0 || isLikedByViewer || canLike || deletedAt === null)
      throw invalid("comment.tombstone consistency");
  } else if (body === null || author === null || deletedAt !== null) {
    throw invalid("comment active consistency");
  }
  const replyCount = integer(source.replyCount, "comment.replyCount");
  if (expectedParent !== null && replyCount !== 0) throw invalid("reply.replyCount");
  return {
    id, parentCommentId, body, isSpoiler, isTombstone, author,
    createdAt: timestamp(source.createdAt, "comment.createdAt")!,
    updatedAt: timestamp(source.updatedAt, "comment.updatedAt")!,
    editedAt: timestamp(source.editedAt, "comment.editedAt", true),
    deletedAt,
    isOwnedByViewer, canEdit, canDelete, editTag, likeCount, isLikedByViewer, canLike, replyCount,
  };
}

export function parseCommentPage(value: unknown, expectedTarget: CommunityTarget,
  expectedSort: CommunitySort, expectedParent: string | null, expectedPageSize: number,
  viewerAuthenticated = true): CommentPage {
  const source = record(value, "page");
  exactKeys(source, ["target", "items", "nextCursor", "hasMore", "sort", "pageSize"], "page");
  const target = parseCommunityTarget(source.target);
  if (!sameTarget(target, expectedTarget)) throw invalid("page.target");
  if (source.sort !== expectedSort) throw invalid("page.sort");
  if (source.pageSize !== expectedPageSize) throw invalid("page.pageSize");
  if (!Array.isArray(source.items)) throw invalid("page.items");
  const items = source.items.map((item) => parseComment(item, expectedParent, viewerAuthenticated));
  if (new Set(items.map((item) => item.id)).size !== items.length) throw invalid("page duplicate ids");
  const nextCursor = string(source.nextCursor, "page.nextCursor", true);
  const hasMore = boolean(source.hasMore, "page.hasMore");
  if (hasMore !== (nextCursor !== null) || (nextCursor !== null && (!nextCursor || nextCursor.length > 2048)))
    throw invalid("page.cursor");
  return { target, items, nextCursor, hasMore, sort: expectedSort, pageSize: expectedPageSize };
}

export function parseCommentLikeResult(value: unknown, expectedCommentId: string): CommentLikeResult {
  const source = record(value, "Like response");
  exactKeys(source, ["commentId", "likeCount", "isLikedByViewer", "canLike"], "Like response");
  const commentId = uuid(source.commentId, "Like response.commentId");
  if (commentId.toLowerCase() !== expectedCommentId.toLowerCase()) throw invalid("Like response.commentId");
  const likeCount = integer(source.likeCount, "Like response.likeCount");
  const isLikedByViewer = boolean(source.isLikedByViewer, "Like response.isLikedByViewer");
  const canLike = boolean(source.canLike, "Like response.canLike");
  return { commentId, likeCount, isLikedByViewer, canLike };
}

export function parseCommentReportResult(value: unknown): CommentReportResult {
  const source = record(value, "report response");
  exactKeys(source, ["id", "status", "createdAt"], "report response");
  if (source.status !== "OPEN") throw invalid("report response.status");
  return { id: uuid(source.id, "report response.id"), status: "OPEN",
    createdAt: timestamp(source.createdAt, "report response.createdAt")! };
}
