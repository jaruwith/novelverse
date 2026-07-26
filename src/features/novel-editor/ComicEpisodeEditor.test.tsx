import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getStory: vi.fn(), getEpisode: vi.fn(), getComicPages: vi.fn(),
  replaceComicPages: vi.fn(), uploadComicPage: vi.fn(), publishEpisode: vi.fn(),
}));
vi.mock("./api", async (original) => ({ ...await original<typeof import("./api")>(), ...api }));
import { ComicEpisodeEditor } from "./ComicEpisodeEditor";

beforeEach(() => {
  api.getStory.mockResolvedValue({ id: "s", title: "Comic", storyType: "COMIC" });
  api.getEpisode.mockResolvedValue({ id: "e", title: "Episode", status: "DRAFT" });
  api.getComicPages.mockResolvedValue({ episodeId: "e", pages: [
    { id: "p1", sortOrder: 1, mediaAssetId: "m1", mediaUrl: "http://test/page.png",
      width: 3, height: 3, mimeType: "image/png", createdAt: "x", updatedAt: "x" },
  ] });
});

describe("ComicEpisodeEditor", () => {
  it("renders pages and a restricted native upload picker", async () => {
    render(<ComicEpisodeEditor storyId="s" episodeId="e" />);
    expect(await screen.findByTestId("comic-page")).toBeInTheDocument();
    expect(screen.getByLabelText("เลือกหน้าการ์ตูน"))
      .toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
    expect(screen.getByRole("button", { name: "เลื่อนขึ้น" })).toBeDisabled();
  });
});
