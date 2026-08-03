"use client";

import { useEffect, useRef } from "react";
import type { CommentReportReason } from "./types";
import type { ReportState } from "./useDiscussionController";
import styles from "./community.module.css";
import dialogStyles from "./CommentReportDialog.module.css";

const reasons: { value: CommentReportReason; label: string }[] = [
  { value: "SPAM", label: "Spam" }, { value: "COPYRIGHT", label: "Copyright" },
  { value: "HARASSMENT", label: "Harassment" }, { value: "HATE", label: "Hate" },
  { value: "SEXUAL_CONTENT", label: "Sexual content" }, { value: "VIOLENCE", label: "Violence" },
  { value: "SELF_HARM", label: "Self-harm" }, { value: "MISINFORMATION", label: "Misinformation" },
  { value: "IMPERSONATION", label: "Impersonation" }, { value: "PRIVACY", label: "Privacy" },
  { value: "OTHER", label: "Other" },
];

export function CommentReportDialog({ state, onChange, onSubmit, onCancel }: {
  state: ReportState;
  onChange: (next: ReportState) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => { cancel.current?.focus(); }, []);
  function close() {
    const restore = state.restoreFocus;
    onCancel();
    requestAnimationFrame(() => restore?.isConnected && restore.focus());
  }
  return <div className={styles.backdrop}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="report-comment-title"
      className={styles.dialog} onKeyDown={(event) => {
        if (event.key === "Escape" && !state.pending) { event.preventDefault(); close(); return; }
        if (event.key !== "Tab") return;
        const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]),select:not([disabled]),textarea:not([disabled])") ?? [])];
        if (!focusable.length) return;
        const index = focusable.indexOf(document.activeElement as HTMLElement);
        const next = event.shiftKey ? (index <= 0 ? focusable.length - 1 : index - 1)
          : (index === focusable.length - 1 ? 0 : index + 1);
        event.preventDefault(); focusable[next].focus();
      }}>
      <h2 id="report-comment-title">Report Comment</h2>
      <p>The current Comment is captured privately by the safety system when you submit.</p>
      <label className={dialogStyles.field}>Reason
        <select required value={state.reason} disabled={state.pending}
          onChange={(event) => onChange({ ...state, reason: event.target.value as CommentReportReason, error: "" })}>
          <option value="">Choose a reason</option>
          {reasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
        </select>
      </label>
      <label className={dialogStyles.field}>Additional details (optional)
        <textarea maxLength={1000} value={state.details} disabled={state.pending}
          onChange={(event) => onChange({ ...state, details: event.target.value, error: "" })} />
      </label>
      <p className={styles.count}>{state.details.length}/1000</p>
      {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
      <div className={styles.actions}>
        <button ref={cancel} type="button" disabled={state.pending} onClick={close}>Cancel</button>
        <button type="button" disabled={state.pending || !state.reason} onClick={onSubmit}>
          {state.pending ? "Submitting…" : "Submit report"}
        </button>
      </div>
    </div>
  </div>;
}
