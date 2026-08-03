"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError, apiErrorMessage, getCurrentUser, getSessionGeneration,
  listModerationReports, moderateTarget, updateModerationWorkflow,
} from "@/features/novel-editor/api";
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
  const [acting, setActing] = useState<string | null>(null);
  const activeLoad = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    activeLoad.current?.abort();
    const controller = new AbortController();
    activeLoad.current = controller;
    const generation = getSessionGeneration();
    setLoading(true); setError("");
    try {
      const user = await getCurrentUser();
      if (user.role !== "MODERATOR") throw new ApiError(403);
      const result = await listModerationReports({ status: status || undefined,
        targetType: targetType || undefined, sort, page, signal: controller.signal });
      if (controller.signal.aborted || generation !== getSessionGeneration()) return;
      setItems(result.items); setPages(Math.max(1, result.totalPages));
    } catch (reason) {
      if (!controller.signal.aborted && generation === getSessionGeneration()) setError(apiErrorMessage(reason));
    } finally {
      if (!controller.signal.aborted && generation === getSessionGeneration()) setLoading(false);
    }
  }, [page, sort, status, targetType]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      activeLoad.current?.abort();
    };
  }, [load]);

  async function act(report: ModerationReport, action: "review" | "dismiss" | "hide" | "restore") {
    if (acting) return;
    const generation = getSessionGeneration();
    const operationId = globalThis.crypto.randomUUID();
    setActing(`${report.id}:${action}`); setError("");
    try {
      if (action === "review") await updateModerationWorkflow(report.id, "UNDER_REVIEW");
      if (action === "dismiss") await updateModerationWorkflow(report.id, "DISMISSED");
      if (action === "hide" && confirm("Hide this moderation target and resolve the report?"))
        await moderateTarget("hide", { targetType: report.targetType, targetId: report.targetId,
          reportId: report.id, reasonCode: report.reason, operationId });
      if (action === "restore" && confirm("Restore this moderation target?"))
        await moderateTarget("restore", { targetType: report.targetType, targetId: report.targetId,
          reasonCode: report.reason, operationId });
      if (generation === getSessionGeneration()) await load();
    } catch (reason) {
      if (generation === getSessionGeneration()) setError(apiErrorMessage(reason));
    } finally {
      if (generation === getSessionGeneration()) setActing(null);
    }
  }

  return <main className="container"><h1>Content report queue</h1>
    <div className="formRow">
      <select aria-label="Status" value={status} onChange={(event) => {
        setStatus(event.target.value as typeof status); setPage(1);
      }}><option value="">All statuses</option><option value="OPEN">Open</option>
        <option value="UNDER_REVIEW">Under review</option><option value="ACTION_TAKEN">Action taken</option>
        <option value="DISMISSED">Dismissed</option></select>
      <select aria-label="Target type" value={targetType} onChange={(event) => {
        setTargetType(event.target.value as typeof targetType); setPage(1);
      }}><option value="">All target types</option><option value="STORY">Story</option>
        <option value="EPISODE">Episode</option><option value="USER">User</option>
        <option value="COMMENT">Comment</option></select>
      <select aria-label="Sort" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
        <option value="NEWEST">Newest first</option><option value="OLDEST">Oldest first</option></select>
    </div>
    {loading && <p role="status">Loading reports…</p>}
    {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => void load()}>Retry</button></div>}
    {!loading && !error && !items.length && <p>No reports.</p>}
    {items.map((report) => <article className="panel" key={report.id}>
      <h2>{report.targetType} · {report.reason}</h2>
      <p>Status: {report.status}</p>
      {report.comment && <p>{report.comment}</p>}
      {report.commentEvidence && <section aria-label="Restricted Comment report evidence">
        <h3>Restricted report-time evidence</h3>
        <p>Current state: {report.commentEvidence.currentState}</p>
        <p>{report.commentEvidence.isSpoiler ? "Whole-body spoiler at report time" : "Not a spoiler at report time"}</p>
        <p style={{ whiteSpace: "pre-wrap" }}>{report.commentEvidence.bodySnapshot}</p>
        <time dateTime={report.commentEvidence.evidenceCreatedAt}>
          {new Date(report.commentEvidence.evidenceCreatedAt).toLocaleString()}
        </time>
      </section>}
      <div className="actions">
        {report.status === "OPEN" && <button disabled={Boolean(acting)} onClick={() => void act(report, "review")}>Start review</button>}
        {(report.status === "OPEN" || report.status === "UNDER_REVIEW") && <>
          <button className="secondaryButton" disabled={Boolean(acting)} onClick={() => void act(report, "dismiss")}>Dismiss</button>
          <button className="dangerButton" disabled={Boolean(acting)} onClick={() => void act(report, "hide")}>Hide and close report</button>
        </>}
        <button className="secondaryButton" disabled={Boolean(acting)} onClick={() => void act(report, "restore")}>Restore target</button>
      </div>
    </article>)}
    <div className="actions"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
      <span>Page {page}/{pages}</span><button disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</button></div>
  </main>;
}
