"use client";

import { use, useEffect, useState } from "react";
import { apiErrorMessage, getPublicStory, getPublicVideoContent } from "@/features/novel-editor/api";
import type { VideoContent } from "@/features/novel-editor/types";
import { recordEpisodeProgress } from "@/features/reader-state/progress";
import { ReportDialog } from "@/features/moderation/ReportDialog";
import { EngagementSessionController } from "@/features/engagement/controller";
import { unsupportedVideoEvidence } from "@/features/engagement/evidence";
import {
  decodeRouteSegmentOnce,
  ROUTE_SEGMENT_UNAVAILABLE_MESSAGE,
} from "@/lib/routeSegments";

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
  const [content, setContent] = useState<VideoContent | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([
      getPublicVideoContent(creatorSlug, storySlug, episodeSlug),
      getPublicStory(creatorSlug, storySlug),
    ]).then(([video, story]) => {
      setContent(video);
      void recordEpisodeProgress(story.id, video.episodeId);
    })
      .catch((reason) => setError(apiErrorMessage(reason)));
  }, [creatorSlug, storySlug, episodeSlug]);
  useEffect(() => {
    if (!content) return;
    // youtube-nocookie iframe is not currently wired to the official Player API.
    // Session heartbeats intentionally contain no playback/completion evidence.
    const controller = new EngagementSessionController(
      { targetType: "EPISODE", targetId: content.episodeId },
      unsupportedVideoEvidence);
    void controller.start(); return () => { void controller.stop(); };
  }, [content]);
  if (error) return <main><p role="alert">{error}</p></main>;
  if (!content) return <main><p>กำลังโหลด…</p></main>;
  return <main>
    <h1>{content.title ?? "Video"}</h1>
    <iframe width="560" height="315" src={`https://www.youtube-nocookie.com/embed/${content.videoId}`}
      title={content.title ?? "YouTube video player"} allowFullScreen
      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
    <ReportDialog targetType="EPISODE" targetId={content.episodeId} targetSummary={episodeSlug} />
  </main>;
}
