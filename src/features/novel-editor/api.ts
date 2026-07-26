import type {
  Category, ContentBlockPayload, CurrentUser, DevelopmentSignInResponse, EditorBlock, Episode,
  LegalDocument, NovelContentResponse, PagedResponse, ProblemDetails, SocialProvider, Story,
  StorySummary, TokenResponse, MediaAsset, ComicPagesResponse, VideoContent,
  PublicStory, PublicEpisode, StoryType,
} from "./types";
import { createLocalKey } from "./types";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5039").replace(/\/$/, "");
const ACCESS_KEY = "novelverse_access_token";
const REFRESH_KEY = "novelverse_refresh_token";
const ACCESS_EXPIRY_KEY = "novelverse_access_token_expires_at";
const REFRESH_EXPIRY_KEY = "novelverse_refresh_token_expires_at";

const absoluteApiUrl = (url: string | null) => url ? new URL(url, API_BASE).toString() : null;

export class ApiError extends Error {
  constructor(public status: number, public problem?: ProblemDetails) {
    super(problem?.detail || problem?.title || "Request failed");
  }
}

export function storeTokens(tokens: TokenResponse) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  localStorage.setItem(ACCESS_EXPIRY_KEY, tokens.accessTokenExpiresAt);
  localStorage.setItem(REFRESH_EXPIRY_KEY, tokens.refreshTokenExpiresAt);
}

export function clearSession() {
  if (typeof window === "undefined") return;
  [ACCESS_KEY, REFRESH_KEY, ACCESS_EXPIRY_KEY, REFRESH_EXPIRY_KEY].forEach((key) => localStorage.removeItem(key));
}

export function hasSession() {
  return typeof window !== "undefined" && Boolean(localStorage.getItem(REFRESH_KEY));
}

async function parseProblem(response: Response): Promise<ProblemDetails | undefined> {
  try {
    const body = await response.json() as unknown;
    return body && typeof body === "object" ? body as ProblemDetails : undefined;
  } catch {
    return undefined;
  }
}

let refreshInFlight: Promise<boolean> | null = null;
async function refreshSession(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return false;
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).then(async (response) => {
      if (!response.ok) return false;
      storeTokens(await response.json() as TokenResponse);
      return true;
    }).catch(() => false).finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = typeof window === "undefined" ? null : localStorage.getItem(ACCESS_KEY);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, { detail: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองอีกครั้ง" });
  }
  if (response.status === 401 && retry && await refreshSession()) return request<T>(path, init, false);
  if (!response.ok) {
    const problem = await parseProblem(response);
    if (response.status === 401) clearSession();
    throw new ApiError(response.status, problem);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function apiErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง";
  if (error.status === 0) return error.message;
  if (error.status === 401) return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง";
  if (error.status === 403) return "บัญชีนี้ไม่มีสิทธิ์ดำเนินการ";
  if (error.status === 404) return "ไม่พบข้อมูลนี้ หรือคุณไม่มีสิทธิ์เข้าถึง";
  if (error.status === 409) return error.problem?.detail || "สถานะปัจจุบันไม่อนุญาตให้ดำเนินการนี้";
  const fieldErrors = error.problem?.errors
    ? Object.values(error.problem.errors).flatMap((value) => Array.isArray(value) ? value : [value]).join(" ")
    : "";
  if (error.status >= 500) return "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง";
  return fieldErrors || error.problem?.detail || error.problem?.title || "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง";
}

export async function developmentLogin(input: {
  provider: SocialProvider; providerSubject: string; email: string; displayName: string;
}) {
  const response = await request<DevelopmentSignInResponse>("/api/v1/dev/auth/social-sign-in", {
    method: "POST", body: JSON.stringify(input),
  });
  storeTokens(response.tokens);
  return response;
}
export const getCurrentUser = () => request<CurrentUser>("/api/v1/users/me");
export const getCurrentLegalDocuments = () =>
  request<LegalDocument[]>("/api/v1/legal-documents/current");
export const acceptLegalDocuments = (legalDocumentIds: string[]) =>
  request<{ userId: string; status: CurrentUser["status"]; acceptedDocumentIds: string[] }>(
    "/api/v1/legal-acceptances",
    { method: "POST", body: JSON.stringify({ legalDocumentIds, acceptanceSource: "DEVELOPMENT" }) },
  );
export const updateCurrentUserProfile = (displayName: string, creatorSlug: string) =>
  request<CurrentUser>("/api/v1/users/me/profile", {
    method: "PUT", body: JSON.stringify({ displayName, creatorSlug }),
  });
