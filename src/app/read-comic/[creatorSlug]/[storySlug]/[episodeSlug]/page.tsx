"use client";

import { use, useEffect, useState } from "react";
import { getPublicComicPages, getPublicStory } from "@/features/novel-editor/api";
import type { ComicPage } from "@/features/novel-editor/types";
import { recordEpisodeProgress } from "@/features/reader-state/progress";
import { ReportDialog } from "@/features/moderation/ReportDialog";
import { EngagementSessionController } from "@/features/engagement/controller";
import { buildOrderedContentEvidence } from "@/features/engagement/evidence";

export default function ComicReader({ params }: {
  params: Promise<{ creatorSlug: string; storySlug: string; episodeSlug: string }>;
}) {
  const { creatorSlug, storySlug, episodeSlug } = use(params);
  const [pages, setPages] = useState<ComicPage[]>([]);
  const [episodeId, setEpisodeId] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([
      getPublicComicPages(creatorSlug, storySlug, episodeSlug),
      getPublicStory(creatorSlug, storySlug),
    ]).then(([result, story]) => {
      setPages(result.pages);
      setEpisodeId(result.episodeId);
      void recordEpisodeProgress(story.id, result.episodeId);
    }).catch(() => setError("ไม่พบหน้าการ์ตูน"));
  }, [creatorSlug, storySlug, episodeSlug]);
  useEffect(() => {
    if (!episodeId || !pages.length) return;
    const evidence = () => {
      const progress = ((window.scrollY + window.innerHeight) /
        document.documentElement.scrollHeight) * 100;
      return buildOrderedContentEvidence(pages.map((page) => page.id), progress);
    };
    const controller = new EngagementSessionController({ targetType: "EPISODE", targetId: episodeId }, evidence);
    void controller.start(); return () => { void controller.stop(); };
  }, [episodeId, pages]);
  if (error) return <main role="alert">{error}</main>;
  return <main className="comicCanvas" data-testid="comic-reader">
    {pages.map((page, index) =>
      // eslint-disable-next-line @next/next/no-img-element
      <img key={page.id} src={page.mediaUrl} alt={`หน้าการ์ตูน ${index + 1}`} />)}
    {episodeId &&
      <ReportDialog targetType="EPISODE" targetId={episodeId} targetSummary={episodeSlug} />}
  </main>;
}
