"use client";

import { useId, useRef } from "react";
import { validateCommentDraft, type CommentDraft } from "./validation";
import styles from "./community.module.css";

export function CommentComposer({ label, draft, pending, onChange, onSubmit, onCancel, autoFocus = false }: {
  label: string;
  draft: CommentDraft & { error: string };
  pending: boolean;
  onChange: (draft: CommentDraft) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const errorId = useId();
  const countId = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const validation = validateCommentDraft(draft.body);
  const effectiveError = draft.error || (draft.body.length > 0 ? validation.error : null) || "";
  return <form className={styles.composer} aria-label={label} onSubmit={(event) => {
    event.preventDefault();
    onSubmit();
  }}>
    <label>{label}
      <textarea ref={textarea} autoFocus={autoFocus} value={draft.body} disabled={pending}
        aria-describedby={`${countId}${effectiveError ? ` ${errorId}` : ""}`}
        aria-invalid={Boolean(effectiveError)}
        onChange={(event) => onChange({ body: event.target.value, isSpoiler: draft.isSpoiler })} />
    </label>
    <p id={countId} className={styles.count} aria-live="off">
      {validation.scalarCount.toLocaleString()} / 4,000 characters · {validation.lineCount} / 40 lines
    </p>
    <label className={styles.checkbox}>
      <input type="checkbox" checked={draft.isSpoiler} disabled={pending}
        onChange={(event) => onChange({ body: draft.body, isSpoiler: event.target.checked })} />
      Hide the whole Comment as a spoiler
    </label>
    {effectiveError && <p id={errorId} role="alert" className={styles.error}>{effectiveError}</p>}
    <div className={styles.actions}>
      <button type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Submit"}
      </button>
      {onCancel && <button type="button" disabled={pending} onClick={onCancel}>Cancel</button>}
    </div>
  </form>;
}
