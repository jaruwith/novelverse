import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryPage } from "./LibraryPage";
import { ContinueReading } from "./ContinueReading";
import { recordEpisodeProgress, resetProgressRecordingForTests } from "./progress";
import * as api from "@/features/novel-editor/api";

const replace = vi.fn();
const router = { replace };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/novel-editor/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/novel-editor/api")>();
  return {
    ...actual,
    hasSession: vi.fn(),
    listLibrary: vi.fn(),
    listReadingProgress: vi.fn(),
    removeBookmark: vi.fn(),
    upsertReadingProgress: vi.fn(),
  };
});

const page = <T,>(items: T[]) => ({
  items, page: 1, pageSize: 20, totalItems: items.length, totalPages: items.length ? 1 : 0,
  hasPreviousPage: false, hasNextPage: false,
});
const progress = {
  storyId: "story-1", storyTitle: "เรื่องสำหรับอ่านต่อ", storySlug: "resume-story",
  creatorSlug: "creator", storyType: "COMIC" as const, episodeId: "episode-1",
  episodeTitle: "ตอนล่าสุด", episodeSlug: "latest", lastAccessedAt: "2026-07-26T08:00:00Z",
};
const bookmark = {
  storyId: "story-1", title: "เรื่องในคลัง", storySlug: "resume-story", creatorSlug: "creator",
  creatorDisplayName: "ผู้สร้าง", synopsis: null, storyType: "COMIC" as const, coverUrl: null,
  categories: [], bookmarkedAt: "2026-07-26T08:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  resetProgressRecordingForTests();
  vi.mocked(api.hasSession).mockReturnValue(true);
  vi.mocked(api.listLibrary).mockResolvedValue(page([bookmark]));
  vi.mocked(api.listReadingProgress).mockResolvedValue(page([progress]));
  vi.mocked(api.removeBookmark).mockResolvedValue(undefined);
  vi.mocked(api.upsertReadingProgress).mockResolvedValue(progress);
});

describe("reader library", () => {
  it("loads bookmarks and Continue Reading, then removes a bookmark", async () => {
    render(<LibraryPage />);
    expect(screen.getByRole("status")).toHaveTextContent("กำลังโหลด");
    expect(await screen.findByText("เรื่องในคลัง")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "อ่านต่อ" }))
      .toHaveAttribute("href", "/read-comic/creator/resume-story/latest");
    fireEvent.click(screen.getByRole("button", { name: "ลบออกจากคลัง" }));
    await waitFor(() => expect(api.removeBookmark).toHaveBeenCalledWith("story-1"));
    await waitFor(() => expect(screen.queryByText("เรื่องในคลัง")).not.toBeInTheDocument());
  });

  it("redirects anonymous readers and supports retry after failure", async () => {
    vi.mocked(api.hasSession).mockReturnValue(false);
    render(<LibraryPage />);
    expect(replace).toHaveBeenCalledWith("/login?next=%2Flibrary");
  });

  it("keeps a hidden bookmark unavailable without leaking moderation details or a reader link", async () => {
    vi.mocked(api.listLibrary).mockResolvedValue(page([{
      ...bookmark, isAvailable: false, unavailableReason: "CONTENT_UNAVAILABLE",
    }]));
    vi.mocked(api.listReadingProgress).mockResolvedValue(page([]));
    render(<LibraryPage />);
    expect(await screen.findByText("เนื้อหานี้ไม่พร้อมให้บริการ")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: bookmark.title })).not.toBeInTheDocument();
    expect(screen.queryByText(/moderator|SPAM|COPYRIGHT/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /อ่านต่อ/ })).not.toBeInTheDocument();
  });

  it("shows personal Home progress only for authenticated sessions", async () => {
    const { unmount } = render(<ContinueReading />);
    expect(await screen.findByText("เรื่องสำหรับอ่านต่อ")).toBeInTheDocument();
    unmount();
    vi.mocked(api.hasSession).mockReturnValue(false);
    render(<ContinueReading />);
    expect(screen.queryByText("เรื่องสำหรับอ่านต่อ")).not.toBeInTheDocument();
  });
});

describe("reader progress recording", () => {
  it("records once for Strict Mode duplicate calls and ignores write failure", async () => {
    await Promise.all([
      recordEpisodeProgress("story-1", "episode-1"),
      recordEpisodeProgress("story-1", "episode-1"),
    ]);
    await recordEpisodeProgress("story-1", "episode-1");
    expect(api.upsertReadingProgress).toHaveBeenCalledTimes(1);
    vi.mocked(api.upsertReadingProgress).mockRejectedValueOnce(new Error("offline"));
    await expect(recordEpisodeProgress("story-2", "episode-2")).resolves.toBeUndefined();
  });

  it("does not record for anonymous readers", async () => {
    vi.mocked(api.hasSession).mockReturnValue(false);
    await recordEpisodeProgress("story-1", "episode-1");
    expect(api.upsertReadingProgress).not.toHaveBeenCalled();
  });
});
