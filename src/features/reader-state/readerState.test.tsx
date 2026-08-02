import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryPage } from "./LibraryPage";
import { ContinueReading } from "./ContinueReading";
import { HistoryPage } from "./HistoryPage";
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function transitionSession(label: string) {
  api.storeTokens({
    accessToken: `access-${label}`, accessTokenExpiresAt: "2026-08-02T01:00:00Z",
    refreshToken: `refresh-${label}`, refreshTokenExpiresAt: "2026-08-03T00:00:00Z",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  resetProgressRecordingForTests();
  transitionSession("initial");
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
    await waitFor(() => expect(api.removeBookmark).toHaveBeenCalledWith("story-1", expect.any(AbortSignal)));
    await waitFor(() => expect(screen.queryByText("เรื่องในคลัง")).not.toBeInTheDocument());
  });

  it("redirects anonymous readers and supports retry after failure", async () => {
    vi.mocked(api.hasSession).mockReturnValue(false);
    render(<LibraryPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?next=%2Flibrary"));
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

  it("ignores User A Library success that arrives after logout and aborts both private requests", async () => {
    const userALibrary = deferred<Awaited<ReturnType<typeof api.listLibrary>>>();
    const userAProgress = deferred<Awaited<ReturnType<typeof api.listReadingProgress>>>();
    vi.mocked(api.listLibrary).mockReturnValueOnce(userALibrary.promise);
    vi.mocked(api.listReadingProgress).mockReturnValueOnce(userAProgress.promise);
    render(<LibraryPage />);
    await waitFor(() => expect(api.listLibrary).toHaveBeenCalledTimes(1));
    const librarySignal = vi.mocked(api.listLibrary).mock.calls[0][2];
    const progressSignal = vi.mocked(api.listReadingProgress).mock.calls[0][2];

    vi.mocked(api.hasSession).mockReturnValue(false);
    act(() => api.clearSession());
    expect(librarySignal?.aborted).toBe(true);
    expect(progressSignal?.aborted).toBe(true);
    await act(async () => {
      userALibrary.resolve(page([{ ...bookmark, title: "User A bookmark" }]));
      userAProgress.resolve(page([{ ...progress, storyTitle: "User A progress" }]));
      await Promise.resolve();
    });
    expect(screen.queryByText("User A bookmark")).not.toBeInTheDocument();
    expect(screen.queryByText("User A progress")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/login?next=%2Flibrary");
  });

  it("keeps User B bookmarks and Continue Reading when User A succeeds late", async () => {
    const userALibrary = deferred<Awaited<ReturnType<typeof api.listLibrary>>>();
    const userAProgress = deferred<Awaited<ReturnType<typeof api.listReadingProgress>>>();
    const userBBookmark = { ...bookmark, storyId: "story-b", title: "User B bookmark" };
    const userBProgress = { ...progress, storyId: "story-b", storyTitle: "User B progress" };
    vi.mocked(api.listLibrary).mockReturnValueOnce(userALibrary.promise).mockResolvedValueOnce(page([userBBookmark]));
    vi.mocked(api.listReadingProgress).mockReturnValueOnce(userAProgress.promise).mockResolvedValueOnce(page([userBProgress]));
    render(<LibraryPage />);
    await waitFor(() => expect(api.listLibrary).toHaveBeenCalledTimes(1));
    act(() => transitionSession("user-b"));
    expect(await screen.findByText("User B bookmark")).toBeInTheDocument();
    expect(screen.getByText("User B progress")).toBeInTheDocument();

    await act(async () => {
      userAProgress.resolve(page([{ ...progress, storyTitle: "User A progress" }]));
      userALibrary.resolve(page([{ ...bookmark, title: "User A bookmark" }]));
      await Promise.resolve();
    });
    expect(screen.getByText("User B bookmark")).toBeInTheDocument();
    expect(screen.getByText("User B progress")).toBeInTheDocument();
    expect(screen.queryByText("User A bookmark")).not.toBeInTheDocument();
    expect(screen.queryByText("User A progress")).not.toBeInTheDocument();
  });

  it("ignores User A late failure/finally and lets only User B retry own loading and error state", async () => {
    const userALibrary = deferred<Awaited<ReturnType<typeof api.listLibrary>>>();
    const userAProgress = deferred<Awaited<ReturnType<typeof api.listReadingProgress>>>();
    const userBBookmark = { ...bookmark, storyId: "story-b", title: "User B retry bookmark" };
    vi.mocked(api.listLibrary)
      .mockReturnValueOnce(userALibrary.promise)
      .mockRejectedValueOnce(new Error("User B temporary failure"))
      .mockResolvedValueOnce(page([userBBookmark]));
    vi.mocked(api.listReadingProgress)
      .mockReturnValueOnce(userAProgress.promise)
      .mockResolvedValueOnce(page([]))
      .mockResolvedValueOnce(page([]));
    render(<LibraryPage />);
    await waitFor(() => expect(api.listLibrary).toHaveBeenCalledTimes(1));
    act(() => transitionSession("user-b"));
    fireEvent.click(await screen.findByRole("button"));
    expect(await screen.findByText("User B retry bookmark")).toBeInTheDocument();

    await act(async () => {
      userALibrary.reject(new Error("User A late failure"));
      userAProgress.resolve(page([]));
      await Promise.resolve();
    });
    expect(screen.getByText("User B retry bookmark")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(api.listLibrary).toHaveBeenCalledTimes(3);
  });

  it("clears private rows and redirects on a terminal Library 401", async () => {
    vi.mocked(api.listLibrary).mockRejectedValueOnce(new api.ApiError(401));
    render(<LibraryPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?next=%2Flibrary"));
    expect(screen.queryByText(bookmark.title)).not.toBeInTheDocument();
    expect(screen.queryByText(progress.storyTitle)).not.toBeInTheDocument();
  });

  it("ignores a User A bookmark-removal completion after User B replaces the Library", async () => {
    const removal = deferred<void>();
    const userBBookmark = { ...bookmark, title: "User B same-story bookmark" };
    vi.mocked(api.removeBookmark).mockReturnValueOnce(removal.promise);
    vi.mocked(api.listLibrary).mockResolvedValueOnce(page([bookmark])).mockResolvedValueOnce(page([userBBookmark]));
    render(<LibraryPage />);
    expect(await screen.findByText(bookmark.title)).toBeInTheDocument();
    const removeButton = screen.getAllByRole("button").find((button) =>
      !["Like", "Follow"].includes(button.textContent ?? ""));
    fireEvent.click(removeButton!);
    act(() => transitionSession("user-b"));
    expect(await screen.findByText(userBBookmark.title)).toBeInTheDocument();
    await act(async () => {
      removal.resolve(undefined);
      await Promise.resolve();
    });
    expect(screen.getByText(userBBookmark.title)).toBeInTheDocument();
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

  it("does not let User A suppress User B for the same Story and Episode", async () => {
    await recordEpisodeProgress("same-story", "same-episode");
    act(() => transitionSession("user-b"));
    await recordEpisodeProgress("same-story", "same-episode");
    expect(api.upsertReadingProgress).toHaveBeenCalledTimes(2);
  });

  it("does not let User A's in-flight write suppress User B for the same Story and Episode", async () => {
    const userAWrite = deferred<typeof progress>();
    vi.mocked(api.upsertReadingProgress).mockReturnValueOnce(userAWrite.promise).mockResolvedValueOnce(progress);
    const pendingUserA = recordEpisodeProgress("same-story", "same-episode");
    act(() => transitionSession("user-b"));
    const pendingUserB = recordEpisodeProgress("same-story", "same-episode");
    await pendingUserB;
    expect(api.upsertReadingProgress).toHaveBeenCalledTimes(2);
    userAWrite.resolve(progress);
    await pendingUserA;
  });

  it("invalidates dedupe state on logout, terminal 401, and same-user re-login", async () => {
    await recordEpisodeProgress("same-story", "same-episode");
    act(() => api.clearSession());
    vi.mocked(api.hasSession).mockReturnValue(false);
    await recordEpisodeProgress("same-story", "same-episode");
    expect(api.upsertReadingProgress).toHaveBeenCalledTimes(1);

    vi.mocked(api.hasSession).mockReturnValue(true);
    act(() => transitionSession("same-user-relogin"));
    await recordEpisodeProgress("same-story", "same-episode");
    vi.mocked(api.upsertReadingProgress).mockImplementationOnce(async () => {
      api.clearSession();
      throw new api.ApiError(401);
    });
    await recordEpisodeProgress("terminal-story", "terminal-episode");
    act(() => transitionSession("after-terminal-401"));
    await recordEpisodeProgress("same-story", "same-episode");
    expect(api.upsertReadingProgress).toHaveBeenCalledTimes(4);
  });
});

describe("real Reading History", () => {
  it("redirects anonymous readers to the exact return URL", () => {
    vi.mocked(api.hasSession).mockReturnValue(false);
    render(<HistoryPage />);
    expect(replace).toHaveBeenCalledWith("/login?next=%2Fhistory");
    expect(api.listReadingProgress).not.toHaveBeenCalled();
  });

  it("renders server-confirmed progress with bounded pagination and canonical routes", async () => {
    vi.mocked(api.listReadingProgress).mockResolvedValue({
      ...page([progress]), totalItems: 21, totalPages: 2, hasNextPage: true,
    });
    render(<HistoryPage />);
    expect(await screen.findByRole("heading", { name: "Reading History" })).toBeInTheDocument();
    expect(screen.getByText(/latest episode read for each Story/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue reading" }))
      .toHaveAttribute("href", "/read-comic/creator/resume-story/latest");
    expect(api.listReadingProgress).toHaveBeenCalledWith(1, 20);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(api.listReadingProgress).toHaveBeenLastCalledWith(2, 20));
  });

  it("supports empty and retry states without importing mock data", async () => {
    vi.mocked(api.listReadingProgress).mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(page([]));
    render(<HistoryPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText(/no available reading history/i)).toBeInTheDocument();
  });

  it("clears private rows before refetching after a session identity change", async () => {
    vi.mocked(api.listReadingProgress)
      .mockResolvedValueOnce(page([progress]))
      .mockResolvedValueOnce(page([]));
    render(<HistoryPage />);
    expect(await screen.findByText(progress.storyTitle)).toBeInTheDocument();
    window.dispatchEvent(new Event("novelverse:session-changed"));
    await waitFor(() => expect(screen.queryByText(progress.storyTitle)).not.toBeInTheDocument());
    expect(await screen.findByText(/no available reading history/i)).toBeInTheDocument();
  });

  it("clears Home Continue Reading across logout and User A to User B changes", async () => {
    vi.mocked(api.listReadingProgress)
      .mockResolvedValueOnce(page([progress]))
      .mockResolvedValueOnce(page([]));
    render(<ContinueReading />);
    expect(await screen.findByText(progress.storyTitle)).toBeInTheDocument();
    window.dispatchEvent(new Event("novelverse:session-changed"));
    await waitFor(() => expect(screen.queryByText(progress.storyTitle)).not.toBeInTheDocument());
    await waitFor(() => expect(api.listReadingProgress).toHaveBeenCalledTimes(2));
    vi.mocked(api.hasSession).mockReturnValue(false);
    window.dispatchEvent(new Event("novelverse:session-changed"));
    expect(screen.queryByText(progress.storyTitle)).not.toBeInTheDocument();
  });
});
