"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiErrorMessage, getEpisode, getEpisodeContent, getStory } from "./api";
import { NovelContentRenderer } from "./NovelContentRenderer";
import type { EditorBlock, Episode, Story } from "./types";
import styles from "./novelEditor.module.css";

export function EpisodePreview({ storyId, episodeId }: { storyId: string; episodeId: string }) {
  const [data, setData] = useState<{ story: Story; episode: Episode; blocks: EditorBlock[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([getStory(storyId), getEpisode(storyId, episodeId), getEpisodeContent(storyId, episodeId)])
      .then(([story, episode, content]) => setData({ story, episode, blocks: content.blocks }))
      .catch((reason) => setError(apiErrorMessage(reason)));
  }, [episodeId, storyId]);
  if (error) return <div className={styles.previewState} role="alert">{error}</div>;
  if (!data) return <div className={styles.previewState}>กำลังโหลดตัวอย่าง…</div>;
  return (
    <main className={styles.preview}>
      <Link href={`/creator/stories/${storyId}/episodes/${episodeId}/edit`}>← กลับไปแก้ไข</Link>
      <header>
        <small>{data.story.title}</small>
        <h1>{data.episode.title}</h1>
        {data.episode.synopsis && <p>{data.episode.synopsis}</p>}
      </header>
      <NovelContentRenderer blocks={data.blocks} />
    </main>
  );
}
