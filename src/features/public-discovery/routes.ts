import type { StoryType } from "@/features/novel-editor/types";

const segment = encodeURIComponent;

export function resolvePublicStoryHref(creatorSlug: string, storySlug: string) {
  return `/stories/${segment(creatorSlug)}/${segment(storySlug)}`;
}

export function resolvePublicEpisodeHref(
  storyType: StoryType,
  creatorSlug: string,
  storySlug: string,
  episodeSlug: string,
) {
  const suffix = `${segment(creatorSlug)}/${segment(storySlug)}/${segment(episodeSlug)}`;
  if (storyType === "NOVEL") return `/read-novel/${suffix}`;
  if (storyType === "COMIC") return `/read-comic/${suffix}`;
  if (storyType === "VIDEO") return `/watch-video/${suffix}`;
  return null;
}
