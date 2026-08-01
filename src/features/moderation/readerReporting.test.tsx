import { Suspense } from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ComicReader from "@/app/read-comic/[creatorSlug]/[storySlug]/[episodeSlug]/page";
import NovelReader from "@/app/read-novel/[creatorSlug]/[storySlug]/[episodeSlug]/page";
import VideoReader from "@/app/watch-video/[creatorSlug]/[storySlug]/[episodeSlug]/page";

const api = vi.hoisted(() => ({
  getPublicStory: vi.fn(),
  getPublicNovelContent: vi.fn(),
  getPublicComicPages: vi.fn(),
  getPublicVideoContent: vi.fn(),
}));
vi.mock("@/features/novel-editor/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/features/novel-editor/api")>();
  return { ...original, ...api };
});
vi.mock("@/features/reader-state/progress", () => ({ recordEpisodeProgress: vi.fn() }));
vi.mock("@/features/moderation/ReportDialog", () => ({
  ReportDialog: ({ targetType, targetId }: { targetType: string; targetId: string }) =>
    <div data-testid="report-target">{targetType}:{targetId}</div>,
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
});

describe("owning Episode report targets", () => {
  it.each([
    ["NOVEL", (value: ReturnType<typeof params>) => <NovelReader params={value} />, "EPISODE:novel-episode", api.getPublicNovelContent],
    ["COMIC", (value: ReturnType<typeof params>) => <ComicReader params={value} />, "EPISODE:comic-episode", api.getPublicComicPages],
    ["VIDEO", (value: ReturnType<typeof params>) => <VideoReader params={value} />, "EPISODE:video-episode", api.getPublicVideoContent],
  ])("%s decodes Thai route slugs and reports its owning Episode", async (_type, createReader, expected, contentCall) => {
    await act(async () => {
      render(<Suspense fallback={<p>loading</p>}>{createReader(params())}</Suspense>);
    });
    expect(await screen.findByTestId("report-target")).toHaveTextContent(expected);
    expect(api.getPublicStory).toHaveBeenCalledWith(rawSlugs.creatorSlug, rawSlugs.storySlug);
    expect(contentCall).toHaveBeenCalledWith(rawSlugs.creatorSlug, rawSlugs.storySlug, rawSlugs.episodeSlug);
  });
});