export const listStories = (page = 1, pageSize = 20) =>
  request<PagedResponse<StorySummary>>(`/api/v1/creator/stories?page=${page}&pageSize=${pageSize}`);
export const listCategories = () => request<Category[]>("/api/v1/categories");
export function listPublicStories(input: {
  page?: number; pageSize?: number; storyType?: StoryType; categorySlug?: string; sort?: "LATEST" | "UPDATED";
} = {}) {
  const query = new URLSearchParams({
    page: String(input.page ?? 1),
    pageSize: String(input.pageSize ?? 12),
    sort: input.sort ?? "LATEST",
  });
  if (input.storyType) query.set("storyType", input.storyType);
  if (input.categorySlug) query.set("categorySlug", input.categorySlug);
  return request<PagedResponse<PublicStory>>(`/api/v1/stories?${query}`).then((page) => ({
    ...page,
    items: page.items.map((story) => ({ ...story, coverUrl: absoluteApiUrl(story.coverUrl) })),
  }));
}
export const getPublicStory = (creatorSlug: string, storySlug: string) =>
  request<PublicStory>(`/api/v1/stories/${encodeURIComponent(creatorSlug)}/${encodeURIComponent(storySlug)}`)
    .then((story) => ({ ...story, coverUrl: absoluteApiUrl(story.coverUrl) }));
export const listPublicEpisodes = (creatorSlug: string, storySlug: string, page = 1, pageSize = 100) =>
  request<PagedResponse<PublicEpisode>>(
    `/api/v1/stories/${encodeURIComponent(creatorSlug)}/${encodeURIComponent(storySlug)}/episodes?page=${page}&pageSize=${pageSize}`,
  );
export const createNovelStory = (title: string, synopsis: string, categoryId: string) =>
  createStory(title, synopsis, categoryId, "NOVEL");
export const createComicStory = (title: string, synopsis: string, categoryId: string) =>
  createStory(title, synopsis, categoryId, "COMIC");
export const createVideoStory = (title: string, synopsis: string, categoryId: string) =>
  createStory(title, synopsis, categoryId, "VIDEO");
const createStory = (title: string, synopsis: string, categoryId: string, storyType: "NOVEL" | "COMIC" | "VIDEO") =>
  request<Story>("/api/v1/creator/stories", {
    method: "POST",
    body: JSON.stringify({
      title, slug: null, synopsis, languageCode: "th", visibility: "PUBLIC",
      contentRating: "GENERAL", coverMediaAssetId: null, categoryIds: [categoryId], tags: [],
      storyType, readingMode: "VERTICAL",
    }),
  });
export const getStory = (storyId: string) =>
  request<Story>(`/api/v1/creator/stories/${encodeURIComponent(storyId)}`);
export const publishStory = (storyId: string) =>
  request<Story>(`/api/v1/creator/stories/${encodeURIComponent(storyId)}/publish`, { method: "POST" });
export const listEpisodes = (storyId: string, page = 1, pageSize = 20) =>
  request<PagedResponse<Episode>>(`/api/v1/creator/stories/${encodeURIComponent(storyId)}/episodes?page=${page}&pageSize=${pageSize}`);
export const createDraftEpisode = (storyId: string, title: string, episodeNumber: number, sortOrder: number) =>
  request<Episode>(`/api/v1/creator/stories/${encodeURIComponent(storyId)}/episodes`, {
    method: "POST",
    body: JSON.stringify({
      title, episodeNumber, sortOrder, slug: null, synopsis: null, visibility: "PUBLIC",
    }),
  });
export const getEpisode = (storyId: string, episodeId: string) =>
  request<Episode>(`/api/v1/creator/stories/${encodeURIComponent(storyId)}/episodes/${encodeURIComponent(episodeId)}`);
