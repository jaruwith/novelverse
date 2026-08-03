"use client";

import { useState } from "react";
import type { DiscussionController } from "./useDiscussionController";
import { CommentItem } from "./CommentItem";
import { ReplyList } from "./ReplyList";
import styles from "./community.module.css";

export function CommentList({ controller }: { controller: DiscussionController }) {
  const [focusReplyRootId, setFocusReplyRootId] = useState<string | null>(null);
  if (controller.rootStatus === "loading" && !controller.roots.length)
    return <p role="status">Loading discussion…</p>;
  if (controller.rootStatus === "error" && !controller.roots.length)
    return <div role="alert" className={styles.errorState}><p>{controller.rootError}</p>
      <button type="button" onClick={controller.retryRoots}>Retry discussion</button></div>;
  if (!controller.roots.length) return <p>No Comments yet. Start the discussion.</p>;
  return <>
    <ol className={styles.list}
      aria-label={`${controller.target.kind === "STORY" ? "Story" : "Episode"} discussion Comments`}>
      {controller.roots.map((comment) => <li key={comment.id}>
        <CommentItem comment={comment} root controller={controller}>
          <div className={styles.replyControls}>
            {(comment.replyCount > 0 || controller.replies[comment.id]?.items.length) &&
              <button type="button" aria-expanded={Boolean(controller.replies[comment.id]?.expanded)}
                onClick={() => controller.toggleReplies(comment.id)}>
                {controller.replies[comment.id]?.expanded ? "Hide Replies" : "View Replies"}
              </button>}
            {controller.authenticated && !comment.isTombstone &&
              <button type="button" aria-expanded={Boolean(controller.replies[comment.id]?.expanded)}
                onClick={() => {
                  setFocusReplyRootId(comment.id);
                  if (!controller.replies[comment.id]?.expanded) controller.toggleReplies(comment.id);
                }}>Reply</button>}
          </div>
          <ReplyList root={comment} controller={controller} focusComposer={focusReplyRootId === comment.id}
            onComposerFocused={() => setFocusReplyRootId(null)} />
        </CommentItem>
      </li>)}
    </ol>
    {controller.rootError && controller.roots.length > 0 && <div role="alert" className={styles.errorState}>
      <p>{controller.rootError}</p><button type="button" onClick={controller.loadMoreRoots}>Retry Load More</button>
    </div>}
    {controller.rootHasMore && !controller.rootError && <button type="button" disabled={controller.rootLoadingMore}
      onClick={controller.loadMoreRoots}>{controller.rootLoadingMore ? "Loading…" : "Load more Comments"}</button>}
  </>;
}
