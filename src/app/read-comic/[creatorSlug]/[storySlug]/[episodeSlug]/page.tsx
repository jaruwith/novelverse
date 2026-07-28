"use client";

import { use, useEffect, useState } from "react";
import { getPublicComicPages, getPublicStory } from "@/features/novel-editor/api";
import type { ComicPage } from "@/features/novel-editor/types";
import { recordEpisodeProgress } from "@/features/reader-state/progress";

export default function ComicReader({ params }: {
  params: Promise<{ creatorSlug: string; storySlug: string; episodeSlug: string }>;
}) {
  const { creatorSlug, storySlug, episodeSlug } = use(params);
  const [pages, setPages] = useState<ComicPage[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([
      getPublicComicPages(creatorSlug, storySlug, episodeSlug),
      getPublicStory(creatorSlug, storySlug),
    ]).then(([result, story]) => {
      setPages(result.pages);
      void recordEpisodeProgress(story.id, result.episodeId);
    }).catch(() => setError("ไม่พบหน้าการ์ตูน"));
  }, [creatorSlug, storySlug, episodeSlug]);
  if (error) return <main role="alert">{error}</main>;
  return <main className="comicCanvas" data-testid="comic-reader">{pages.map((page, index) =>
    // eslint-disable-next-line @next/next/no-img-element
    <img key={page.id} src={page.mediaUrl} alt={`หน้าการ์ตูน ${index + 1}`} />)}</main>;
}
