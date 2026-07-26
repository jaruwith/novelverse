import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublicHome } from "./PublicHome";
import { StoryDetail } from "./StoryDetail";
import { resolvePublicEpisodeHref } from "./routes";
import * as api from "@/features/novel-editor/api";
import type { PublicStory } from "@/features/novel-editor/types";

vi.mock("@/features/novel-editor/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/novel-editor/api")>();
  return { ...actual, listPublicStories: vi.fn(), listCategories: vi.fn(),
    getPublicStory: vi.fn(), listPublicEpisodes: vi.fn() };
});

const story: PublicStory = {
  id: "story-1", creatorSlug: "creator-one", creatorDisplayName: "นักเขียนหนึ่ง",
  title: "เรื่องจริงจาก API", slug: "real-api-story", synopsis: "เรื่องย่อสำหรับผู้อ่าน",
  languageCode: "th", visibility: "PUBLIC", contentRating: "GENERAL",
  coverMediaAssetId: null, coverUrl: null, publishedAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-02T00:00:00Z", publishedEpisodeCount: 1,
  categories: [{ id: "cat-1", code: "FANTASY", name: "แฟนตาซี", slug: "fantasy", isActive: true, sortOrder: 1 }],
  tags: [{ id: "tag-1", name: "ผจญภัย", slug: "adventure" }],
  storyType: "NOVEL", readingMode: "VERTICAL",
};
const page = (items = [story]) => ({
  items, page: 1, pageSize: 12, totalItems: items.length, totalPages: items.length ? 1 : 0,
  hasPreviousPage: false, hasNextPage: false,
});

beforeEach(() => {
  vi.mocked(api.listPublicStories).mockResolvedValue(page());
  vi.mocked(api.listCategories).mockResolvedValue(story.categories);
  vi.mocked(api.getPublicStory).mockResolvedValue(story);
  vi.mocked(api.listPublicEpisodes).mockResolvedValue({
    ...page([]), pageSize: 100,
    items: [{ id: "episode-1", title: "ตอนแรก", slug: "episode-one", episodeNumber: 1,
      sortOrder: 1, visibility: "PUBLIC", synopsis: "เริ่มต้น", publishedAt: "2026-07-02T00:00:00Z",
      updatedAt: "2026-07-02T00:00:00Z", wordCount: 120 }],
  });
});

describe("public discovery Home", () => {
  it("loads real discovery cards and applies type and category filters", async () => {
    render(<PublicHome />);
    expect(screen.getByRole("status")).toHaveTextContent("กำลังโหลด");
    expect(await screen.findByText("เรื่องจริงจาก API")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เรื่องจริงจาก API" }))
      .toHaveAttribute("href", "/stories/creator-one/real-api-story");

    fireEvent.click(screen.getByRole("button", { name: "นิยาย" }));
    await waitFor(() => expect(api.listPublicStories).toHaveBeenLastCalledWith(
      expect.objectContaining({ storyType: "NOVEL" })));
    fireEvent.change(screen.getByLabelText("หมวดหมู่"), { target: { value: "fantasy" } });
    await waitFor(() => expect(api.listPublicStories).toHaveBeenLastCalledWith(
      expect.objectContaining({ categorySlug: "fantasy", storyType: "NOVEL" })));
  });

  it("shows empty state and retries a failed request", async () => {
    vi.mocked(api.listPublicStories).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(page([]));
    render(<PublicHome />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ลองอีกครั้ง" }));
    expect(await screen.findByText("ยังไม่มีเรื่องที่เผยแพร่ตรงกับตัวกรองนี้")).toBeInTheDocument();
    expect(api.listPublicStories).toHaveBeenCalledTimes(2);
  });
});

describe("public Story Detail", () => {
  it("renders public metadata and published episode navigation", async () => {
    render(<StoryDetail creatorSlug="creator-one" storySlug="real-api-story" />);
    expect(await screen.findByRole("heading", { name: "เรื่องจริงจาก API" })).toBeInTheDocument();
    expect(screen.getByText("โดย นักเขียนหนึ่ง")).toBeInTheDocument();
    expect(screen.getByText("1. ตอนแรก")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เปิดอ่าน" }))
      .toHaveAttribute("href", "/read-novel/creator-one/real-api-story/episode-one");
  });

  it("renders the no-published-episode state", async () => {
    vi.mocked(api.listPublicEpisodes).mockResolvedValue({ ...page([]), pageSize: 100, items: [] });
    render(<StoryDetail creatorSlug="creator-one" storySlug="real-api-story" />);
    expect(await screen.findByText("เรื่องนี้ยังไม่มีตอนที่เผยแพร่")).toBeInTheDocument();
  });
});

describe("public reader route resolver", () => {
  it.each([
    ["NOVEL", "/read-novel/creator/story/episode"],
    ["COMIC", "/read-comic/creator/story/episode"],
    ["VIDEO", "/watch-video/creator/story/episode"],
  ] as const)("maps %s to its reader", (type, expected) => {
    expect(resolvePublicEpisodeHref(type, "creator", "story", "episode")).toBe(expected);
  });
});
