import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EditorBlock } from "./types";

const setBlocks = vi.fn();
const hookValue = {
  story: { id: "story-1", title: "เรื่องทดสอบ" },
  episode: { id: "episode-1", storyId: "story-1", title: "ตอนแรก", synopsis: "", status: "DRAFT" },
  episodes: [{ id: "episode-1", storyId: "story-1", title: "ตอนแรก", synopsis: "", status: "DRAFT" }],
  blocks: [] as EditorBlock[],
  loading: false,
  saveStatus: "clean" as const,
  message: "",
  publishing: false,
  setBlocks,
  setMetadata: vi.fn(),
  save: vi.fn(),
  publish: vi.fn(),
  hasUnsavedChanges: false,
};
vi.mock("./useEpisodeEditor", () => ({ useEpisodeEditor: () => hookValue }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { NovelEpisodeEditor } from "./NovelEpisodeEditor";

beforeEach(() => { setBlocks.mockClear(); hookValue.blocks = []; });

describe("NovelEpisodeEditor", () => {
  it("adds TEXT and DIVIDER blocks with the typed defaults", async () => {
    const user = userEvent.setup();
    render(<NovelEpisodeEditor storyId="story-1" episodeId="episode-1" />);
    await user.click(screen.getByText("＋ ข้อความ"));
    expect(setBlocks.mock.calls[0][0][0]).toMatchObject({ type: "TEXT", textContent: "", mediaAssetId: null });
    await user.click(screen.getByText("＋ เส้นคั่น"));
    expect(setBlocks.mock.calls[1][0][0]).toMatchObject({ type: "DIVIDER", textContent: null, mediaAssetId: null });
  });

  it("opens a native IMAGE picker restricted to JPEG, PNG, and WebP", async () => {
    const user = userEvent.setup();
    render(<NovelEpisodeEditor storyId="story-1" episodeId="episode-1" />);
    await user.click(screen.getByText("＋ รูปภาพ"));
    expect(screen.getByLabelText("เลือกรูปภาพ")).toHaveAttribute(
      "accept", "image/jpeg,image/png,image/webp",
    );
    expect(setBlocks).not.toHaveBeenCalled();
  });

  it("opens mobile episode navigation through an accessible button", async () => {
    const user = userEvent.setup();
    render(<NovelEpisodeEditor storyId="story-1" episodeId="episode-1" />);
    await user.click(screen.getByRole("button", { name: "ตอนทั้งหมด" }));
    expect(screen.getByRole("button", { name: "ปิดรายการตอน" })).toBeInTheDocument();
  });
});
