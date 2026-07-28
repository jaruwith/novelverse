"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiErrorMessage, listCategories, listPublicStories } from "@/features/novel-editor/api";
import type { Category, PagedResponse, PublicStory, StoryType } from "@/features/novel-editor/types";
import styles from "./publicDiscovery.module.css";
import { ContinueReading } from "@/features/reader-state/ContinueReading";

const types: { label: string; value: StoryType | "" }[] = [
  { label: "ทั้งหมด", value: "" },
  { label: "นิยาย", value: "NOVEL" },
  { label: "การ์ตูน", value: "COMIC" },
  { label: "วิดีโอ", value: "VIDEO" },
];

export function PublicHome() {
  const [storyType, setStoryType] = useState<StoryType | "">("");
  const [categorySlug, setCategorySlug] = useState("");
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [result, setResult] = useState<PagedResponse<PublicStory> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
        listPublicStories({ page, storyType: storyType || undefined, categorySlug: categorySlug || undefined }),
        listCategories(),
      ]).then(([stories, taxonomy]) => {
      if (!active) return;
      setResult(stories);
      setCategories(taxonomy);
    }).catch((reason) => {
      if (!active) return;
      setError(apiErrorMessage(reason));
    }).finally(() => {
      if (!active) return;
      setLoading(false);
    });
    return () => { active = false; };
  }, [categorySlug, page, retryKey, storyType]);
  const beginReload = () => { setLoading(true); setError(""); };
  const changeType = (value: StoryType | "") => { beginReload(); setStoryType(value); setPage(1); };
  const changeCategory = (value: string) => { beginReload(); setCategorySlug(value); setPage(1); };

  return (
    <div className="container">
      <ContinueReading />
      <section className={styles.heading}>
        <span className="eyebrow">เรื่องที่เผยแพร่ล่าสุด</span>
        <h1>ค้นพบเรื่องราวบน NovelVerse</h1>
        <p>เลือกอ่านนิยาย การ์ตูน หรือวิดีโอจากครีเอเตอร์ได้ทันทีโดยไม่ต้องเข้าสู่ระบบ</p>
      </section>

      <section aria-label="ตัวกรองเรื่อง" className={styles.filters}>
        <div className={styles.typeFilters}>
          {types.map((type) => (
            <button key={type.value || "ALL"} type="button"
              aria-pressed={storyType === type.value} onClick={() => changeType(type.value)}>
              {type.label}
            </button>
          ))}
        </div>
        <label>
          หมวดหมู่
          <select aria-label="หมวดหมู่" value={categorySlug} onChange={(event) => changeCategory(event.target.value)}>
            <option value="">ทุกหมวดหมู่</option>
            {categories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}
          </select>
        </label>
      </section>

      {loading && <p role="status">กำลังโหลดเรื่องล่าสุด…</p>}
      {error && <div role="alert" className={styles.state}><p>{error}</p>
        <button type="button" onClick={() => { beginReload(); setRetryKey((value) => value + 1); }}>ลองอีกครั้ง</button>
      </div>}
      {!loading && !error && result?.items.length === 0 &&
        <p className={styles.state}>ยังไม่มีเรื่องที่เผยแพร่ตรงกับตัวกรองนี้</p>}
      {!loading && !error && result && (
        <>
          <div className={styles.storyGrid}>
            {result.items.map((story) => <PublicStoryCard key={story.id} story={story} />)}
          </div>
          <nav aria-label="หน้ารายการเรื่อง" className={styles.pagination}>
            <button type="button" disabled={!result.hasPreviousPage} onClick={() => { beginReload(); setPage((value) => value - 1); }}>
              ก่อนหน้า
            </button>
            <span>หน้า {result.page} จาก {Math.max(1, result.totalPages)}</span>
            <button type="button" disabled={!result.hasNextPage} onClick={() => { beginReload(); setPage((value) => value + 1); }}>
              ถัดไป
            </button>
          </nav>
        </>
      )}
    </div>
  );
}

function PublicStoryCard({ story }: { story: PublicStory }) {
  return (
    <article className={styles.card}>
      {story.coverUrl
        // URL is supplied by the public backend media contract.
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={story.coverUrl} alt={`ปก ${story.title}`} />
        : <div className={styles.coverPlaceholder} aria-label="ไม่มีภาพปก">◇</div>}
      <div className={styles.cardBody}>
        <span className={styles.storyType}>{story.storyType}</span>
        <h2><Link href={`/stories/${encodeURIComponent(story.creatorSlug)}/${encodeURIComponent(story.slug)}`}>
          {story.title}
        </Link></h2>
        <p className={styles.creator}>โดย {story.creatorDisplayName}</p>
        <p>{story.synopsis || "ยังไม่มีเรื่องย่อ"}</p>
        <div className="tagRow">{story.categories.map((category) =>
          <span className="tag" key={category.id}>{category.name}</span>)}</div>
        <small>อัปเดต {new Date(story.updatedAt).toLocaleDateString("th-TH")} · {story.publishedEpisodeCount} ตอน</small>
      </div>
    </article>
  );
}
