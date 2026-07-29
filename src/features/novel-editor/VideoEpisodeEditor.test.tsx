import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getEpisode: vi.fn(), getVideoContent: vi.fn(),
  replaceVideoContent: vi.fn(), publishEpisode: vi.fn(),
}));
vi.mock("./api", async (original) => ({ ...await original<typeof import("./api")>(), ...api }));
import { VideoEpisodeEditor } from "./VideoEpisodeEditor";

beforeEach(() => {
  api.getEpisode.mockResolvedValue({ id: "e", title: "Video Episode", status: "DRAFT" });
  api.getVideoContent.mockResolvedValue(null);
  api.replaceVideoContent.mockResolvedValue({
    id: "v", episodeId: "e", provider: "YOUTUBE", videoId: "dQw4w9WgXcQ",
    originalUrl: "https://youtu.be/dQw4w9WgXcQ", title: "Demo",
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    durationSeconds: null, createdAt: "x", updatedAt: "x",
  });
});

describe("VideoEpisodeEditor", () => {
  it("validates, saves, and previews backend-derived YouTube metadata", async () => {
    render(<VideoEpisodeEditor storyId="s" episodeId="e" />);
    const input = await screen.findByLabelText("Video URL");
    fireEvent.change(input, { target: { value: "https://youtube.com/shorts/dQw4w9WgXcQ" } });
    expect(screen.getByRole("button", { name: "บันทึก" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "https://youtu.be/dQw4w9WgXcQ" } });
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));
    await waitFor(() => expect(api.replaceVideoContent).toHaveBeenCalledWith(
      "s", "e", "https://youtu.be/dQw4w9WgXcQ", null,
    ));
    expect(await screen.findByText("Video ID: dQw4w9WgXcQ")).toBeInTheDocument();
  });
});
