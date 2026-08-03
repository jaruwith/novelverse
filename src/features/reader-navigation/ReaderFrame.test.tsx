import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReaderFrame } from "./ReaderFrame";
import { ReaderNavigationShell } from "./ReaderNavigationShell";
import * as api from "@/features/novel-editor/api";
import { recordEpisodeProgress } from "@/features/reader-state/progress";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/features/novel-editor/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/novel-editor/api")>(),
  getPublicEpisodeNavigation: vi.fn(),
}));
vi.mock("@/features/reader-state/progress", () => ({ recordEpisodeProgress: vi.fn() }));
vi.mock("@/features/community/DiscussionPanel", () => ({
  DiscussionPanel: ({ target }: { target: { kind: string; episodeSlug?: string } }) =>
    <section data-testid="discussion-panel">{target.kind}:{target.episodeSlug}</section>,
}));

const navigation = {
  story: { id: "11111111-1111-4111-8111-111111111111", title: "Thai Story", creatorSlug: "ผู้สร้าง",
    slug: "นิยาย", storyType: "NOVEL" as const },
  currentEpisode: { id: "22222222-2222-4222-8222-222222222222", title: "Middle", slug: "ตอน-2",
    episodeNumber: 2, sortOrder: 2, visibility: "PUBLIC" as const },
  previousEpisode: { title: "First", slug: "ตอน-1", episodeNumber: 1 },
  nextEpisode: { title: "Last", slug: "ตอน-3", episodeNumber: 3 },
};
const slugs = { creatorSlug: "ผู้สร้าง", storySlug: "นิยาย", episodeSlug: "ตอน-2" };

function Frame({ load = vi.fn().mockResolvedValue({ episodeId: navigation.currentEpisode.id }) }) {
  return <ReaderFrame slugs={slugs} storyType="NOVEL" loadContent={load}
    episodeId={(content: { episodeId: string }) => content.episodeId}
    renderContent={() => <article>Readable content</article>}
    renderReport={() => <button>Report</button>} />;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getPublicEpisodeNavigation).mockResolvedValue(navigation);
});