export async function getEpisodeContent(storyId: string, episodeId: string) {
  const response = await request<NovelContentResponse>(
    `/api/v1/creator/stories/${encodeURIComponent(storyId)}/episodes/${encodeURIComponent(episodeId)}/content`,
  );
  return {
    ...response,
    blocks: response.blocks.map(({ type, textContent, mediaAssetId, mediaUrl, width, height, mimeType }): EditorBlock => {
      const localKey = createLocalKey();
      if (type === "TEXT") return { type, textContent: textContent ?? "", mediaAssetId: null, localKey };
      if (type === "IMAGE" && mediaAssetId && mediaUrl) return {
        type, textContent: null, mediaAssetId, localKey,
        mediaUrl: new URL(mediaUrl, API_BASE).toString(), width, height, mimeType,
      };
      return { type: "DIVIDER", textContent: null, mediaAssetId: null, localKey };
    }),
  };
}
export async function getPublicNovelContent(creatorSlug: string, storySlug: string, episodeSlug: string) {
  const response = await request<NovelContentResponse>(
    `/api/v1/stories/${encodeURIComponent(creatorSlug)}/${encodeURIComponent(storySlug)}/episodes/${encodeURIComponent(episodeSlug)}/content`,
  );
  return {
    ...response,
    blocks: response.blocks.map(({ type, textContent, mediaAssetId, mediaUrl, width, height, mimeType }): EditorBlock => {
      const localKey = createLocalKey();
      if (type === "TEXT") return { type, textContent: textContent ?? "", mediaAssetId: null, localKey };
      if (type === "IMAGE" && mediaAssetId && mediaUrl) return {
        type, textContent: null, mediaAssetId, localKey,
        mediaUrl: absoluteApiUrl(mediaUrl), width, height, mimeType,
      };
      return { type: "DIVIDER", textContent: null, mediaAssetId: null, localKey };
    }),
  };
}
export function uploadNovelContentImage(file: File) {
  return uploadMedia(file, "NOVEL_CONTENT");
}
export function uploadComicPage(file: File) {
  return uploadMedia(file, "COMIC_PAGE");
}
function uploadMedia(file: File, purpose: "NOVEL_CONTENT" | "COMIC_PAGE") {
  const body = new FormData();
  body.append("file", file);
  body.append("purpose", purpose);
  return request<MediaAsset>("/api/v1/media-assets", { method: "POST", body })
    .then((asset) => ({ ...asset, contentUrl: new URL(asset.contentUrl, API_BASE).toString() }));
}
export async function getComicPages(storyId: string, episodeId: string) {
  const response = await request<ComicPagesResponse>(
    `/api/v1/creator/stories/${storyId}/episodes/${episodeId}/comic-pages`,
  );
  return { ...response, pages: response.pages.map((page) => ({
    ...page, mediaUrl: new URL(page.mediaUrl, API_BASE).toString(),
  })) };
}
export const replaceComicPages = (storyId: string, episodeId: string, mediaAssetIds: string[]) =>
  request<ComicPagesResponse>(`/api/v1/creator/stories/${storyId}/episodes/${episodeId}/comic-pages`, {
    method: "PUT", body: JSON.stringify({ pages: mediaAssetIds.map((mediaAssetId) => ({ mediaAssetId })) }),
  });
export async function getPublicComicPages(creatorSlug: string, storySlug: string, episodeSlug: string) {
  const response = await request<ComicPagesResponse>(
    `/api/v1/stories/${creatorSlug}/${storySlug}/episodes/${episodeSlug}/comic-pages`,
  );
  return { ...response, pages: response.pages.map((page) => ({
    ...page, mediaUrl: new URL(page.mediaUrl, API_BASE).toString(),
  })) };
}
export const updateEpisode = (storyId: string, episodeId: string, metadata: {
  title: string; slug: string | null; episodeNumber: number; sortOrder: number;
  visibility: Episode["visibility"]; synopsis: string | null;
}) => request<Episode>(`/api/v1/creator/stories/${storyId}/episodes/${episodeId}`, {
  method: "PUT", body: JSON.stringify(metadata),
});
export const replaceEpisodeContent = (storyId: string, episodeId: string, blocks: ContentBlockPayload[]) =>
  request<NovelContentResponse>(`/api/v1/creator/stories/${storyId}/episodes/${episodeId}/content`, {
    method: "PUT", body: JSON.stringify({ blocks }),
  });
export const publishEpisode = (storyId: string, episodeId: string) =>
  request<Episode>(`/api/v1/creator/stories/${storyId}/episodes/${episodeId}/publish`, { method: "POST" });
export const getVideoContent = (storyId: string, episodeId: string) =>
  request<VideoContent | null>(`/api/v1/creator/stories/${storyId}/episodes/${episodeId}/video-content`);
export const replaceVideoContent = (storyId: string, episodeId: string, url: string, title: string | null) =>
  request<VideoContent>(`/api/v1/creator/stories/${storyId}/episodes/${episodeId}/video-content`, {
    method: "PUT", body: JSON.stringify({ url, title }),
  });
export const getPublicVideoContent = (creatorSlug: string, storySlug: string, episodeSlug: string) =>
  request<VideoContent>(`/api/v1/stories/${creatorSlug}/${storySlug}/episodes/${episodeSlug}/video-content`);
