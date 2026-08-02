"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError, apiErrorMessage, hasSession, listReadingProgress, subscribeToSessionChanges,
} from "@/features/novel-editor/api";
import type { PagedResponse, ReadingProgress } from "@/features/novel-editor/types";
import { resolvePublicEpisodeHref } from "@/features/public-discovery/routes";

const PAGE_SIZE = 20;

export function HistoryPage() {
  const router = useRouter();
  const requestId = useRef(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [result, setResult] = useState<PagedResponse<ReadingProgress> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback((page: number) => {
    const current = ++requestId.current;
    setResult(null);
    setError("");
    if (!hasSession()) {
      setLoading(false);
      router.replace("/login?next=%2Fhistory");
      return;
    }
    setLoading(true);
    listReadingProgress(page, PAGE_SIZE).then((value) => {
      if (requestId.current === current) setResult(value);
    }).catch((reason) => {
      if (requestId.current !== current) return;
      setResult(null);
      if (reason instanceof ApiError && reason.status === 401) router.replace("/login?next=%2Fhistory");
      else setError(apiErrorMessage(reason));
    }).finally(() => { if (requestId.current === current) setLoading(false); });
  }, [router]);

  useEffect(() => {
    const synchronize = () => {
      setPageNumber(1);
      load(1);
    };
    synchronize();
    return subscribeToSessionChanges(synchronize);
  }, [load]);

  function changePage(page: number) {
    setPageNumber(page);
    load(page);
  }

  if (loading) return <main className="container narrow" aria-busy="true">
    <h1>Reading History</h1><p role="status">Loading your reading history…</p>
    <div aria-hidden="true">━━━━━━━━━━━━━━━━</div>
  </main>;
  if (error) return <main className="container narrow"><h1>Reading History</h1><div role="alert">
    <p>{error}</p><button type="button" onClick={() => load(pageNumber)}>Retry</button>
  </div></main>;

  const items = result?.items ?? [];
  return <main className="container narrow">
    <h1>Reading History</h1>
    <p>Shows the latest episode read for each Story, rather than every visit.</p>
    {!items.length && <p>You have no available reading history yet.</p>}
    {items.map((item) => {
      const href = resolvePublicEpisodeHref(item.storyType, item.creatorSlug, item.storySlug, item.episodeSlug);
      return <article key={item.storyId}>
        <h2>{item.storyTitle}</h2>
        <p>{item.episodeTitle} · {new Date(item.lastAccessedAt).toLocaleString()}</p>
        {href && <Link href={href}>Continue reading</Link>}
      </article>;
    })}
    {result && result.totalPages > 1 && <nav aria-label="Reading History pages">
      <button type="button" disabled={!result.hasPreviousPage} onClick={() => changePage(pageNumber - 1)}>Previous page</button>
      <span>Page {result.page} of {result.totalPages}</span>
      <button type="button" disabled={!result.hasNextPage} onClick={() => changePage(pageNumber + 1)}>Next page</button>
    </nav>}
  </main>;
}
