import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const previewApi = vi.hoisted(() => ({
  getStory: vi.fn(),
  getEpisode: vi.fn(),
  getEpisodeContent: vi.fn(),
}));
vi.mock("./api", async (importOriginal) => {
  const original = await importOriginal<typeof import("./api")>();
  return {
    ...original,
    ...previewApi,
  };
});
import { EpisodePreview } from "./EpisodePreview";

beforeEach(() => {
  previewApi.getStory.mockResolvedValue({ id: "story-1", title: "เรื่องทดสอบ" });
  previewApi.getEpisode.mockResolvedValue({ id: "episode-1", storyId: "story-1", title: "ตอนแรก", synopsis: "", status: "DRAFT" });
  previewApi.getEpisodeContent.mockResolvedValue({ episodeId: "episode-1", wordCount: 2, blocks: [
    { localKey: "text", type: "TEXT", textContent: "เนื้อหาตัวอย่าง", mediaAssetId: null },
  ] });
});

describe("EpisodePreview", () => {
  it("uses the shared novel content renderer", async () => {
    render(<EpisodePreview storyId="story-1" episodeId="episode-1" />);
    expect(await screen.findByTestId("novel-content-renderer")).toBeInTheDocument();
    expect(screen.getByText("เนื้อหาตัวอย่าง")).toBeInTheDocument();
  });
});
