import type { EpisodeVisibility, StoryType } from "@/features/novel-editor/types";

export type NavigationStorySummary = {
  id: string;
  title: string;
  creatorSlug: string;
  slug: string;
  storyType: StoryType;
};

export type NavigationCurrentEpisodeSummary = {
  id: string;
  title: string;
  slug: string;
  episodeNumber: number;
  sortOrder: number;
  visibility: Extract<EpisodeVisibility, "PUBLIC" | "UNLISTED">;
};

export type NavigationAdjacentEpisodeSummary = {
  title: string;
  slug: string;
  episodeNumber: number;
};

export type CreatorEpisodeNavigationResponse = {
  story: NavigationStorySummary;
  currentEpisode: NavigationCurrentEpisodeSummary;
  previousEpisode: NavigationAdjacentEpisodeSummary | null;
  nextEpisode: NavigationAdjacentEpisodeSummary | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const isNumber = (value: unknown): value is number => Number.isFinite(value);
const isUuid = (value: unknown): value is string => isText(value)
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function adjacent(value: unknown): value is NavigationAdjacentEpisodeSummary {
  return isRecord(value) && isText(value.title) && isText(value.slug) && isNumber(value.episodeNumber);
}

export function parseCreatorEpisodeNavigationResponse(value: unknown): CreatorEpisodeNavigationResponse {
  if (!isRecord(value) || !isRecord(value.story) || !isRecord(value.currentEpisode)
    || !isUuid(value.story.id) || !isText(value.story.title) || !isText(value.story.creatorSlug)
    || !isText(value.story.slug) || !["NOVEL", "COMIC", "VIDEO"].includes(String(value.story.storyType))
    || !isUuid(value.currentEpisode.id) || !isText(value.currentEpisode.title)
    || !isText(value.currentEpisode.slug) || !isNumber(value.currentEpisode.episodeNumber)
    || !isNumber(value.currentEpisode.sortOrder)
    || !["PUBLIC", "UNLISTED"].includes(String(value.currentEpisode.visibility))
    || !(value.previousEpisode === null || adjacent(value.previousEpisode))
    || !(value.nextEpisode === null || adjacent(value.nextEpisode))) {
    throw new Error("Episode navigation response does not match the approved contract.");
  }
  return value as CreatorEpisodeNavigationResponse;
}
