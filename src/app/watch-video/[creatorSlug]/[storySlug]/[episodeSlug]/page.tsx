"use client";

import { use, useEffect, useState } from "react";
import { apiErrorMessage, getPublicStory, getPublicVideoContent } from "@/features/novel-editor/api";
import type { VideoContent } from "@/features/novel-editor/types";
import { recordEpisodeProgress } from "@/features/reader-state/progress";
import { ReportDialog } from "@/features/moderation/ReportDialog";

export default function VideoReaderPage({ params }: {
  params: Promise<{ creatorSlug: string; storySlug: string; episodeSlug: string }>;
}) {
  const { creatorSlug, storySlug, episodeSlug } = use(params);
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