describe("mixed Reader Navigation state", () => {
  it("renders matched content/navigation and records progress only after both succeed", async () => {
    render(<Frame />);
    expect(await screen.findByText("Readable content")).toBeInTheDocument();
    expect(screen.getByTestId("discussion-panel")).toHaveTextContent("EPISODE:");
    expect(await screen.findByRole("heading", { name: "Middle" })).toHaveFocus();
    await waitFor(() => expect(recordEpisodeProgress).toHaveBeenCalledWith(
      navigation.story.id, navigation.currentEpisode.id, expect.any(AbortSignal)));
    expect(screen.getAllByRole("link", { name: /Previous: First/ })[0]).toHaveAttribute(
      "href", "/read-novel/%E0%B8%9C%E0%B8%B9%E0%B9%89%E0%B8%AA%E0%B8%A3%E0%B9%89%E0%B8%B2%E0%B8%87/%E0%B8%99%E0%B8%B4%E0%B8%A2%E0%B8%B2%E0%B8%A2/%E0%B8%95%E0%B8%AD%E0%B8%99-1");
  });

  it("keeps content readable on transient navigation failure and retries without fabricating links", async () => {
    vi.mocked(api.getPublicEpisodeNavigation)
      .mockRejectedValueOnce(new api.ApiError(504))
      .mockResolvedValueOnce(navigation);
    render(<Frame />);
    expect(await screen.findByText("Readable content")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Retry navigation" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Previous/ })).not.toBeInTheDocument();
    expect(recordEpisodeProgress).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry navigation" }));
    expect(await screen.findByRole("heading", { name: "Middle" })).toBeInTheDocument();
    await waitFor(() => expect(recordEpisodeProgress).toHaveBeenCalledTimes(1));
  });

  it.each([
    ["navigation 404", () => vi.mocked(api.getPublicEpisodeNavigation).mockRejectedValue(new api.ApiError(404)), navigation.currentEpisode.id],
    ["Episode ID mismatch", () => undefined, "33333333-3333-4333-8333-333333333333"],
  ])("conceals the full reader on %s and never records progress", async (_name, setup, contentId) => {
    setup();
    render(<Frame load={vi.fn().mockResolvedValue({ episodeId: contentId })} />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("Readable content")).not.toBeInTheDocument();
    expect(recordEpisodeProgress).not.toHaveBeenCalled();
  });

  it("aborts stale content and navigation when the route unmounts", async () => {
    let contentSignal: AbortSignal | undefined;
    const load = vi.fn((signal: AbortSignal) => {
      contentSignal = signal;
      return new Promise<{ episodeId: string }>(() => undefined);
    });
    const { unmount } = render(<Frame load={load} />);
    await waitFor(() => expect(load).toHaveBeenCalled());
    const navigationSignal = vi.mocked(api.getPublicEpisodeNavigation).mock.calls[0][3];
    unmount();
    expect(contentSignal?.aborted).toBe(true);
    expect(navigationSignal?.aborted).toBe(true);
    expect(recordEpisodeProgress).not.toHaveBeenCalled();
  });
});

describe("shared shell boundaries and keyboard", () => {
  it.each([
    ["first", null, navigation.nextEpisode, /Previous unavailable/],
    ["last", navigation.previousEpisode, null, /Next unavailable/],
    ["single", null, null, /only available episode/],
  ])("renders the %s boundary without treating it as an error", async (_name, previous, next, message) => {
    render(<ReaderNavigationShell navigation={{ ...navigation, previousEpisode: previous, nextEpisode: next }}
      navigationState="ready" retryNavigation={vi.fn()}><p>Body</p></ReaderNavigationShell>);
    expect(screen.getAllByText(message).length).toBeGreaterThan(0);
  });

  it("keeps UNLISTED direct-only and exposes no neighbor links", () => {
    render(<ReaderNavigationShell navigation={{ ...navigation,
      currentEpisode: { ...navigation.currentEpisode, visibility: "UNLISTED" },
      previousEpisode: null, nextEpisode: null }} navigationState="ready" retryNavigation={vi.fn()}>
      <p>Body</p></ReaderNavigationShell>);
    expect(screen.getAllByText(/direct link only/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /Previous:|Next:/ })).not.toBeInTheDocument();
  });

  it("navigates with unmodified arrows but ignores form controls, composition, modifiers, and absent neighbors", () => {
    const { rerender } = render(<ReaderNavigationShell navigation={navigation} navigationState="ready"
      retryNavigation={vi.fn()}><input aria-label="Editor" /></ReaderNavigationShell>);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(push).toHaveBeenCalledWith(expect.stringContaining("%E0%B8%95%E0%B8%AD%E0%B8%99-3"));
    push.mockClear();
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Editor" }), { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "ArrowLeft", ctrlKey: true });
    fireEvent.keyDown(window, { key: "ArrowLeft", isComposing: true });
    expect(push).not.toHaveBeenCalled();
    rerender(<ReaderNavigationShell navigation={{ ...navigation, previousEpisode: null, nextEpisode: null }}
      navigationState="ready" retryNavigation={vi.fn()}><p>Body</p></ReaderNavigationShell>);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(push).not.toHaveBeenCalled();
  });

  it("prevents default only when an available neighbor navigation fires", () => {
    const { rerender } = render(<ReaderNavigationShell navigation={navigation} navigationState="ready"
      retryNavigation={vi.fn()}><p>Body</p></ReaderNavigationShell>);
    const navigated = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true });
    fireEvent(window, navigated);
    expect(navigated.defaultPrevented).toBe(true);
    expect(push).toHaveBeenCalledTimes(1);

    rerender(<ReaderNavigationShell navigation={{ ...navigation, previousEpisode: null }} navigationState="ready"
      retryNavigation={vi.fn()}><p>Body</p></ReaderNavigationShell>);
    const firstBoundary = new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true });
    fireEvent(window, firstBoundary);
    expect(firstBoundary.defaultPrevented).toBe(false);

    rerender(<ReaderNavigationShell navigation={{ ...navigation, nextEpisode: null }} navigationState="ready"
      retryNavigation={vi.fn()}><p>Body</p></ReaderNavigationShell>);
    const lastBoundary = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true });
    fireEvent(window, lastBoundary);
    expect(lastBoundary.defaultPrevented).toBe(false);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("ignores reader arrows anywhere inside Community controls and dialogs", () => {
    render(<ReaderNavigationShell navigation={navigation} navigationState="ready" retryNavigation={vi.fn()}>
      <section data-community-panel><select aria-label="Comment sort"><option>Oldest</option></select>
        <button type="button">Reveal spoiler</button><div role="dialog"><button>Cancel delete</button></div></section>
    </ReaderNavigationShell>);
    fireEvent.keyDown(screen.getByLabelText("Comment sort"), { key: "ArrowRight" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Reveal spoiler" }), { key: "ArrowLeft" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Cancel delete" }), { key: "ArrowRight" });
    expect(push).not.toHaveBeenCalled();
  });
});
