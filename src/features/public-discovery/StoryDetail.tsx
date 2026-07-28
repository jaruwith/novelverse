"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  addBookmark, apiErrorMessage, getPublicStory, hasSession, listLibrary,
  listPublicEpisodes, removeBookmark,
} from "@/features/novel-editor/api";
import type { PublicEpisode, PublicStory } from "@/features/novel-editor/types";
import { resolvePublicEpisodeHref } from "./routes";
import styles from "./publicDiscovery.module.css";
import { ReportDialog } from "@/features/moderation/ReportDialog";

export function StoryDetail({ creatorSlug, storySlug }: { creatorSlug: string; storySlug: string }) {
  const [story, setStory] = useState<PublicStory | null>(null);
  const [episodes, setEpisodes] = useState<PublicEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [bookmarkError, setBookmarkError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([
        getPublicStory(creatorSlug, storySlug),
        listPublicEpisodes(creatorSlug, storySlug),
      ]).then(([storyResult, episodeResult]) => {
      if (!active) return;
      setStory(storyResult);
      setEpisodes(episodeResult.items);
    }).catch((reason) => {
      if (!active) return;
      setError(apiErrorMessage(reason));
    }).finally(() => {
      if (!active) return;
      setLoading(false);
    });
    return () => { active = false; };
  }, [creatorSlug, retryKey, storySlug]);
  useEffect(() => {
    if (!story || !hasSession()) return;
    listLibrary(1, 100).then((result) => {
      setBookmarked(result.items.some((item) => item.storyId === story.id));
    }).catch(() => undefined);
  }, [story]);

  async function toggleBookmark() {
    if (!story) return;
    setBookmarkBusy(true);
    setBookmarkError("");
    try {
      if (bookmarked) await removeBookmark(story.id);
      else await addBookmark(story.id);
      setBookmarked((value) => !value);
    } catch (reason) {
      setBookmarkError(apiErrorMessage(reason));
    } finally {
      setBookmarkBusy(false);
    }
  }

  if (loading) return <main className="container"><p role="status">กำลังโหลดรายละเอียดเรื่อง…</p></main>;
  if (error || !story) return <main className="container"><div role="alert" className={styles.state}>
    <p>{error || "ไม่พบเรื่องนี้"}</p>
    <button type="button" onClick={() => { setLoading(true); setError(""); setRetryKey((value) => value + 1); }}>ลองอีกครั้ง</button>
  </div></main>;

  return (
    <main className="container">
      <Link href="/">← กลับหน้าแรก</Link>
      <section className={styles.detailHero}>
        {story.coverUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={story.coverUrl} alt={`ปก ${story.title}`} />
          : <div className={styles.detailPlaceholder} aria-label="ไม่มีภาพปก">◇</div>}
        <div>
          <span className="eyebrow">{story.storyType}</span>
          <h1>{story.title}</h1>
          <p>โดย {story.creatorDisplayName}</p>
          <p>{story.synopsis || "ยังไม่มีเรื่องย่อ"}</p>
          <p>ระดับเนื้อหา: {story.contentRating} · เผยแพร่ {new Date(story.publishedAt).toLocaleDateString("th-TH")}</p>
          {hasSession()
            ? <button type="button" disabled={bookmarkBusy} onClick={() => void toggleBookmark()}>
              {bookmarkBusy ? "กำลังบันทึก…" : bookmarked ? "นำออกจากคลัง" : "บันทึกเข้าคลัง"}
            </button>
            : <Link className="primaryButton" href={`/login?next=${encodeURIComponent(`/stories/${creatorSlug}/${storySlug}`)}`}>
              บันทึกเข้าคลัง
            </Link>}
          {bookmarkError && <p role="alert">{bookmarkError}</p>}
          <ReportDialog targetType="STORY" targetId={story.id} targetSummary={story.title} />
          <div className="tagRow">
            {story.categories.map((category) => <span className="tag" key={category.id}>{category.name}</span>)}
            {story.tags.map((tag) => <span className="tag" key={tag.id}>#{tag.name}</span>)}
          </div>
        </div>
      </section>
      <section className={styles.episodes}>
        <h2>ตอนที่เผยแพร่</h2>
        {!episodes.length && <p>เรื่องนี้ยังไม่มีตอนที่เผยแพร่</p>}
        {episodes.map((episode) => {
          const href = resolvePublicEpisodeHref(story.storyType, creatorSlug, storySlug, episode.slug);
          return <article key={episode.id}>
            <div><strong>{episode.episodeNumber}. {episode.title}</strong>
              {episode.synopsis && <p>{episode.synopsis}</p>}</div>
            {href ? <Link className="primaryButton" href={href}>เปิดอ่าน</Link> : <span role="alert">ไม่รองรับประเภทเรื่องนี้</span>}
          </article>;
        })}
      </section>
    </main>
  );
}
