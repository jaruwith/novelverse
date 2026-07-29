"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiErrorMessage, getCurrentUser, listModerationReports, moderateTarget, updateModerationWorkflow } from "@/features/novel-editor/api";
import type { ModerationReport, ModerationReportStatus, ModerationTargetType } from "@/features/novel-editor/types";

export function ModeratorQueue() {
  const [items, setItems] = useState<ModerationReport[]>([]);
  const [status, setStatus] = useState<ModerationReportStatus | "">("");
  const [targetType, setTargetType] = useState<ModerationTargetType | "">("");
  const [sort, setSort] = useState<"NEWEST" | "OLDEST">("NEWEST");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const user = await getCurrentUser();
      if (user.role !== "MODERATOR") throw new ApiError(403);
      const result = await listModerationReports({ status: status || undefined,
        targetType: targetType || undefined, sort, page });
      setItems(result.items); setPages(Math.max(1, result.totalPages));
    } catch (reason) { setError(apiErrorMessage(reason)); }
    finally { setLoading(false); }
  }, [page, sort, status, targetType]);
  // The callback starts an external API synchronization; state changes occur after awaited requests.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  async function act(report: ModerationReport, action: "review" | "dismiss" | "hide" | "restore") {
    try {
      if (action === "review") await updateModerationWorkflow(report.id, "UNDER_REVIEW");
      if (action === "dismiss") await updateModerationWorkflow(report.id, "DISMISSED");
      if (action === "hide" && confirm("ยืนยันการซ่อนเนื้อหา?")) await moderateTarget("hide", {
        targetType: report.targetType, targetId: report.targetId, reportId: report.id, reasonCode: report.reason });
      if (action === "restore" && confirm("ยืนยันการคืนค่าเนื้อหา?")) await moderateTarget("restore", {
        targetType: report.targetType, targetId: report.targetId, reasonCode: report.reason });
      await load();
    } catch (reason) { setError(apiErrorMessage(reason)); }
  }
  return <main className="container"><h1>คิวรายงานเนื้อหา</h1>
    <div className="formRow">
      <select aria-label="สถานะ" value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }}>
        <option value="">ทุกสถานะ</option><option value="OPEN">เปิด</option><option value="UNDER_REVIEW">กำลังตรวจสอบ</option>
        <option value="ACTION_TAKEN">ดำเนินการแล้ว</option><option value="DISMISSED">ยกเลิก</option></select>
      <select aria-label="ประเภทเป้าหมาย" value={targetType} onChange={(e) => { setTargetType(e.target.value as typeof targetType); setPage(1); }}>
        <option value="">ทุกประเภท</option><option value="STORY">เรื่อง</option><option value="EPISODE">ตอน</option><option value="USER">ผู้ใช้</option></select>
      <select aria-label="การเรียง" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
        <option value="NEWEST">ใหม่สุด</option><option value="OLDEST">เก่าสุด</option></select>
    </div>
    {loading && <p role="status">กำลังโหลดรายงาน…</p>}
    {error && <div role="alert"><p>{error}</p><button onClick={() => void load()}>ลองอีกครั้ง</button></div>}
    {!loading && !error && !items.length && <p>ไม่มีรายงาน</p>}
    {items.map((report) => <article className="panel" key={report.id}><h2>{report.targetType} · {report.reason}</h2>
      <p>สถานะ: {report.status}</p>{report.comment && <p>{report.comment}</p>}<div className="actions">
        {report.status === "OPEN" && <button onClick={() => void act(report, "review")}>เริ่มตรวจสอบ</button>}
        {(report.status === "OPEN" || report.status === "UNDER_REVIEW") && <>
          <button className="secondaryButton" onClick={() => void act(report, "dismiss")}>ยกเลิก</button>
          <button className="dangerButton" onClick={() => void act(report, "hide")}>ซ่อนและปิดรายงาน</button></>}
        <button className="secondaryButton" onClick={() => void act(report, "restore")}>คืนค่าเป้าหมาย</button>
      </div></article>)}
    <div className="actions"><button disabled={page <= 1} onClick={() => setPage((x) => x - 1)}>ก่อนหน้า</button>
      <span>หน้า {page}/{pages}</span><button disabled={page >= pages} onClick={() => setPage((x) => x + 1)}>ถัดไป</button></div>
  </main>;
}
