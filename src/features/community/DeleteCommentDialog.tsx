"use client";

import { useEffect, useRef } from "react";
import type { DeleteState } from "./useDiscussionController";
import styles from "./community.module.css";

export function DeleteCommentDialog({ state, onConfirm, onCancel }: {
  state: DeleteState;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => { cancel.current?.focus(); }, []);
  function close() {
    const restore = state.restoreFocus;
    onCancel();
    requestAnimationFrame(() => restore?.focus());
  }
  return <div className={styles.backdrop}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="delete-comment-title"
      className={styles.dialog} onKeyDown={(event) => {
        if (event.key === "Escape" && !state.pending) { event.preventDefault(); close(); return; }
        if (event.key !== "Tab") return;
        const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? [])];
        if (!focusable.length) return;
        const index = focusable.indexOf(document.activeElement as HTMLElement);
        const next = event.shiftKey ? (index <= 0 ? focusable.length - 1 : index - 1)
          : (index === focusable.length - 1 ? 0 : index + 1);
        event.preventDefault(); focusable[next].focus();
      }}>
      <h2 id="delete-comment-title">Delete Comment permanently?</h2>
      <p>This cannot be undone. A root may remain as a neutral tombstone when Replies need context.</p>
      {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
      <div className={styles.actions}>
        <button ref={cancel} type="button" disabled={state.pending} onClick={close}>Cancel</button>
        <button type="button" disabled={state.pending} onClick={onConfirm}>
          {state.pending ? "Deleting…" : "Delete permanently"}
        </button>
      </div>
    </div>
  </div>;
}
