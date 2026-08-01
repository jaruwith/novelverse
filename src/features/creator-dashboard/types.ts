import type { EpisodeStatus, EpisodeVisibility, StoryStatus, StoryType, StoryVisibility } from "@/features/novel-editor/types";

export type DashboardPeriod = {
  kind: "COMPLETE_UTC_DAYS";
  currentStartInclusive: string;
  currentEndExclusive: string;
  previousStartInclusive: string;
  previousEndExclusive: string;
  days: number;
};

export type CreatorSummary = {
  creatorProfileId: string | null;
  displayName: string;
  creatorSlug: string | null;
  eligibility: "ELIGIBLE" | "PROFILE_INCOMPLETE";
  profileVisibility: "VISIBLE" | "HIDDEN";
  followerCount: number;
};

export type CreatorOverview = {
  stories: { total: number };
  storiesByType: { novel: number; comic: number; video: number };
  storiesByStatus: { draft: number; published: number; archived: number };
  hiddenStories: number;
  episodes: { total: number };
  episodesByStatus: { draft: number; published: number; archived: number };
  hiddenEpisodes: number;
  bookmarkCount: number;
  likeCount: number;
};

export type MetricValue<T extends number> = { value: T | null; suppressed: boolean };
export type MetricComparison<T extends number> = {
  current: MetricValue<T>;
  previous: MetricValue<T>;
  absoluteChange: T | null;
  percentageChange: number | null;
};

export type CreatorPerformance = {
  availability: "AVAILABLE" | "NO_ACTIVITY" | "SUPPRESSED";
  suppression: { reason: "NONE" | "SMALL_CELL"; threshold: number };
  qualifiedViews: MetricComparison<number>;
  uniqueViewers: MetricComparison<number>;
  activeReadSeconds: MetricComparison<number>;
  completedSessions: MetricComparison<number>;
  completionRate: MetricComparison<number>;
};

export type RecentStoryItem = {
  storyId: string;
  title: string;
  slug: string;
  storyType: StoryType;
  status: StoryStatus;
  visibility: StoryVisibility;
  moderationVisibility: "VISIBLE" | "HIDDEN";
  updatedAt: string;
  publishedAt: string | null;
  publishedEpisodeCount: number;
  canEdit: boolean;
  canAddEpisode: boolean;
  canViewPublic: boolean;
};

export type RecentEpisodeItem = {
  episodeId: string;
  storyId: string;
  storyTitle: string;
  title: string;
  slug: string;
  episodeNumber: number;
  storyType: StoryType;
  status: EpisodeStatus;
  visibility: EpisodeVisibility;
  moderationVisibility: "VISIBLE" | "HIDDEN";
  contentReadiness: "READY" | "MISSING_REQUIRED_CONTENT";
  updatedAt: string;
  publishedAt: string | null;
  canEdit: boolean;
  canViewPublic: boolean;
};

export type AttentionItem = {
  reasonCode:
    | "CREATOR_PROFILE_INCOMPLETE"
    | "CREATOR_PROFILE_HIDDEN"
    | "STORY_HIDDEN"
    | "EPISODE_HIDDEN"
    | "PUBLISHED_STORY_NO_PUBLIC_EPISODE"
    | "DRAFT_STORY_NO_EPISODE"
    | "DRAFT_EPISODE_MISSING_CONTENT";
  severity: "INFO" | "WARNING" | "CRITICAL";
  targetType: "STORY" | "EPISODE" | "CREATOR_PROFILE";
  targetId: string | null;
  title: string;
  action: "MANAGE_PROFILE" | "MANAGE_STORY" | "ADD_EPISODE" | "EDIT_EPISODE";
};

export type Capabilities = {
  canManageProfile: boolean;
  canCreateStory: boolean;
  canViewPublicProfile: boolean;
};

export type CreatorDashboardResponse = {
  generatedAt: string;
  period: DashboardPeriod;
  creator: CreatorSummary;
  overview: CreatorOverview;
  performance: CreatorPerformance;
  content: {
    recentStories: RecentStoryItem[];
    recentDrafts: RecentStoryItem[];
    recentEpisodes: RecentEpisodeItem[];
  };
  attention: { items: AttentionItem[]; truncated: boolean };
  capabilities: Capabilities;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const allowed = <T extends string>(value: unknown, values: readonly T[]): value is T =>
  typeof value === "string" && values.includes(value as T);

export function parseCreatorDashboardResponse(value: unknown): CreatorDashboardResponse {
  if (!isRecord(value) || typeof value.generatedAt !== "string"
    || !isRecord(value.period) || value.period.kind !== "COMPLETE_UTC_DAYS"
    || !isRecord(value.creator)
    || !allowed(value.creator.eligibility, ["ELIGIBLE", "PROFILE_INCOMPLETE"] as const)
    || !allowed(value.creator.profileVisibility, ["VISIBLE", "HIDDEN"] as const)
    || !isRecord(value.overview) || !isRecord(value.performance)
    || !allowed(value.performance.availability, ["AVAILABLE", "NO_ACTIVITY", "SUPPRESSED"] as const)
    || !isRecord(value.content)
    || !Array.isArray(value.content.recentStories)
    || !Array.isArray(value.content.recentDrafts)
    || !Array.isArray(value.content.recentEpisodes)
    || !isRecord(value.attention) || !Array.isArray(value.attention.items)
    || !isRecord(value.capabilities)) {
    throw new Error("Creator Dashboard response does not match the approved contract.");
  }

  const validStory = (item: unknown) => isRecord(item)
    && allowed(item.storyType, ["NOVEL", "COMIC", "VIDEO"] as const)
    && allowed(item.status, ["DRAFT", "PUBLISHED", "ARCHIVED", "DELETED"] as const)
    && allowed(item.moderationVisibility, ["VISIBLE", "HIDDEN"] as const);
  const validEpisode = (item: unknown) => isRecord(item)
    && allowed(item.storyType, ["NOVEL", "COMIC", "VIDEO"] as const)
    && allowed(item.status, ["DRAFT", "PUBLISHED", "ARCHIVED", "DELETED"] as const)
    && allowed(item.moderationVisibility, ["VISIBLE", "HIDDEN"] as const)
    && allowed(item.contentReadiness, ["READY", "MISSING_REQUIRED_CONTENT"] as const);
  const validAttention = (item: unknown) => isRecord(item)
    && allowed(item.severity, ["INFO", "WARNING", "CRITICAL"] as const)
    && allowed(item.targetType, ["STORY", "EPISODE", "CREATOR_PROFILE"] as const)
    && allowed(item.action, ["MANAGE_PROFILE", "MANAGE_STORY", "ADD_EPISODE", "EDIT_EPISODE"] as const);

  if (![...value.content.recentStories, ...value.content.recentDrafts].every(validStory)
    || !value.content.recentEpisodes.every(validEpisode)
    || !value.attention.items.every(validAttention)) {
    throw new Error("Creator Dashboard contains an unsupported enum value.");
  }

  return value as CreatorDashboardResponse;
}
