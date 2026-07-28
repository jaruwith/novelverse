"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ApiError, apiErrorMessage, hasSession, submitModerationReport } from "@/features/novel-editor/api";
import type { ModerationReason, ModerationTargetType } from "@/features/novel-editor/types";

const reasons: { value: ModerationReason; label: string }[] = [
  { value: "SPAM", label: "สแปม" }, { value: "COPYRIGHT", label: "ลิขสิทธิ์" },
  { value: "HARASSMENT", label: "การคุกคาม" }, { value: "HATE", label: "ความเกลียดชัง" },
  { value: "SEXUAL_CONTENT", label: "เนื้อหาทางเพศ" }, { value: "VIOLENCE", label: "ความรุนแรง" },
  { value: "SELF_HARM", label: "การทำร้ายตนเอง" }, { value: "MISINFORMATION", label: "ข้อมูลเท็จ" },
  { value: "IMPERSONATION", label: "การแอบอ้าง" }, { value: "PRIVACY", label: "ความเป็นส่วนตัว" },
  { value: "OTHER", label: "อื่น ๆ" },
];

export function ReportDialog({ targetType, targetId, targetSummary }: {
  targetType: ModerationTargetType; targetId: string; targetSummary: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ModerationReason | "">("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!reason || comment.length > 1000) return;
    setBusy(true); setMessage("");
    try {
      await submitModerationReport(targetType, targetId, reason, comment.trim() || null);
      setMessage("ส่งรายงานเรียบร้อยแล้ว");
    } catch (error) {
      setMessage(error instanceof ApiError && error.status === 409
        ? "คุณได้รายงานเนื้อหานี้ด้วยเหตุผลเดียวกันแล้ว" : apiErrorMessage(error));
    } finally { setBusy(false); }
  }
  if (!hasSession()) return <Link className="secondaryButton"
    href={`/login?next=${encodeURIComponent(globalThis.location?.pathname ?? "/")}`}>เข้าสู่ระบบเพื่อรายงาน</Link>;
  return <div>
    <button className="secondaryButton" type="button" onClick={() => setOpen(true)}>รายงาน</button>
    {open && <div role="dialog" aria-modal="true" aria-label="รายงานเนื้อหา" className="panel">
      <h2>รายงานเนื้อหา</h2><p>{targetSummary}</p>
      <form className="formGrid" onSubmit={submit}>
        <label className="full">เหตุผล
          <select required value={reason} onChange={(event) => setReason(event.target.value as ModerationReason)}>
            <option value="">เลือกเหตุผล</option>
            {reasons.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="full">รายละเอียดเพิ่มเติม (ไม่บังคับ)
          <textarea maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} />
          <small>{comment.length}/1000</small>
        </label>
        {message && <p className="full" role="status">{message}</p>}
        <div className="actions full"><button disabled={busy} type="submit">{busy ? "กำลังส่ง…" : "ส่งรายงาน"}</button>
          <button className="secondaryButton" type="button" onClick={() => setOpen(false)}>ปิด</button></div>
      </form>
    </div>}
  </div>;
}
