import { Suspense } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ComicReader from "@/app/read-comic/[creatorSlug]/[storySlug]/[episodeSlug]/page";
import NovelReader from "@/app/read-novel/[creatorSlug]/[storySlug]/[episodeSlug]/page";
import VideoReader from "@/app/watch-video/[creatorSlug]/[storySlug]/[episodeSlug]/page";

const api = vi.hoisted(() => ({
  getPublicStory: vi.fn(),
  getPublicNovelContent: vi.fn(),
  getPublicComicPages: vi.fn(),
  getPublicVideoContent: vi.fn(),
  getPublicEpisodeNavigation: vi.fn(),
}));
const progress = vi.hoisted(() => ({ recordEpisodeProgress: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/read-novel/creator/story/episode",
}));
vi.mock("@/features/novel-editor/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/features/novel-editor/api")>();
  return { ...original, ...api };
});
vi.mock("@/features/reader-state/progress", () => progress);
vi.mock("@/features/moderation/ReportDialog", () => ({
  ReportDialog: ({ targetType, targetId }: { targetType: string; targetId: string }) =>
    <div data-testid="report-target">{targetType}:{targetId}</div>,
}));
vi.mock("@/features/community/DiscussionPanel", () => ({
  DiscussionPanel: () => <div data-testid="discussion-panel" />,
}));

const rawSlugs = {
  creatorSlug: "creator-ไทย",
  storySlug: "test-นิยาย",
  episodeSlug: "test-นิยาย-ตอน-1",
};
const params = () => Promise.resolve({
  creatorSlug: encodeURIComponent(rawSlugs.creatorSlug),
  storySlug: encodeURIComponent(rawSlugs.storySlug),
  episodeSlug: encodeURIComponent(rawSlugs.episodeSlug),
});
beforeEach(() => {
  vi.clearAllMocks();
  api.getPublicStory.mockResolvedValue({ id: "story-id" });
  api.getPublicNovelContent.mockResolvedValue({ episodeId: "novel-episode", blocks: [] });
  api.getPublicComicPages.mockResolvedValue({ episodeId: "comic-episode", pages: [] });
  api.getPublicVideoContent.mockResolvedValue({
    id: "video", episodeId: "video-episode", videoId: "dQw4w9WgXcQ", title: "Video",
  });
  api.getPublicEpisodeNavigation.mockImplementation((_creator, _story, episode) => Promise.resolve({
    story: { id: "11111111-1111-4111-8111-111111111111", title: "Story", creatorSlug: rawSlugs.creatorSlug,
      slug: rawSlugs.storySlug, storyType: episode.includes("ตอน") ? "NOVEL" : "NOVEL" },
    currentEpisode: { id: "novel-episode", title: "Episode", slug: rawSlugs.episodeSlug,
      episodeNumber: 1, sortOrder: 1, visibility: "PUBLIC" },
    previousEpisode: null, nextEpisode: null,
  }));
});

describe("owning Episode report targets", () => {
  it.each([
    ["NOVEL", (value: ReturnType<typeof params>) => <NovelReader params={value} />, "EPISODE:novel-episode", api.getPublicNovelContent],
    ["COMIC", (value: ReturnType<typeof params>) => <ComicReader params={value} />, "EPISODE:comic-episode", api.getPublicComicPages],
    ["VIDEO", (value: ReturnType<typeof params>) => <VideoReader params={value} />, "EPISODE:video-episode", api.getPublicVideoContent],
  ])("%s decodes Thai route slugs and reports its owning Episode", async (type, createReader, expected, contentCall) => {
    const storyType = type as "NOVEL" | "COMIC" | "VIDEO";
    const episodeId = expected.split(":")[1];
    api.getPublicEpisodeNavigation.mockResolvedValueOnce({
      story: { id: "11111111-1111-4111-8111-111111111111", title: "Story", creatorSlug: rawSlugs.creatorSlug,
        slug: rawSlugs.storySlug, storyType },
      currentEpisode: { id: episodeId, title: "Episode", slug: rawSlugs.episodeSlug,
        episodeNumber: 1, sortOrder: 1, visibility: "PUBLIC" },
      previousEpisode: null, nextEpisode: null,
    });
    await act(async () => {
      render(<Suspense fallback={<p>loading</p>}>{createReader(params())}</Suspense>);
    });
    expect(await screen.findByTestId("report-target")).toHaveTextContent(expected);
    expect(api.getPublicEpisodeNavigation).toHaveBeenCalledWith(
      rawSlugs.creatorSlug, rawSlugs.storySlug, rawSlugs.episodeSlug, expect.any(AbortSignal));
    expect(contentCall).toHaveBeenCalledWith(
      rawSlugs.creatorSlug, rawSlugs.storySlug, rawSlugs.episodeSlug, expect.any(AbortSignal));
    await waitFor(() => expect(progress.recordEpisodeProgress).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111", episodeId, expect.any(AbortSignal)));
  });
});
