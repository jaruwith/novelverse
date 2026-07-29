import { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";

const api = vi.hoisted(() => ({
  getStory: vi.fn(),
  getEpisode: vi.fn(),
  getEpisodeContent: vi.fn(),
  listEpisodes: vi.fn(),
  updateEpisode: vi.fn(),
  replaceEpisodeContent: vi.fn(),
  publishEpisode: vi.fn(),
}));

vi.mock("./api", async (importOriginal) => {
  const original = await importOriginal<typeof import("./api")>();
  return { ...original, ...api };
});

import { useEpisodeEditor } from "./useEpisodeEditor";

const episode = {
  id: "episode-1", storyId: "story-1", title: "ตอนแรก", slug: "first", synopsis: null,
  status: "DRAFT", visibility: "PUBLIC", episodeNumber: 1, sortOrder: 1, wordCount: 3,
  publishedAt: null, archivedAt: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
};
const textBlock = { localKey: "text-1", type: "TEXT" as const, textContent: "เนื้อหา", mediaAssetId: null };

beforeEach(() => {
  api.getStory.mockResolvedValue({ id: "story-1", title: "เรื่องทดสอบ" });
  api.getEpisode.mockResolvedValue(episode);
  api.getEpisodeContent.mockResolvedValue({ episodeId: "episode-1", wordCount: 3, blocks: [textBlock] });
  api.listEpisodes.mockResolvedValue({ items: [episode] });
  api.updateEpisode.mockResolvedValue(episode);
  api.replaceEpisodeContent.mockResolvedValue(undefined);
  api.publishEpisode.mockResolvedValue({ ...episode, status: "PUBLISHED" });
});
afterEach(() => vi.useRealTimers());

async function loadEditor() {
  const hook = renderHook(() => useEpisodeEditor("story-1", "episode-1"));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe("useEpisodeEditor", () => {
  it("loads episode metadata, content, story, and episode navigation", async () => {
    const hook = await loadEditor();
    expect(hook.result.current.episode?.title).toBe("ตอนแรก");
    expect(hook.result.current.blocks).toEqual([textBlock]);
    expect(hook.result.current.story?.title).toBe("เรื่องทดสอบ");
    expect(hook.result.current.episodes).toHaveLength(1);
  });

  it("autosaves after the debounce and only reports saved after success", async () => {
    vi.useFakeTimers();
    const hook = renderHook(() => useEpisodeEditor("story-1", "episode-1"));
    await act(async () => { await Promise.resolve(); });
    act(() => hook.result.current.setMetadata("title", "ชื่อใหม่"));
    expect(hook.result.current.saveStatus).toBe("dirty");
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(api.updateEpisode).toHaveBeenCalledWith("story-1", "episode-1", {
      title: "ชื่อใหม่", slug: "first", episodeNumber: 1, sortOrder: 1,
      visibility: "PUBLIC", synopsis: null,
    });
    expect(api.replaceEpisodeContent).toHaveBeenCalled();
    expect(hook.result.current.saveStatus).toBe("saved");
  });

  it("reports saved in React Strict Mode after the development effect cycle", async () => {
    const hook = renderHook(() => useEpisodeEditor("story-1", "episode-1"), {
      wrapper: StrictMode,
    });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    act(() => hook.result.current.setMetadata("title", "Strict Mode title"));
    await act(async () => { await hook.result.current.save(); });
    expect(hook.result.current.saveStatus).toBe("saved");
  });

  it("retains content and exposes Problem Details when save fails", async () => {
    api.replaceEpisodeContent.mockRejectedValue(new ApiError(400, {
      title: "Validation failed",
      errors: { blocks: ["เนื้อหาไม่ถูกต้อง"] },
    }));
    const hook = await loadEditor();
    act(() => hook.result.current.setBlocks([{ ...textBlock, textContent: "ข้อความที่ยังอยู่" }]));
    await act(async () => { await hook.result.current.save(); });
    expect(hook.result.current.saveStatus).toBe("failed");
    expect(hook.result.current.message).toContain("เนื้อหาไม่ถูกต้อง");
    expect(hook.result.current.blocks[0]).toMatchObject({ textContent: "ข้อความที่ยังอยู่" });
  });

  it("saves before publishing and updates visible status", async () => {
    const order: string[] = [];
    api.updateEpisode.mockImplementation(async () => { order.push("metadata"); return episode; });
    api.replaceEpisodeContent.mockImplementation(async () => { order.push("content"); });
    api.publishEpisode.mockImplementation(async () => { order.push("publish"); return { ...episode, status: "PUBLISHED" }; });
    const hook = await loadEditor();
    await act(async () => { await hook.result.current.publish(); });
    expect(order).toEqual(["metadata", "content", "publish"]);
    expect(hook.result.current.episode?.status).toBe("PUBLISHED");
  });

  it("rejects publishing without non-empty text on the client", async () => {
    const hook = await loadEditor();
    act(() => hook.result.current.setBlocks([{ ...textBlock, textContent: "  " }]));
    await act(async () => { await hook.result.current.publish(); });
    expect(hook.result.current.message).toContain("อย่างน้อย 1 บล็อก");
    expect(api.publishEpisode).not.toHaveBeenCalled();
  });

  it("shows a Thai authentication failure", async () => {
    api.getEpisode.mockRejectedValue(new ApiError(401));
    const hook = await loadEditor();
    expect(hook.result.current.message).toContain("เข้าสู่ระบบ");
  });
});
