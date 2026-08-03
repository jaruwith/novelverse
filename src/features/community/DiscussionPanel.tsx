"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { CommunityTarget } from "./types";
import { useDiscussionController } from "./useDiscussionController";
import { CommentComposer } from "./CommentComposer";
import { CommentList } from "./CommentList";
import { DeleteCommentDialog } from "./DeleteCommentDialog";
import { CommentReportDialog } from "./CommentReportDialog";
import styles from "./community.module.css";

export function DiscussionPanel({ target }: { target: CommunityTarget }) {
  const controller = useDiscussionController(target);
  const pathname = usePathname();
  const { focusCommentId, setFocusCommentId } = controller;
  useEffect(() => {
    if (!focusCommentId) return;
    document.getElementById(`comment-${focusCommentId}`)?.focus();
    setFocusCommentId(null);
  }, [focusCommentId, setFocusCommentId]);
  if (controller.concealed) return null;
  return <section className={styles.panel} aria-labelledby="discussion-heading" data-community-panel
    aria-busy={controller.rootStatus === "loading" || controller.rootLoadingMore || controller.rootPending}>
    <div className={styles.heading}>
      <h2 id="discussion-heading" tabIndex={-1}>Discussion</h2>
      <label>Sort Comments
        <select value={controller.sort} disabled={controller.rootStatus === "loading"}
          onChange={(event) => controller.setSort(event.target.value as "OLDEST" | "NEWEST")}>
          <option value="OLDEST">Oldest first</option>
          <option value="NEWEST">Newest first</option>
        </select>
      </label>
    </div>
    <CommentList controller={controller} />
    <div className={styles.rootComposer}>
      {controller.authenticated ? <CommentComposer label="Write a Comment" draft={controller.rootDraft}
        pending={controller.rootPending} onChange={controller.setRootDraft}
        onSubmit={() => void controller.submitRoot()} />
        : <p><Link href={`/login?next=${encodeURIComponent(pathname)}`}>Sign in</Link> to write a Comment or Reply.</p>}
    </div>
    <p className={styles.srOnly} aria-live="polite" aria-atomic="true">{controller.announcement}</p>
    {controller.deleting && <DeleteCommentDialog state={controller.deleting}
      onConfirm={() => void controller.confirmDelete()} onCancel={() => controller.setDeleting(null)} />}
    {controller.reporting && <CommentReportDialog state={controller.reporting}
      onChange={controller.setReporting} onSubmit={() => void controller.submitReport()}
      onCancel={() => controller.setReporting(null)} />}
  </section>;
}
