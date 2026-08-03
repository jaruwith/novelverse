export const TEXT_BLOCK_LIMIT = 20_000;

export type UserStatus = "PENDING_LEGAL_ACCEPTANCE" | "ACTIVE" | "SUSPENDED" | "DELETED";
export type StoryStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED" | "DELETED";
export type StoryVisibility = "PUBLIC" | "UNLISTED";
export type StoryType = "NOVEL" | "COMIC" | "VIDEO";
export type ReadingMode = "VERTICAL" | "LEFT_TO_RIGHT" | "RIGHT_TO_LEFT";
export type ContentRating = "GENERAL" | "TEEN" | "MATURE";
export type EpisodeStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED" | "DELETED";
export type EpisodeVisibility = "PUBLIC" | "UNLISTED";
export type BlockType = "TEXT" | "IMAGE" | "DIVIDER";
export type SocialProvider = "GOOGLE" | "FACEBOOK";

export type CurrentUser = {
  id: string;
  status: UserStatus;
  displayName: string;
  creatorSlug: string | null;
  activatedAt: string | null;
  createdAt: string;
  role: "USER" | "MODERATOR";
};

export type TokenResponse = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
};

export type DevelopmentSignInResponse = {
  user: CurrentUser;
  tokens: TokenResponse;
};
export type LegalDocument = {
  id: string;
  documentType: "TERMS_OF_SERVICE" | "PRIVACY_NOTICE" | "CREATOR_GUIDELINES" | "MODERATION_RULES";
  version: string;
  title: string;
  content: string;
  isRequired: boolean;
  effectiveAt: string;
};

export type PagedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type StorySummary = {
  id: string;
  title: string;
  slug: string;
  synopsis: string | null;
  languageCode: string;
  status: StoryStatus;
  visibility: StoryVisibility;
  contentRating: ContentRating;
  coverMediaAssetId: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  storyType: StoryType;
  readingMode: ReadingMode;
};
export type Category = {
  id: string;
  code: string;
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
};
export type Story = StorySummary & {
  categories: Category[];
  tags: { id: string; name: string; slug: string }[];
};

export type PublicStory = {
  id: string;
  creatorSlug: string;
  creatorDisplayName: string;
  title: string;
  slug: string;
  synopsis: string | null;
  languageCode: string;
  visibility: StoryVisibility;
  contentRating: ContentRating;
  coverMediaAssetId: string | null;
  coverUrl: string | null;
  publishedAt: string;
  updatedAt: string;
  publishedEpisodeCount: number;
  latestPublishedEpisodeId: string | null;
  latestPublishedEpisodeSlug: string | null;
  latestPublishedEpisodeTitle: string | null;
  latestPublishedEpisodeAt: string | null;
  categories: Category[];
  tags: { id: string; name: string; slug: string }[];
  storyType: StoryType;
  readingMode: ReadingMode;
};

export type PublicEpisode = {
  id: string;
  title: string;
  slug: string;
  episodeNumber: number;
  sortOrder: number;
  visibility: EpisodeVisibility;
  synopsis: string | null;
  publishedAt: string;
  updatedAt: string;
  wordCount: number;
};

export type LibraryStory = {
  storyId: string;
  title: string;
  storySlug: string;
  creatorSlug: string;
  creatorDisplayName: string;
  synopsis: string | null;
  storyType: StoryType;
  coverUrl: string | null;
  categories: Category[];
  bookmarkedAt: string;
  isAvailable?: boolean;
  unavailableReason?: string | null;
};

export type ModerationTargetType = "STORY" | "EPISODE" | "USER" | "COMMENT";
export type ModerationReason = "SPAM" | "COPYRIGHT" | "HARASSMENT" | "HATE" | "SEXUAL_CONTENT" |
  "VIOLENCE" | "SELF_HARM" | "MISINFORMATION" | "IMPERSONATION" | "PRIVACY" | "OTHER";
