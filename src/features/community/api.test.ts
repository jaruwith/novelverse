import { beforeEach, describe, expect, it, vi } from "vitest";
import * as shared from "@/features/novel-editor/api";
import {
  communityRootPath, createReply, createRootComment, deleteComment, editComment,
  listReplies, listRootComments, reportComment, setCommentLike,
} from "./api";

vi.mock("@/features/novel-editor/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/novel-editor/api")>(), apiRequest: vi.fn(),
}));

const rootId = "11111111-1111-4111-8111-111111111111";
const replyId = "22222222-2222-4222-8222-222222222222";
const target = { kind: "STORY" as const, creatorSlug: "ผู้/สร้าง", storySlug: "นิยาย ไทย" };
const episode = { kind: "EPISODE" as const, creatorSlug: "ผู้/สร้าง", storySlug: "นิยาย ไทย", episodeSlug: "ตอน/๑" };
const comment = (id = rootId, parentCommentId: string | null = null) => ({
  id, parentCommentId, body: "plain <text>", isSpoiler: false, isTombstone: false,
  author: { displayName: "Member", creatorSlug: null, isCreator: false },
  createdAt: "2026-08-03T01:00:00Z", updatedAt: "2026-08-03T01:00:00Z", editedAt: null,
  deletedAt: null, isOwnedByViewer: true, canEdit: true, canDelete: true,
  editTag: `"comment-${id}-v0"`, likeCount: 0, isLikedByViewer: false, canLike: false, replyCount: 0,
});
const response = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), init);

beforeEach(() => vi.clearAllMocks());

describe("Community shared API client", () => {
  it("single-encodes raw Story/Episode slugs and binds keyset queries", async () => {
    vi.mocked(shared.apiRequest).mockResolvedValueOnce(response({ target: { ...target, episodeSlug: null }, items: [],
      nextCursor: null, hasMore: false, sort: "NEWEST", pageSize: 20 }));
    await listRootComments(target, "NEWEST", "cursor/value");
    expect(shared.apiRequest).toHaveBeenCalledWith(
      "/api/v1/stories/%E0%B8%9C%E0%B8%B9%E0%B9%89%2F%E0%B8%AA%E0%B8%A3%E0%B9%89%E0%B8%B2%E0%B8%87/%E0%B8%99%E0%B8%B4%E0%B8%A2%E0%B8%B2%E0%B8%A2%20%E0%B9%84%E0%B8%97%E0%B8%A2/comments?sort=NEWEST&pageSize=20&cursor=cursor%2Fvalue",
      expect.objectContaining({ cache: "no-store" }));
    expect(communityRootPath(episode)).toContain("episodes/%E0%B8%95%E0%B8%AD%E0%B8%99%2F%E0%B9%91/comments");
  });

  it("sends only approved create fields and preserves idempotency/replay metadata", async () => {
    vi.mocked(shared.apiRequest).mockResolvedValue(response(comment(), { status: 201,
      headers: { ETag: `"comment-${rootId}-v0"`, "Idempotent-Replay": "false" } }));
    const result = await createRootComment(target, { body: "ไทย🙂", isSpoiler: true }, "key-1");
    const init = vi.mocked(shared.apiRequest).mock.calls[0][1]!;
    expect(new Headers(init.headers).get("Idempotency-Key")).toBe("key-1");
    expect(JSON.parse(init.body as string)).toEqual({ body: "ไทย🙂", isSpoiler: true });
    expect(init.body as string).not.toMatch(/userId|actor/i);
    expect(result.replayed).toBe(false);
  });

  it("parses Replies and sends supplied If-Match for edit and delete", async () => {
    vi.mocked(shared.apiRequest)
      .mockResolvedValueOnce(response({ target: { ...target, episodeSlug: null }, items: [comment(replyId, rootId)],
        nextCursor: null, hasMore: false, sort: "OLDEST", pageSize: 20 }))
      .mockResolvedValueOnce(response(comment(replyId, rootId), { status: 201,
        headers: { ETag: `"comment-${replyId}-v0"`, "Idempotent-Replay": "false" } }))
      .mockResolvedValueOnce(response(comment(replyId, rootId), { headers: { ETag: `"comment-${replyId}-v0"` } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect((await listReplies(target, rootId, null)).items[0].parentCommentId).toBe(rootId);
    await createReply(target, rootId, { body: "reply", isSpoiler: false }, "reply-key");
    await editComment(replyId, rootId, { body: "edited", isSpoiler: false }, `"comment-${replyId}-v0"`);
    await deleteComment(replyId, `"comment-${replyId}-v0"`);
    expect(new Headers(vi.mocked(shared.apiRequest).mock.calls[1][1]?.headers).get("Idempotency-Key"))
      .toBe("reply-key");
    expect(new Headers(vi.mocked(shared.apiRequest).mock.calls[2][1]?.headers).get("If-Match"))
      .toBe(`"comment-${replyId}-v0"`);
    expect(new Headers(vi.mocked(shared.apiRequest).mock.calls[3][1]?.headers).get("If-Match"))
      .toBe(`"comment-${replyId}-v0"`);
  });

  it("rejects contradictory ETag and malformed replay markers", async () => {
    vi.mocked(shared.apiRequest)
      .mockResolvedValueOnce(response(comment(), { status: 201,
        headers: { ETag: '"wrong"', "Idempotent-Replay": "false" } }))
      .mockResolvedValueOnce(response(comment(), { status: 200,
        headers: { ETag: `"comment-${rootId}-v0"`, "Idempotent-Replay": "invalid" } }))
      .mockResolvedValueOnce(response(comment(), { status: 200,
        headers: { "Idempotent-Replay": "false" } }));
    await expect(createRootComment(target, { body: "a", isSpoiler: false }, "key-a")).rejects.toThrow(/tags/);
    await expect(createRootComment(target, { body: "a", isSpoiler: false }, "key-b")).rejects.toThrow(/replay/);
    await expect(createRootComment(target, { body: "a", isSpoiler: false }, "key-c")).rejects.toThrow(/tags/);
  });

  it("uses exact Like/Unlike and Comment report routes without actor fields", async () => {
    vi.mocked(shared.apiRequest)
      .mockResolvedValueOnce(response({ commentId: rootId, likeCount: 1, isLikedByViewer: true, canLike: true }))
      .mockResolvedValueOnce(response({ commentId: rootId, likeCount: 0, isLikedByViewer: false, canLike: true }))
      .mockResolvedValueOnce(response({ id: replyId, status: "OPEN", createdAt: "2026-08-03T03:00:00Z" }, { status: 201 }));
    await setCommentLike(rootId, true);
    await setCommentLike(rootId, false);
    await reportComment(rootId, "SPAM", "plain evidence note");
    expect(shared.apiRequest).toHaveBeenNthCalledWith(1, `/api/v1/comments/${rootId}/like`,
      expect.objectContaining({ method: "PUT", cache: "no-store" }));
    expect(shared.apiRequest).toHaveBeenNthCalledWith(2, `/api/v1/comments/${rootId}/like`,
      expect.objectContaining({ method: "DELETE", cache: "no-store" }));
    const reportBody = JSON.parse(vi.mocked(shared.apiRequest).mock.calls[2][1]!.body as string);
    expect(reportBody).toEqual({ reason: "SPAM", comment: "plain evidence note" });
    expect(reportBody).not.toHaveProperty("userId");
  });
});
