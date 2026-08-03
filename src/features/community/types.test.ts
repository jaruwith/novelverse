import { describe, expect, it } from "vitest";
import { CommunityContractError, parseComment, parseCommentPage, parseCommunityTarget } from "./types";

const rootId = "11111111-1111-4111-8111-111111111111";
const replyId = "22222222-2222-4222-8222-222222222222";
const target = { kind: "STORY" as const, creatorSlug: "ผู้สร้าง", storySlug: "นิยาย-หนึ่ง" };

function active(overrides: Record<string, unknown> = {}) {
  return {
    id: rootId, parentCommentId: null, body: "สวัสดี\n🙂 <not-markup>", isSpoiler: false,
    isTombstone: false, author: { displayName: "NovelVerse member", creatorSlug: null, isCreator: false },
    createdAt: "2026-08-03T01:00:00Z", updatedAt: "2026-08-03T01:00:00Z",
    editedAt: null, deletedAt: null, isOwnedByViewer: false, canEdit: false, canDelete: false,
    editTag: null, likeCount: 0, isLikedByViewer: false, canLike: false, replyCount: 0, ...overrides,
  };
}

describe("Community runtime contract parser", () => {
  it("accepts anonymous, hidden-profile owner, Reply, creator badge, spoiler, and tombstone projections", () => {
    expect(parseComment(active(), null).isOwnedByViewer).toBe(false);
    const owner = parseComment(active({ isOwnedByViewer: true, canEdit: true, canDelete: true,
      editTag: `"comment-${rootId}-v4"`, isSpoiler: true,
      author: { displayName: "NovelVerse member", creatorSlug: null, isCreator: true } }), null);
    expect(owner).toMatchObject({ canEdit: true, canDelete: true, isSpoiler: true,
      author: { displayName: "NovelVerse member", isCreator: true } });
    expect(parseComment(active({ id: replyId, parentCommentId: rootId }), rootId).parentCommentId).toBe(rootId);
    expect(parseComment(active({ body: null, author: null, isTombstone: true,
      deletedAt: "2026-08-03T02:00:00Z" }), null).isTombstone).toBe(true);
  });

  it.each([
    { canEdit: true },
    { canDelete: true },
    { editTag: `"comment-${rootId}-v1"` },
    { isOwnedByViewer: true, editTag: `"comment-${rootId}-v1"` },
    { isOwnedByViewer: true, canEdit: true, editTag: null },
    { isTombstone: true, body: "leak", author: null },
    { isTombstone: true, body: null, author: null, isOwnedByViewer: true },
    { body: null },
    { author: null },
    { id: "not-a-uuid" },
    { createdAt: "not-a-date" },
    { deletedAt: "2026-08-03T02:00:00Z" },
    { authorUserId: rootId },
    { isOwnedByViewer: true, canLike: true },
    { isTombstone: true, body: null, author: null, deletedAt: "2026-08-03T02:00:00Z", likeCount: 1 },
  ])("rejects contradictory or malformed projection %#", (override) => {
    expect(() => parseComment(active(override), null)).toThrow(CommunityContractError);
  });

  it("rejects anonymous interactive Like capability", () => {
    expect(() => parseComment(active({ canLike: true }), null, false)).toThrow(CommunityContractError);
    expect(() => parseComment(active({ isLikedByViewer: true }), null, false)).toThrow(CommunityContractError);
    expect(parseComment(active({ likeCount: 12 }), null, false).likeCount).toBe(12);
  });

  it("accepts an authenticated existing Like that is temporarily not mutable", () => {
    expect(parseComment(active({ likeCount: 1, isLikedByViewer: true, canLike: false }), null, true))
      .toMatchObject({ likeCount: 1, isLikedByViewer: true, canLike: false });
  });

  it("rejects cross-parent Replies and root/Reply count contradictions", () => {
    expect(() => parseComment(active({ id: replyId, parentCommentId: rootId }), null)).toThrow();
    expect(() => parseComment(active({ id: replyId, parentCommentId: rootId, replyCount: 1 }), rootId)).toThrow();
  });

  it("strictly parses target, sort, cursor, page size, and duplicate IDs", () => {
    const page = parseCommentPage({ target: { ...target, episodeSlug: null }, items: [active()],
      nextCursor: "opaque", hasMore: true, sort: "OLDEST", pageSize: 20 }, target, "OLDEST", null, 20);
    expect(page.nextCursor).toBe("opaque");
    expect(parseCommunityTarget({ kind: "EPISODE", creatorSlug: "ผู้สร้าง", storySlug: "เรื่อง",
      episodeSlug: "ตอน-๑" })).toMatchObject({ kind: "EPISODE", episodeSlug: "ตอน-๑" });
    expect(() => parseCommentPage({ target: { ...target, episodeSlug: null }, items: [active(), active()],
      nextCursor: null, hasMore: false, sort: "OLDEST", pageSize: 20 }, target, "OLDEST", null, 20)).toThrow();
    expect(() => parseCommentPage({ target: { ...target, episodeSlug: null }, items: [],
      nextCursor: null, hasMore: true, sort: "OLDEST", pageSize: 20 }, target, "OLDEST", null, 20)).toThrow();
    expect(() => parseCommentPage({ target: { ...target, episodeSlug: null }, items: [],
      nextCursor: null, hasMore: false, sort: "RANKED", pageSize: 20 }, target, "OLDEST", null, 20)).toThrow();
  });
});
