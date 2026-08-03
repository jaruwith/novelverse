import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

describe("Community production integration boundaries", () => {
  it("integrates Story Detail and the shared ReaderFrame without mock fallback", () => {
    const story = source("src/features/public-discovery/StoryDetail.tsx");
    const reader = source("src/features/reader-navigation/ReaderFrame.tsx");
    expect(story).toMatch(/DiscussionPanel[\s\S]*kind: "STORY"/);
    expect(reader).toMatch(/DiscussionPanel[\s\S]*kind: "EPISODE"/);
    expect(`${story}\n${reader}`).not.toMatch(/mockData|CommentList.*components\/Content|mock fallback/i);
  });

  it.each([
    "src/app/read-novel/[creatorSlug]/[storySlug]/[episodeSlug]/page.tsx",
    "src/app/read-comic/[creatorSlug]/[storySlug]/[episodeSlug]/page.tsx",
    "src/app/watch-video/[creatorSlug]/[storySlug]/[episodeSlug]/page.tsx",
  ])("routes %s through the shared ReaderFrame", (file) => {
    expect(source(file)).toMatch(/ReaderFrame/);
  });

  it("keeps Community payloads out of browser persistence and unsafe rendering", () => {
    const files = fs.readdirSync(path.join(process.cwd(), "src/features/community"))
      .filter((file) => /\.(ts|tsx)$/.test(file) && !file.endsWith(".test.ts") && !file.endsWith(".test.tsx"));
    const implementation = files.map((file) => source(`src/features/community/${file}`)).join("\n");
    expect(implementation).not.toMatch(/localStorage|sessionStorage|indexedDB|caches\.|serviceWorker|dangerouslySetInnerHTML/);
    expect(implementation).not.toMatch(/authorUserId|viewerUserId/);
  });

  it("retires reachable legacy mock Comment entry points without deleting unrelated mock fixtures", () => {
    const novelLegacy = source("src/app/(public)/story/[slug]/chapter/[chapterNumber]/page.tsx");
    const comicLegacy = source("src/app/(public)/comic/[slug]/chapter/[chapterNumber]/page.tsx");
    const admin = source("src/app/admin/comments/page.tsx");
    expect(novelLegacy).not.toMatch(/<CommentList/);
    expect(comicLegacy).toMatch(/const CommentList = \(\) => null/);
    expect(admin).toMatch(/legacy mock Comment queue is retired/);
    expect(fs.existsSync(path.join(process.cwd(), "src/lib/mockData.ts"))).toBe(true);
  });
});
