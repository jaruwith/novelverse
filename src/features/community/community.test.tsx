import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DiscussionPanel } from "./DiscussionPanel";
import { SessionRequestGuard } from "./useDiscussionController";
import * as communityApi from "./api";
import { ApiError, clearSession, storeTokens } from "@/features/novel-editor/api";
import type { CommentPage, CommentProjection } from "./types";

vi.mock("next/navigation", () => ({ usePathname: () => "/stories/creator/story" }));
vi.mock("./api", async (importOriginal) => ({
  ...await importOriginal<typeof import("./api")>(),
  listRootComments: vi.fn(), listReplies: vi.fn(), createRootComment: vi.fn(), createReply: vi.fn(),
  editComment: vi.fn(), deleteComment: vi.fn(), setCommentLike: vi.fn(), reportComment: vi.fn(),
  createIdempotencyKey: vi.fn(() => "secure-key"),
}));

const target = { kind: "STORY" as const, creatorSlug: "creator", storySlug: "story" };
const rootId = "11111111-1111-4111-8111-111111111111";
const replyId = "22222222-2222-4222-8222-222222222222";
function comment(overrides: Partial<CommentProjection> = {}): CommentProjection {
  return { id: rootId, parentCommentId: null, body: "สวัสดี\n&lt;b&gt;literal&lt;/b&gt;", isSpoiler: false,
    isTombstone: false, author: { displayName: "NovelVerse member", creatorSlug: null, isCreator: false },
    createdAt: "2026-08-03T01:00:00Z", updatedAt: "2026-08-03T01:00:00Z", editedAt: null,
    deletedAt: null, isOwnedByViewer: false, canEdit: false, canDelete: false, editTag: null,
    likeCount: 0, isLikedByViewer: false, canLike: false,
    replyCount: 0, ...overrides };
}
function page(items: CommentProjection[] = [], overrides: Partial<CommentPage> = {}): CommentPage {
  return { target, items, nextCursor: null, hasMore: false, sort: "OLDEST", pageSize: 20, ...overrides };
}
function signIn(label = "a") {
  storeTokens({ accessToken: `access-${label}`, accessTokenExpiresAt: "2026-09-01T00:00:00Z",
    refreshToken: `refresh-${label}`, refreshTokenExpiresAt: "2026-10-01T00:00:00Z" });
}

beforeEach(() => {
  vi.clearAllMocks();
  clearSession();
  vi.mocked(communityApi.listRootComments).mockResolvedValue(page());
  vi.mocked(communityApi.listReplies).mockResolvedValue(page([], { items: [] }));
  vi.mocked(communityApi.setCommentLike).mockResolvedValue({
    commentId: rootId, likeCount: 1, isLikedByViewer: true, canLike: true,
  });
  vi.mocked(communityApi.reportComment).mockResolvedValue({
    id: "99999999-9999-4999-8999-999999999999", status: "OPEN", createdAt: "2026-08-03T03:00:00Z",
  });
});

