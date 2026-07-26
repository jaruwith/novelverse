"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { apiErrorMessage, uploadNovelContentImage } from "./api";
import { ContentBlockList } from "./ContentBlockList";
import { createLocalKey } from "./types";
import { useEpisodeEditor, type SaveStatus } from "./useEpisodeEditor";
import styles from "./novelEditor.module.css";

const statusLabel: Record<SaveStatus, string> = {
  clean: "ยังไม่มีการแก้ไข",
  dirty: "มีการแก้ไขที่ยังไม่บันทึก",
  saving: "กำลังบันทึก…",
  saved: "บันทึกแล้ว",
  failed: "บันทึกไม่สำเร็จ",
};

export function NovelEpisodeEditor({ storyId, episodeId }: { storyId: string; episodeId: string }) {
  const editor = useEpisodeEditor(storyId, episodeId);
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const addText = () => editor.setBlocks([...editor.blocks, {
    type: "TEXT", localKey: createLocalKey(), textContent: "", mediaAssetId: null,
  }]);
  const addDivider = () => editor.setBlocks([...editor.blocks, {
    type: "DIVIDER", localKey: createLocalKey(), textContent: null, mediaAssetId: null,
  }]);
  const addImage = () => {
    if (!uploading) fileInput.current?.click();
  };
  const uploadImage = async (file?: File) => {
    if (!file || uploading) return;
    setUploading(true);
    setUploadMessage("");
    try {
      const asset = await uploadNovelContentImage(file);
      editor.setBlocks([...editor.blocks, {
        type: "IMAGE", localKey: createLocalKey(), textContent: null,
        mediaAssetId: asset.id, mediaUrl: asset.contentUrl,
        width: asset.width, height: asset.height, mimeType: asset.mimeType,
      }]);
    } catch (error) {
      setUploadMessage(`อัปโหลดรูปภาพไม่สำเร็จ: ${apiErrorMessage(error)}`);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  if (editor.loading) return <div className={styles.loading} aria-live="polite">กำลังโหลดเครื่องมือแก้ไขตอน…</div>;
  if (!editor.episode) return <div className={styles.loading} role="alert">{editor.message || "ไม่พบตอนที่ต้องการ"}</div>;

  const episodeNav = (
    <nav className={styles.episodeNav} aria-label="รายการตอน">
      <div className={styles.episodeNavHead}>
        <strong>ตอนทั้งหมด</strong>
        <button type="button" disabled title="ยังไม่เปิดใช้ในสปรินต์นี้">＋ สร้างตอน</button>
      </div>
      {editor.episodes.length ? editor.episodes.map((episode) => (
        <Link
          className={episode.id === episodeId ? styles.activeEpisode : ""}
          key={episode.id}
          href={`/creator/stories/${storyId}/episodes/${episode.id}/edit`}
          aria-current={episode.id === episodeId ? "page" : undefined}
          onClick={(event) => {
            if (editor.hasUnsavedChanges && !window.confirm("ยังมีการแก้ไขที่ไม่ได้บันทึก ต้องการออกจากตอนนี้หรือไม่?")) {
              event.preventDefault();
            }
          }}
        >
          <span>{episode.episodeNumber ? `ตอนที่ ${episode.episodeNumber}` : "ตอน"}</span>
          <strong>{episode.title}</strong>
        </Link>
      )) : <p className="muted">ไม่พบรายการตอน</p>}
    </nav>
  );

  return (
    <div className={styles.editorShell}>
      <header className={styles.editorHeader}>
        <Link href={`/creator/stories/${storyId}`} aria-label="กลับไปหน้ารายละเอียดเรื่อง"
          onClick={(event) => {
            if (editor.hasUnsavedChanges && !window.confirm("ยังมีการแก้ไขที่ไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?")) {
              event.preventDefault();
            }
          }}>←</Link>
        <div className={styles.headerTitle}>
          <small>{editor.story?.title || "NovelVerse Studio"}</small>
          <strong>{editor.episode.title || "ตอนที่ยังไม่มีชื่อ"}</strong>
        </div>
        <span className={styles.saveStatus} data-status={editor.saveStatus} aria-live="polite">
          {statusLabel[editor.saveStatus]}
        </span>
        <button type="button" className={`${styles.mobileEpisodes} secondaryButton`} onClick={() => setDrawerOpen(true)}>
          ตอนทั้งหมด
        </button>
        <button type="button" className="secondaryButton" disabled={editor.saveStatus === "saving"}
          onClick={async () => {
            if (editor.hasUnsavedChanges && !await editor.save()) return;
            router.push(`/creator/stories/${storyId}/episodes/${episodeId}/preview`);
          }}>ดูตัวอย่าง</button>
        <button type="button" className="secondaryButton" disabled={editor.saveStatus === "saving"}
          onClick={() => void editor.save()}>บันทึกฉบับร่าง</button>
        <button type="button" disabled={editor.publishing || editor.saveStatus === "saving"}
          onClick={() => void editor.publish()}>{editor.publishing ? "กำลังเผยแพร่…" : "เผยแพร่"}</button>
      </header>
      <aside className={styles.desktopEpisodes}>{episodeNav}</aside>
      {drawerOpen && (
        <div className={styles.drawerBackdrop} onClick={() => setDrawerOpen(false)}>
          <aside className={styles.drawer} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="textButton" onClick={() => setDrawerOpen(false)} aria-label="ปิดรายการตอน">✕ ปิด</button>
            {episodeNav}
          </aside>
        </div>
      )}
      <main className={styles.editorMain}>
        <div className={styles.metadata}>
          <label>ชื่อตอน
            <input value={editor.episode.title} onChange={(event) => editor.setMetadata("title", event.target.value)} />
          </label>
          <label>เรื่องย่อตอน (ไม่บังคับ)
            <textarea rows={3} value={editor.episode.synopsis ?? ""}
              onChange={(event) => editor.setMetadata("synopsis", event.target.value)} />
          </label>
          <span className={styles.episodeStatus}>สถานะ: {editor.episode.status}</span>
        </div>
        {editor.message && <div className={styles.alert} role="alert">{editor.message}</div>}
        {uploadMessage && <div className={styles.alert} role="alert">{uploadMessage}</div>}
        <ContentBlockList blocks={editor.blocks} onChange={editor.setBlocks} />
        {!editor.blocks.length && <div className={styles.empty}>ยังไม่มีเนื้อหา เริ่มต้นด้วยบล็อกข้อความได้เลย</div>}
        <div className={styles.addBar} aria-label="เพิ่มบล็อกเนื้อหา">
          <button type="button" onClick={addText}>＋ ข้อความ</button>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden
            aria-label="เลือกรูปภาพ" onChange={(event) => void uploadImage(event.target.files?.[0])} />
          <button type="button" className="secondaryButton" onClick={addImage} disabled={uploading}>
            {uploading ? "กำลังอัปโหลดรูปภาพ…" : "＋ รูปภาพ"}
          </button>
          <button type="button" className="secondaryButton" onClick={addDivider}>＋ เส้นคั่น</button>
        </div>
      </main>
    </div>
  );
}
