import { describe, expect, it } from "vitest";
import { parseCreatorEpisodeNavigationResponse } from "./types";

const valid = (storyType: "NOVEL" | "COMIC" | "VIDEO" = "NOVEL") => ({
  story: { id: "11111111-1111-4111-8111-111111111111", title: "เรื่องไทย", creatorSlug: "ผู้สร้าง",
    slug: "นิยาย", storyType },
  currentEpisode: { id: "22222222-2222-4222-8222-222222222222", title: "ตอนหนึ่ง", slug: "ตอน-๑",
    episodeNumber: 1, sortOrder: 10, visibility: "PUBLIC" },
  previousEpisode: null,
  nextEpisode: { title: "Episode Two", slug: "episode-two", episodeNumber: 2 },
});

describe("Episode navigation contract", () => {
  it.each(["NOVEL", "COMIC", "VIDEO"] as const)("accepts a valid %s response", (type) => {
    expect(parseCreatorEpisodeNavigationResponse(valid(type)).story.storyType).toBe(type);
  });

  it("accepts nullable neighbors and PUBLIC or UNLISTED current visibility", () => {
    const response = valid();
    response.currentEpisode.visibility = "UNLISTED";
    response.nextEpisode = null as never;
    expect(parseCreatorEpisodeNavigationResponse(response).nextEpisode).toBeNull();
  });

  it.each([
    ["unsupported StoryType", { story: { storyType: "AUDIO" } }],
    ["unsupported visibility", { currentEpisode: { visibility: "HIDDEN" } }],
    ["missing routing slug", { story: { creatorSlug: "" } }],
    ["malformed identifier", { currentEpisode: { id: "not-a-guid" } }],
  ])("rejects %s", (_name, change) => {
    const response = valid() as unknown as Record<string, Record<string, unknown>>;
    for (const [key, value] of Object.entries(change)) Object.assign(response[key], value);
    expect(() => parseCreatorEpisodeNavigationResponse(response)).toThrow(/approved contract/);
  });
});
