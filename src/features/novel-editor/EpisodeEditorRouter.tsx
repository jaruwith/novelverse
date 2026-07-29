"use client";
import { useEffect, useState } from "react";
import { getStory } from "./api";
import { ComicEpisodeEditor } from "./ComicEpisodeEditor";
import { NovelEpisodeEditor } from "./NovelEpisodeEditor";
import { VideoEpisodeEditor } from "./VideoEpisodeEditor";
import type { Story } from "./types";
export function EpisodeEditorRouter({ storyId, episodeId }: { storyId: string; episodeId: string }) {
  const [story, setStory] = useState<Story | null>(null);
  useEffect(() => { void getStory(storyId).then(setStory); }, [storyId]);
  if (!story) return <p>กำลังโหลด…</p>;
  if (story.storyType === "COMIC") return <ComicEpisodeEditor storyId={storyId} episodeId={episodeId} />;
  if (story.storyType === "VIDEO") return <VideoEpisodeEditor storyId={storyId} episodeId={episodeId} />;
  return <NovelEpisodeEditor storyId={storyId} episodeId={episodeId} />;
}
