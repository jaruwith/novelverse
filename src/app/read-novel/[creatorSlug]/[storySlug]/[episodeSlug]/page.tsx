"use client";

import { use, useCallback, useEffect } from "react";
import { getPublicNovelContent } from "@/features/novel-editor/api";
import { NovelContentRenderer } from "@/features/novel-editor/NovelContentRenderer";
import type { EditorBlock } from "@/features/novel-editor/types";
import { ReportDialog } from "@/features/moderation/ReportDialog";
import { EngagementSessionController } from "@/features/engagement/controller";
import { buildOrderedContentEvidence } from "@/features/engagement/evidence";
import {
  decodeRouteSegmentOnce,
  ROUTE_SEGMENT_UNAVAILABLE_MESSAGE,
} from "@/lib/routeSegments";
import { ReaderFrame } from "@/features/reader-navigation/ReaderFrame";

type ReaderSlugs = { creatorSlug: string; storySlug: string; episodeSlug: string };

export default function NovelReaderPage({ params }: {
  params: Promise<ReaderSlugs>;
}) {
  const routeParams = use(params);
  const creatorSlug = decodeRouteSegmentOnce(routeParams.creatorSlug);
  const storySlug = decodeRouteSegmentOnce(routeParams.storySlug);
  const episodeSlug = decodeRouteSegmentOnce(routeParams.episodeSlug);
  if (creatorSlug === null || storySlug === null || episodeSlug === null) {
    return <main className="reader"><p role="alert">{ROUTE_SEGMENT_UNAVAILABLE_MESSAGE}</p></main>;
  }
  return <NovelReader creatorSlug={creatorSlug} storySlug={storySlug} episodeSlug={episodeSlug} />;
}

function NovelReader({ creatorSlug, storySlug, episodeSlug }: ReaderSlugs) {
  const load = useCallback((signal: AbortSignal) =>
    getPublicNovelContent(creatorSlug, storySlug, episodeSlug, signal),
  [creatorSlug, episodeSlug, storySlug]);
  return <ReaderFrame key={`${creatorSlug}/${storySlug}/${episodeSlug}`}
    slugs={{ creatorSlug, storySlug, episodeSlug }} storyType="NOVEL" loadContent={load}
    episodeId={(content) => content.episodeId}
    renderContent={(content) => <NovelEpisodeContent content={content} />}
    renderReport={(content) => <ReportDialog targetType="EPISODE" targetId={content.episodeId}
      targetSummary={episodeSlug} />} />;
}

function NovelEpisodeContent({ content }: { content: { episodeId: string; wordCount: number; blocks: EditorBlock[] } }) {
  const { blocks, episodeId } = content;
  useEffect(() => {
    if (!episodeId || !blocks?.length) return;
    const evidence = () => {
      const progress = ((window.scrollY + window.innerHeight) /
        document.documentElement.scrollHeight) * 100;
      return buildOrderedContentEvidence(blocks.map((block) => block.persistedId), progress);
    };
    const controller = new EngagementSessionController({ targetType: "EPISODE", targetId: episodeId }, evidence);
    void controller.start(); return () => { void controller.stop(); };
  }, [blocks, episodeId]);
  return <section data-testid="novel-reader"><NovelContentRenderer blocks={blocks} /></section>;
}
