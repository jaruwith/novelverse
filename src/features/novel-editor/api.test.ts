import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDraftEpisode, createNovelStory, developmentLogin, getEpisodeContent, listStories,
  publishEpisode, replaceEpisodeContent, updateEpisode, uploadNovelContentImage,
  uploadComicPage, replaceComicPages,
  createVideoStory, replaceVideoContent,
  listPublicStories,
} from "./api";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn());
});

describe("verified NovelVerseApi client", () => {
  it("maps development login and persists the actual token response", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      user: { id: "u1", status: "ACTIVE", displayName: "Writer", creatorSlug: null, activatedAt: null, createdAt: "2026-01-01Z" },
      tokens: { accessToken: "access", accessTokenExpiresAt: "2026-01-01Z", refreshToken: "refresh", refreshTokenExpiresAt: "2026-02-01Z" },
    }));
    const result = await developmentLogin({ provider: "GOOGLE", providerSubject: "dev-1", email: "writer@example.com", displayName: "Writer" });
    expect(result.user.creatorSlug).toBeNull();
    expect(localStorage.getItem("novelverse_access_token")).toBe("access");
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toEqual({
      provider: "GOOGLE", providerSubject: "dev-1", email: "writer@example.com", displayName: "Writer",
    });
  });

  it("attaches bearer auth and maps the paged creator stories response", async () => {
    localStorage.setItem("novelverse_access_token", "secret");
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      items: [{ id: "s1", title: "Story", status: "DRAFT" }],
      page: 1, pageSize: 20, totalItems: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false,
    }));
    const page = await listStories();
    expect(page.items[0].title).toBe("Story");
    expect(new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers).get("Authorization")).toBe("Bearer secret");
  });

  it("loads discovery anonymously with backend filters and no mock fallback", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      items: [{ id: "public-1", title: "Published", coverUrl: "/api/v1/media-assets/m1/content" }],
      page: 2, pageSize: 12, totalItems: 13, totalPages: 2, hasPreviousPage: true, hasNextPage: false,
    }));
    const result = await listPublicStories({
      q: "แมว ไทย", page: 2, pageSize: 12, storyType: "COMIC", categorySlug: "fantasy",
      tag: "magic", creatorSlug: "creator-one", languageCode: "th",
      contentRating: "TEEN", sort: "RELEVANCE",
    });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("http://localhost:5039/api/v1/stories?page=2&pageSize=12&sort=RELEVANCE&q=%E0%B9%81%E0%B8%A1%E0%B8%A7+%E0%B9%84%E0%B8%97%E0%B8%A2&storyType=COMIC&categorySlug=fantasy&tag=magic&creatorSlug=creator-one&languageCode=th&contentRating=TEEN");
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
    expect(result.items[0].coverUrl).toBe("http://localhost:5039/api/v1/media-assets/m1/content");
  });

  it("maps content envelope and nullable block fields without leaking response ids", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      episodeId: "e1", wordCount: 2, blocks: [
        { id: "b1", type: "TEXT", sortOrder: 1, textContent: "hello world", mediaAssetId: null, createdAt: "x", updatedAt: "x" },
        { id: "b2", type: "DIVIDER", sortOrder: 2, textContent: null, mediaAssetId: null, createdAt: "x", updatedAt: "x" },
      ],
    }));
    const content = await getEpisodeContent("s1", "e1");
    expect(content.wordCount).toBe(2);
    expect(content.blocks[0]).toMatchObject({ type: "TEXT", textContent: "hello world", mediaAssetId: null });
    expect(content.blocks[0]).not.toHaveProperty("id");
  });

  it("sends exact metadata and replace-all request bodies", async () => {
    vi.mocked(fetch).mockImplementation(async () => jsonResponse({}));
    await updateEpisode("s1", "e1", {
      title: "Episode", slug: "episode", episodeNumber: 2, sortOrder: 3, visibility: "UNLISTED", synopsis: null,
    });
    await replaceEpisodeContent("s1", "e1", [{ type: "TEXT", textContent: "body", mediaAssetId: null }]);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toEqual({
      title: "Episode", slug: "episode", episodeNumber: 2, sortOrder: 3, visibility: "UNLISTED", synopsis: null,
    });
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body))).toEqual({
      blocks: [{ type: "TEXT", textContent: "body", mediaAssetId: null }],
    });
  });

  it("uses POST publish and surfaces 404 concealment and 409 conflict", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}, 404));
    await expect(publishEpisode("s1", "e1")).rejects.toMatchObject({ status: 404 });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ status: 409, detail: "Episode cannot be published." }, 409));
    await expect(publishEpisode("s1", "e1")).rejects.toMatchObject({ status: 409 });
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe("http://localhost:5039/api/v1/creator/stories/s1/episodes/e1/publish");
    expect(vi.mocked(fetch).mock.calls[1][1]?.method).toBe("POST");
  });

  it("maps validation Problem Details and clears an invalid expired session", async () => {
    localStorage.setItem("novelverse_access_token", "expired");
    localStorage.setItem("novelverse_refresh_token", "invalid");
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ status: 401 }, 401))
      .mockResolvedValueOnce(jsonResponse({ status: 401 }, 401));
    await expect(listStories()).rejects.toMatchObject({ status: 401 });
    expect(localStorage.getItem("novelverse_access_token")).toBeNull();

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      title: "Validation failed", status: 400, errors: { "blocks[0].textContent": ["TEXT is invalid."] }, traceId: "hidden",
    }, 400));
    await expect(replaceEpisodeContent("s1", "e1", [])).rejects.toMatchObject({
      problem: { errors: { "blocks[0].textContent": ["TEXT is invalid."] } },
    });
  });

  it("stores a rotated token pair and retries the authenticated request once", async () => {
    localStorage.setItem("novelverse_access_token", "expired");
    localStorage.setItem("novelverse_refresh_token", "old-refresh");
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ status: 401 }, 401))
      .mockResolvedValueOnce(jsonResponse({
        accessToken: "rotated-access", accessTokenExpiresAt: "2026-08-01Z",
        refreshToken: "rotated-refresh", refreshTokenExpiresAt: "2026-09-01Z",
      }))
      .mockResolvedValueOnce(jsonResponse({
        items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0,
        hasPreviousPage: false, hasNextPage: false,
      }));

    await listStories();

    expect(localStorage.getItem("novelverse_access_token")).toBe("rotated-access");
    expect(localStorage.getItem("novelverse_refresh_token")).toBe("rotated-refresh");
    expect(new Headers(vi.mocked(fetch).mock.calls[2][1]?.headers).get("Authorization"))
      .toBe("Bearer rotated-access");
  });

  it("sends backend-defined minimal NOVEL story and DRAFT episode creation bodies", async () => {
    vi.mocked(fetch).mockImplementation(async () => jsonResponse({ id: "created" }));
    await createNovelStory("Local E2E", "Publishable synopsis", "category-1");
    await createDraftEpisode("s1", "Episode one", 1, 1);

    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({
      title: "Local E2E", synopsis: "Publishable synopsis", categoryIds: ["category-1"],
      storyType: "NOVEL", readingMode: "VERTICAL",
      visibility: "PUBLIC", contentRating: "GENERAL",
    });
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body))).toEqual({
      title: "Episode one", episodeNumber: 1, sortOrder: 1, slug: null,
      synopsis: null, visibility: "PUBLIC",
    });
  });

  it("uploads authenticated multipart without forcing a JSON content type", async () => {
    localStorage.setItem("novelverse_access_token", "media-token");
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      id: "media-1", purpose: "NOVEL_CONTENT", mimeType: "image/png", sizeBytes: 70,
      width: 2, height: 2, status: "ACTIVE", createdAt: "2026-01-01Z",
      contentUrl: "/api/v1/media-assets/media-1/content",
    }));
    const result = await uploadNovelContentImage(new File(["png"], "fixture.png", { type: "image/png" }));
    const init = vi.mocked(fetch).mock.calls[0][1]!;
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("purpose")).toBe("NOVEL_CONTENT");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer media-token");
    expect(new Headers(init.headers).has("Content-Type")).toBe(false);
    expect(result.contentUrl).toContain("/api/v1/media-assets/media-1/content");
  });

  it("uses COMIC_PAGE media and replace-all comic page contracts", async () => {
    localStorage.setItem("novelverse_access_token", "comic-token");
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ id: "m1", contentUrl: "/media/m1" }))
      .mockResolvedValueOnce(jsonResponse({ episodeId: "e1", pages: [] }));
    await uploadComicPage(new File(["png"], "page.png", { type: "image/png" }));
    expect((vi.mocked(fetch).mock.calls[0][1]!.body as FormData).get("purpose")).toBe("COMIC_PAGE");
    await replaceComicPages("s1", "e1", ["m2", "m1"]);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]!.body))).toEqual({
      pages: [{ mediaAssetId: "m2" }, { mediaAssetId: "m1" }],
    });
  });

  it("creates VIDEO stories and saves YouTube metadata references", async () => {
    vi.mocked(fetch).mockImplementation(async () => jsonResponse({ id: "created" }));
    await createVideoStory("Video", "Synopsis", "category-1");
    await replaceVideoContent("s1", "e1", "https://youtu.be/dQw4w9WgXcQ", "Demo");
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({
      storyType: "VIDEO", readingMode: "VERTICAL",
    });
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body))).toEqual({
      url: "https://youtu.be/dQw4w9WgXcQ", title: "Demo",
    });
  });
});
