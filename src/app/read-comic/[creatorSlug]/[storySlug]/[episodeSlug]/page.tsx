"use client";

import { use, useCallback, useEffect } from "react";
import { getPublicComicPages } from "@/features/novel-editor/api";
import type { ComicPagesResponse } from "@/features/novel-editor/types";
import { ReportDialog } from "@/features/moderation/ReportDialog";
import { EngagementSessionController } from "@/features/engagement/controller";
import { buildOrderedContentEvidence } from "@/features/engagement/evidence";
import {
  decodeRouteSegmentOnce,
  ROUTE_SEGMENT_UNAVAILABLE_MESSAGE,
} from "@/lib/routeSegments";
import { ReaderFrame } from "@/features/reader-navigation/ReaderFrame";

type ReaderSlugs = { creatorSlug: string; storySlug: string; episodeSlug: string };

export default function ComicReader({ params }: {
  params: Promise<ReaderSlugs>;
}) {
  const routeParams = use(params);
  const creatorSlug = decodeRouteSegmentOnce(routeParams.creatorSlug);
  const storySlug = decodeRouteSegmentOnce(routeParams.storySlug);
  const episodeSlug = decodeRouteSegmentOnce(routeParams.episodeSlug);
  if (creatorSlug === null || storySlug === null || episodeSlug === null) {
    return <main role="alert">{ROUTE_SEGMENT_UNAVAILABLE_MESSAGE}</main>;
  }
  return <ComicReaderContent creatorSlug={creatorSlug} storySlug={storySlug} episodeSlug={episodeSlug} />;
}

function ComicReaderContent({ creatorSlug, storySlug, episodeSlug }: ReaderSlugs) {
  const load = useCallback((signal: AbortSignal) =>
    getPublicComicPages(creatorSlug, storySlug, episodeSlug, signal),
  [creatorSlug, episodeSlug, storySlug]);
  return <ReaderFrame key={`${creatorSlug}/${storySlug}/${episodeSlug}`}
    slugs={{ creatorSlug, storySlug, episodeSlug }} storyType="COMIC" loadContent={load}
    episodeId={(content) => content.episodeId}
    renderContent={(content) => <ComicEpisodeContent content={content} />}
    renderReport={(content) => <ReportDialog targetType="EPISODE" targetId={content.episodeId}
      targetSummary={episodeSlug} />} />;
}

function ComicEpisodeContent({ content }: { content: ComicPagesResponse }) {
  const { episodeId, pages } = content;
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
  return <section className="comicCanvas" data-testid="comic-reader">
    {pages.map((page, index) =>
      // eslint-disable-next-line @next/next/no-img-element
      <img key={page.id} src={page.mediaUrl} alt={`หน้าการ์ตูน ${index + 1}`} />)}
  </section>;
}
