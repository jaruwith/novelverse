"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError, getSessionGeneration, hasSession, subscribeToSessionChanges,
} from "@/features/novel-editor/api";
import {
  createIdempotencyKey, createReply, createRootComment, deleteComment, editComment,
  listReplies, listRootComments, reportComment, setCommentLike,
} from "./api";
import type { CommentProjection, CommentReportReason, CommunitySort, CommunityTarget } from "./types";
import { targetKey } from "./types";
import { draftFingerprint, validateCommentDraft, type CommentDraft } from "./validation";

export type ReplyState = {
  expanded: boolean;
  status: "idle" | "loading" | "ready" | "error";
  items: CommentProjection[];
  cursor: string | null;
  hasMore: boolean;
  error: string;
};

type DraftState = CommentDraft & { error: string };
type Attempt = { fingerprint: string; key: string };
export type EditState = { comment: CommentProjection; body: string; isSpoiler: boolean; error: string; pending: boolean };
export type DeleteState = { comment: CommentProjection; error: string; pending: boolean; restoreFocus: HTMLElement | null };
export type ReportState = { commentId: string; reason: CommentReportReason | ""; details: string;
  error: string; pending: boolean; restoreFocus: HTMLElement | null };

export class SessionRequestGuard {
  private epoch = 0;
  private controllers = new Set<AbortController>();

  begin(sessionGeneration: number) {
    const controller = new AbortController();
    this.controllers.add(controller);
    return { epoch: this.epoch, sessionGeneration, controller };
  }

  current(request: { epoch: number; sessionGeneration: number; controller: AbortController },
    sessionGeneration: number) {
    return !request.controller.signal.aborted && request.epoch === this.epoch &&
      request.sessionGeneration === sessionGeneration;
  }

  finish(request: { controller: AbortController }) {
    this.controllers.delete(request.controller);
  }

  invalidate() {
    this.epoch += 1;
    this.controllers.forEach((controller) => controller.abort());
    this.controllers.clear();
  }
}

type MutationRequest = {
  key: string;
  id: number;
  request: ReturnType<SessionRequestGuard["begin"]>;
};

const emptyDraft = (): DraftState => ({ body: "", isSpoiler: false, error: "" });
const emptyReply = (): ReplyState => ({ expanded: true, status: "idle", items: [], cursor: null, hasMore: false, error: "" });

function dedupe(existing: CommentProjection[], incoming: CommentProjection[]) {
  const ids = new Set(existing.map((item) => item.id));
  return [...existing, ...incoming.filter((item) => !ids.has(item.id))];
}

function publicOnly(comment: CommentProjection): CommentProjection {
  return { ...comment, isOwnedByViewer: false, canEdit: false, canDelete: false, editTag: null,
    isLikedByViewer: false, canLike: false };
}

function message(reason: unknown) {
  if (!(reason instanceof ApiError)) return "Discussion is temporarily unavailable. Please try again.";
  if (reason.status === 0) return reason.message;
  if (reason.status === 400) {
    const fields = reason.problem?.errors
      ? Object.values(reason.problem.errors).flatMap((entry) => Array.isArray(entry) ? entry : [entry]).join(" ")
      : "";
    return fields || reason.problem?.detail || "Check the Comment and try again.";
  }
  if (reason.status === 401) return "Your session ended. Sign in again to continue writing.";
  if (reason.status === 403) return "Your account or profile is not currently eligible to write Comments.";
  if (reason.status === 404) return "This Comment is no longer available.";
  if (reason.status === 409) return "The Comment changed on the server. The latest discussion was loaded.";
  if (reason.status === 413) return "This Comment is too large for the server. Shorten it and try again.";
  if (reason.status === 429) {
    const retry = reason.headers.get("Retry-After");
    return retry ? `Too many Comment requests. Try again after ${retry} seconds.`
      : "Too many Comment requests. Please try again later.";
  }
  return reason.status >= 500 ? "Discussion is temporarily unavailable. Confirmed Comments were preserved."
    : reason.problem?.detail || "The Comment request could not be completed.";
}

