"use client";

import { use, useEffect, useState } from "react";
import { apiErrorMessage, getPublicNovelContent, getPublicStory } from "@/features/novel-editor/api";
import { NovelContentRenderer } from "@/features/novel-editor/NovelContentRenderer";
import type { EditorBlock } from "@/features/novel-editor/types";
import { recordEpisodeProgress } from "@/features/reader-state/progress";
import { ReportDialog } from "@/features/moderation/ReportDialog";

export default function NovelReaderPage({ params }: {
  params: Promise<{ creatorSlug: string; storySlug: string; episodeSlug: string }>;
}) {
  const { creatorSlug, storySlug, episodeSlug } = use(params);
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
  if (error) return <main className="reader"><p role="alert">{error}</p></main>;
  if (!blocks) return <main className="reader"><p role="status">กำลังโหลดเนื้อหา…</p></main>;
  return <main className="reader" data-testid="novel-reader"><NovelContentRenderer blocks={blocks} />
    {episodeId && <ReportDialog targetType="EPISODE" targetId={episodeId} targetSummary={episodeSlug} />}</main>;
}
