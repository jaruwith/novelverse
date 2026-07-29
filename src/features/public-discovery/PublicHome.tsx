"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { apiErrorMessage, listCategories, listPublicStories } from "@/features/novel-editor/api";
import type { Category, ContentRating, PagedResponse, PublicStory, StoryType } from "@/features/novel-editor/types";
import styles from "./publicDiscovery.module.css";
import { ContinueReading } from "@/features/reader-state/ContinueReading";

type Sort = "LATEST" | "UPDATED" | "RELEVANCE";
type SearchState = {
  q: string; storyType: StoryType | ""; categorySlug: string; tag: string; creatorSlug: string;
  languageCode: string; contentRating: ContentRating | ""; sort: Sort; page: number;
};

const emptyState: SearchState = {
  q: "", storyType: "", categorySlug: "", tag: "", creatorSlug: "", languageCode: "",
  contentRating: "", sort: "LATEST", page: 1,
};
const types: { label: string; value: StoryType | "" }[] = [
  { label: "ทั้งหมด", value: "" }, { label: "นิยาย", value: "NOVEL" },
  { label: "การ์ตูน", value: "COMIC" }, { label: "วิดีโอ", value: "VIDEO" },
];

function readUrl(): SearchState {
  if (typeof window === "undefined") return emptyState;
  const p = new URLSearchParams(window.location.search);
  const q = p.get("q")?.trim() ?? "";
  const requestedSort = p.get("sort");
  const sort: Sort = requestedSort === "UPDATED" || requestedSort === "LATEST" ||
    (requestedSort === "RELEVANCE" && q) ? requestedSort : (q ? "RELEVANCE" : "LATEST");
  return {
    q, storyType: (p.get("storyType") as StoryType | null) ?? "",
    categorySlug: p.get("categorySlug") ?? "", tag: p.get("tag") ?? "",
    creatorSlug: p.get("creatorSlug") ?? "", languageCode: p.get("languageCode") ?? "",
    contentRating: (p.get("contentRating") as ContentRating | null) ?? "", sort,
    page: Math.max(1, Number(p.get("page")) || 1),
  };
}

function writeUrl(state: SearchState) {
  const p = new URLSearchParams();
  Object.entries(state).forEach(([key, value]) => {
    if (value && !(key === "page" && value === 1) && !(key === "sort" && value === "LATEST")) {
      p.set(key, String(value));
    }
  });
  const query = p.toString();
  window.history.pushState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
}

