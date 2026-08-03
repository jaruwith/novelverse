import { ApiError, apiRequest, hasSession } from "@/features/novel-editor/api";
import {
  parseComment, parseCommentLikeResult, parseCommentPage, parseCommentReportResult,
  type CommentLikeResult, type CommentPage, type CommentReportReason, type CommentReportResult, type CommunitySort,
  type CommunityTarget, type CreateCommentResult, type EditCommentResult,
} from "./types";
import type { CommentDraft } from "./validation";

export const COMMUNITY_PAGE_SIZE = 20;

function segment(value: string) {
  return encodeURIComponent(value);
}

export function communityRootPath(target: CommunityTarget) {
  const story = `/api/v1/stories/${segment(target.creatorSlug)}/${segment(target.storySlug)}`;
  return target.kind === "STORY" ? `${story}/comments`
    : `${story}/episodes/${segment(target.episodeSlug)}/comments`;
}

function repliesPath(rootCommentId: string) {
  return `/api/v1/comments/${segment(rootCommentId)}/replies`;
}

function commentPath(commentId: string) {
  return `/api/v1/comments/${segment(commentId)}`;
}

async function json(response: Response): Promise<unknown> {
  try {
    return await response.json() as unknown;
  } catch {
    throw new ApiError(0, { detail: "The Community server returned an unreadable response." });
  }
}

function assertEtag(etag: string | null, editTag: string | null) {
  if (etag === null || editTag === null || etag !== editTag)
    throw new ApiError(0, { detail: "The Community server returned contradictory edit tags." });
}

export async function listRootComments(target: CommunityTarget, sort: CommunitySort,
  cursor: string | null, signal?: AbortSignal): Promise<CommentPage> {
  const query = new URLSearchParams({ sort, pageSize: String(COMMUNITY_PAGE_SIZE) });
  if (cursor) query.set("cursor", cursor);
  const response = await apiRequest(`${communityRootPath(target)}?${query}`, { signal, cache: "no-store" });
  return parseCommentPage(await json(response), target, sort, null, COMMUNITY_PAGE_SIZE, hasSession());
}

export async function listReplies(target: CommunityTarget, rootCommentId: string,
  cursor: string | null, signal?: AbortSignal): Promise<CommentPage> {
  const query = new URLSearchParams({ pageSize: String(COMMUNITY_PAGE_SIZE) });
  if (cursor) query.set("cursor", cursor);
  const response = await apiRequest(`${repliesPath(rootCommentId)}?${query}`, { signal, cache: "no-store" });
  return parseCommentPage(await json(response), target, "OLDEST", rootCommentId, COMMUNITY_PAGE_SIZE, hasSession());
}

async function create(path: string, parentCommentId: string | null,
  draft: CommentDraft, idempotencyKey: string, signal?: AbortSignal): Promise<CreateCommentResult> {
  const response = await apiRequest(path, {
    method: "POST", signal, cache: "no-store",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ body: draft.body, isSpoiler: draft.isSpoiler }),
  });
  const comment = parseComment(await json(response), parentCommentId, true);
  const etag = response.headers.get("ETag");
  assertEtag(etag, comment.editTag);
  const replayHeader = response.headers.get("Idempotent-Replay");
  const replayMarker = replayHeader?.toLowerCase();
  if ((replayMarker !== "true" && replayMarker !== "false") ||
    (response.status === 200) !== (replayMarker === "true") ||
    (response.status === 201) !== (replayMarker === "false"))
    throw new ApiError(0, { detail: "The Community server returned an invalid replay marker." });
  return { comment, replayed: replayMarker === "true", etag };
}

export const createRootComment = (target: CommunityTarget, draft: CommentDraft,
  idempotencyKey: string, signal?: AbortSignal) =>
  create(communityRootPath(target), null, draft, idempotencyKey, signal);

export const createReply = (target: CommunityTarget, rootCommentId: string,
  draft: CommentDraft, idempotencyKey: string, signal?: AbortSignal) =>
  create(repliesPath(rootCommentId), rootCommentId, draft, idempotencyKey, signal);

export async function editComment(commentId: string, parentCommentId: string | null,
  draft: CommentDraft, editTag: string, signal?: AbortSignal): Promise<EditCommentResult> {
  const response = await apiRequest(commentPath(commentId), {
    method: "PATCH", signal, cache: "no-store", headers: { "If-Match": editTag },
    body: JSON.stringify({ body: draft.body, isSpoiler: draft.isSpoiler }),
  });
  const comment = parseComment(await json(response), parentCommentId, true);
  const etag = response.headers.get("ETag");
  assertEtag(etag, comment.editTag);
  return { comment, etag };
}

export async function deleteComment(commentId: string, editTag: string, signal?: AbortSignal) {
  const response = await apiRequest(commentPath(commentId), {
    method: "DELETE", signal, cache: "no-store", headers: { "If-Match": editTag },
  });
  if (response.status !== 204) throw new ApiError(0, { detail: "The Community delete response was invalid." });
}

export function createIdempotencyKey() {
  if (!globalThis.crypto?.randomUUID) throw new Error("Secure UUID generation is unavailable.");
  return globalThis.crypto.randomUUID();
}

export async function setCommentLike(commentId: string, liked: boolean,
  signal?: AbortSignal): Promise<CommentLikeResult> {
  const response = await apiRequest(`${commentPath(commentId)}/like`, {
    method: liked ? "PUT" : "DELETE", signal, cache: "no-store",
  });
  return parseCommentLikeResult(await json(response), commentId);
}

export async function reportComment(commentId: string, reason: CommentReportReason,
  comment: string | null, signal?: AbortSignal): Promise<CommentReportResult> {
  const response = await apiRequest(`${commentPath(commentId)}/reports`, {
    method: "POST", signal, cache: "no-store", body: JSON.stringify({ reason, comment }),
  });
  if (response.status !== 201) throw new ApiError(0, { detail: "The Comment report response was invalid." });
  return parseCommentReportResult(await json(response));
}
