"use client";

import { use, useEffect, useState } from "react";
import { apiErrorMessage, getPublicNovelContent, getPublicStory } from "@/features/novel-editor/api";
import { NovelContentRenderer } from "@/features/novel-editor/NovelContentRenderer";
import type { EditorBlock } from "@/features/novel-editor/types";
import { recordEpisodeProgress } from "@/features/reader-state/progress";
import { ReportDialog } from "@/features/moderation/ReportDialog";
import { EngagementSessionController } from "@/features/engagement/controller";
import { buildOrderedContentEvidence } from "@/features/engagement/evidence";
import {
  decodeRouteSegmentOnce,
  ROUTE_SEGMENT_UNAVAILABLE_MESSAGE,
} from "@/lib/routeSegments";

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
  const [blocks, setBlocks] = useState<EditorBlock[] | null>(null);
  const [error, setError] = useState("");
  const [episodeId, setEpisodeId] = useState("");
  useEffect(() => {
    Promise.all([
      getPublicNovelContent(creatorSlug, storySlug, episodeSlug),
      getPublicStory(creatorSlug, storySlug),
    ]).then(([content, story]) => {
      setBlocks(content.blocks);
      setEpisodeId(content.episodeId);
      void recordEpisodeProgress(story.id, content.episodeId);
    })
      .catch((reason) => setError(apiErrorMessage(reason)));
  }, [creatorSlug, episodeSlug, storySlug]);
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
  if (error) return <main className="reader"><p role="alert">{error}</p></main>;
  if (!blocks) return <main className="reader"><p role="status">กำลังโหลดเนื้อหา…</p></main>;
  return <main className="reader" data-testid="novel-reader"><NovelContentRenderer blocks={blocks} />
    {episodeId && <ReportDialog targetType="EPISODE" targetId={episodeId} targetSummary={episodeSlug} />}</main>;
}