export type ModerationReportStatus = "OPEN" | "UNDER_REVIEW" | "ACTION_TAKEN" | "DISMISSED";
export type ModerationReport = {
  id: string; reporterUserId: string | null; targetType: ModerationTargetType; targetId: string;
  reason: ModerationReason; comment: string | null; status: ModerationReportStatus;
  assignedModeratorUserId: string | null; resolutionNote: string | null;
  createdAt: string; updatedAt: string; reviewedAt: string | null; resolvedAt: string | null;
  commentEvidence: null | {
    commentId: string; bodySnapshot: string; isSpoiler: boolean;
    commentCreatedAt: string; commentEditedAt: string | null; evidenceCreatedAt: string;
    integrityHash: string; currentState: "VISIBLE" | "HIDDEN" | "DELETED"; currentVersion: number;
  };
};

export type ReadingProgress = {
  storyId: string;
  storyTitle: string;
  storySlug: string;
  creatorSlug: string;
  storyType: StoryType;
  episodeId: string;
  episodeTitle: string;
  episodeSlug: string;
  lastAccessedAt: string;
};

export type Episode = {
  id: string;
  storyId: string;
  title: string;
  slug: string;
  episodeNumber: number;
  sortOrder: number;
  status: EpisodeStatus;
  visibility: EpisodeVisibility;
  synopsis: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  wordCount: number;
};

type BlockBase = { localKey: string; persistedId?: string };
export type TextBlock = BlockBase & { type: "TEXT"; textContent: string; mediaAssetId: null };
export type ImageBlock = BlockBase & {
  type: "IMAGE"; textContent: null; mediaAssetId: string; mediaUrl?: string | null;
  width?: number | null; height?: number | null; mimeType?: string | null;
};
export type DividerBlock = BlockBase & { type: "DIVIDER"; textContent: null; mediaAssetId: null };
export type EditorBlock = TextBlock | ImageBlock | DividerBlock;
export type ContentBlockPayload =
  | { type: "TEXT"; textContent: string; mediaAssetId: null }
  | { type: "IMAGE"; textContent: null; mediaAssetId: string }
  | { type: "DIVIDER"; textContent: null; mediaAssetId: null };
export type NovelContentBlockResponse = ContentBlockPayload & {
  id: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  mediaUrl?: string | null;
  width?: number | null;
  height?: number | null;
  mimeType?: string | null;
};
export type NovelContentResponse = {
  episodeId: string;
  wordCount: number;
  blocks: NovelContentBlockResponse[];
};

export type MediaAsset = {
  id: string;
  purpose: "NOVEL_CONTENT" | "STORY_COVER" | "USER_AVATAR" | "COMIC_PAGE" | "VIDEO_THUMBNAIL";
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  status: "ACTIVE" | "DELETED";
  createdAt: string;
  contentUrl: string;
};
export type ComicPage = {
  id: string; sortOrder: number; mediaAssetId: string; mediaUrl: string;
  width: number; height: number; mimeType: string; createdAt: string; updatedAt: string;
};
export type ComicPagesResponse = { episodeId: string; pages: ComicPage[] };
export type VideoContent = {
  id: string; episodeId: string; provider: "YOUTUBE"; videoId: string; originalUrl: string;
  title: string | null; thumbnailUrl: string; durationSeconds: number | null;
  createdAt: string; updatedAt: string;
};

export type ProblemDetails = {
  type?: string;
  title?: string;
  detail?: string;
  status?: number;
  instance?: string;
  errorCode?: string;
  traceId?: string;
  errors?: Record<string, string[] | string>;
};

export function createLocalKey() {
  return globalThis.crypto?.randomUUID?.() ??
    `block-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function serializeBlocks(blocks: EditorBlock[]): ContentBlockPayload[] {
  return blocks.map(({ type, textContent, mediaAssetId }) => ({ type, textContent, mediaAssetId })) as ContentBlockPayload[];
}

export function hasPublishableText(blocks: EditorBlock[]) {
  return blocks.some((block) => block.type === "TEXT" && block.textContent.trim());
}

export function validateBlocksForSave(blocks: EditorBlock[]) {
  if (blocks.some((block) => block.type === "TEXT" && block.textContent.trim().length > TEXT_BLOCK_LIMIT)) {
    return `ข้อความแต่ละบล็อกต้องไม่เกิน ${TEXT_BLOCK_LIMIT.toLocaleString("th-TH")} ตัวอักษร`;
  }
  if (blocks.some((block) => block.type === "TEXT" && !block.textContent.trim())) {
    return "กรุณาเติมข้อความหรือลบบล็อกข้อความที่ว่างก่อนบันทึก";
  }
  return null;
}
