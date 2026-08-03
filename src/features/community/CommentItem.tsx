"use client";

import type { CommentProjection } from "./types";
import type { DiscussionController } from "./useDiscussionController";
import { CommentEditor } from "./CommentEditor";
import { SpoilerContent } from "./SpoilerContent";
import styles from "./community.module.css";

export function CommentItem({ comment, root, controller, children }: {
  comment: CommentProjection;
  root: boolean;
  controller: DiscussionController;
  children?: React.ReactNode;
}) {
  const editing = controller.edit?.comment.id === comment.id;
  const authorText = comment.author?.displayName ?? "Deleted member";
  return <article id={`comment-${comment.id}`} tabIndex={-1} className={styles.comment}
    aria-label={comment.isTombstone ? `${root ? "Comment" : "Reply"}, deleted`
      : `${root ? "Comment" : "Reply"} by ${authorText}${comment.isOwnedByViewer ? ", your Comment" : ""}`}>
    {comment.isTombstone ? <div className={styles.tombstone}>
      <p><strong>Deleted Comment</strong></p>
      <p>This Comment is unavailable.</p>
    </div> : <>
      <header className={styles.commentHeader}>
        <strong>{authorText}</strong>
        {comment.author?.isCreator && <span className={styles.badge}>Creator</span>}
        {comment.isOwnedByViewer && <span>Your Comment</span>}
        <time dateTime={comment.createdAt} title={new Date(comment.createdAt).toLocaleString()}>
          {new Date(comment.createdAt).toLocaleString()}
        </time>
        {comment.editedAt && <span>Edited</span>}
      </header>
      {editing && controller.edit ? <CommentEditor edit={controller.edit}
        onChange={(body, isSpoiler) => controller.setEdit((current) => current ? { ...current, body, isSpoiler, error: "" } : null)}
        onSave={() => void controller.submitEdit()} onCancel={() => controller.setEdit(null)} />
        : comment.isSpoiler ? <SpoilerContent body={comment.body!} /> : <p className={styles.body}>{comment.body}</p>}
      {!editing && (comment.canEdit || comment.canDelete) && <div className={styles.actions}>
        {comment.canEdit && comment.editTag && <button type="button" onClick={() => controller.startEdit(comment)}>Edit</button>}
        {comment.canDelete && comment.editTag && <button type="button" onClick={(event) =>
          controller.openDelete(comment, event.currentTarget)}>Delete</button>}
      </div>}
      {!editing && <div className={styles.actions} aria-label="Comment interactions">
        <span aria-label={`${comment.likeCount} Likes`}>{comment.likeCount} {comment.likeCount === 1 ? "Like" : "Likes"}</span>
        {comment.canLike && <button type="button"
          aria-label={comment.isLikedByViewer ? "Unlike Comment" : "Like Comment"}
          aria-pressed={comment.isLikedByViewer}
          disabled={Boolean(controller.likePending[comment.id])}
          onClick={() => void controller.toggleLike(comment)}>
          {controller.likePending[comment.id] ? "Saving…" : comment.isLikedByViewer ? "Unlike" : "Like"}
        </button>}
        {comment.isLikedByViewer && !comment.canLike && <span>Liked; unavailable to change</span>}
        {controller.authenticated && <button type="button"
          onClick={(event) => controller.openReport(comment, event.currentTarget)}>Report</button>}
      </div>}
      {controller.interactionErrors[comment.id] && <p role="alert" className={styles.error}>
        {controller.interactionErrors[comment.id]}
      </p>}
    </>}
    {children}
  </article>;
}
