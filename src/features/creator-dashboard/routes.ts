import type { AttentionItem, RecentEpisodeItem, RecentStoryItem } from "./types";

export const creatorDashboardHref = "/creator/dashboard";
export const creatorStoriesHref = "/creator/stories";
export const creatorProfileHref = "/creator/profile";

export const manageStoryHref = (storyId: string) =>
  `${creatorStoriesHref}/${encodeURIComponent(storyId)}`;

export const editEpisodeHref = (storyId: string, episodeId: string) =>
  `${manageStoryHref(storyId)}/episodes/${encodeURIComponent(episodeId)}/edit`;

export const publicStoryHref = (creatorSlug: string, storySlug: string) =>
  `/stories/${encodeURIComponent(creatorSlug)}/${encodeURIComponent(storySlug)}`;

export function attentionHref(item: AttentionItem): string {
  if (item.action === "MANAGE_PROFILE") return creatorProfileHref;
  if ((item.action === "MANAGE_STORY" || item.action === "ADD_EPISODE") && item.targetId) {
    return manageStoryHref(item.targetId);
  }
  if (item.action === "EDIT_EPISODE" && item.targetId) {
    return creatorStoriesHref;
  }
  return creatorDashboardHref;
}

export const storyOpenHref = (item: RecentStoryItem) =>
  item.canEdit || item.canAddEpisode ? manageStoryHref(item.storyId) : creatorDashboardHref;

export const episodeOpenHref = (item: RecentEpisodeItem) =>
  item.canEdit ? editEpisodeHref(item.storyId, item.episodeId) : manageStoryHref(item.storyId);
