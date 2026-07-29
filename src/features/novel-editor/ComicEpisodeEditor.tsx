"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiErrorMessage, getComicPages, getEpisode, getStory, publishEpisode,
  replaceComicPages, uploadComicPage } from "./api";
import type { ComicPage, Episode, Story } from "./types";
import styles from "./novelEditor.module.css";

export function ComicEpisodeEditor({ storyId, episodeId }: { storyId: string; episodeId: string }) {
  const [story, setStory] = useState<Story | null>(null);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [pages, setPages] = useState<ComicPage[]>([]);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    Promise.all([getStory(storyId), getEpisode(storyId, episodeId), getComicPages(storyId, episodeId)])
      .then(([s, e, p]) => { setStory(s); setEpisode(e); setPages(p.pages); })
      .catch((error) => setMessage(apiErrorMessage(error)));
  }, [storyId, episodeId]);
  const save = async (next = pages) => {
    setSaving(true); setMessage("");
    try {
      const result = await replaceComicPages(storyId, episodeId, next.map((page) => page.mediaAssetId));
      const apiRoot = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5039";
      setPages(result.pages.map((page) => ({ ...page, mediaUrl: new URL(page.mediaUrl, apiRoot).toString() })));
      setMessage("บันทึกหน้าการ์ตูนแล้ว"); return true;
    } catch (error) { setMessage(apiErrorMessage(error)); return false; }
    finally { setSaving(false); }
  };
  const move = (index: number, offset: number) => {
    const target = index + offset; if (target < 0 || target >= pages.length) return;
    const next = [...pages]; [next[index], next[target]] = [next[target], next[index]]; setPages(next);
  };
  if (!story || !episode) return <main className={styles.previewState}>{message || "กำลังโหลด…"}</main>;
  return <main className={styles.preview}>
    <Link href={`/creator/stories/${storyId}`}>← กลับไปจัดการเรื่อง</Link>
    <header><small>{story.title}</small><h1>{episode.title}</h1></header>
    {message && <div role="status" className={styles.alert}>{message}</div>}
    <div className={styles.blockList}>{pages.map((page, index) =>
      <section className={styles.blockCard} key={page.mediaAssetId} data-testid="comic-page">
        <div className={styles.blockToolbar}><strong>หน้า {index + 1}</strong>
          <button type="button" disabled={index === 0} onClick={() => move(index, -1)}>เลื่อนขึ้น</button>
          <button type="button" disabled={index === pages.length - 1} onClick={() => move(index, 1)}>เลื่อนลง</button>
          <button type="button" onClick={() => setPages(pages.filter((_, i) => i !== index))}>ลบ</button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.previewImage} src={page.mediaUrl} alt={`หน้าการ์ตูน ${index + 1}`} />
      </section>)}</div>
    <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" aria-label="เลือกหน้าการ์ตูน"
      onChange={async (event) => {
        const file = event.target.files?.[0]; if (!file || uploading) return; setUploading(true);
        try {
          const asset = await uploadComicPage(file);
          setPages([...pages, { id: asset.id, sortOrder: pages.length + 1, mediaAssetId: asset.id,
            mediaUrl: asset.contentUrl, width: asset.width, height: asset.height,
            mimeType: asset.mimeType, createdAt: asset.createdAt, updatedAt: asset.createdAt }]);
        } catch (error) { setMessage(apiErrorMessage(error)); }
        finally { setUploading(false); if (input.current) input.current.value = ""; }
      }} />
    <div className="actions">
      <button type="button" disabled={uploading} onClick={() => input.current?.click()}>
        {uploading ? "กำลังอัปโหลด…" : "+ อัปโหลดหน้า"}</button>
      <button type="button" disabled={saving} onClick={() => void save()}>บันทึก</button>
      <button type="button" disabled={saving || !pages.length} onClick={async () => {
        if (await save()) { setEpisode(await publishEpisode(storyId, episodeId)); setMessage("เผยแพร่ตอนแล้ว"); }
      }}>เผยแพร่</button>
    </div>
  </main>;
}
