"use client";

import { use, useEffect, useState } from "react";
import { apiErrorMessage, getPublicNovelContent } from "@/features/novel-editor/api";
import { NovelContentRenderer } from "@/features/novel-editor/NovelContentRenderer";
import type { EditorBlock } from "@/features/novel-editor/types";

export default function NovelReaderPage({ params }: {
  params: Promise<{ creatorSlug: string; storySlug: string; episodeSlug: string }>;
}) {
  const { creatorSlug, storySlug, episodeSlug } = use(params);
  const [blocks, setBlocks] = useState<EditorBlock[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    getPublicNovelContent(creatorSlug, storySlug, episodeSlug)
      .then((content) => setBlocks(content.blocks))
      .catch((reason) => setError(apiErrorMessage(reason)));
  }, [creatorSlug, episodeSlug, storySlug]);
  if (error) return <main className="reader"><p role="alert">{error}</p></main>;
  if (!blocks) return <main className="reader"><p role="status">กำลังโหลดเนื้อหา…</p></main>;
  return <main className="reader" data-testid="novel-reader"><NovelContentRenderer blocks={blocks} /></main>;
}
