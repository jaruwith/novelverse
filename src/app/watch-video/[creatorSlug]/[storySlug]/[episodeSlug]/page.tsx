"use client";

import { use, useCallback, useEffect } from "react";
import { getPublicVideoContent } from "@/features/novel-editor/api";
import type { VideoContent } from "@/features/novel-editor/types";
import { ReportDialog } from "@/features/moderation/ReportDialog";
import { EngagementSessionController } from "@/features/engagement/controller";
import { unsupportedVideoEvidence } from "@/features/engagement/evidence";
import {
  decodeRouteSegmentOnce,
  ROUTE_SEGMENT_UNAVAILABLE_MESSAGE,
} from "@/lib/routeSegments";
import { ReaderFrame } from "@/features/reader-navigation/ReaderFrame";

type ReaderSlugs = { creatorSlug: string; storySlug: string; episodeSlug: string };

export default function VideoReaderPage({ params }: {
  params: Promise<ReaderSlugs>;
}) {
  const routeParams = use(params);
  const creatorSlug = decodeRouteSegmentOnce(routeParams.creatorSlug);
  const storySlug = decodeRouteSegmentOnce(routeParams.storySlug);
  const episodeSlug = decodeRouteSegmentOnce(routeParams.episodeSlug);
  if (creatorSlug === null || storySlug === null || episodeSlug === null) {
    return <main><p role="alert">{ROUTE_SEGMENT_UNAVAILABLE_MESSAGE}</p></main>;
  }
  return <VideoReader creatorSlug={creatorSlug} storySlug={storySlug} episodeSlug={episodeSlug} />;
}

function VideoReader({ creatorSlug, storySlug, episodeSlug }: ReaderSlugs) {
  const load = useCallback((signal: AbortSignal) =>
    getPublicVideoContent(creatorSlug, storySlug, episodeSlug, signal),
  [creatorSlug, episodeSlug, storySlug]);
  return <ReaderFrame key={`${creatorSlug}/${storySlug}/${episodeSlug}`}
    slugs={{ creatorSlug, storySlug, episodeSlug }} storyType="VIDEO" loadContent={load}
    episodeId={(content) => content.episodeId}
    renderContent={(content) => <VideoEpisodeContent content={content} />}
    renderReport={(content) => <ReportDialog targetType="EPISODE" targetId={content.episodeId}
      targetSummary={episodeSlug} />} />;
}

function VideoEpisodeContent({ content }: { content: VideoContent }) {
  useEffect(() => {
    if (!content) return;
    // youtube-nocookie iframe is not currently wired to the official Player API.
    // Session heartbeats intentionally contain no playback/completion evidence.
    const controller = new EngagementSessionController(
      { targetType: "EPISODE", targetId: content.episodeId },
      unsupportedVideoEvidence);
    void controller.start(); return () => { void controller.stop(); };
  }, [content]);
  return <section data-reader-shortcuts="off">
    <iframe width="560" height="315" src={`https://www.youtube-nocookie.com/embed/${content.videoId}`}
      title={content.title ?? "YouTube video player"} allowFullScreen
      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
  </section>;
}
