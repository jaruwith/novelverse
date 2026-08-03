"use client";

import type { EditState } from "./useDiscussionController";
import { CommentComposer } from "./CommentComposer";

export function CommentEditor({ edit, onChange, onSave, onCancel }: {
  edit: EditState;
  onChange: (body: string, isSpoiler: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return <CommentComposer label="Edit Comment" autoFocus
    draft={{ body: edit.body, isSpoiler: edit.isSpoiler, error: edit.error }} pending={edit.pending}
    onChange={(draft) => onChange(draft.body, draft.isSpoiler)} onSubmit={onSave} onCancel={onCancel} />;
}
