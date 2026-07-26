"use client";

import { useEffect, useState } from "react";
import {
  apiErrorMessage, getEpisode, getVideoContent, publishEpisode, replaceVideoContent,
} from "./api";
import type { Episode, VideoContent } from "./types";
import styles from "./novelEditor.module.css";

const supportedUrl = /^https:\/\/(?:youtu\.be\/[A-Za-z0-9_-]{11}|(?:www\.)?youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}(?:&.*)?)$/;

export function VideoEpisodeEditor({ storyId, episodeId }: { storyId: string; episodeId: string }) {
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [content, setContent] = useState<VideoContent | null>(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    Promise.all([getEpisode(storyId, episodeId), getVideoContent(storyId, episodeId)])
      .then(([nextEpisode, nextContent]) => {
        setEpisode(nextEpisode); setContent(nextContent);
        setUrl(nextContent?.originalUrl ?? ""); setTitle(nextContent?.title ?? "");
      }).catch((error) => setMessage(apiErrorMessage(error)));
  }, [storyId, episodeId]);
  const valid = supportedUrl.test(url.trim());
  async function save() {
    if (!valid || saving) {
      if (!valid) setMessage("กรุณาใส่ลิงก์วิดีโอ YouTube รูปแบบ youtu.be หรือ youtube.com/watch?v=");
      return null;
    }
    setSaving(true); setMessage("");
    try {
      const saved = await replaceVideoContent(storyId, episodeId, url.trim(), title.trim() || null);
      setContent(saved); setMessage("บันทึกวิดีโอแล้ว"); return saved;
    } catch (error) { setMessage(apiErrorMessage(error)); return null; }
    finally { setSaving(false); }
  }
  return <main className={styles.editor}>
    <h1>{episode?.title ?? "กำลังโหลด…"}</h1>
    {message && <p role="alert">{message}</p>}
    <label>Video URL<input aria-label="Video URL" value={url}
      onChange={(event) => { setUrl(event.target.value); setMessage(""); }} /></label>
    <label>ชื่อวิดีโอ (ไม่บังคับ)<input maxLength={200} value={title}
      onChange={(event) => setTitle(event.target.value)} /></label>
    {url && !valid && <p role="alert">ลิงก์ YouTube ไม่ถูกต้อง</p>}
    {valid && <p>ลิงก์ถูกต้อง พร้อมบันทึก</p>}
    {content && <section>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={content.thumbnailUrl} alt={content.title ?? "YouTube thumbnail"} />
      <p>Video ID: {content.videoId}</p>
    </section>}
    <div className="actions">
      <button type="button" disabled={!valid || saving} onClick={() => void save()}>
        {saving ? "กำลังบันทึก…" : "บันทึก"}</button>
      <button type="button" disabled={!content || saving} onClick={async () => {
        const saved = await save(); if (saved) {
          setEpisode(await publishEpisode(storyId, episodeId)); setMessage("เผยแพร่ตอนแล้ว");
        }
      }}>เผยแพร่</button>
    </div>
  </main>;
}
