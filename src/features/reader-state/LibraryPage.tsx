"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError, apiErrorMessage, getSessionGeneration, hasSession, listLibrary, listReadingProgress, removeBookmark,
  subscribeToSessionChanges,
} from "@/features/novel-editor/api";
import type { LibraryStory, ReadingProgress } from "@/features/novel-editor/types";
import { resolvePublicEpisodeHref } from "@/features/public-discovery/routes";

export function LibraryPage() {
  const router = useRouter();
  const loadRequestId = useRef(0);
  const loadController = useRef<AbortController | null>(null);
  const removeRequestId = useRef(0);
  const removeController = useRef<AbortController | null>(null);
  const [bookmarks, setBookmarks] = useState<LibraryStory[]>([]);
  const [progress, setProgress] = useState<ReadingProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const load = useCallback(() => {
    const current = ++loadRequestId.current;
    const sessionGeneration = getSessionGeneration();
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setBookmarks([]);
    setProgress([]);
    setError("");
    if (!hasSession()) {
      loadController.current = null;
      setLoading(false);
      router.replace("/login?next=%2Flibrary");
      return;
    }
    setLoading(true);
    Promise.all([listLibrary(1, 20, controller.signal), listReadingProgress(1, 3, controller.signal)])
      .then(([library, recent]) => {
        if (controller.signal.aborted || loadRequestId.current !== current
          || getSessionGeneration() !== sessionGeneration) return;
        setBookmarks(library.items);
        setProgress(recent.items);
      })
      .catch((reason) => {
        if (controller.signal.aborted || loadRequestId.current !== current
          || getSessionGeneration() !== sessionGeneration) return;
        setBookmarks([]);
        setProgress([]);
        if (reason instanceof ApiError && reason.status === 401) router.replace("/login?next=%2Flibrary");
        else setError(apiErrorMessage(reason));
      })
      .finally(() => {
        if (loadRequestId.current !== current || getSessionGeneration() !== sessionGeneration) return;
        loadController.current = null;
        setLoading(false);
      });
  }, [router]);
  useEffect(() => {
    let active = true;
    const synchronize = () => {
      if (!active) return;
      removeRequestId.current += 1;
      removeController.current?.abort();
      removeController.current = null;
      setRemoving(null);
      load();
    };
    queueMicrotask(() => { if (active) synchronize(); });
    const unsubscribe = subscribeToSessionChanges(synchronize);
    return () => {
      active = false;
      unsubscribe();
      loadRequestId.current += 1;
      removeRequestId.current += 1;
      loadController.current?.abort();
      removeController.current?.abort();
    };
  }, [load]);

  async function remove(storyId: string) {
    const current = ++removeRequestId.current;
    const sessionGeneration = getSessionGeneration();
    removeController.current?.abort();
    const controller = new AbortController();
    removeController.current = controller;
    setRemoving(storyId);
    try {
      await removeBookmark(storyId, controller.signal);
      if (controller.signal.aborted || removeRequestId.current !== current
        || getSessionGeneration() !== sessionGeneration) return;
      setBookmarks((items) => items.filter((item) => item.storyId !== storyId));
    } catch (reason) {
      if (controller.signal.aborted || removeRequestId.current !== current
        || getSessionGeneration() !== sessionGeneration) return;
      setError(apiErrorMessage(reason));
    } finally {
      if (removeRequestId.current !== current || getSessionGeneration() !== sessionGeneration) return;
      removeController.current = null;
      setRemoving(null);
    }
  }

  if (loading) return <main className="container"><p role="status">กำลังโหลดคลังของคุณ…</p></main>;
  if (error) return <main className="container"><div role="alert"><p>{error}</p>
    <button type="button" onClick={load}>ลองอีกครั้ง</button></div></main>;
  return <main className="container">
    <h1>คลังของฉัน</h1>
    <section>
      <h2>อ่านต่อ</h2>
      {!progress.length && <p>ยังไม่มีตอนที่อ่านล่าสุด</p>}
      {progress.map((item) => {
        const href = resolvePublicEpisodeHref(
          item.storyType, item.creatorSlug, item.storySlug, item.episodeSlug,
        );
        return <article key={item.storyId}>
          <h3>{item.storyTitle}</h3>
          <p>{item.episodeTitle} · {item.storyType} · {new Date(item.lastAccessedAt).toLocaleString("th-TH")}</p>
          {href && <Link className="primaryButton" href={href}>อ่านต่อ</Link>}
        </article>;
      })}
    </section>
    <section>
      <h2>เรื่องที่บันทึกไว้</h2>
      {!bookmarks.length && <p>ยังไม่มีเรื่องที่บันทึกไว้</p>}
      {bookmarks.map((story) => <article key={story.storyId}>
        <h3>{story.isAvailable !== false
          ? <Link href={`/stories/${encodeURIComponent(story.creatorSlug)}/${encodeURIComponent(story.storySlug)}`}>{story.title}</Link>
          : story.title}</h3>
        {story.isAvailable === false && <p role="status">เนื้อหานี้ไม่พร้อมให้บริการ</p>}
        <p>โดย {story.creatorDisplayName} · {story.storyType}</p>
        <div className="tagRow">{story.categories.map((category) =>
          <span className="tag" key={category.id}>{category.name}</span>)}</div>
        <button type="button" disabled={removing === story.storyId} onClick={() => void remove(story.storyId)}>
          {removing === story.storyId ? "กำลังลบ…" : "ลบออกจากคลัง"}
        </button>
      </article>)}
    </section>
  </main>;
}
