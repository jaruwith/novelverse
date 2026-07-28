"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  apiErrorMessage, hasSession, listLibrary, listReadingProgress, removeBookmark,
} from "@/features/novel-editor/api";
import type { LibraryStory, ReadingProgress } from "@/features/novel-editor/types";
import { resolvePublicEpisodeHref } from "@/features/public-discovery/routes";

export function LibraryPage() {
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState<LibraryStory[]>([]);
  const [progress, setProgress] = useState<ReadingProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const load = useCallback(() => {
    if (!hasSession()) {
      router.replace("/login?next=%2Flibrary");
      return;
    }
    setLoading(true);
    setError("");
    Promise.all([listLibrary(), listReadingProgress()])
      .then(([library, recent]) => {
        setBookmarks(library.items);
        setProgress(recent.items);
      })
      .catch((reason) => setError(apiErrorMessage(reason)))
      .finally(() => setLoading(false));
  }, [router]);
  useEffect(() => {
    if (!hasSession()) {
      router.replace("/login?next=%2Flibrary");
      return;
    }
    Promise.all([listLibrary(), listReadingProgress()])
      .then(([library, recent]) => {
        setBookmarks(library.items);
        setProgress(recent.items);
      })
      .catch((reason) => setError(apiErrorMessage(reason)))
      .finally(() => setLoading(false));
  }, [router]);

  async function remove(storyId: string) {
    setRemoving(storyId);
    try {
      await removeBookmark(storyId);
      setBookmarks((items) => items.filter((item) => item.storyId !== storyId));
    } catch (reason) {
      setError(apiErrorMessage(reason));
    } finally {
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