export function useDiscussionController(target: CommunityTarget) {
  const identity = targetKey(target);
  const stableTarget = useMemo(() => target, [identity]); // eslint-disable-line react-hooks/exhaustive-deps
  const guard = useRef(new SessionRequestGuard());
  const rootRequestId = useRef(0);
  const replyRequestIds = useRef(new Map<string, number>());
  const mutationRequestIds = useRef(new Map<string, number>());
  const rootAttempt = useRef<Attempt | null>(null);
  const replyAttempts = useRef(new Map<string, Attempt>());
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const [authenticated, setAuthenticated] = useState(() => hasSession());
  const [sort, setSortState] = useState<CommunitySort>("OLDEST");
  const [roots, setRoots] = useState<CommentProjection[]>([]);
  const [rootStatus, setRootStatus] = useState<"loading" | "ready" | "error">("loading");
  const [rootError, setRootError] = useState("");
  const [rootCursor, setRootCursor] = useState<string | null>(null);
  const [rootHasMore, setRootHasMore] = useState(false);
  const [rootLoadingMore, setRootLoadingMore] = useState(false);
  const [concealed, setConcealed] = useState(false);
  const [replies, setReplies] = useState<Record<string, ReplyState>>({});
  const [rootDraft, setRootDraft] = useState<DraftState>(emptyDraft);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, DraftState>>({});
  const [rootPending, setRootPending] = useState(false);
  const [replyPending, setReplyPending] = useState<Record<string, boolean>>({});
  const [edit, setEdit] = useState<EditState | null>(null);
  const [deleting, setDeleting] = useState<DeleteState | null>(null);
  const [reporting, setReporting] = useState<ReportState | null>(null);
  const [likePending, setLikePending] = useState<Record<string, boolean>>({});
  const [interactionErrors, setInteractionErrors] = useState<Record<string, string>>({});
  const [announcement, setAnnouncement] = useState("");
  const [focusCommentId, setFocusCommentId] = useState<string | null>(null);

  const begin = useCallback(() => guard.current.begin(getSessionGeneration()), []);
  const isCurrent = useCallback((request: ReturnType<SessionRequestGuard["begin"]>) =>
    guard.current.current(request, getSessionGeneration()), []);
  const beginMutation = useCallback((key: string): MutationRequest => {
    const id = (mutationRequestIds.current.get(key) ?? 0) + 1;
    mutationRequestIds.current.set(key, id);
    return { key, id, request: begin() };
  }, [begin]);
  const isCurrentMutation = useCallback((mutation: MutationRequest) =>
    isCurrent(mutation.request) && mutationRequestIds.current.get(mutation.key) === mutation.id,
  [isCurrent]);
  const finishMutation = useCallback((mutation: MutationRequest) => {
    if (mutationRequestIds.current.get(mutation.key) === mutation.id)
      mutationRequestIds.current.delete(mutation.key);
    guard.current.finish(mutation.request);
  }, []);

  const loadRootPage = useCallback(async (cursor: string | null, reset: boolean) => {
    const requestId = ++rootRequestId.current;
    const request = begin();
    if (reset) { setRootStatus("loading"); setRootError(""); }
    else { setRootLoadingMore(true); setRootError(""); }
    try {
      const page = await listRootComments(stableTarget, sort, cursor, request.controller.signal);
      if (!isCurrent(request) || rootRequestId.current !== requestId) return null;
      setRoots((current) => reset ? page.items : dedupe(current, page.items));
      setRootCursor(page.nextCursor);
      setRootHasMore(page.hasMore);
      setRootStatus("ready");
      setConcealed(false);
      if (!reset) setAnnouncement(`${page.items.length} more Comments loaded.`);
      return page;
    } catch (reason) {
      if (!isCurrent(request) || rootRequestId.current !== requestId) return null;
      if (reason instanceof ApiError && reason.status === 404) {
        setConcealed(true);
        setRoots([]);
        setRootStatus("ready");
      } else {
        setRootError(message(reason));
        if (reset) setRootStatus("error");
      }
      return null;
    } finally {
      if (isCurrent(request) && rootRequestId.current === requestId) setRootLoadingMore(false);
      guard.current.finish(request);
    }
  }, [begin, isCurrent, sort, stableTarget]);

  const loadReplyPage = useCallback(async (rootId: string, cursor: string | null, reset: boolean) => {
    const requestId = (replyRequestIds.current.get(rootId) ?? 0) + 1;
    replyRequestIds.current.set(rootId, requestId);
    const request = begin();
    setReplies((current) => ({ ...current, [rootId]: {
      ...(current[rootId] ?? emptyReply()), expanded: true, status: "loading", error: "",
    } }));
    try {
      const page = await listReplies(stableTarget, rootId, cursor, request.controller.signal);
      if (!isCurrent(request) || replyRequestIds.current.get(rootId) !== requestId) return null;
      setReplies((current) => ({ ...current, [rootId]: {
        expanded: true, status: "ready", error: "", cursor: page.nextCursor, hasMore: page.hasMore,
        items: reset ? page.items : dedupe(current[rootId]?.items ?? [], page.items),
      } }));
      if (!reset) setAnnouncement(`${page.items.length} more Replies loaded.`);
      return page;
    } catch (reason) {
      if (!isCurrent(request) || replyRequestIds.current.get(rootId) !== requestId) return null;
      setReplies((current) => ({ ...current, [rootId]: {
        ...(current[rootId] ?? emptyReply()), expanded: true, status: "error", error: message(reason),
      } }));
      return null;
    } finally {
      guard.current.finish(request);
    }
  }, [begin, isCurrent, stableTarget]);

  useEffect(() => {
    const synchronize = () => {
      guard.current.invalidate();
      rootRequestId.current += 1;
      mutationRequestIds.current.clear();
      setAuthenticated(hasSession());
      setRoots((current) => current.map(publicOnly));
      setReplies((current) => Object.fromEntries(Object.entries(current).map(([key, value]) =>
        [key, { ...value, items: value.items.map(publicOnly) }])));
      setRootDraft(emptyDraft()); setReplyDrafts({}); setEdit(null); setDeleting(null); setReporting(null);
      setLikePending({}); setInteractionErrors({});
      setRootPending(false); setReplyPending({}); rootAttempt.current = null; replyAttempts.current.clear();
      setSessionEpoch((value) => value + 1);
    };
    return subscribeToSessionChanges(synchronize);
  }, []);

  useEffect(() => {
    const requestGuard = guard.current;
    requestGuard.invalidate();
    rootRequestId.current += 1;
    replyRequestIds.current.clear();
    mutationRequestIds.current.clear();
    setRoots([]); setReplies({}); setRootCursor(null); setRootHasMore(false); setConcealed(false);
    setRootDraft(emptyDraft()); setReplyDrafts({}); setEdit(null); setDeleting(null); setReporting(null);
    setLikePending({}); setInteractionErrors({});
    setAnnouncement("");
    void loadRootPage(null, true);
    return () => requestGuard.invalidate();
  }, [identity, loadRootPage, sessionEpoch, sort]);

  const setSort = useCallback((next: CommunitySort) => {
    if (next !== "OLDEST" && next !== "NEWEST") return;
    setSortState(next);
  }, []);

  const setRootDraftValue = useCallback((draft: CommentDraft) => setRootDraft({ ...draft, error: "" }), []);
  const setReplyDraftValue = useCallback((rootId: string, draft: CommentDraft) =>
    setReplyDrafts((current) => ({ ...current, [rootId]: { ...draft, error: "" } })), []);

  const submitRoot = useCallback(async () => {
    const validation = validateCommentDraft(rootDraft.body);
    if (validation.error) { setRootDraft((current) => ({ ...current, error: validation.error! })); return; }
    if (rootPending || !authenticated) return;
    const draft = { body: validation.normalizedBody, isSpoiler: rootDraft.isSpoiler };
    const fingerprint = draftFingerprint(draft);
    if (!rootAttempt.current || rootAttempt.current.fingerprint !== fingerprint)
      rootAttempt.current = { fingerprint, key: createIdempotencyKey() };
    const mutation = beginMutation("root:create");
    setRootPending(true); setRootDraft((current) => ({ ...current, error: "" }));
    try {
      const result = await createRootComment(stableTarget, draft, rootAttempt.current.key,
        mutation.request.controller.signal);
      if (!isCurrentMutation(mutation)) return;
      if (sort === "NEWEST") setRoots((current) => dedupe([], [result.comment, ...current]));
      else if (rootHasMore) await loadRootPage(null, true);
      else setRoots((current) => dedupe(current, [result.comment]));
      setRootDraft(emptyDraft()); rootAttempt.current = null;
      setAnnouncement(result.replayed ? "Comment submission reconciled from the server." : "Comment posted.");
      setFocusCommentId(result.comment.id);
    } catch (reason) {
      if (!isCurrentMutation(mutation)) return;
      if (reason instanceof ApiError && reason.status === 409) await loadRootPage(null, true);
      setRootDraft((current) => ({ ...current, error: message(reason) }));
    } finally {
      if (isCurrentMutation(mutation)) setRootPending(false);
      finishMutation(mutation);
    }
  }, [authenticated, beginMutation, finishMutation, isCurrentMutation, loadRootPage,
    rootDraft, rootHasMore, rootPending, sort, stableTarget]);

  const submitReply = useCallback(async (rootId: string) => {
    const source = replyDrafts[rootId] ?? emptyDraft();
    const validation = validateCommentDraft(source.body);
    if (validation.error) {
      setReplyDrafts((current) => ({ ...current, [rootId]: { ...source, error: validation.error! } })); return;
    }
    if (replyPending[rootId] || !authenticated) return;
    const draft = { body: validation.normalizedBody, isSpoiler: source.isSpoiler };
    const fingerprint = draftFingerprint(draft);
    const prior = replyAttempts.current.get(rootId);
    if (!prior || prior.fingerprint !== fingerprint)
      replyAttempts.current.set(rootId, { fingerprint, key: createIdempotencyKey() });
    const mutation = beginMutation(`reply:create:${rootId}`);
    setReplyPending((current) => ({ ...current, [rootId]: true }));
    try {
      const result = await createReply(stableTarget, rootId, draft,
        replyAttempts.current.get(rootId)!.key, mutation.request.controller.signal);
      if (!isCurrentMutation(mutation)) return;
      await Promise.all([loadReplyPage(rootId, null, true), loadRootPage(null, true)]);
      if (!isCurrentMutation(mutation)) return;
      setReplyDrafts((current) => ({ ...current, [rootId]: emptyDraft() }));
      replyAttempts.current.delete(rootId);
      setAnnouncement(result.replayed ? "Reply submission reconciled from the server." : "Reply posted.");
      setFocusCommentId(result.comment.id);
    } catch (reason) {
      if (!isCurrentMutation(mutation)) return;
      if (reason instanceof ApiError && reason.status === 409) await loadReplyPage(rootId, null, true);
      setReplyDrafts((current) => ({ ...current, [rootId]: { ...source, error: message(reason) } }));
    } finally {
      if (isCurrentMutation(mutation))
        setReplyPending((current) => ({ ...current, [rootId]: false }));
      finishMutation(mutation);
    }
  }, [authenticated, beginMutation, finishMutation, isCurrentMutation, loadReplyPage,
    loadRootPage, replyDrafts, replyPending, stableTarget]);

  const toggleReplies = useCallback((rootId: string) => {
    const current = replies[rootId];
    if (current?.expanded) {
      setReplies((states) => ({ ...states, [rootId]: { ...states[rootId], expanded: false } }));
    } else if (current?.items.length) {
      setReplies((states) => ({ ...states, [rootId]: { ...states[rootId], expanded: true } }));
    } else void loadReplyPage(rootId, null, true);
  }, [loadReplyPage, replies]);

  const startEdit = useCallback((comment: CommentProjection) => {
    if (!comment.canEdit || !comment.editTag || comment.isTombstone || comment.body === null) return;
    setEdit({ comment, body: comment.body, isSpoiler: comment.isSpoiler, error: "", pending: false });
  }, []);

  const submitEdit = useCallback(async () => {
    if (!edit || edit.pending || !edit.comment.canEdit || !edit.comment.editTag) return;
    const validation = validateCommentDraft(edit.body);
    if (validation.error) { setEdit((current) => current ? { ...current, error: validation.error! } : null); return; }
    const mutation = beginMutation(`edit:${edit.comment.id}`);
    setEdit((current) => current ? { ...current, pending: true, error: "" } : null);
    try {
      const result = await editComment(edit.comment.id, edit.comment.parentCommentId,
        { body: validation.normalizedBody, isSpoiler: edit.isSpoiler }, edit.comment.editTag,
        mutation.request.controller.signal);
      if (!isCurrentMutation(mutation)) return;
      if (result.comment.parentCommentId) setReplies((current) => ({ ...current,
        [result.comment.parentCommentId!]: { ...current[result.comment.parentCommentId!],
          items: (current[result.comment.parentCommentId!]?.items ?? []).map((item) =>
            item.id === result.comment.id ? result.comment : item) } }));
      else setRoots((current) => current.map((item) => item.id === result.comment.id ? result.comment : item));
      setEdit(null); setAnnouncement("Comment edited."); setFocusCommentId(result.comment.id);
    } catch (reason) {
      if (!isCurrentMutation(mutation)) return;
      if (reason instanceof ApiError && (reason.status === 409 || reason.status === 404)) {
        if (edit.comment.parentCommentId) await loadReplyPage(edit.comment.parentCommentId, null, true);
        else await loadRootPage(null, true);
      }
      setEdit((current) => current ? { ...current, pending: false, error: message(reason) } : null);
    } finally {
      if (isCurrentMutation(mutation))
        setEdit((current) => current ? { ...current, pending: false } : null);
      finishMutation(mutation);
    }
  }, [beginMutation, edit, finishMutation, isCurrentMutation, loadReplyPage, loadRootPage]);

  const openDelete = useCallback((comment: CommentProjection, restoreFocus: HTMLElement | null) => {
    if (!comment.canDelete || !comment.editTag || comment.isTombstone) return;
    setDeleting({ comment, error: "", pending: false, restoreFocus });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleting || deleting.pending || !deleting.comment.canDelete || !deleting.comment.editTag) return;
    const mutation = beginMutation(`delete:${deleting.comment.id}`);
    setDeleting((current) => current ? { ...current, pending: true, error: "" } : null);
    try {
      await deleteComment(deleting.comment.id, deleting.comment.editTag, mutation.request.controller.signal);
      if (!isCurrentMutation(mutation)) return;
      const reconciled = deleting.comment.parentCommentId
        ? await loadReplyPage(deleting.comment.parentCommentId, null, true)
        : await loadRootPage(null, true);
      if (!isCurrentMutation(mutation)) return;
      if (!reconciled) {
        setDeleting((current) => current ? { ...current, pending: false,
          error: "Deleted on the server, but the discussion could not be refreshed. Retry reconciliation." } : null);
        return;
      }
      const restore = deleting.restoreFocus;
      const fallbackId = deleting.comment.parentCommentId ?? deleting.comment.id;
      setDeleting(null); setEdit(null); setAnnouncement("Comment deleted.");
      requestAnimationFrame(() => {
        if (restore?.isConnected) restore.focus();
        else (document.getElementById(`comment-${fallbackId}`) ??
          document.getElementById("discussion-heading"))?.focus();
      });
    } catch (reason) {
      if (!isCurrentMutation(mutation)) return;
      if (reason instanceof ApiError && reason.status === 404) {
        if (deleting.comment.parentCommentId) await loadReplyPage(deleting.comment.parentCommentId, null, true);
        else await loadRootPage(null, true);
      }
      setDeleting((current) => current ? { ...current, pending: false, error: message(reason) } : null);
    } finally {
      if (isCurrentMutation(mutation))
        setDeleting((current) => current ? { ...current, pending: false } : null);
      finishMutation(mutation);
    }
  }, [beginMutation, deleting, finishMutation, isCurrentMutation, loadReplyPage, loadRootPage]);

  const updateComment = useCallback((commentId: string,
    update: (comment: CommentProjection) => CommentProjection) => {
    setRoots((current) => current.map((item) => item.id === commentId ? update(item) : item));
    setReplies((current) => Object.fromEntries(Object.entries(current).map(([rootId, state]) =>
      [rootId, { ...state, items: state.items.map((item) => item.id === commentId ? update(item) : item) }])));
  }, []);

  const toggleLike = useCallback(async (comment: CommentProjection) => {
    if (!authenticated || !comment.canLike || comment.isTombstone || likePending[comment.id]) return;
    const mutation = beginMutation(`like:${comment.id}`);
    setLikePending((current) => ({ ...current, [comment.id]: true }));
    setInteractionErrors((current) => ({ ...current, [comment.id]: "" }));
    try {
      const result = await setCommentLike(comment.id, !comment.isLikedByViewer,
        mutation.request.controller.signal);
      if (!isCurrentMutation(mutation)) return;
      updateComment(comment.id, (confirmed) => ({ ...confirmed, likeCount: result.likeCount,
        isLikedByViewer: result.isLikedByViewer, canLike: result.canLike }));
      setAnnouncement(result.isLikedByViewer ? "Comment Liked." : "Comment Like removed.");
    } catch (reason) {
      if (!isCurrentMutation(mutation)) return;
      if (reason instanceof ApiError && (reason.status === 404 || reason.status === 409)) {
        if (comment.parentCommentId) await loadReplyPage(comment.parentCommentId, null, true);
        else await loadRootPage(null, true);
      }
      setInteractionErrors((current) => ({ ...current, [comment.id]: message(reason) }));
    } finally {
      if (isCurrentMutation(mutation))
        setLikePending((current) => ({ ...current, [comment.id]: false }));
      finishMutation(mutation);
    }
  }, [authenticated, beginMutation, finishMutation, isCurrentMutation, likePending,
    loadReplyPage, loadRootPage, updateComment]);

  const openReport = useCallback((comment: CommentProjection, restoreFocus: HTMLElement | null) => {
    if (!authenticated || comment.isTombstone) return;
    setReporting({ commentId: comment.id, reason: "", details: "", error: "", pending: false, restoreFocus });
  }, [authenticated]);

  const submitReport = useCallback(async () => {
    if (!reporting || !reporting.reason || reporting.pending || reporting.details.length > 1000) return;
    const mutation = beginMutation(`report:${reporting.commentId}`);
    setReporting((current) => current ? { ...current, pending: true, error: "" } : null);
    try {
      await reportComment(reporting.commentId, reporting.reason,
        reporting.details.trim() || null, mutation.request.controller.signal);
      if (!isCurrentMutation(mutation)) return;
      const restore = reporting.restoreFocus;
      setReporting(null); setAnnouncement("Comment report submitted.");
      requestAnimationFrame(() => restore?.isConnected && restore.focus());
    } catch (reason) {
      if (!isCurrentMutation(mutation)) return;
      setReporting((current) => current ? { ...current, pending: false, error: message(reason) } : null);
    } finally {
      if (isCurrentMutation(mutation))
        setReporting((current) => current ? { ...current, pending: false } : null);
      finishMutation(mutation);
    }
  }, [beginMutation, finishMutation, isCurrentMutation, reporting]);

  return {
    target: stableTarget, authenticated, sort, setSort, roots, rootStatus, rootError, rootCursor, rootHasMore,
    rootLoadingMore, concealed, replies, rootDraft, setRootDraft: setRootDraftValue,
    replyDrafts, setReplyDraft: setReplyDraftValue, rootPending, replyPending, edit, setEdit,
    deleting, setDeleting, reporting, setReporting, likePending, interactionErrors,
    announcement, focusCommentId, setFocusCommentId,
    retryRoots: () => void loadRootPage(null, true),
    loadMoreRoots: () => rootCursor && void loadRootPage(rootCursor, false),
    toggleReplies,
    retryReplies: (rootId: string) => void loadReplyPage(rootId, replies[rootId]?.cursor ?? null, false),
    loadMoreReplies: (rootId: string) => void loadReplyPage(rootId, replies[rootId]?.cursor ?? null, false),
    submitRoot, submitReply, startEdit, submitEdit, openDelete, confirmDelete,
    toggleLike, openReport, submitReport,
  };
}

export type DiscussionController = ReturnType<typeof useDiscussionController>;
