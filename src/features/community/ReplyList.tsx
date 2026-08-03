"use client";

import { useEffect, useRef } from "react";
import type { CommentProjection } from "./types";
import type { DiscussionController } from "./useDiscussionController";
import { CommentComposer } from "./CommentComposer";
import { CommentItem } from "./CommentItem";
import styles from "./community.module.css";

export function ReplyList({ root, controller, focusComposer, onComposerFocused }: {
  root: CommentProjection;
  controller: DiscussionController;
  focusComposer: boolean;
  onComposerFocused: () => void;
}) {
  const state = controller.replies[root.id];
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!focusComposer || !state?.expanded || state.status === "loading") return;
    section.current?.querySelector("textarea")?.focus();
    onComposerFocused();
  }, [focusComposer, onComposerFocused, state?.expanded, state?.status]);
  if (!state?.expanded) return null;
  const draft = controller.replyDrafts[root.id] ?? { body: "", isSpoiler: false, error: "" };
  return <section ref={section} className={styles.replies} data-reply-composer={root.id}
    aria-label={`Replies to Comment by ${root.author?.displayName ?? "deleted member"}`}>
    {state.status === "loading" && !state.items.length && <p role="status">Loading Replies…</p>}
    {state.items.length > 0 && <ol>
      {state.items.map((reply) => <li key={reply.id}><CommentItem comment={reply} root={false} controller={controller} /></li>)}
    </ol>}
    {state.status === "error" && <div role="alert"><p>{state.error}</p>
      <button type="button" onClick={() => controller.retryReplies(root.id)}>Retry Replies</button></div>}
    {state.hasMore && state.status !== "error" && <button type="button" disabled={state.status === "loading"}
      onClick={() => controller.loadMoreReplies(root.id)}>Load more Replies</button>}
    {controller.authenticated ? <CommentComposer label="Write a Reply" draft={draft}
      pending={Boolean(controller.replyPending[root.id])}
      onChange={(next) => controller.setReplyDraft(root.id, next)}
      onSubmit={() => void controller.submitReply(root.id)} /> : null}
  </section>;
}