describe("DiscussionPanel capabilities and accessibility", () => {
  it("supports anonymous reads and safe sign-in gating without interpreting literal markup", async () => {
    vi.mocked(communityApi.listRootComments).mockResolvedValue(page([comment()]));
    render(<DiscussionPanel target={target} />);
    expect(await screen.findByText("สวัสดี", { exact: false })).toHaveTextContent("&lt;b&gt;literal&lt;/b&gt;");
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href", "/login?next=%2Fstories%2Fcreator%2Fstory");
    expect(screen.queryByRole("textbox", { name: "Write a Comment" })).not.toBeInTheDocument();
  });

  it("renders owner controls only from canEdit/canDelete and never from creator presentation", async () => {
    signIn();
    vi.mocked(communityApi.listRootComments).mockResolvedValue(page([
      comment({ author: { displayName: "NovelVerse member", creatorSlug: null, isCreator: false },
        isOwnedByViewer: true, canEdit: true, canDelete: true, editTag: `"comment-${rootId}-v1"` }),
      comment({ id: "33333333-3333-4333-8333-333333333333", body: "Creator non-owner",
        author: { displayName: "Creator", creatorSlug: "creator", isCreator: true } }),
    ]));
    render(<DiscussionPanel target={target} />);
    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getAllByText("Creator").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
  });

  it("keeps spoiler body out of the DOM/accessibility tree until keyboard reveal", async () => {
    vi.mocked(communityApi.listRootComments).mockResolvedValue(page([comment({ body: "secret spoiler", isSpoiler: true })]));
    render(<DiscussionPanel target={target} />);
    const reveal = await screen.findByRole("button", { name: "Reveal spoiler" });
    expect(screen.queryByText("secret spoiler")).not.toBeInTheDocument();
    reveal.focus(); fireEvent.keyDown(reveal, { key: "Enter" }); fireEvent.click(reveal);
    expect(screen.getByText("secret spoiler")).toBeInTheDocument();
    expect(reveal).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: "Hide spoiler" }));
    expect(screen.queryByText("secret spoiler")).not.toBeInTheDocument();
  });

  it("renders neutral tombstones without author, spoiler, or controls", async () => {
    vi.mocked(communityApi.listRootComments).mockResolvedValue(page([comment({ body: null, author: null,
      isTombstone: true, deletedAt: "2026-08-03T02:00:00Z" })]));
    render(<DiscussionPanel target={target} />);
    expect(await screen.findByText("Deleted Comment")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /spoiler|Edit|Delete/i })).not.toBeInTheDocument();
  });

  it("exposes bounded loading state through aria-busy", async () => {
    let resolveRoots!: (value: CommentPage) => void;
    vi.mocked(communityApi.listRootComments)
      .mockReturnValueOnce(new Promise((resolve) => { resolveRoots = resolve; }));
    render(<DiscussionPanel target={target} />);
    const discussion = screen.getByRole("region", { name: "Discussion" });
    expect(discussion).toHaveAttribute("aria-busy", "true");
    await act(async () => resolveRoots(page()));
    await waitFor(() => expect(discussion).toHaveAttribute("aria-busy", "false"));
  });

  it("loads bounded root pages with ID dedupe and preserves prior rows on failure", async () => {
    const second = comment({ id: "33333333-3333-4333-8333-333333333333", body: "second" });
    vi.mocked(communityApi.listRootComments)
      .mockResolvedValueOnce(page([comment()], { nextCursor: "next", hasMore: true }))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(page([comment(), second]));
    render(<DiscussionPanel target={target} />);
    await screen.findByText("สวัสดี", { exact: false });
    fireEvent.click(screen.getByRole("button", { name: "Load more Comments" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/temporarily unavailable/i);
    expect(screen.getByText("สวัสดี", { exact: false })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry Load More" }));
    expect(await screen.findByText("second")).toBeInTheDocument();
    expect(screen.getAllByText("สวัสดี", { exact: false })).toHaveLength(1);
    expect(communityApi.listRootComments).toHaveBeenNthCalledWith(2, target, "OLDEST", "next", expect.any(AbortSignal));
    expect(communityApi.listRootComments).toHaveBeenNthCalledWith(3, target, "OLDEST", "next", expect.any(AbortSignal));
  });

  it("creates only from the server response, suppresses duplicates, and changes keys with content", async () => {
    signIn();
    let resolveCreate!: (value: Awaited<ReturnType<typeof communityApi.createRootComment>>) => void;
    vi.mocked(communityApi.createRootComment).mockReturnValueOnce(new Promise((resolve) => { resolveCreate = resolve; }));
    render(<DiscussionPanel target={target} />);
    const textarea = await screen.findByRole("textbox", { name: "Write a Comment" });
    fireEvent.change(textarea, { target: { value: "ไทย🙂" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    fireEvent.click(screen.getByRole("button", { name: "Submitting…" }));
    expect(communityApi.createRootComment).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("server body")).not.toBeInTheDocument();
    await act(async () => resolveCreate({ comment: comment({ body: "server body", isOwnedByViewer: true,
      canEdit: true, canDelete: true, editTag: `"comment-${rootId}-v0"` }), replayed: false,
      etag: `"comment-${rootId}-v0"` }));
    expect(await screen.findByText("server body")).toBeInTheDocument();
    expect(document.getElementById(`comment-${rootId}`)).toHaveFocus();
  });

  it("reuses an uncertain create key and generates a new key for changed normalized content", async () => {
    signIn();
    vi.mocked(communityApi.createIdempotencyKey).mockReturnValueOnce("key-one").mockReturnValueOnce("key-two");
    vi.mocked(communityApi.createRootComment)
      .mockRejectedValueOnce(new ApiError(0, { detail: "uncertain" }))
      .mockRejectedValueOnce(new ApiError(413))
      .mockRejectedValueOnce(new ApiError(429, undefined, new Headers({ "Retry-After": "12" })));
    render(<DiscussionPanel target={target} />);
    const form = await screen.findByRole("form", { name: "Write a Comment" });
    const textarea = screen.getByRole("textbox", { name: "Write a Comment" });
    fireEvent.change(textarea, { target: { value: "same payload" } });
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent("uncertain");
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent(/too large/i);
    fireEvent.change(textarea, { target: { value: "changed payload" } });
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent(/after 12 seconds/i);
    const keys = vi.mocked(communityApi.createRootComment).mock.calls.map((call) => call[2]);
    expect(keys).toEqual(["key-one", "key-one", "key-two"]);
  });

  it.each([
    [400, { detail: "validation failed", errors: { body: ["Body is invalid."] } }, /Body is invalid/i],
    [403, undefined, /not currently eligible/i],
    [500, undefined, /confirmed Comments were preserved/i],
  ] as const)("preserves confirmed state and maps mutation status %s", async (status, problem, expected) => {
    signIn();
    vi.mocked(communityApi.listRootComments).mockResolvedValue(page([comment({ body: "confirmed" })]));
    vi.mocked(communityApi.createRootComment).mockRejectedValueOnce(new ApiError(status,
      problem ? { detail: problem.detail, errors: { body: [...problem.errors.body] } } : undefined));
    render(<DiscussionPanel target={target} />);
    fireEvent.change(await screen.findByRole("textbox", { name: "Write a Comment" }),
      { target: { value: "draft remains" } });
    fireEvent.submit(screen.getByRole("form", { name: "Write a Comment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
    expect(screen.getByText("confirmed")).toBeInTheDocument();
    expect(screen.getByDisplayValue("draft remains")).toBeInTheDocument();
  });

  it("reconciles one stale edit from server truth and keeps the last projection visible", async () => {
    signIn();
    const owner = comment({ body: "confirmed v0", isOwnedByViewer: true, canEdit: true,
      canDelete: true, editTag: `"comment-${rootId}-v0"` });
    const fresh = comment({ body: "confirmed v1", editedAt: "2026-08-03T02:00:00Z",
      isOwnedByViewer: true, canEdit: true, canDelete: true, editTag: `"comment-${rootId}-v1"` });
    vi.mocked(communityApi.listRootComments).mockResolvedValueOnce(page([owner])).mockResolvedValueOnce(page([fresh]));
    vi.mocked(communityApi.editComment).mockRejectedValueOnce(new ApiError(409));
    render(<DiscussionPanel target={target} />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Edit Comment" }), { target: { value: "stale body" } });
    fireEvent.submit(screen.getByRole("form", { name: "Edit Comment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/changed on the server/i);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("confirmed v1")).toBeInTheDocument();
    expect(communityApi.listRootComments).toHaveBeenCalledTimes(2);
  });

  it("loads one-level Replies, exposes no nested Reply action, and reconciles 204 deletion", async () => {
    signIn();
    const owned = comment({ replyCount: 1, isOwnedByViewer: true, canDelete: true,
      editTag: `"comment-${rootId}-v0"` });
    const reply = comment({ id: replyId, parentCommentId: rootId, body: "Reply body", isOwnedByViewer: true,
      canEdit: true, canDelete: true, editTag: `"comment-${replyId}-v0"` });
    vi.mocked(communityApi.listRootComments).mockResolvedValue(page([owned]));
    vi.mocked(communityApi.listReplies).mockResolvedValueOnce(page([reply], { items: [reply] }))
      .mockResolvedValueOnce(page([], { items: [] }));
    vi.mocked(communityApi.deleteComment).mockResolvedValue(undefined);
    render(<DiscussionPanel target={target} />);
    fireEvent.click(await screen.findByRole("button", { name: "View Replies" }));
    expect(await screen.findByText("Reply body")).toBeInTheDocument();
    const replyArticle = screen.getByLabelText(/Reply by/);
    expect(replyArticle.querySelector("button[aria-label='Reply']")).toBeNull();
    fireEvent.click(replyArticle.querySelector<HTMLButtonElement>("button:nth-of-type(2)")!);
    await screen.findByRole("dialog", { name: "Delete Comment permanently?" });
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    await waitFor(() => expect(communityApi.deleteComment).toHaveBeenCalledWith(
      replyId, `"comment-${replyId}-v0"`, expect.any(AbortSignal)));
    await waitFor(() => expect(screen.queryByText("Reply body")).not.toBeInTheDocument());
  });
});

describe("session request isolation", () => {
  it("invalidates deferred success, failure, and finally callbacks", async () => {
    const guard = new SessionRequestGuard();
    const request = guard.begin(1);
    const updates: string[] = [];
    const deferred = Promise.resolve().then(() => {
      if (guard.current(request, 1)) updates.push("success");
    }).catch(() => {
      if (guard.current(request, 1)) updates.push("failure");
    }).finally(() => {
      if (guard.current(request, 1)) updates.push("finally");
    });
    guard.invalidate();
    await deferred;
    expect(request.controller.signal.aborted).toBe(true);
    expect(updates).toEqual([]);
  });

  it("prevents User A pending create from entering User B UI and clears private controls synchronously", async () => {
    signIn("a");
    const owner = comment({ body: "A confirmed", isOwnedByViewer: true, canEdit: true, canDelete: true,
      editTag: `"comment-${rootId}-v0"` });
    vi.mocked(communityApi.listRootComments).mockResolvedValue(page([owner]));
    let resolveCreate!: (value: Awaited<ReturnType<typeof communityApi.createRootComment>>) => void;
    vi.mocked(communityApi.createRootComment).mockReturnValue(new Promise((resolve) => { resolveCreate = resolve; }));
    render(<DiscussionPanel target={target} />);
    fireEvent.change(await screen.findByRole("textbox", { name: "Write a Comment" }), { target: { value: "A pending" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    act(() => signIn("b"));
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    await act(async () => resolveCreate({ comment: comment({ body: "A late result" }), replayed: false, etag: null }));
    expect(screen.queryByText("A late result")).not.toBeInTheDocument();
    await waitFor(() => expect(communityApi.listRootComments).toHaveBeenCalledTimes(2));
  });

  it("rejects late root and Reply loads across an A to B generation switch", async () => {
    signIn("a");
    let resolveRoot!: (value: CommentPage) => void;
    vi.mocked(communityApi.listRootComments)
      .mockReturnValueOnce(new Promise((resolve) => { resolveRoot = resolve; }))
      .mockResolvedValue(page([comment({ body: "B root" })]));
    const view = render(<DiscussionPanel target={target} />);
    act(() => signIn("b"));
    expect(await screen.findByText("B root")).toBeInTheDocument();
    await act(async () => resolveRoot(page([comment({ body: "A late root" })])));
    expect(screen.queryByText("A late root")).not.toBeInTheDocument();

    const rootWithReply = comment({ body: "B root", replyCount: 1 });
    vi.mocked(communityApi.listRootComments).mockResolvedValue(page([rootWithReply]));
    let resolveReply!: (value: CommentPage) => void;
    vi.mocked(communityApi.listReplies).mockReturnValueOnce(new Promise((resolve) => { resolveReply = resolve; }));
    view.unmount();
    render(<DiscussionPanel target={target} />);
    fireEvent.click(await screen.findByRole("button", { name: "View Replies" }));
    act(() => signIn("c"));
    await act(async () => resolveReply(page([comment({ id: replyId, parentCommentId: rootId,
      body: "A late Reply" })], { items: [comment({ id: replyId, parentCommentId: rootId,
      body: "A late Reply" })] })));
    expect(screen.queryByText("A late Reply")).not.toBeInTheDocument();
  });

  it("terminal 401 clears private mutation state and refetches anonymous discussion", async () => {
    signIn();
    const owner = comment({ body: "public confirmed", isOwnedByViewer: true, canEdit: true,
      canDelete: true, editTag: `"comment-${rootId}-v0"` });
    vi.mocked(communityApi.listRootComments).mockResolvedValueOnce(page([owner]))
      .mockResolvedValue(page([comment({ body: "public confirmed" })]));
    vi.mocked(communityApi.editComment).mockImplementationOnce(async () => {
      clearSession();
      throw new ApiError(401);
    });
    render(<DiscussionPanel target={target} />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Edit Comment" }), { target: { value: "private edit" } });
    fireEvent.submit(screen.getByRole("form", { name: "Edit Comment" }));
    expect(await screen.findByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByDisplayValue("private edit")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.getByText("public confirmed")).toBeInTheDocument();
  });

  it("ignores late edit and delete completions after an account switch", async () => {
    signIn("a");
    const owner = comment({ body: "A confirmed", isOwnedByViewer: true, canEdit: true,
      canDelete: true, editTag: `"comment-${rootId}-v0"` });
    const publicProjection = comment({ body: "B confirmed" });
    vi.mocked(communityApi.listRootComments).mockReset()
      .mockResolvedValueOnce(page([owner])).mockResolvedValue(page([publicProjection]));
    let resolveEdit!: (value: Awaited<ReturnType<typeof communityApi.editComment>>) => void;
    vi.mocked(communityApi.editComment).mockReturnValueOnce(new Promise((resolve) => { resolveEdit = resolve; }));
    const editView = render(<DiscussionPanel target={target} />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Edit Comment" }), { target: { value: "A pending edit" } });
    fireEvent.submit(screen.getByRole("form", { name: "Edit Comment" }));
    act(() => signIn("b"));
    await act(async () => resolveEdit({ comment: { ...owner, body: "A late edit" }, etag: owner.editTag }));
    expect(screen.queryByText("A late edit")).not.toBeInTheDocument();
    expect(await screen.findByText("B confirmed")).toBeInTheDocument();
    editView.unmount();

    act(() => signIn("a"));
    vi.mocked(communityApi.listRootComments).mockReset()
      .mockResolvedValueOnce(page([owner])).mockResolvedValue(page([publicProjection]));
    let resolveDelete!: () => void;
    vi.mocked(communityApi.deleteComment).mockReturnValueOnce(new Promise<void>((resolve) => { resolveDelete = resolve; }));
    render(<DiscussionPanel target={target} />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete permanently" }));
    act(() => signIn("b"));
    await act(async () => resolveDelete());
    expect(await screen.findByText("B confirmed")).toBeInTheDocument();
    expect(screen.queryByText("Comment deleted.")).not.toBeInTheDocument();
  });

  it("logout clears drafts and refetches anonymous-readable discussion", async () => {
    signIn();
    vi.mocked(communityApi.listRootComments).mockResolvedValue(page([comment()]));
    render(<DiscussionPanel target={target} />);
    const input = await screen.findByRole("textbox", { name: "Write a Comment" });
    await userEvent.type(input, "private draft");
    act(() => clearSession());
    expect(screen.queryByDisplayValue("private draft")).not.toBeInTheDocument();
    expect(await screen.findByText("สวัสดี", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });

  it("uses server Like capabilities and reconciles count only after confirmation", async () => {
    signIn();
    const likeable = comment({ likeCount: 0, canLike: true });
    vi.mocked(communityApi.listRootComments).mockResolvedValue(page([likeable]));
    let resolveLike!: (value: Awaited<ReturnType<typeof communityApi.setCommentLike>>) => void;
    vi.mocked(communityApi.setCommentLike).mockReturnValueOnce(new Promise((resolve) => { resolveLike = resolve; }));
    render(<DiscussionPanel target={target} />);
    const like = await screen.findByRole("button", { name: "Like Comment" });
    fireEvent.click(like); fireEvent.click(like);
    expect(communityApi.setCommentLike).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("0 Likes")).toBeInTheDocument();
    await act(async () => resolveLike({ commentId: rootId, likeCount: 1,
      isLikedByViewer: true, canLike: true }));
    expect(await screen.findByRole("button", { name: "Unlike Comment" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("1 Likes")).toBeInTheDocument();
  });

  it("shows a confirmed Like as unavailable when the current viewer cannot mutate it", async () => {
    signIn();
    vi.mocked(communityApi.listRootComments).mockResolvedValue(page([comment({
      likeCount: 1, isLikedByViewer: true, canLike: false,
    })]));
    render(<DiscussionPanel target={target} />);
    expect(await screen.findByText("Liked; unavailable to change")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Like Comment|Unlike Comment/ })).not.toBeInTheDocument();
  });

  it("lets an unrelated report finish without invalidating an in-flight Like", async () => {
    signIn();
    const otherId = "33333333-3333-4333-8333-333333333333";
    vi.mocked(communityApi.listRootComments).mockResolvedValue(page([
      comment({ canLike: true }),
      comment({ id: otherId, body: "other Comment" }),
    ]));
    let resolveLike!: (value: Awaited<ReturnType<typeof communityApi.setCommentLike>>) => void;
    vi.mocked(communityApi.setCommentLike)
      .mockReturnValueOnce(new Promise((resolve) => { resolveLike = resolve; }));
    render(<DiscussionPanel target={target} />);
    fireEvent.click(await screen.findByRole("button", { name: "Like Comment" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Report" })[1]);
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "SPAM" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    expect(await screen.findByText("Comment report submitted.")).toBeInTheDocument();
    await act(async () => resolveLike({ commentId: rootId, likeCount: 1,
      isLikedByViewer: true, canLike: true }));
    expect(await screen.findByRole("button", { name: "Unlike Comment" })).toBeInTheDocument();
    expect(screen.getByLabelText("1 Likes")).toBeInTheDocument();
  });

  it("reconciles two independent Like mutations regardless of completion order", async () => {
    signIn();
    const otherId = "33333333-3333-4333-8333-333333333333";
    vi.mocked(communityApi.listRootComments).mockResolvedValue(page([
      comment({ canLike: true }),
      comment({ id: otherId, body: "second Like target", canLike: true }),
    ]));
    let resolveFirst!: (value: Awaited<ReturnType<typeof communityApi.setCommentLike>>) => void;
    let resolveSecond!: (value: Awaited<ReturnType<typeof communityApi.setCommentLike>>) => void;
    vi.mocked(communityApi.setCommentLike)
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveSecond = resolve; }));
    render(<DiscussionPanel target={target} />);
    const buttons = await screen.findAllByRole("button", { name: "Like Comment" });
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    await act(async () => resolveSecond({ commentId: otherId, likeCount: 1,
      isLikedByViewer: true, canLike: true }));
    await act(async () => resolveFirst({ commentId: rootId, likeCount: 1,
      isLikedByViewer: true, canLike: true }));
    expect(await screen.findAllByRole("button", { name: "Unlike Comment" })).toHaveLength(2);
  });

  it("restores focus to the Discussion heading when deletion removes the final root", async () => {
    signIn();
    const owned = comment({ isOwnedByViewer: true, canDelete: true,
      editTag: `"comment-${rootId}-v0"` });
    vi.mocked(communityApi.listRootComments).mockResolvedValueOnce(page([owned])).mockResolvedValueOnce(page());
    vi.mocked(communityApi.deleteComment).mockResolvedValueOnce(undefined);
    render(<DiscussionPanel target={target} />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Discussion" })).toHaveFocus());
  });

  it("never infers Like authority for an owned Creator Comment", async () => {
    signIn();
    vi.mocked(communityApi.listRootComments).mockResolvedValue(page([comment({
      isOwnedByViewer: true, author: { displayName: "Creator", creatorSlug: "creator", isCreator: true },
      canLike: false, likeCount: 4,
    })]));
    render(<DiscussionPanel target={target} />);
    expect(await screen.findByLabelText("4 Likes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Like Comment" })).not.toBeInTheDocument();
  });

  it("submits a target-bound Comment report without copying the Comment body", async () => {
    signIn();
    vi.mocked(communityApi.listRootComments).mockResolvedValue(page([comment({ body: "private evidence body" })]));
    render(<DiscussionPanel target={target} />);
    fireEvent.click(await screen.findByRole("button", { name: "Report" }));
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "HARASSMENT" } });
    fireEvent.change(screen.getByLabelText(/Additional details/), { target: { value: "  repeated abuse  " } });
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    await waitFor(() => expect(communityApi.reportComment).toHaveBeenCalledWith(
      rootId, "HARASSMENT", "repeated abuse", expect.any(AbortSignal)));
    expect(JSON.stringify(vi.mocked(communityApi.reportComment).mock.calls)).not.toContain("private evidence body");
    expect(await screen.findByText("Comment report submitted.")).toBeInTheDocument();
  });
});