export function PublicHome() {
  const [state, setState] = useState<SearchState>(readUrl);
  const [draftQuery, setDraftQuery] = useState(state.q);
  const [categories, setCategories] = useState<Category[]>([]);
  const [result, setResult] = useState<PagedResponse<PublicStory> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const restore = () => {
      const next = readUrl(); setLoading(true); setError(""); setState(next); setDraftQuery(next.q);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => {
    let active = true;
    Promise.all([listPublicStories({
      q: state.q || undefined, page: state.page, storyType: state.storyType || undefined,
      categorySlug: state.categorySlug || undefined, tag: state.tag || undefined,
      creatorSlug: state.creatorSlug || undefined, languageCode: state.languageCode || undefined,
      contentRating: state.contentRating || undefined, sort: state.sort,
    }), listCategories()]).then(([stories, taxonomy]) => {
      if (active) { setResult(stories); setCategories(taxonomy); }
    }).catch((reason) => { if (active) setError(apiErrorMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retryKey, state]);

  const apply = (patch: Partial<SearchState>) => {
    const next = { ...state, ...patch, page: patch.page ?? 1 };
    if (!next.q && next.sort === "RELEVANCE") next.sort = "LATEST";
    writeUrl(next); setLoading(true); setError(""); setState(next);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const q = draftQuery.trim().replace(/\s+/g, " ");
    apply({ q, sort: q ? "RELEVANCE" : (state.sort === "RELEVANCE" ? "LATEST" : state.sort) });
  };

  return <div className="container">
    <ContinueReading />
    <section className={styles.heading}>
      <span className="eyebrow">ค้นพบเรื่องที่เผยแพร่</span>
      <h1>ค้นหาเรื่องราวบน NovelVerse</h1>
      <p>ค้นหาและกรองนิยาย การ์ตูน และวิดีโอได้โดยไม่ต้องเข้าสู่ระบบ</p>
    </section>
    <form aria-label="ค้นหาเรื่อง" className={styles.search} onSubmit={submit}>
      <input aria-label="คำค้นหา" value={draftQuery} onChange={(e) => setDraftQuery(e.target.value)}
        placeholder="ชื่อเรื่อง ครีเอเตอร์ แท็ก หรือหมวดหมู่" />
      <button type="submit">ค้นหา</button>
    </form>
    <section aria-label="ตัวกรองเรื่อง" className={styles.filters}>
      <div className={styles.typeFilters}>{types.map((type) =>
        <button key={type.value || "ALL"} type="button" aria-pressed={state.storyType === type.value}
          onClick={() => apply({ storyType: type.value })}>{type.label}</button>)}</div>
      <label>หมวดหมู่<select aria-label="หมวดหมู่" value={state.categorySlug}
        onChange={(e) => apply({ categorySlug: e.target.value })}>
        <option value="">ทุกหมวดหมู่</option>
        {categories.map((x) => <option key={x.id} value={x.slug}>{x.name}</option>)}
      </select></label>
      <label>แท็ก<input aria-label="แท็ก" value={state.tag} onChange={(e) => apply({ tag: e.target.value })} /></label>
      <label>ครีเอเตอร์<input aria-label="ครีเอเตอร์" value={state.creatorSlug} onChange={(e) => apply({ creatorSlug: e.target.value })} /></label>
      <label>ภาษา<input aria-label="ภาษา" value={state.languageCode} onChange={(e) => apply({ languageCode: e.target.value })} /></label>
      <label>ระดับเนื้อหา<select aria-label="ระดับเนื้อหา" value={state.contentRating}
        onChange={(e) => apply({ contentRating: e.target.value as ContentRating | "" })}>
        <option value="">ทั้งหมด</option><option value="GENERAL">ทั่วไป</option>
        <option value="TEEN">วัยรุ่น</option><option value="MATURE">ผู้ใหญ่</option>
      </select></label>
      <label>เรียงตาม<select aria-label="เรียงตาม" value={state.sort}
        onChange={(e) => apply({ sort: e.target.value as Sort })}>
        {state.q && <option value="RELEVANCE">ความเกี่ยวข้อง</option>}
        <option value="LATEST">เผยแพร่ล่าสุด</option><option value="UPDATED">อัปเดตล่าสุด</option>
      </select></label>
      <button type="button" onClick={() => {
        writeUrl(emptyState); setDraftQuery(""); setLoading(true); setError(""); setState(emptyState);
      }}>ล้างตัวกรอง</button>
    </section>
    {loading && <p role="status">กำลังค้นหาเรื่อง…</p>}
    {error && <div role="alert" className={styles.state}><p>{error}</p>
      <button type="button" onClick={() => {
        setLoading(true); setError(""); setRetryKey((x) => x + 1);
      }}>ลองอีกครั้ง</button></div>}
    {!loading && !error && result?.items.length === 0 && <p className={styles.state}>ไม่พบเรื่องที่ตรงกับการค้นหาและตัวกรอง</p>}
    {!loading && !error && result && <>
      <div className={styles.storyGrid}>{result.items.map((story) => <PublicStoryCard key={story.id} story={story} />)}</div>
      <nav aria-label="หน้ารายการเรื่อง" className={styles.pagination}>
        <button type="button" disabled={!result.hasPreviousPage} onClick={() => apply({ page: state.page - 1 })}>ก่อนหน้า</button>
        <span>หน้า {result.page} จาก {Math.max(1, result.totalPages)}</span>
        <button type="button" disabled={!result.hasNextPage} onClick={() => apply({ page: state.page + 1 })}>ถัดไป</button>
      </nav></>}
  </div>;
}

function PublicStoryCard({ story }: { story: PublicStory }) {
  return <article className={styles.card}>
    {story.coverUrl
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={story.coverUrl} alt={`ปก ${story.title}`} />
      : <div className={styles.coverPlaceholder} aria-label="ไม่มีภาพปก">◇</div>}
    <div className={styles.cardBody}><span className={styles.storyType}>{story.storyType}</span>
      <h2><Link href={`/stories/${encodeURIComponent(story.creatorSlug)}/${encodeURIComponent(story.slug)}`}>{story.title}</Link></h2>
      <p className={styles.creator}>โดย {story.creatorDisplayName}</p>
      <p>{story.synopsis || "ยังไม่มีเรื่องย่อ"}</p>
      <div className="tagRow">{story.categories.map((x) => <span className="tag" key={x.id}>{x.name}</span>)}</div>
      {story.latestPublishedEpisodeTitle && <small>ตอนล่าสุด: {story.latestPublishedEpisodeTitle} · {new Date(story.latestPublishedEpisodeAt!).toLocaleDateString("th-TH")}</small>}
      <small>อัปเดต {new Date(story.updatedAt).toLocaleDateString("th-TH")} · {story.publishedEpisodeCount} ตอน</small>
    </div>
  </article>;
}
