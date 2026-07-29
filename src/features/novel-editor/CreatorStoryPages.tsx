"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  apiErrorMessage, createDraftEpisode, createNovelStory, createComicStory, createVideoStory, getStory, listEpisodes,
  listCategories, listStories, publishStory,
} from "./api";
import type { Category, Episode, Story, StorySummary } from "./types";
import styles from "./studioPages.module.css";

function StudioHeader() {
  return <header className={styles.header}><Link href="/creator/stories">NovelVerse Studio</Link>
    <span>ข้อมูลจริงจาก NovelVerseApi</span></header>;
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <div><div className={styles.alert} role="alert">{message}</div>
    <button type="button" onClick={retry}>ลองอีกครั้ง</button></div>;
}

export function CreatorStoriesPage() {
  const [stories, setStories] = useState<StorySummary[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("นิยายทดสอบ Local E2E");
  const [synopsis, setSynopsis] = useState("เรื่องย่อสำหรับทดสอบการทำงานในเครื่อง");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [storyType, setStoryType] = useState<"NOVEL" | "COMIC" | "VIDEO">("NOVEL");
  useEffect(() => {
    let active = true;
    listStories().then((page) => { if (active) setStories(page.items); })
      .catch((reason) => { if (active) setError(apiErrorMessage(reason)); });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => {
    let active = true;
    listCategories().then((items) => {
      if (!active) return;
      const available = items.filter((item) => item.isActive);
      setCategories(available);
      setCategoryId((current) => current || available[0]?.id || "");
    }).catch((reason) => { if (active) setError(apiErrorMessage(reason)); });
    return () => { active = false; };
  }, []);
  return <><StudioHeader/><main className={styles.page}>
    <div className="sectionTitle"><div><span className="eyebrow">Creator</span><h1>นิยายของฉัน</h1></div>
      <button type="button" onClick={() => setCreating((value) => !value)}>＋ สร้างนิยาย</button></div>
    {creating && <form onSubmit={async (event) => {
      event.preventDefault(); setError(""); setSubmitting(true);
      try {
        const story = storyType === "COMIC"
          ? await createComicStory(title.trim(), synopsis.trim(), categoryId)
          : storyType === "VIDEO"
            ? await createVideoStory(title.trim(), synopsis.trim(), categoryId)
            : await createNovelStory(title.trim(), synopsis.trim(), categoryId);
        window.location.assign(`/creator/stories/${story.id}`);
      } catch (reason) { setError(apiErrorMessage(reason)); setSubmitting(false); }
    }}><label>ประเภทเรื่อง<select aria-label="ประเภทเรื่อง" value={storyType}
      onChange={(event) => setStoryType(event.target.value as "NOVEL" | "COMIC" | "VIDEO")}>
      <option value="NOVEL">NOVEL</option><option value="COMIC">COMIC</option><option value="VIDEO">VIDEO</option>
    </select></label><label>ชื่อเรื่อง<input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label>เรื่องย่อ<textarea required maxLength={5000} value={synopsis} onChange={(event) => setSynopsis(event.target.value)} /></label>
      <label>หมวดหมู่<select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
        {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
      </select></label>
      <button type="submit" disabled={submitting || !categoryId}>{submitting ? "กำลังสร้าง…" : `สร้าง ${storyType} ฉบับร่าง`}</button></form>}
    {error && <ErrorState message={error} retry={() => { setError(""); setAttempt((value) => value + 1); }} />}
    {!stories && !error ? <p>กำลังโหลดผลงาน…</p> : stories?.length ? <div className={styles.list}>{stories.map((story) =>
      <Link href={`/creator/stories/${story.id}`} key={story.id}><strong>{story.title}</strong><span>{story.status}</span></Link>
    )}</div> : !error && <div className={styles.empty}>ยังไม่มีนิยายในบัญชีนี้</div>}
  </main></>;
}

export function CreatorStoryPage({ storyId }: { storyId: string }) {
  const [story, setStory] = useState<Story | null>(null);
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [episodeTitle, setEpisodeTitle] = useState("ตอนทดสอบ Local E2E");
  useEffect(() => {
    let active = true;
    Promise.all([getStory(storyId), listEpisodes(storyId)])
      .then(([nextStory, page]) => { if (active) { setStory(nextStory); setEpisodes(page.items); } })
      .catch((reason) => { if (active) setError(apiErrorMessage(reason)); });
    return () => { active = false; };
  }, [storyId, attempt]);
  return <><StudioHeader/><main className={styles.page}>
    <Link href="/creator/stories">← นิยายของฉัน</Link>
    <div className="sectionTitle"><div><span className="eyebrow">จัดการตอน</span><h1>{story?.title || "กำลังโหลด…"}</h1></div>
      <div className="actions">
        {story?.status === "DRAFT" && <button type="button" className="secondaryButton" onClick={async () => {
          try { setStory(await publishStory(storyId)); } catch (reason) { setError(apiErrorMessage(reason)); }
        }}>เผยแพร่เรื่อง</button>}
        <button type="button" onClick={() => setCreating((value) => !value)}>＋ สร้างตอน</button>
      </div></div>
    {creating && <form onSubmit={async (event) => {
      event.preventDefault(); setError(""); setSubmitting(true);
      const nextNumber = (episodes?.reduce((max, episode) => Math.max(max, episode.episodeNumber), 0) ?? 0) + 1;
      try {
        const episode = await createDraftEpisode(storyId, episodeTitle.trim(), nextNumber, nextNumber);
        window.location.assign(`/creator/stories/${storyId}/episodes/${episode.id}/edit`);
      } catch (reason) { setError(apiErrorMessage(reason)); setSubmitting(false); }
    }}><label>ชื่อตอน<input required maxLength={200} value={episodeTitle} onChange={(event) => setEpisodeTitle(event.target.value)} /></label>
      <button type="submit" disabled={submitting}>{submitting ? "กำลังสร้าง…" : "สร้างตอนฉบับร่าง"}</button></form>}
    {error && <ErrorState message={error} retry={() => { setError(""); setAttempt((value) => value + 1); }} />}
    {episodes?.length ? <div className={styles.list}>{episodes.map((episode) =>
      <Link href={`/creator/stories/${storyId}/episodes/${episode.id}/edit`} key={episode.id}>
        <strong>ตอนที่ {episode.episodeNumber}: {episode.title}</strong><span>{episode.status}</span>
      </Link>
    )}</div> : episodes && !error && <div className={styles.empty}>เรื่องนี้ยังไม่มีตอน</div>}
  </main></>;
}
