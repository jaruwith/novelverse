import { chromium } from "playwright";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { deflateSync } from "node:zlib";
import { collectExpectedEngagementStarts } from "./engagement-response-collector.mjs";
import {
  createCommunityE2EEvidenceState,
  requireSuccessfulCommunityEvidence,
} from "./community-e2e-evidence.mjs";

const baseUrl = "http://localhost:3000";
const apiUrl = "http://localhost:5039";
const runId = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
const testText = `NovelVerse browser E2E content ${runId}`;
const screenshotPath = path.join(os.tmpdir(), `novelverse-e2e-failure-${runId}.png`);
const imagePath = path.join(os.tmpdir(), `novelverse-e2e-${runId}.png`);

function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function apiCall(route, { token, method = "GET", body, headers = {} } = {}) {
  const response = await fetch(`${apiUrl}${route}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const content = response.status === 204 ? null : await response.json().catch(() => null);
  return { response, content };
}

function assertCommentCapabilities(comment, { owned, editable, deletable }) {
  check(comment.isOwnedByViewer === owned, `Comment ${comment.id} ownership capability was incorrect.`);
  check(comment.canEdit === editable, `Comment ${comment.id} edit capability was incorrect.`);
  check(comment.canDelete === deletable, `Comment ${comment.id} delete capability was incorrect.`);
  check((comment.editTag !== null) === (editable || deletable),
    `Comment ${comment.id} editTag availability contradicted its capabilities.`);
  check(!("authorUserId" in comment) && !("userId" in comment),
    `Comment ${comment.id} exposed an internal user identifier.`);
}

async function runCommunityDiscussionE2E(browser, fixture) {
  const {
    storyPath, storyRoute, novelRoute, comicRoute, videoRoute,
    creator, userB, userC, paginationUsers,
  } = fixture;
  const communityStartedAt = Date.now();
  const evidenceState = createCommunityE2EEvidenceState();
  const contexts = [];
  const openPage = async (tokens) => {
    const context = await browser.newContext({ locale: "th-TH", viewport: { width: 390, height: 844 } });
    contexts.push(context);
    await context.route(`${apiUrl}/api/v1/engagement/**`, (route) => route.abort("blockedbyclient"));
    const communityPage = await context.newPage();
    if (tokens) await setBrowserSession(communityPage, tokens);
    return communityPage;
  };
  const createThroughApi = async (route, user, body, isSpoiler = false, key = crypto.randomUUID()) => {
    const result = await apiCall(route, {
      token: user.tokens.accessToken, method: "POST", body: { body, isSpoiler },
      headers: { "Idempotency-Key": key, Origin: baseUrl },
    });
    check(result.response.status === 201 || result.response.status === 200,
      `Community create returned ${result.response.status} for ${body}.`);
    assertCommentCapabilities(result.content, { owned: true, editable: true, deletable: true });
    check(result.response.headers.get("cache-control")?.includes("no-store"),
      "Community create did not return no-store.");
    check(result.response.headers.get("etag") === result.content.editTag,
      "Community create ETag did not match editTag.");
    return result;
  };

  try {
    const anonymousPage = await openPage();
    await anonymousPage.goto(`${baseUrl}${storyPath}`, { waitUntil: "networkidle" });
    const anonymousDiscussion = anonymousPage.getByRole("region", { name: "Discussion" });
    await anonymousDiscussion.getByText("No Comments yet. Start the discussion.").waitFor();
    check(await anonymousDiscussion.getByRole("textbox", { name: "Write a Comment" }).count() === 0,
      "Anonymous Community viewer received a write composer.");
    check((await anonymousDiscussion.getByRole("link", { name: "Sign in" }).getAttribute("href"))
      ?.includes(encodeURIComponent(storyPath)), "Community sign-in action lost its safe return route.");

    const creatorPage = await openPage(creator.tokens);
    await creatorPage.goto(`${baseUrl}${storyPath}`, { waitUntil: "networkidle" });
    const creatorDiscussion = creatorPage.getByRole("region", { name: "Discussion" });
    const thaiRootBody = `ความคิดเห็นภาษาไทย 🙂 ${runId}\n&lt;ยังเป็นข้อความ&gt;`;
    const rootCreateResponse = creatorPage.waitForResponse((response) =>
      response.request().method() === "POST" && new URL(response.url()).pathname === storyRoute);
    const rootComposer = creatorDiscussion.getByRole("form", { name: "Write a Comment" });
    await rootComposer.getByRole("textbox").fill(thaiRootBody);
    await rootComposer.getByRole("button", { name: "Submit" }).click();
    const createdRootResponse = await rootCreateResponse;
    check(createdRootResponse.status() === 201, "Community root UI create was not accepted.");
    const createdRoot = await createdRootResponse.json();
    assertCommentCapabilities(createdRoot, { owned: true, editable: true, deletable: true });
    await creatorDiscussion.getByText(thaiRootBody, { exact: true }).waitFor();
    await creatorPage.reload({ waitUntil: "networkidle" });
    await creatorPage.getByText(thaiRootBody, { exact: true }).waitFor();

    const replayKey = crypto.randomUUID();
    const replayBody = `Idempotent replay ${runId}`;
    const firstReplay = await createThroughApi(storyRoute, creator, replayBody, false, replayKey);
    const replay = await createThroughApi(storyRoute, creator, replayBody, false, replayKey);
    check(firstReplay.response.status === 201 && firstReplay.response.headers.get("idempotent-replay") === "false" &&
      replay.response.status === 200 && replay.response.headers.get("idempotent-replay") === "true" &&
      replay.content.id === firstReplay.content.id,
    "Community Idempotency-Key replay did not preserve the server projection.");

    await creatorPage.reload({ waitUntil: "networkidle" });
    const spoilerBody = `Spoiler secret ${runId}`;
    const spoilerForm = creatorPage.getByRole("form", { name: "Write a Comment" });
    await spoilerForm.getByRole("textbox").fill(spoilerBody);
    await spoilerForm.getByRole("checkbox").check();
    await spoilerForm.getByRole("button", { name: "Submit" }).click();
    const reveal = creatorPage.getByRole("button", { name: "Reveal spoiler" });
    await reveal.waitFor();
    check(await creatorPage.getByText(spoilerBody, { exact: true }).count() === 0,
      "Spoiler body was present before reveal.");
    await reveal.press("Enter");
    await creatorPage.getByText(spoilerBody, { exact: true }).waitFor();

    const novelBody = `NOVEL Episode discussion ${runId}`;
    await createThroughApi(novelRoute, creator, novelBody);
    const userBRootBodies = Array.from({ length: 4 }, (_, index) => `User B root ${index + 1} ${runId}`);
    const userBRoots = [];
    const reply = await createThroughApi(`/api/v1/comments/${createdRoot.id}/replies`, userB,
      `Reply from User B ${runId}`);
    for (const body of userBRootBodies) userBRoots.push((await createThroughApi(storyRoute, userB, body)).content);
    const comicBody = `COMIC Episode discussion ${runId}`;
    const videoBody = `VIDEO Episode discussion ${runId}`;
    const userCRoots = [];
    for (let index = 1; index <= 3; index += 1)
      userCRoots.push((await createThroughApi(storyRoute, userC, `User C root ${index} ${runId}`)).content);
    await createThroughApi(comicRoute, userC, comicBody);
    await createThroughApi(videoRoute, userC, videoBody);
    for (const user of paginationUsers) {
      for (let index = 1; index <= 3; index += 1)
        await createThroughApi(storyRoute, user, `Pagination ${user.id} ${index} ${runId}`);
    }
    const retainedReply = await createThroughApi(`/api/v1/comments/${createdRoot.id}/replies`, paginationUsers[0],
      `Reply retained below tombstone ${runId}`);

    const anonymousList = await apiCall(`${storyRoute}?sort=OLDEST&pageSize=20`, {
      headers: { Origin: baseUrl },
    });
    check(anonymousList.response.status === 200 && anonymousList.content.items.length === 20 &&
      anonymousList.content.hasMore && anonymousList.content.nextCursor,
    "Anonymous Community first page did not prove bounded keyset pagination.");
    check(anonymousList.response.headers.get("cache-control")?.includes("no-store"),
      "Community list response did not return no-store.");
    check((anonymousList.response.headers.get("access-control-expose-headers") ?? "").includes("ETag") &&
      (anonymousList.response.headers.get("access-control-expose-headers") ?? "").includes("Idempotent-Replay"),
    "Community CORS response did not expose mutation reconciliation headers.");
    anonymousList.content.items.forEach((item) =>
      assertCommentCapabilities(item, { owned: false, editable: false, deletable: false }));
    const ownerList = await apiCall(`${storyRoute}?sort=OLDEST&pageSize=20`, { token: creator.tokens.accessToken });
    const ownerProjection = ownerList.content.items.find((item) => item.id === createdRoot.id);
    assertCommentCapabilities(ownerProjection, { owned: true, editable: true, deletable: true });
    const otherList = await apiCall(`${storyRoute}?sort=OLDEST&pageSize=20`, { token: userB.tokens.accessToken });
    const otherProjection = otherList.content.items.find((item) => item.id === createdRoot.id);
    assertCommentCapabilities(otherProjection, { owned: false, editable: false, deletable: false });
    const invalidRead = await apiCall(`${storyRoute}?sort=OLDEST&pageSize=20`, {
      headers: { Authorization: "Bearer invalid-community-e2e" },
    });
    check(invalidRead.response.status === 401 && invalidRead.content?.status === 401,
      "Invalid credentials on Community GET fell back to anonymous access.");
    const badCursor = await apiCall(`${storyRoute}?sort=OLDEST&pageSize=20&cursor=malformed`);
    check(badCursor.response.status === 400 && badCursor.content?.status === 400,
      "Community malformed cursor did not return Problem Details 400.");

    await creatorPage.reload({ waitUntil: "networkidle" });
    const loadMore = creatorPage.getByRole("button", { name: "Load more Comments" });
    await loadMore.waitFor();
    await loadMore.click();
    await creatorPage.getByText(userCRoots.at(-1).body, { exact: true }).waitFor();
    await creatorPage.getByLabel("Sort Comments").selectOption("NEWEST");
    await creatorPage.getByText(userCRoots.at(-1).body, { exact: true }).waitFor();
    await creatorPage.getByLabel("Sort Comments").selectOption("OLDEST");

    const userBPage = await openPage(userB.tokens);
    await userBPage.goto(`${baseUrl}${storyPath}`, { waitUntil: "networkidle" });
    const rootForOther = userBPage.locator("article").filter({ hasText: thaiRootBody }).first();
    await rootForOther.waitFor();
    check(await rootForOther.getByRole("button", { name: "Edit" }).count() === 0 &&
      await rootForOther.getByRole("button", { name: "Delete" }).count() === 0,
    "Another viewer received owner controls for a Comment.");
    const viewReplies = rootForOther.getByRole("button", { name: "View Replies" });
    await viewReplies.click();
    const replyArticle = userBPage.locator('article[aria-label^="Reply by"]')
      .filter({ hasText: reply.content.body }).first();
    await replyArticle.waitFor();
    check(await replyArticle.getByRole("button", { name: "Reply" }).count() === 0,
      "Reply UI implied nested threading.");
    check(await replyArticle.getByRole("button", { name: "Delete" }).count() === 1,
      "Reply owner did not receive its server-authorized Delete control.");

    const [likeResponse] = await Promise.all([
      userBPage.waitForResponse((response) => response.request().method() === "PUT" &&
        new URL(response.url()).pathname === `/api/v1/comments/${createdRoot.id}/like`),
      rootForOther.getByLabel("Comment interactions").first()
        .getByRole("button", { name: "Like Comment" }).click(),
    ]);
    check(likeResponse.status() === 200, "Comment Like UI did not receive a successful server response.");
    await rootForOther.getByLabel("1 Likes").waitFor();
    await userBPage.reload({ waitUntil: "networkidle" });
    const likedAfterReload = userBPage.locator(`#comment-${createdRoot.id}`);
    check(await likedAfterReload.getByRole("button", { name: "Unlike Comment" }).getAttribute("aria-pressed") === "true",
      "Comment Like state did not persist after reload.");
    const [unlikeResponse] = await Promise.all([
      userBPage.waitForResponse((response) => response.request().method() === "DELETE" &&
        new URL(response.url()).pathname === `/api/v1/comments/${createdRoot.id}/like`),
      likedAfterReload.getByRole("button", { name: "Unlike Comment" }).click(),
    ]);
    check(unlikeResponse.status() === 200, "Comment Unlike UI did not reconcile successfully.");
    const repeatedUnlike = await apiCall(`/api/v1/comments/${createdRoot.id}/like`, {
      token: userB.tokens.accessToken, method: "DELETE",
    });
    check(repeatedUnlike.response.status === 200 && repeatedUnlike.content.likeCount === 0,
      "Repeated Comment Unlike was not idempotent.");
    check(await creatorPage.locator(`#comment-${createdRoot.id}`).getByLabel("Comment interactions").first()
      .getByRole("button", { name: "Like Comment" }).count() === 0,
      "Comment author received a self-Like control.");

    const creatorReplyRoot = creatorPage.locator(`#comment-${createdRoot.id}`);
    const creatorViewReplies = creatorReplyRoot.getByRole("button", { name: "View Replies" });
    if (await creatorViewReplies.count()) await creatorViewReplies.click();
    const creatorReply = creatorPage.locator(`#comment-${reply.content.id}`);
    const [replyLikeResponse] = await Promise.all([
      creatorPage.waitForResponse((response) => response.request().method() === "PUT" &&
        new URL(response.url()).pathname === `/api/v1/comments/${reply.content.id}/like`),
      creatorReply.getByRole("button", { name: "Like Comment" }).click(),
    ]);
    check(replyLikeResponse.status() === 200, "Reply Like did not work through the shared UI.");

    const reportTarget = userBPage.locator(`#comment-${createdRoot.id}`);
    await reportTarget.getByRole("button", { name: "Report" }).click();
    const commentReportDialog = userBPage.getByRole("dialog", { name: "Report Comment" });
    await commentReportDialog.getByLabel("Reason").selectOption("HARASSMENT");
    await commentReportDialog.getByLabel(/Additional details/).fill(`Browser report ${runId}`);
    const [submittedCommentReport] = await Promise.all([
      userBPage.waitForResponse((response) => response.request().method() === "POST" &&
        new URL(response.url()).pathname === `/api/v1/comments/${createdRoot.id}/reports`),
      commentReportDialog.getByRole("button", { name: "Submit report" }).click(),
    ]);
    check(submittedCommentReport.status() === 201, "Comment report UI did not create a moderation report.");
    databaseCommand(`UPDATE user_profiles SET moderation_visibility = 'Hidden'
      WHERE user_id = ${sqlLiteral(userB.id)}::uuid;`);
    await userBPage.reload({ waitUntil: "networkidle" });
    const hiddenOwner = userBPage.locator("article").filter({ hasText: userBRootBodies[0] }).first();
    await hiddenOwner.waitFor();
    check((await hiddenOwner.innerText()).includes("NovelVerse member") &&
      await hiddenOwner.getByRole("button", { name: "Edit" }).count() === 1,
    "Hidden-profile ownership was inferred from presentation instead of server capability.");
    await anonymousPage.reload({ waitUntil: "networkidle" });
    const hiddenOther = anonymousPage.locator("article").filter({ hasText: userBRootBodies[0] }).first();
    await hiddenOther.waitFor();
    check((await hiddenOther.innerText()).includes("NovelVerse member") &&
      await hiddenOther.getByRole("button", { name: "Edit" }).count() === 0,
    "Hidden-profile projection leaked owner capability to another viewer.");
    databaseCommand(`UPDATE user_profiles SET moderation_visibility = 'Visible'
      WHERE user_id = ${sqlLiteral(userB.id)}::uuid;`);

    const creatorViewOfOther = creatorPage.locator("article").filter({ hasText: userBRootBodies[0] }).first();
    check(await creatorViewOfOther.getByRole("button", { name: "Edit" }).count() === 0,
      "Target Creator received author controls for another viewer's Comment.");
    databaseCommand(`UPDATE users SET role = 'Moderator' WHERE id = ${sqlLiteral(userC.id)}::uuid;`);
    const moderatorSignIn = await apiCall("/api/v1/dev/auth/social-sign-in", {
      method: "POST", body: userC.identity,
    });
    check(moderatorSignIn.response.ok, "Community moderator token refresh failed.");
    const moderatorTokens = moderatorSignIn.content.tokens;
    const moderatorPage = await openPage(moderatorTokens);
    await moderatorPage.goto(`${baseUrl}${storyPath}`, { waitUntil: "networkidle" });
    const moderatorView = moderatorPage.locator("article").filter({ hasText: userBRootBodies[0] }).first();
    await moderatorView.waitFor();
    check(await moderatorView.getByRole("button", { name: "Edit" }).count() === 0 &&
      await moderatorView.getByRole("button", { name: "Delete" }).count() === 0,
    "Moderator role created Comment author capability.");
    await moderatorPage.goto(`${baseUrl}/moderation/reports`, { waitUntil: "networkidle" });
    await moderatorPage.getByLabel("Target type").selectOption("COMMENT");
    const reportCard = moderatorPage.locator("article").filter({ hasText: "COMMENT · HARASSMENT" }).first();
    await reportCard.waitFor();
    check((await reportCard.innerText()).includes(thaiRootBody) &&
      (await reportCard.innerText()).includes("Restricted report-time evidence"),
    "Moderator queue did not render restricted Comment report-time evidence.");
    moderatorPage.on("dialog", (dialog) => dialog.accept());
    const [hideResponse] = await Promise.all([
      moderatorPage.waitForResponse((response) => response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/moderation/actions/hide"),
      reportCard.getByRole("button", { name: "Hide and close report" }).click(),
    ]);
    check(hideResponse.status() === 200, "Moderator Comment Hide failed.");
    const hiddenPublic = await apiCall(`${storyRoute}?sort=OLDEST&pageSize=20`);
    check(!hiddenPublic.content.items.some((item) => item.id === createdRoot.id),
      "Hidden Comment root remained publicly projected.");
    const hiddenReplies = await apiCall(`/api/v1/comments/${createdRoot.id}/replies?pageSize=20`);
    check(hiddenReplies.response.status === 404, "Hidden root subtree remained directly readable.");
    const [restoreResponse] = await Promise.all([
      moderatorPage.waitForResponse((response) => response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/moderation/actions/restore"),
      moderatorPage.getByRole("button", { name: "Restore target" }).first().click(),
    ]);
    check(restoreResponse.status() === 200, "Moderator Comment Restore failed.");
    const restoredPublic = await apiCall(`${storyRoute}?sort=OLDEST&pageSize=20`);
    check(restoredPublic.content.items.some((item) => item.id === createdRoot.id),
      "Restored Comment did not return to current eligible public truth.");
    databaseCommand(`UPDATE users SET role = 'User' WHERE id = ${sqlLiteral(userC.id)}::uuid;`);

    const privacyActor = paginationUsers.at(-1);
    const privacyReplyActor = await createSocialUser("privacy-replier", "Privacy Reply Viewer");
    const privacyRoot = await createThroughApi(storyRoute, privacyActor, `Privacy root ${runId}`);
    const privacyReply = await createThroughApi(`/api/v1/comments/${privacyRoot.content.id}/replies`, privacyReplyActor,
      `Incoming privacy Reply ${runId}`);
    await apiCall(`/api/v1/comments/${privacyRoot.content.id}/like`, {
      token: userB.tokens.accessToken, method: "PUT",
    });
    await apiCall(`/api/v1/comments/${privacyReply.content.id}/like`, {
      token: privacyActor.tokens.accessToken, method: "PUT",
    });
    const privacyReporter = await apiCall(`/api/v1/comments/${userBRoots[0].id}/reports`, {
      token: privacyActor.tokens.accessToken, method: "POST", body: { reason: "PRIVACY", comment: null },
    });
    check(privacyReporter.response.status === 201, "Privacy reporter fixture failed.");
    const privacyUnlink = await apiCall("/api/v1/dev/social/privacy/unlink", {
      token: privacyActor.tokens.accessToken, method: "DELETE",
    });
    check(privacyUnlink.response.ok && privacyUnlink.content.outgoingCommentLikes === 1 &&
      privacyUnlink.content.incomingCommentLikes === 1 && privacyUnlink.content.commentsUnlinked >= 1 &&
      privacyUnlink.content.reportsUnlinked === 1,
    "Community privacy unlink did not remove identity, bodies, Likes, and reporter link.");
    const privacyList = await apiCall(`${storyRoute}?sort=NEWEST&pageSize=20`);
    const privacyTombstone = privacyList.content.items.find((item) => item.id === privacyRoot.content.id);
    check(privacyTombstone?.isTombstone && privacyTombstone.body === null && privacyTombstone.likeCount === 0,
      "Privacy-unlinked root did not become a neutral Like-free tombstone.");
    const privacyReplies = await apiCall(`/api/v1/comments/${privacyRoot.content.id}/replies?pageSize=20`);
    check(privacyReplies.content.items.some((item) => item.id === privacyReply.content.id),
      "Privacy unlink removed an unrelated incoming Reply.");

    const freshOwner = await apiCall(`${storyRoute}?sort=OLDEST&pageSize=20`, { token: creator.tokens.accessToken });
    const beforeConflict = freshOwner.content.items.find((item) => item.id === createdRoot.id);
    const concurrentBody = `Concurrent server edit ${runId}`;
    const concurrentEdit = await apiCall(`/api/v1/comments/${createdRoot.id}`, {
      token: creator.tokens.accessToken, method: "PATCH", body: { body: concurrentBody, isSpoiler: false },
      headers: { "If-Match": beforeConflict.editTag },
    });
    check(concurrentEdit.response.status === 200, "Community concurrent edit fixture failed.");
    const staleEdit = await apiCall(`/api/v1/comments/${createdRoot.id}`, {
      token: creator.tokens.accessToken, method: "PATCH",
      body: { body: `Stale rejected edit ${runId}`, isSpoiler: false },
      headers: { "If-Match": beforeConflict.editTag },
    });
    check(staleEdit.response.status === 409 && staleEdit.content?.status === 409,
      "Stale Community edit did not return Problem Details 409.");
    await creatorPage.reload({ waitUntil: "networkidle" });
    await creatorPage.getByText(concurrentBody, { exact: true }).waitFor();
    const reconciledArticle = creatorPage.locator(`#comment-${createdRoot.id}`);
    await reconciledArticle.getByRole("button", { name: "Edit" }).click();
    const finalEditBody = `Server-confirmed edit ${runId}`;
    await reconciledArticle.getByRole("textbox", { name: "Edit Comment" }).fill(finalEditBody);
    await reconciledArticle.getByRole("button", { name: "Submit" }).click();
    await creatorPage.getByText(finalEditBody, { exact: true }).waitFor();
    evidenceState.markMutationConcurrencyVerified();

    const rootBeforeReplyDelete = userBPage.locator(`#comment-${createdRoot.id}`);
    const reopenReplies = rootBeforeReplyDelete.getByRole("button", { name: "View Replies" });
    if (await reopenReplies.count()) await reopenReplies.click();
    const replyDeleteArticle = userBPage.locator('article[aria-label^="Reply by"]')
      .filter({ hasText: reply.content.body }).first();
    await replyDeleteArticle.waitFor();
    await replyDeleteArticle.getByRole("button", { name: "Delete" }).click();
    const replyDeleteResponse = userBPage.waitForResponse((response) =>
      response.request().method() === "DELETE" && new URL(response.url()).pathname === `/api/v1/comments/${reply.content.id}`);
    await userBPage.getByRole("dialog", { name: "Delete Comment permanently?" })
      .getByRole("button", { name: "Delete permanently" }).click();
    check((await replyDeleteResponse).status() === 204, "Community Reply delete did not return 204.");
    await replyDeleteArticle.waitFor({ state: "detached" });

    const updatedOwnerPage = await apiCall(`${storyRoute}?sort=OLDEST&pageSize=20`, { token: creator.tokens.accessToken });
    const deletableRoot = updatedOwnerPage.content.items.find((item) => item.id === createdRoot.id);
    const rootDelete = await apiCall(`/api/v1/comments/${createdRoot.id}`, {
      token: creator.tokens.accessToken, method: "DELETE", headers: { "If-Match": deletableRoot.editTag },
    });
    check(rootDelete.response.status === 204, "Community root delete did not return 204.");
    const afterRootDelete = await apiCall(`${storyRoute}?sort=OLDEST&pageSize=20`, { token: creator.tokens.accessToken });
    const tombstone = afterRootDelete.content.items.find((item) => item.id === createdRoot.id);
    check(tombstone?.isTombstone && tombstone.body === null && tombstone.author === null,
      "Deleted root with visible Reply did not become a neutral server tombstone.");
    assertCommentCapabilities(tombstone, { owned: false, editable: false, deletable: false });
    const retainedReplies = await apiCall(`/api/v1/comments/${createdRoot.id}/replies?pageSize=20`, {
      token: paginationUsers[0].tokens.accessToken,
    });
    check(retainedReplies.content.items.some((item) => item.id === retainedReply.content.id),
      "Visible Reply was not retained beneath a root tombstone.");

    const spoilerList = await apiCall(`${storyRoute}?sort=NEWEST&pageSize=20`, { token: creator.tokens.accessToken });
    const emptyRoot = spoilerList.content.items.find((item) => item.body === spoilerBody);
    const emptyDelete = await apiCall(`/api/v1/comments/${emptyRoot.id}`, {
      token: creator.tokens.accessToken, method: "DELETE", headers: { "If-Match": emptyRoot.editTag },
    });
    check(emptyDelete.response.status === 204, "Empty Community root delete failed.");
    const afterEmptyDelete = await apiCall(`${storyRoute}?sort=NEWEST&pageSize=20`, { token: creator.tokens.accessToken });
    check(!afterEmptyDelete.content.items.some((item) => item.id === emptyRoot.id),
      "Deleted root without Replies remained projected.");

    const oversized = await apiCall(storyRoute, {
      token: paginationUsers[1].tokens.accessToken, method: "POST",
      body: { body: "🙂".repeat(5_000), isSpoiler: false },
      headers: { "Idempotency-Key": crypto.randomUUID() },
    });
    check(oversized.response.status === 413 && oversized.content?.status === 413,
      "Community oversized request did not return Problem Details 413.");
    const likeQuotaStatuses = [];
    for (let index = 0; index < 31; index += 1) {
      likeQuotaStatuses.push((await apiCall(`/api/v1/comments/${userBRoots[0].id}/like`, {
        token: paginationUsers[1].tokens.accessToken, method: index % 2 === 0 ? "PUT" : "DELETE",
      })).response.status);
    }
    check(likeQuotaStatuses.includes(429), "Comment Like rate-limit path did not return 429.");
    evidenceState.markLimiterVerified("like");
    const reportQuotaStatuses = [];
    for (const [target, reason] of [[createdRoot.id, "SPAM"], [userBRoots[0].id, "HATE"],
      [userBRoots[1].id, "VIOLENCE"], [userBRoots[2].id, "OTHER"],
      [userBRoots[3].id, "MISINFORMATION"], [userBRoots[0].id, "COPYRIGHT"]]) {
      reportQuotaStatuses.push((await apiCall(`/api/v1/comments/${target}/reports`, {
        token: paginationUsers[0].tokens.accessToken, method: "POST", body: { reason, comment: null },
      })).response.status);
    }
    check(reportQuotaStatuses.includes(429), "Comment report rate-limit path did not return 429.");
    evidenceState.markLimiterVerified("report");
    const quotaStatuses = [];
    for (let index = 0; index < 4; index += 1) {
      quotaStatuses.push((await apiCall(storyRoute, {
        token: paginationUsers[2].tokens.accessToken, method: "POST",
        body: { body: `Quota ${index} ${runId}`, isSpoiler: false },
        headers: { "Idempotency-Key": crypto.randomUUID() },
      })).response.status);
    }
    check(quotaStatuses.includes(429), "Community create rate-limit path did not return 429.");
    evidenceState.markLimiterVerified("create");

    for (const [route, body] of [[
      `/read-novel/${creator.slug}/browser-e2e-story-${runId}/browser-e2e-episode-${runId}`, novelBody,
    ], [
      `/read-comic/${creator.slug}/browser-e2e-comic-${runId}/comic-episode-${runId}`, comicBody,
    ], [
      `/watch-video/${creator.slug}/browser-e2e-video-${runId}/video-episode-${runId}`, videoBody,
    ]]) {
      await creatorPage.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
      await creatorPage.getByRole("region", { name: "Discussion" }).getByText(body, { exact: true }).waitFor();
    }
    await creatorPage.goto(`${baseUrl}/read-novel/${creator.slug}/browser-e2e-story-${runId}/browser-e2e-episode-${runId}`,
      { waitUntil: "networkidle" });
    const readerPath = new URL(creatorPage.url()).pathname;
    const readerComposer = creatorPage.getByRole("form", { name: "Write a Comment" }).getByRole("textbox");
    await readerComposer.focus();
    await readerComposer.press("ArrowRight");
    check(new URL(creatorPage.url()).pathname === readerPath,
      "Reader ArrowRight navigation fired inside the Community composer.");
    check(!(await creatorPage.locator("body").innerText()).toLowerCase().includes("mock comment"),
      "Production Community flow rendered a mock fallback.");
    const evidence = requireSuccessfulCommunityEvidence(evidenceState, { mockFallbackDetected: false });

    return {
      verified: true, durationMs: Date.now() - communityStartedAt, rootsCreated: 22,
      storyDiscussionVerified: true, novelDiscussionVerified: true,
      comicDiscussionVerified: true, videoDiscussionVerified: true,
      ownerCapabilitiesVerified: true, ...evidence,
    };
  } finally {
    await Promise.all(contexts.map((context) => context.close().catch(() => undefined)));
  }
}

async function createSocialUser(prefix, displayName) {
  const identity = {
    provider: "GOOGLE",
    providerSubject: `${prefix}-${runId}`,
    email: `${prefix}-${runId}@browser-e2e.test`,
    displayName,
  };
  const first = await apiCall("/api/v1/dev/auth/social-sign-in", { method: "POST", body: identity });
  check(first.response.ok, `${displayName} initial development sign-in failed.`);
  const documents = await apiCall("/api/v1/legal-documents/current", {
    token: first.content.tokens.accessToken,
  });
  const required = documents.content.filter((item) => item.isRequired).map((item) => item.id);
  const accepted = await apiCall("/api/v1/legal-acceptances", {
    token: first.content.tokens.accessToken,
    method: "POST",
    body: { legalDocumentIds: required, acceptanceSource: "DEVELOPMENT" },
  });
  check(accepted.response.ok, `${displayName} legal acceptance failed.`);
  const slug = `${prefix}-${runId}`;
  const profile = await apiCall("/api/v1/users/me/profile", {
    token: first.content.tokens.accessToken,
    method: "PUT",
    body: { displayName, creatorSlug: slug },
  });
  check(profile.response.ok, `${displayName} profile setup failed.`);
  const signed = await apiCall("/api/v1/dev/auth/social-sign-in", { method: "POST", body: identity });
  check(signed.response.ok, `${displayName} final development sign-in failed.`);
  return { id: signed.content.user.id, slug, identity, tokens: signed.content.tokens };
}

async function replaceBrowserSession(page, tokens) {
  await page.evaluate((value) => {
    localStorage.setItem("novelverse_access_token", value.accessToken);
    localStorage.setItem("novelverse_refresh_token", value.refreshToken);
    localStorage.setItem("novelverse_access_token_expires_at", value.accessTokenExpiresAt);
    localStorage.setItem("novelverse_refresh_token_expires_at", value.refreshTokenExpiresAt);
    window.dispatchEvent(new Event("novelverse:session-changed"));
  }, tokens);
}

async function createQualifiedDashboardSession(viewer, episodeId, content, occurredAt) {
  const clientSessionKey = crypto.randomUUID();
  const started = await apiCall("/api/v1/engagement/sessions", {
    token: viewer.tokens.accessToken,
    method: "POST",
    body: {
      targetType: "EPISODE",
      targetId: episodeId,
      clientSessionKey,
      idempotencyKey: crypto.randomUUID(),
    },
  });
  check(started.response.ok,
    `Dashboard viewer ${viewer.id} session start failed with ${started.response.status}.`);
  const advanced = await apiCall(
    `/api/v1/dev/engagement/sessions/${started.content.sessionId}/advance`, {
      token: viewer.tokens.accessToken,
      method: "POST",
      body: { seconds: 31 },
    });
  check(advanced.response.ok, `Dashboard viewer ${viewer.id} time advance failed.`);
  const activity = await apiCall(
    `/api/v1/engagement/sessions/${started.content.sessionId}/activity`, {
      token: viewer.tokens.accessToken,
      method: "POST",
      body: {
        idempotencyKey: crypto.randomUUID(),
        sequence: 1,
        clientSessionKey,
        evidenceType: "COMPLETION",
        reportedActiveSeconds: 30,
        progressPercent: 100,
        reachedContentId: content.blocks.at(-1).id,
        reachedPosition: content.blocks.length,
        totalItems: content.blocks.length,
        finalContentReached: true,
      },
    });
  check(activity.response.ok && activity.content.qualified,
    `Dashboard viewer ${viewer.id} did not produce qualified engagement.`);
  databaseCommand(
    `UPDATE engagement_sessions
     SET qualified_at = ${timestampSqlLiteral(occurredAt)},
         completed_at = ${timestampSqlLiteral(occurredAt)},
         updated_at = ${timestampSqlLiteral(occurredAt)}
     WHERE id = ${sqlLiteral(started.content.sessionId)}::uuid;
     UPDATE engagement_activity_facts
     SET server_accepted_at = ${timestampSqlLiteral(occurredAt)},
         created_at = ${timestampSqlLiteral(occurredAt)}
     WHERE session_id = ${sqlLiteral(started.content.sessionId)}::uuid;`,
  );
  return started.content.sessionId;
}

async function setBrowserSession(page, tokens) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate((value) => {
    localStorage.setItem("novelverse_access_token", value.accessToken);
    localStorage.setItem("novelverse_refresh_token", value.refreshToken);
    localStorage.setItem("novelverse_access_token_expires_at", value.accessTokenExpiresAt);
    localStorage.setItem("novelverse_refresh_token_expires_at", value.refreshTokenExpiresAt);
  }, tokens);
}

function sqlLiteral(value) {
  check(/^[a-zA-Z0-9-]+$/.test(value), "Unsafe value supplied to E2E database assertion.");
  return `'${value}'`;
}

function databaseScalar(sql) {
  const output = execFileSync("docker", [
    "exec", "novelverse-postgres", "psql",
    "-U", "novelverse", "-d", "novelverse",
    "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql,
  ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return Number(output.trim());
}

function storyLikeCount(storyId, userId) {
  const actor = userId ? ` AND "UserId" = ${sqlLiteral(userId)}::uuid` : "";
  return databaseScalar(
    `SELECT count(*) FROM story_likes WHERE "StoryId" = ${sqlLiteral(storyId)}::uuid${actor};`,
  );
}

function databaseCommand(sql) {
  execFileSync("docker", [
    "exec", "novelverse-postgres", "psql",
    "-U", "novelverse", "-d", "novelverse",
    "-v", "ON_ERROR_STOP=1", "-c", sql,
  ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function timestampSqlLiteral(value) {
  check(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value),
    "Unsafe timestamp supplied to E2E database fixture.");
  return `'${value}'::timestamptz`;
}

function creatorFollowCount(creatorSlug, followerUserId) {
  const actor = followerUserId
    ? ` AND follow."FollowerUserId" = ${sqlLiteral(followerUserId)}::uuid`
    : "";
  return databaseScalar(
    `SELECT count(*) FROM creator_follows follow
     JOIN user_profiles profile ON profile.id = follow."CreatorProfileId"
     WHERE profile.creator_slug = ${sqlLiteral(creatorSlug)}${actor};`,
  );
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function createPng() {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(2, 0);
  header.writeUInt32BE(2, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const rows = Buffer.from([
    0, 35, 100, 210, 255, 35, 100, 210, 255,
    0, 35, 100, 210, 255, 35, 100, 210, 255,
  ]);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(rows)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

async function createSearchFixture(page, fixture) {
  return page.evaluate(async ({ title, tag, suffix }) => {
    const apiBase = "http://localhost:5039";
    const token = localStorage.getItem("novelverse_access_token");
    if (!token) throw new Error("Authenticated fixture setup requires a local development session.");
    const call = async (path, init = {}) => {
      const response = await fetch(`${apiBase}${path}`, {
        ...init,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init.headers },
      });
      if (!response.ok) throw new Error(`Fixture API ${init.method ?? "GET"} ${path} returned ${response.status}.`);
      return response.status === 204 ? null : response.json();
    };
    const categories = await call("/api/v1/categories");
    const category = categories.find((item) => item.isActive);
    if (!category) throw new Error("Fixture setup requires an active category.");
    const story = await call("/api/v1/creator/stories", {
      method: "POST",
      body: JSON.stringify({
        title, slug: null, synopsis: `Thai literal search fixture ${suffix}`, languageCode: "th",
        visibility: "PUBLIC", contentRating: "GENERAL", coverMediaAssetId: null,
        categoryIds: [category.id], tags: [tag], storyType: "NOVEL", readingMode: "VERTICAL",
      }),
    });
    const episodeTitle = `ตอนทดสอบ ${suffix}`;
    const contentText = `เนื้อหาทดสอบ ${suffix}`;
    const episode = await call(`/api/v1/creator/stories/${story.id}/episodes`, {
      method: "POST",
      body: JSON.stringify({
        title: episodeTitle, episodeNumber: 1, sortOrder: 1,
        slug: null, synopsis: null, visibility: "PUBLIC",
      }),
    });
    await call(`/api/v1/creator/stories/${story.id}/episodes/${episode.id}/content`, {
      method: "PUT",
      body: JSON.stringify({ blocks: [{ type: "TEXT", textContent: contentText, mediaAssetId: null }] }),
    });
    await call(`/api/v1/creator/stories/${story.id}/publish`, { method: "POST" });
    await call(`/api/v1/creator/stories/${story.id}/episodes/${episode.id}/publish`, { method: "POST" });
    return {
      storyId: story.id, title, storySlug: story.slug, tag, categorySlug: category.slug,
      episodeTitle, episodeSlug: episode.slug, contentText,
    };
  }, fixture);
}

async function run() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const health = await fetch("http://localhost:5039/api/v1/health").catch(() => null);
    if (!health || !health.ok) throw new Error("NovelVerse API is not healthy at http://localhost:5039. Start it with scripts/start-local-api.ps1 and inspect %TEMP%\\novelverse-api logs.");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "th-TH" });
  const page = await context.newPage();
  const engagementStarts = [];
  const pendingEngagementResponses = new Set();
  const engagementResponseErrors = [];
  let communityResult = null;
  page.on("response", (response) => {
    if (response.request().method() === "POST" &&
        /\/api\/v1\/engagement\/sessions$/.test(new URL(response.url()).pathname) &&
        response.ok()) {
      const pending = (async () => {
        const body = await response.json().catch(() => null);
        const requestBody = response.request().postDataJSON();
        engagementStarts.push(body ? { ...body, clientSessionKey: requestBody.clientSessionKey,
          targetId: requestBody.targetId } : null);
      })();
      pendingEngagementResponses.add(pending);
      void pending.then(
        () => pendingEngagementResponses.delete(pending),
        (reason) => {
          engagementResponseErrors.push(reason);
          pendingEngagementResponses.delete(pending);
        },
      );
    }
  });
  async function waitForPendingEngagementResponses() {
    while (pendingEngagementResponses.size) await Promise.all([...pendingEngagementResponses]);
    if (engagementResponseErrors.length) throw engagementResponseErrors.shift();
  }
  page.on("requestfailed", (request) => {
    console.error(`Request failed: ${request.method()} ${request.url()} (${request.failure()?.errorText ?? "unknown"})`);
  });
  page.on("response", (response) => {
    if (response.url().startsWith("http://localhost:5039/")) {
      console.error(`API ${response.status()}: ${response.request().method()} ${new URL(response.url()).pathname}`);
    }
  });
  try {
    await fs.writeFile(imagePath, createPng());
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    await page.getByLabel("Provider subject").fill(`browser-e2e-${runId}`);
    await page.getByLabel("Email").fill(`browser-e2e-${runId}@example.test`);
    await page.getByLabel("ชื่อที่แสดง").fill("Browser E2E Creator");
    await page.getByLabel("Creator slug").fill(`browser-e2e-${runId}`);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "เข้าสู่ระบบสำหรับ Development" }).click();
    await page.waitForURL("**/creator/stories");
    check(!(await page.locator("body").innerText()).includes("mock"), "Creator stories page exposed mock data.");

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
    await page.waitForURL("**/creator/dashboard");
    await page.getByText("No Stories yet", { exact: true }).waitFor();
    await page.getByText("No Episodes yet", { exact: true }).waitFor();
    const emptyPerformance = page.locator('section[aria-labelledby="dashboard-performance"]');
    check(await emptyPerformance.getByText("Insufficient data", { exact: true }).count() === 0,
      "Zero Dashboard activity was mislabeled as a suppressed small cell.");
    check(await emptyPerformance.locator("li").filter({ hasText: "Qualified Views" })
      .getByText("0", { exact: true }).count() === 1,
    "Empty Creator Dashboard did not render an exact zero qualified-view value.");
    check(await page.getByRole("link", { name: "Create Story", exact: true }).count() === 1,
      "Empty Creator Dashboard did not expose its capability-driven Create Story action.");
    check(!(await page.locator("body").innerText()).toLowerCase().includes("mock"),
      "Creator Dashboard used a legacy mock fallback.");
    await page.goto(`${baseUrl}/dashboard/analytics`, { waitUntil: "networkidle" });
    await page.waitForURL("**/creator/dashboard");
    await page.reload({ waitUntil: "networkidle" });
    check(new URL(page.url()).pathname === "/creator/dashboard",
      "Temporary Analytics compatibility redirect did not remain canonical after reload.");
    await page.getByRole("link", { name: "Create Story", exact: true }).click();
    await page.waitForURL("**/creator/stories");

    await page.getByRole("button", { name: "＋ สร้างนิยาย" }).click();
    await page.getByLabel("ชื่อเรื่อง").fill(`Browser E2E Story ${runId}`);
    await page.getByRole("button", { name: "สร้าง NOVEL ฉบับร่าง" }).click();
    await page.waitForURL(/\/creator\/stories\/[^/]+$/);
    const storyUrl = page.url();
    const storyId = new URL(storyUrl).pathname.split("/").at(-1);

    await page.getByRole("button", { name: "＋ สร้างตอน" }).click();
    await page.getByLabel("ชื่อตอน").fill(`Browser E2E Episode ${runId}`);
    await page.getByRole("button", { name: "สร้างตอนฉบับร่าง" }).click();
    await page.waitForURL(/\/episodes\/[^/]+\/edit$/);
    const editorUrl = page.url();
    const episodeId = new URL(editorUrl).pathname.split("/").at(-2);
    await page.getByLabel("เลือกรูปภาพ").setInputFiles(imagePath);
    await page.getByTestId("block-IMAGE").waitFor();

    await page.getByRole("button", { name: "＋ ข้อความ" }).click();
    await page.getByTestId("block-TEXT").locator("textarea").fill(testText);
    await page.getByRole("button", { name: "บันทึกฉบับร่าง" }).click();
    await page.getByText("บันทึกแล้ว").waitFor();

    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("block-IMAGE").locator("img").waitFor();
    await page.getByTestId("block-TEXT").waitFor();
    check(await page.getByTestId("block-TEXT").locator("textarea").inputValue() === testText,
      "Saved TEXT content was not restored after reload.");

    await page.goto(storyUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "เผยแพร่เรื่อง" }).click();
    await page.getByRole("button", { name: "เผยแพร่เรื่อง" }).waitFor({ state: "hidden" });

    await page.goto(editorUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "เผยแพร่" }).click();
    await page.getByText("เผยแพร่ตอนเรียบร้อยแล้ว").waitFor();
    await page.getByRole("button", { name: "ดูตัวอย่าง" }).click();
    await page.waitForURL("**/preview");
    await page.getByText(testText).waitFor();
    await page.getByTestId("novel-content-renderer").locator("img").waitFor();

    const novelNavigationFixture = await page.evaluate(async ({ storyId, runId }) => {
      const api = "http://localhost:5039";
      const token = localStorage.getItem("novelverse_access_token");
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      const created = [];
      for (let number = 2; number <= 22; number += 1) {
        const episode = await fetch(`${api}/api/v1/creator/stories/${storyId}/episodes`, {
          method: "POST", headers, body: JSON.stringify({ title: `Navigation Episode ${number} ${runId}`,
            episodeNumber: number, sortOrder: number, slug: null, synopsis: null, visibility: "PUBLIC" }),
        }).then(async (response) => {
          if (!response.ok) throw new Error(`Navigation fixture Episode ${number} returned ${response.status}.`);
          return response.json();
        });
        const content = await fetch(`${api}/api/v1/creator/stories/${storyId}/episodes/${episode.id}/content`, {
          method: "PUT", headers, body: JSON.stringify({ blocks: [{ type: "TEXT",
            textContent: `Navigation content ${number} ${runId}`, mediaAssetId: null }] }),
        });
        if (!content.ok) throw new Error(`Navigation content ${number} returned ${content.status}.`);
        const published = await fetch(`${api}/api/v1/creator/stories/${storyId}/episodes/${episode.id}/publish`,
          { method: "POST", headers });
        if (!published.ok) throw new Error(`Navigation publish ${number} returned ${published.status}.`);
        created.push(episode);
      }
      return { second: created[0], last: created.at(-1) };
    }, { storyId, runId });

    await page.goto(`${baseUrl}/creator/stories`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "＋ สร้างนิยาย" }).click();
    await page.getByLabel("ประเภทเรื่อง").selectOption("COMIC");
    const comicStoryTitle = `Browser E2E Comic ${runId}`;
    await page.getByLabel("ชื่อเรื่อง").fill(comicStoryTitle);
    await page.getByRole("button", { name: "สร้าง COMIC ฉบับร่าง" }).click();
    await page.waitForURL(/\/creator\/stories\/[^/]+$/);
    const comicStoryUrl = page.url();
    const comicStoryId = new URL(comicStoryUrl).pathname.split("/").at(-1);
    await page.getByRole("button", { name: "＋ สร้างตอน" }).click();
    const comicEpisodeTitle = `Comic Episode ${runId}`;
    await page.getByLabel("ชื่อตอน").fill(comicEpisodeTitle);
    await page.getByRole("button", { name: "สร้างตอนฉบับร่าง" }).click();
    await page.waitForURL(/\/episodes\/[^/]+\/edit$/);
    const comicEditorUrl = page.url();
    await page.getByLabel("เลือกหน้าการ์ตูน").setInputFiles(imagePath);
    await page.getByTestId("comic-page").waitFor();
    await page.getByLabel("เลือกหน้าการ์ตูน").setInputFiles(imagePath);
    await page.getByTestId("comic-page").nth(1).waitFor();
    check(await page.getByTestId("comic-page").count() === 2, "Two comic pages were not uploaded.");
    await page.getByTestId("comic-page").nth(1).getByRole("button", { name: "เลื่อนขึ้น" }).click();
    await page.getByTestId("comic-page").nth(1).getByRole("button", { name: "ลบ" }).click();
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await page.getByText("บันทึกหน้าการ์ตูนแล้ว").waitFor();
    await page.reload({ waitUntil: "networkidle" });
    check(await page.getByTestId("comic-page").count() === 1, "Comic page changes did not survive reload.");
    await page.goto(comicStoryUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "เผยแพร่เรื่อง" }).click();
    await page.goto(comicEditorUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "เผยแพร่", exact: true }).click();
    await page.getByText("เผยแพร่ตอนแล้ว").waitFor();
    const comicStorySlug = `browser-e2e-comic-${runId}`;
    const comicEpisodeSlug = `comic-episode-${runId}`;
    await page.goto(`${baseUrl}/read-comic/browser-e2e-${runId}/${comicStorySlug}/${comicEpisodeSlug}`,
      { waitUntil: "networkidle" });
    await page.getByTestId("comic-reader").locator("img").waitFor();
    await page.getByRole("heading", { name: comicEpisodeTitle }).waitFor();
    await page.getByText(/only available episode/).first().waitFor();

    await page.goto(`${baseUrl}/creator/stories`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "＋ สร้างนิยาย" }).click();
    await page.getByLabel("ประเภทเรื่อง").selectOption("VIDEO");
    const videoStoryTitle = `Browser E2E Video ${runId}`;
    await page.getByLabel("ชื่อเรื่อง").fill(videoStoryTitle);
    await page.getByRole("button", { name: "สร้าง VIDEO ฉบับร่าง" }).click();
    await page.waitForURL(/\/creator\/stories\/[^/]+$/);
    const videoStoryUrl = page.url();
    await page.getByRole("button", { name: "＋ สร้างตอน" }).click();
    const videoEpisodeTitle = `Video Episode ${runId}`;
    await page.getByLabel("ชื่อตอน").fill(videoEpisodeTitle);
    await page.getByRole("button", { name: "สร้างตอนฉบับร่าง" }).click();
    await page.waitForURL(/\/episodes\/[^/]+\/edit$/);
    const videoEditorUrl = page.url();
    await page.getByRole("heading", { name: videoEpisodeTitle }).waitFor();
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Video URL").fill("https://youtu.be/dQw4w9WgXcQ");
    const videoSave = page.getByRole("button", { name: "บันทึก", exact: true });
    await videoSave.waitFor();
    check(await videoSave.isEnabled(), "VIDEO editor did not enable Save for a valid YouTube URL.");
    await videoSave.click();
    await page.getByText("Video ID: dQw4w9WgXcQ").waitFor();
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Video ID: dQw4w9WgXcQ").waitFor();
    await page.goto(videoStoryUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "เผยแพร่เรื่อง" }).click();
    await page.goto(videoEditorUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "เผยแพร่", exact: true }).click();
    await page.getByText("เผยแพร่ตอนแล้ว").waitFor();
    await page.goto(`${baseUrl}/watch-video/browser-e2e-${runId}/browser-e2e-video-${runId}/video-episode-${runId}`,
      { waitUntil: "networkidle" });
    await page.locator('iframe[src*="youtube-nocookie.com/embed/dQw4w9WgXcQ"]').waitFor();
    await page.getByRole("heading", { name: videoEpisodeTitle }).waitFor();
    await page.getByText(/only available episode/).first().waitFor();

    const thaiStoryTitle = `นักรบแห่งเงา ${runId}`;
    const thaiSearchFixture = await createSearchFixture(page, {
      title: thaiStoryTitle, tag: "  Fantasy-Thai  ", suffix: runId,
    });

    // Authenticated reader state: bookmark Stories and retain one Episode-level resume per Story.
    await page.goto(`${baseUrl}/stories/browser-e2e-${runId}/browser-e2e-story-${runId}`, { waitUntil: "networkidle" });
    await page.getByText("แสดง 20 จาก 22 ตอน", { exact: true }).waitFor();
    await page.getByRole("button", { name: "โหลดตอนเพิ่มเติม" }).click();
    await page.getByText("แสดง 22 จาก 22 ตอน", { exact: true }).waitFor();
    check(await page.getByText(`Navigation Episode 22 ${runId}`, { exact: false }).count() === 1,
      "Story Detail pagination duplicated or omitted the final Episode.");
    await page.getByRole("button", { name: "บันทึกเข้าคลัง" }).click();
    await page.getByRole("button", { name: "นำออกจากคลัง" }).waitFor();
    await page.locator('a[href*="/read-novel/"]').first().click();
    await page.getByText(testText).waitFor();
    await page.getByRole("link", { name: /Next: Navigation Episode 2/ }).first().click();
    await page.getByText(`Navigation content 2 ${runId}`, { exact: true }).waitFor();
    await page.keyboard.press("ArrowLeft");
    await page.getByText(testText).waitFor();
    await page.keyboard.press("ArrowRight");
    await page.getByText(`Navigation content 2 ${runId}`, { exact: true }).waitFor();
    await page.getByRole("link", { name: /Back to Story/ }).first().click();
    await page.getByText("แสดง 20 จาก 22 ตอน", { exact: true }).waitFor();

    await page.goto(`${baseUrl}/read-novel/browser-e2e-${runId}/browser-e2e-story-${runId}/${novelNavigationFixture.last.slug}`,
      { waitUntil: "networkidle" });
    await page.getByText(`Navigation content 22 ${runId}`, { exact: true }).waitFor();
    await page.getByText(/Next unavailable/).first().waitFor();

    await page.goto(`${baseUrl}/history`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Reading History" }).waitFor();
    await page.getByText(`Navigation Episode 22 ${runId}`, { exact: false }).waitFor();
    check(!(await page.locator("body").innerText()).toLowerCase().includes("mock"),
      "Reading History used a mock fallback.");

    await page.goto(`${baseUrl}/stories/browser-e2e-${runId}/${comicStorySlug}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "บันทึกเข้าคลัง" }).click();
    await page.getByRole("button", { name: "นำออกจากคลัง" }).waitFor();

    await page.goto(`${baseUrl}/library`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: `Browser E2E Story ${runId}`, exact: true }).waitFor();
    await page.getByRole("link", { name: comicStoryTitle, exact: true }).waitFor();
    check(await page.getByRole("link", { name: "อ่านต่อ" }).count() >= 3,
      "Library did not expose resume links for all StoryTypes.");
    const comicBookmark = page.getByRole("heading", { name: comicStoryTitle }).locator("..");
    await comicBookmark.getByRole("button", { name: "ลบออกจากคลัง" }).click();
    await page.reload({ waitUntil: "networkidle" });
    check(await page.getByRole("button", { name: "ลบออกจากคลัง" }).count() === 1,
      "Removed Comic bookmark returned after reload.");
    await page.getByRole("link", { name: `Browser E2E Story ${runId}`, exact: true }).waitFor();

    // Reader private-state isolation: real User A requests are held, then aborted by a real JWT User B transition.
    const readerIsolationUserB = await createSocialUser("reader-isolation-b", `Reader Isolation B ${runId}`);
    const userASession = await page.evaluate(() => ({
      accessToken: localStorage.getItem("novelverse_access_token"),
      refreshToken: localStorage.getItem("novelverse_refresh_token"),
      accessTokenExpiresAt: localStorage.getItem("novelverse_access_token_expires_at"),
      refreshTokenExpiresAt: localStorage.getItem("novelverse_refresh_token_expires_at"),
    }));
    check(Object.values(userASession).every((value) => typeof value === "string" && value.length > 0),
      "User A browser session was incomplete before reader-state isolation checks.");
    const privateReaderRoute = /\/api\/v1\/me\/(?:library|reading-progress)(?:\?|$)/;
    let holdUserAReaderRequests = true;
    let releaseUserAReaderRequests;
    const userAReaderRelease = new Promise((resolve) => { releaseUserAReaderRequests = resolve; });
    let heldUserAReaderRequests = 0;
    let confirmUserAReaderRequestsHeld;
    const userAReaderRequestsHeld = new Promise((resolve) => { confirmUserAReaderRequestsHeld = resolve; });
    const holdUserAReaderResponse = async (route) => {
      if (!holdUserAReaderRequests || route.request().headers().authorization !== `Bearer ${userASession.accessToken}`) {
        await route.continue();
        return;
      }
      heldUserAReaderRequests += 1;
      if (heldUserAReaderRequests >= 2) confirmUserAReaderRequestsHeld();
      await userAReaderRelease;
      await route.continue().catch(() => undefined);
    };
    await page.route(privateReaderRoute, holdUserAReaderResponse);
    await page.reload({ waitUntil: "domcontentloaded" });
    await Promise.race([
      userAReaderRequestsHeld,
      new Promise((_, reject) => setTimeout(() => reject(new Error(
        "Timed out waiting for User A Library private requests to be held.")), 15_000)),
    ]);
    holdUserAReaderRequests = false;
    const userBLibraryResponse = page.waitForResponse((response) =>
      new URL(response.url()).pathname === "/api/v1/me/library" &&
      response.request().headers().authorization === `Bearer ${readerIsolationUserB.tokens.accessToken}` &&
      response.status() === 200, { timeout: 15_000 });
    const userBProgressListResponse = page.waitForResponse((response) =>
      new URL(response.url()).pathname === "/api/v1/me/reading-progress" &&
      response.request().method() === "GET" &&
      response.request().headers().authorization === `Bearer ${readerIsolationUserB.tokens.accessToken}` &&
      response.status() === 200, { timeout: 15_000 });
    await replaceBrowserSession(page, readerIsolationUserB.tokens);
    releaseUserAReaderRequests();
    await Promise.all([userBLibraryResponse, userBProgressListResponse]);
    await page.unroute(privateReaderRoute, holdUserAReaderResponse);
    await page.getByText(`Browser E2E Story ${runId}`, { exact: true }).waitFor({ state: "detached" });
    check(!(await page.locator("body").innerText()).includes(`Browser E2E Story ${runId}`),
      "User A Library rows appeared after the User B session transition.");

    // The same Story/Episode must write for both actors inside one JavaScript module lifetime.
    await replaceBrowserSession(page, userASession);
    const originalReaderPath = `/read-novel/browser-e2e-${runId}/browser-e2e-story-${runId}/browser-e2e-episode-${runId}`;
    const userAProgressWrite = page.waitForResponse((response) =>
      new URL(response.url()).pathname === "/api/v1/me/reading-progress" &&
      response.request().method() === "PUT" &&
      response.request().headers().authorization === `Bearer ${userASession.accessToken}` &&
      response.status() === 200, { timeout: 15_000 });
    await page.goto(`${baseUrl}${originalReaderPath}`, { waitUntil: "networkidle" });
    await page.getByText(testText).waitFor();
    await userAProgressWrite;
    const progressIsolationWindowStartedAt = Date.now();
    await replaceBrowserSession(page, readerIsolationUserB.tokens);
    const userBProgressWrite = page.waitForResponse((response) =>
      new URL(response.url()).pathname === "/api/v1/me/reading-progress" &&
      response.request().method() === "PUT" &&
      response.request().headers().authorization === `Bearer ${readerIsolationUserB.tokens.accessToken}` &&
      response.status() === 200, { timeout: 15_000 });
    await page.getByRole("link", { name: /Back to Story/ }).first().click();
    await page.locator(`a[href="${originalReaderPath}"]`).first().click();
    await page.getByText(testText).waitFor();
    await userBProgressWrite;
    check(Date.now() - progressIsolationWindowStartedAt < 5_000,
      "User A to User B progress isolation did not execute inside the five-second dedupe window.");
    await replaceBrowserSession(page, userASession);

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "อ่านต่อ" }).waitFor();

    const draftStoryTitle = `Browser E2E Draft ${runId}`;
    await page.goto(`${baseUrl}/creator/stories`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "＋ สร้างนิยาย" }).click();
    await page.getByLabel("ชื่อเรื่อง").fill(draftStoryTitle);
    await page.getByRole("button", { name: "สร้าง NOVEL ฉบับร่าง" }).click();
    await page.waitForURL(/\/creator\/stories\/[^/]+$/);

    // Public discovery remains anonymous and routes each StoryType through one shared detail flow.
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    check(!(await page.locator("body").innerText()).toLowerCase().includes("mock"),
      "Public Home exposed mock content.");
    await page.getByText(`Browser E2E Story ${runId}`, { exact: true }).waitFor();
    await page.getByText(comicStoryTitle, { exact: true }).waitFor();
    await page.getByText(videoStoryTitle, { exact: true }).waitFor();
    check(await page.getByText(draftStoryTitle, { exact: true }).count() === 0,
      "Draft Story was discoverable on public Home.");

    const thaiQuery = "แห่งเงา";
    await page.getByLabel("คำค้นหา").fill(thaiQuery);
    await page.getByLabel("ค้นหาเรื่อง").getByRole("button", { name: "ค้นหา", exact: true }).click();
    await page.getByText(thaiStoryTitle, { exact: true }).waitFor();
    check(await page.getByText(`Browser E2E Story ${runId}`, { exact: true }).count() === 0,
      "Thai character-sequence search retained an unrelated Story.");
    check(new URL(page.url()).searchParams.get("q") === thaiQuery,
      "Thai character-sequence query was not stored in the URL.");
    check(!(await page.locator("body").innerText()).toLowerCase().includes("mock"),
      "Thai search exposed mock fallback content.");
    await page.reload({ waitUntil: "networkidle" });
    check(await page.getByLabel("คำค้นหา").inputValue() === thaiQuery,
      "Thai query was not restored after reload.");
    await page.getByText(thaiStoryTitle, { exact: true }).waitFor();
    const thaiSearchUrl = page.url();
    const thaiStoryRequests = [];
    const captureThaiStoryRequest = (request) => {
      if (request.method() === "GET" && new URL(request.url()).pathname.includes("/api/v1/stories/")) {
        thaiStoryRequests.push(request.url());
      }
    };
    page.on("request", captureThaiStoryRequest);
    await page.getByText(thaiStoryTitle, { exact: true }).click();
    await page.waitForURL(/\/stories\/[^/]+\/[^/]+$/);
    await page.getByRole("heading", { name: thaiStoryTitle }).waitFor();
    await page.getByText(thaiSearchFixture.episodeTitle, { exact: false }).waitFor();
    check(!(await page.locator("body").innerText()).toLowerCase().includes("mock"),
      "Thai Story Detail exposed mock fallback content.");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("heading", { name: thaiStoryTitle }).waitFor();
    await page.getByText(thaiSearchFixture.episodeTitle, { exact: false }).waitFor();
    await page.getByRole("link", { name: "เปิดอ่าน" }).click();
    await page.waitForURL(/\/read-novel\/[^/]+\/[^/]+\/[^/]+$/);
    await page.getByText(thaiSearchFixture.contentText, { exact: true }).waitFor();
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText(thaiSearchFixture.contentText, { exact: true }).waitFor();
    page.off("request", captureThaiStoryRequest);
    const encodedThaiStorySlug = encodeURIComponent(thaiSearchFixture.storySlug);
    const encodedThaiEpisodeSlug = encodeURIComponent(thaiSearchFixture.episodeSlug);
    check(thaiStoryRequests.some((url) => url.includes(encodedThaiStorySlug)),
      "Thai Story Detail did not issue a single-encoded Story request.");
    check(thaiStoryRequests.some((url) => url.includes(encodedThaiEpisodeSlug)),
      "Thai reader did not issue a single-encoded Episode request.");
    check(thaiStoryRequests.every((url) => !url.includes("%25E0")),
      "Thai Story or Episode request was double encoded.");
    await page.goto(thaiSearchUrl, { waitUntil: "networkidle" });
    await page.getByText(thaiStoryTitle, { exact: true }).waitFor();
    await page.getByRole("button", { name: "ล้างตัวกรอง" }).click();

    const tagQuery = "  fAnTaSy-ThAi  ";
    await page.getByLabel("แท็ก").fill(tagQuery);
    await page.getByLabel("ภาษา").fill("th");
    await page.getByText(thaiStoryTitle, { exact: true }).waitFor();
    check(await page.getByText(`Browser E2E Story ${runId}`, { exact: true }).count() === 0,
      "Normalized textual tag filter retained a Story without the tag.");
    check(new URL(page.url()).searchParams.get("tag") === tagQuery,
      "Tag filter did not use the canonical textual tag query parameter.");
    check(new URL(page.url()).searchParams.get("languageCode") === "th",
      "Tag filter did not combine with the language filter.");
    await page.reload({ waitUntil: "networkidle" });
    check(await page.getByLabel("แท็ก").inputValue() === tagQuery,
      "Normalized textual tag filter was not restored after reload.");
    await page.getByText(thaiStoryTitle, { exact: true }).waitFor();
    await page.getByRole("button", { name: "ล้างตัวกรอง" }).click();

    await page.getByLabel("คำค้นหา").fill(`browser   e2e story ${runId}`);
    await page.getByLabel("ค้นหาเรื่อง").getByRole("button", { name: "ค้นหา", exact: true }).click();
    await page.getByText(`Browser E2E Story ${runId}`, { exact: true }).waitFor();
    check(new URL(page.url()).searchParams.get("sort") === "RELEVANCE",
      "Search did not use URL-backed RELEVANCE ordering.");
    await page.getByText(`ตอนล่าสุด: Navigation Episode 22 ${runId}`, { exact: false }).waitFor();
    await page.reload({ waitUntil: "networkidle" });
    check((await page.getByLabel("คำค้นหา").inputValue()).includes(`browser e2e story ${runId}`),
      "Search URL state was not restored after reload.");
    await page.getByRole("button", { name: "ล้างตัวกรอง" }).click();
    check(new URL(page.url()).search === "", "Clear filters did not canonicalize the Home URL.");

    await page.goto(`${baseUrl}/?creatorSlug=browser-e2e-${runId}&languageCode=th&contentRating=GENERAL&sort=UPDATED`,
      { waitUntil: "networkidle" });
    await page.getByText(`Browser E2E Story ${runId}`, { exact: true }).waitFor();
    await page.getByText(comicStoryTitle, { exact: true }).waitFor();
    await page.getByText(videoStoryTitle, { exact: true }).waitFor();
    check(await page.getByText(draftStoryTitle, { exact: true }).count() === 0,
      "Combined filters exposed an ineligible Story.");
    await page.getByLabel("เรียงตาม").selectOption("LATEST");

    await page.getByRole("button", { name: "การ์ตูน" }).click();
    await page.getByText(comicStoryTitle, { exact: true }).waitFor();
    check(await page.getByText(`Browser E2E Story ${runId}`, { exact: true }).count() === 0,
      "StoryType filter did not remove NOVEL stories.");
    await page.getByRole("button", { name: "ทั้งหมด" }).click();
    const categoryOptions = await page.getByLabel("หมวดหมู่").locator("option").evaluateAll(
      (options) => options.map((option) => option.value).filter(Boolean));
    check(categoryOptions.length > 0, "Public category filter had no active categories.");
    await page.getByLabel("หมวดหมู่").selectOption(categoryOptions[0]);
    await page.getByText(comicStoryTitle, { exact: true }).waitFor();

    await page.getByText(`Browser E2E Story ${runId}`, { exact: true }).click();
    await page.waitForURL(`**/stories/browser-e2e-${runId}/browser-e2e-story-${runId}`);
    await page.getByText("Browser E2E Creator", { exact: false }).waitFor();
    await page.getByText(`Browser E2E Episode ${runId}`, { exact: false }).waitFor();
    await page.getByRole("link", { name: "เปิดอ่าน" }).first().click();
    await page.waitForURL(`**/read-novel/browser-e2e-${runId}/browser-e2e-story-${runId}/browser-e2e-episode-${runId}`);
    await page.getByText(testText).waitFor();
    await page.getByTestId("novel-content-renderer").locator("img").waitFor();
    await waitForPendingEngagementResponses();
    const novelSession = engagementStarts.filter((item) => item?.targetType === "EPISODE").at(-1);
    check(novelSession, "NOVEL engagement session response was not observed.");
    const novelEngagement = await page.evaluate(async ({ runId }) => {
      const api = "http://localhost:5039"; const token = localStorage.getItem("novelverse_access_token");
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      const content = await fetch(`${api}/api/v1/stories/browser-e2e-${runId}/browser-e2e-story-${runId}/episodes/browser-e2e-episode-${runId}/content`).then((r) => r.json());
      const clientSessionKey = crypto.randomUUID();
      const session = await fetch(`${api}/api/v1/engagement/sessions`, { method: "POST", headers,
        credentials: "include", body: JSON.stringify({ targetType: "EPISODE", targetId: content.episodeId,
          clientSessionKey, idempotencyKey: crypto.randomUUID() }) }).then((r) => r.json());
      await fetch(`${api}/api/v1/dev/engagement/sessions/${session.sessionId}/advance`,
        { method: "POST", headers, body: JSON.stringify({ seconds: 31 }) });
      return fetch(`${api}/api/v1/engagement/sessions/${session.sessionId}/activity`, {
        method: "POST", headers, credentials: "include", body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(), sequence: 1, clientSessionKey,
          evidenceType: "COMPLETION", reportedActiveSeconds: 30, progressPercent: 100,
          reachedContentId: content.blocks.at(-1).id, reachedPosition: content.blocks.length,
          totalItems: content.blocks.length, finalContentReached: true,
        }),
      }).then((r) => r.json());
    }, { runId });
    check(novelEngagement.qualified && novelEngagement.completed,
      "NOVEL valid block evidence did not qualify and complete.");

    await page.goto(`${baseUrl}/stories/browser-e2e-${runId}/${comicStorySlug}`, { waitUntil: "networkidle" });
    await page.getByText(comicEpisodeTitle, { exact: false }).waitFor();
    await page.getByRole("link", { name: "เปิดอ่าน" }).click();
    await page.getByTestId("comic-reader").locator("img").waitFor();
    await waitForPendingEngagementResponses();
    check(engagementStarts.filter((item) => item?.targetType === "EPISODE").at(-1),
      "COMIC engagement session response was not observed.");
    const comicEngagement = await page.evaluate(async ({ runId, storySlug, episodeSlug }) => {
      const api = "http://localhost:5039"; const token = localStorage.getItem("novelverse_access_token");
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      const content = await fetch(`${api}/api/v1/stories/browser-e2e-${runId}/${storySlug}/episodes/${episodeSlug}/comic-pages`).then((r) => r.json());
      const clientSessionKey = crypto.randomUUID();
      const session = await fetch(`${api}/api/v1/engagement/sessions`, { method: "POST", headers,
        credentials: "include", body: JSON.stringify({ targetType: "EPISODE", targetId: content.episodeId,
          clientSessionKey, idempotencyKey: crypto.randomUUID() }) }).then((r) => r.json());
      await fetch(`${api}/api/v1/dev/engagement/sessions/${session.sessionId}/advance`,
        { method: "POST", headers, body: JSON.stringify({ seconds: 31 }) });
      return fetch(`${api}/api/v1/engagement/sessions/${session.sessionId}/activity`, {
        method: "POST", headers, credentials: "include", body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(), sequence: 1, clientSessionKey,
          evidenceType: "COMPLETION", reportedActiveSeconds: 30, progressPercent: 100,
          reachedContentId: content.pages.at(-1).id, reachedPosition: content.pages.length,
          totalItems: content.pages.length, finalContentReached: true,
        }),
      }).then((r) => r.json());
    }, { runId, storySlug: comicStorySlug, episodeSlug: comicEpisodeSlug });
    check(comicEngagement.qualified && comicEngagement.completed,
      "COMIC valid page evidence did not qualify and complete.");

    await page.goto(`${baseUrl}/stories/browser-e2e-${runId}/browser-e2e-video-${runId}`, { waitUntil: "networkidle" });
    await page.getByText(videoEpisodeTitle, { exact: false }).waitFor();
    await page.getByRole("link", { name: "เปิดอ่าน" }).click();
    await page.locator('iframe[src*="youtube-nocookie.com/embed/dQw4w9WgXcQ"]').waitFor();
    await waitForPendingEngagementResponses();
    const videoSession = engagementStarts.filter((item) => item?.targetType === "EPISODE").at(-1);
    const videoEngagement = await page.evaluate(async ({ episodeId }) => {
      const api = "http://localhost:5039"; const token = localStorage.getItem("novelverse_access_token");
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      const clientSessionKey = crypto.randomUUID();
      const session = await fetch(`${api}/api/v1/engagement/sessions`, { method: "POST", headers,
        credentials: "include", body: JSON.stringify({ targetType: "EPISODE", targetId: episodeId,
          clientSessionKey, idempotencyKey: crypto.randomUUID() }) }).then((r) => r.json());
      await fetch(`${api}/api/v1/dev/engagement/sessions/${session.sessionId}/advance`,
        { method: "POST", headers, body: JSON.stringify({ seconds: 31 }) });
      return fetch(`${api}/api/v1/engagement/sessions/${session.sessionId}/activity`, {
        method: "POST", headers, credentials: "include", body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(), sequence: 1, clientSessionKey,
          evidenceType: "COMPLETION", reportedActiveSeconds: 30, progressPercent: 100,
          playbackSeconds: 200, durationSeconds: 200, providerEnded: true,
        }),
      }).then((r) => r.json());
    }, { episodeId: videoSession.targetId });
    check(!videoEngagement.qualified && !videoEngagement.completed,
      "VIDEO client-only playback evidence falsely qualified/completed.");

    await page.goto(`${baseUrl}/stories/browser-e2e-${runId}/browser-e2e-story-${runId}`, { waitUntil: "networkidle" });
    await page.reload({ waitUntil: "networkidle" });
    await waitForPendingEngagementResponses();
    check(engagementStarts.some((item) => item?.targetType === "STORY"),
      "Story-detail engagement session was not accepted.");
    check(engagementStarts.filter((item) => item?.targetType === "EPISODE").length >= 3,
      "NOVEL, COMIC, and VIDEO did not each start owning-Episode engagement sessions.");
    check(engagementStarts.some((item) => item?.targetType === "STORY" && item.countedNewView === false),
      "Story refresh did not exercise server-side 30-minute view deduplication.");
    check(engagementStarts.filter((item) => item?.targetType === "EPISODE")
      .every((item) => item.qualified === false && item.completed === false),
      "A reader session falsely reported qualification/completion without accepted evidence.");
    check((await page.getByText(/views|ยอดดู|ครั้งที่อ่าน/i).count()) === 0,
      "Public engagement count UI was unexpectedly rendered.");

    // Social Engagement: real browser UI, JWT authentication, API, and PostgreSQL persistence.
    const publicStoryPath = `/stories/browser-e2e-${runId}/browser-e2e-story-${runId}`;
    const creatorSlug = `browser-e2e-${runId}`;
    const creatorSignIn = await apiCall("/api/v1/dev/auth/social-sign-in", {
      method: "POST",
      body: {
        provider: "GOOGLE", providerSubject: `browser-e2e-${runId}`,
        email: `browser-e2e-${runId}@example.test`, displayName: "Browser E2E Creator",
      },
    });
    check(creatorSignIn.response.ok, "Creator A social E2E sign-in failed.");
    const creatorIdentity = {
      id: creatorSignIn.content.user.id,
      tokens: creatorSignIn.content.tokens,
    };
    const dashboardCategories = await apiCall("/api/v1/categories", {
      token: creatorIdentity.tokens.accessToken,
    });
    const dashboardCategory = dashboardCategories.content.find((item) => item.isActive);
    check(dashboardCategories.response.ok && dashboardCategory,
      "Dashboard lifecycle E2E fixture requires an active category.");
    const createDashboardLifecycleStory = async (title, storyType) => {
      const created = await apiCall("/api/v1/creator/stories", {
        token: creatorIdentity.tokens.accessToken,
        method: "POST",
        body: {
          title,
          slug: null,
          synopsis: `Dashboard lifecycle proof ${runId}`,
          languageCode: "en",
          visibility: "UNLISTED",
          contentRating: "GENERAL",
          coverMediaAssetId: null,
          categoryIds: [dashboardCategory.id],
          tags: [],
          storyType,
          readingMode: "VERTICAL",
        },
      });
      check(created.response.ok, `${title} Dashboard lifecycle fixture creation failed.`);
      return created.content;
    };
    const archivedDashboardStory = await createDashboardLifecycleStory(
      `Dashboard Archived Story ${runId}`, "VIDEO");
    const deletedDashboardStory = await createDashboardLifecycleStory(
      `Dashboard Deleted Secret ${runId}`, "NOVEL");
    databaseCommand(
      `UPDATE stories
       SET status = 'Archived', updated_at = now() + interval '2 minutes'
       WHERE id = ${sqlLiteral(archivedDashboardStory.id)}::uuid;
       UPDATE stories
       SET status = 'Deleted', deleted_at = now(), updated_at = now() + interval '3 minutes'
       WHERE id = ${sqlLiteral(deletedDashboardStory.id)}::uuid;`,
    );
    const userB = await createSocialUser("social-user-b", `Social User B ${runId}`);
    const userC = await createSocialUser("social-user-c", `Social User C ${runId}`);

    const performanceContent = await apiCall(
      `/api/v1/stories/${creatorSlug}/browser-e2e-story-${runId}/episodes/browser-e2e-episode-${runId}/content`,
      { token: userB.tokens.accessToken });
    check(performanceContent.response.ok && performanceContent.content.blocks.length > 0,
      "Dashboard suppression E2E fixture could not load the real Episode content.");
    const performanceSessionKey = crypto.randomUUID();
    const performanceSession = await apiCall("/api/v1/engagement/sessions", {
      token: userB.tokens.accessToken,
      method: "POST",
      body: {
        targetType: "EPISODE", targetId: episodeId,
        clientSessionKey: performanceSessionKey, idempotencyKey: crypto.randomUUID(),
      },
    });
    check(performanceSession.response.ok, "Dashboard suppression E2E session start failed.");
    const advancedPerformance = await apiCall(
      `/api/v1/dev/engagement/sessions/${performanceSession.content.sessionId}/advance`, {
        token: userB.tokens.accessToken, method: "POST", body: { seconds: 31 },
      });
    check(advancedPerformance.response.ok, "Dashboard suppression E2E time advance failed.");
    const performanceActivity = await apiCall(
      `/api/v1/engagement/sessions/${performanceSession.content.sessionId}/activity`, {
        token: userB.tokens.accessToken,
        method: "POST",
        body: {
          idempotencyKey: crypto.randomUUID(), sequence: 1,
          clientSessionKey: performanceSessionKey, evidenceType: "COMPLETION",
          reportedActiveSeconds: 30, progressPercent: 100,
          reachedContentId: performanceContent.content.blocks.at(-1).id,
          reachedPosition: performanceContent.content.blocks.length,
          totalItems: performanceContent.content.blocks.length,
          finalContentReached: true,
        },
      });
    check(performanceActivity.response.ok && performanceActivity.content.qualified,
      "Dashboard suppression E2E fixture did not create a qualified real engagement.");
    const metricTimestamp = new Date();
    metricTimestamp.setUTCDate(metricTimestamp.getUTCDate() - 1);
    metricTimestamp.setUTCHours(12, 0, 0, 0);
    databaseCommand(
      `UPDATE engagement_sessions
       SET qualified_at = ${timestampSqlLiteral(metricTimestamp.toISOString())},
           completed_at = ${timestampSqlLiteral(metricTimestamp.toISOString())},
           updated_at = ${timestampSqlLiteral(metricTimestamp.toISOString())}
       WHERE id = ${sqlLiteral(performanceSession.content.sessionId)}::uuid;
       UPDATE engagement_activity_facts
       SET server_accepted_at = ${timestampSqlLiteral(metricTimestamp.toISOString())},
           created_at = ${timestampSqlLiteral(metricTimestamp.toISOString())}
       WHERE session_id = ${sqlLiteral(performanceSession.content.sessionId)}::uuid;`,
    );
    const viewerD = await createSocialUser("dashboard-viewer-d", `Dashboard Viewer D ${runId}`);
    const viewerE = await createSocialUser("dashboard-viewer-e", `Dashboard Viewer E ${runId}`);
    const viewerF = await createSocialUser("dashboard-viewer-f", `Dashboard Viewer F ${runId}`);
    const viewerG = await createSocialUser("dashboard-viewer-g", `Dashboard Viewer G ${runId}`);
    communityResult = await runCommunityDiscussionE2E(browser, {
      storyPath: publicStoryPath,
      storyRoute: `/api/v1/stories/${creatorSlug}/browser-e2e-story-${runId}/comments`,
      novelRoute: `/api/v1/stories/${creatorSlug}/browser-e2e-story-${runId}/episodes/browser-e2e-episode-${runId}/comments`,
      comicRoute: `/api/v1/stories/${creatorSlug}/browser-e2e-comic-${runId}/episodes/comic-episode-${runId}/comments`,
      videoRoute: `/api/v1/stories/${creatorSlug}/browser-e2e-video-${runId}/episodes/video-episode-${runId}/comments`,
      creator: { ...creatorIdentity, slug: creatorSlug },
      userB,
      userC,
      paginationUsers: [viewerD, viewerE, viewerF, viewerG],
    });
    await createQualifiedDashboardSession(
      viewerD, episodeId, performanceContent.content, metricTimestamp.toISOString());
    await createQualifiedDashboardSession(
      viewerE, episodeId, performanceContent.content, metricTimestamp.toISOString());
    await createQualifiedDashboardSession(
      viewerF, episodeId, performanceContent.content, metricTimestamp.toISOString());
    const excludedToday = new Date();
    excludedToday.setUTCHours(0, 0, 0, 0);
    const viewerGSessionId = await createQualifiedDashboardSession(
      viewerG, episodeId, performanceContent.content, excludedToday.toISOString());

    const anonymousSocialContext = await browser.newContext({ locale: "th-TH" });
    const anonymousSocialPage = await anonymousSocialContext.newPage();
    await anonymousSocialPage.goto(`${baseUrl}${publicStoryPath}`, { waitUntil: "networkidle" });
    await anonymousSocialPage.getByText(`Browser E2E Story ${runId}`, { exact: true }).waitFor();
    check(await anonymousSocialPage.getByRole("button", { name: "Like", exact: true }).getAttribute("aria-pressed") === "false",
      "Anonymous Story Detail leaked private Like state.");
    check(await anonymousSocialPage.getByRole("button", { name: "Follow", exact: true }).getAttribute("aria-pressed") === "false",
      "Anonymous Story Detail leaked private Follow state.");
    const anonymousSocialText = (await anonymousSocialPage.locator("body").innerText()).toLowerCase();
    check(!anonymousSocialText.includes("liked by") && !anonymousSocialText.includes("followers"),
      "Anonymous Story Detail exposed a liker or follower identity list.");
    await anonymousSocialPage.getByRole("button", { name: "Like", exact: true }).click();
    await anonymousSocialPage.waitForURL("**/login?next=**");
    await anonymousSocialPage.goto(`${baseUrl}${publicStoryPath}`, { waitUntil: "networkidle" });
    await anonymousSocialPage.getByRole("button", { name: "Follow", exact: true }).click();
    await anonymousSocialPage.waitForURL("**/login?next=**");

    const userBContext = await browser.newContext({ locale: "th-TH" });
    const userBPage = await userBContext.newPage();
    await setBrowserSession(userBPage, userB.tokens);
    await userBPage.goto(`${baseUrl}${publicStoryPath}`, { waitUntil: "networkidle" });
    await userBPage.getByText(`Browser E2E Story ${runId}`, { exact: true }).waitFor();
    const likeResponse = userBPage.waitForResponse((response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === `/api/v1/stories/${storyId}/like`);
    await userBPage.getByRole("button", { name: "Like", exact: true }).click();
    check((await likeResponse).status() === 200, "User B Like UI request was not accepted.");
    await userBPage.getByRole("button", { name: "Unlike", exact: true }).waitFor();
    check(storyLikeCount(storyId, userB.id) === 1 && storyLikeCount(storyId) === 1,
      "Like UI did not persist exactly one relationship or derived count.");
    const repeatedLike = await userBPage.evaluate(async (value) => fetch(
      `http://localhost:5039/api/v1/stories/${value.storyId}/like`,
      { method: "PUT", headers: { Authorization: `Bearer ${value.token}` } }).then((response) => response.status),
    { storyId, token: userB.tokens.accessToken });
    check(repeatedLike === 200 && storyLikeCount(storyId, userB.id) === 1 && storyLikeCount(storyId) === 1,
      "Repeated Like was not idempotent.");

    const unlikeResponse = userBPage.waitForResponse((response) =>
      response.request().method() === "DELETE" &&
      new URL(response.url()).pathname === `/api/v1/stories/${storyId}/like`);
    await userBPage.getByRole("button", { name: "Unlike", exact: true }).click();
    check((await unlikeResponse).status() === 200, "User B Unlike UI request was not accepted.");
    await userBPage.getByRole("button", { name: "Like", exact: true }).waitFor();
    const repeatedUnlike = await userBPage.evaluate(async (value) => fetch(
      `http://localhost:5039/api/v1/stories/${value.storyId}/like`,
      { method: "DELETE", headers: { Authorization: `Bearer ${value.token}` } }).then((response) => response.status),
    { storyId, token: userB.tokens.accessToken });
    check(repeatedUnlike === 200 && storyLikeCount(storyId, userB.id) === 0 && storyLikeCount(storyId) === 0,
      "Repeated Unlike was not idempotent.");

    const socialTabA = await userBContext.newPage();
    const socialTabB = await userBContext.newPage();
    await Promise.all([
      socialTabA.goto(`${baseUrl}${publicStoryPath}`, { waitUntil: "networkidle" }),
      socialTabB.goto(`${baseUrl}${publicStoryPath}`, { waitUntil: "networkidle" }),
    ]);
    await Promise.all([
      socialTabA.getByRole("button", { name: "Like", exact: true }).click(),
      socialTabB.getByRole("button", { name: "Like", exact: true }).click(),
    ]);
    await Promise.all([
      socialTabA.getByRole("button", { name: "Unlike", exact: true }).waitFor(),
      socialTabB.getByRole("button", { name: "Unlike", exact: true }).waitFor(),
    ]);
    check(storyLikeCount(storyId, userB.id) === 1 && storyLikeCount(storyId) === 1,
      "Concurrent browser Likes created duplicate relationships or count drift.");

    const followResponse = socialTabA.waitForResponse((response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === `/api/v1/creators/by-slug/${creatorSlug}/follow`);
    await socialTabA.getByRole("button", { name: "Follow", exact: true }).click();
    check((await followResponse).status() === 200, "User B Follow UI request was not accepted.");
    await socialTabA.getByRole("button", { name: "Following", exact: true }).waitFor();
    check(creatorFollowCount(creatorSlug, userB.id) === 1 && creatorFollowCount(creatorSlug) === 1,
      "Follow UI did not persist exactly one relationship or derived count.");
    const repeatedFollow = await socialTabA.evaluate(async (value) => fetch(
      `http://localhost:5039/api/v1/creators/by-slug/${value.creatorSlug}/follow`,
      { method: "PUT", headers: { Authorization: `Bearer ${value.token}` } }).then((response) => response.status),
    { creatorSlug, token: userB.tokens.accessToken });
    check(repeatedFollow === 200 && creatorFollowCount(creatorSlug, userB.id) === 1 &&
      creatorFollowCount(creatorSlug) === 1, "Repeated Follow was not idempotent.");

    const unfollowResponse = socialTabA.waitForResponse((response) =>
      response.request().method() === "DELETE" &&
      new URL(response.url()).pathname === `/api/v1/creators/by-slug/${creatorSlug}/follow`);
    await socialTabA.getByRole("button", { name: "Following", exact: true }).click();
    check((await unfollowResponse).status() === 200, "User B Unfollow UI request was not accepted.");
    await socialTabA.getByRole("button", { name: "Follow", exact: true }).waitFor();
    const repeatedUnfollow = await socialTabA.evaluate(async (value) => fetch(
      `http://localhost:5039/api/v1/creators/by-slug/${value.creatorSlug}/follow`,
      { method: "DELETE", headers: { Authorization: `Bearer ${value.token}` } }).then((response) => response.status),
    { creatorSlug, token: userB.tokens.accessToken });
    check(repeatedUnfollow === 200 && creatorFollowCount(creatorSlug, userB.id) === 0 &&
      creatorFollowCount(creatorSlug) === 0, "Repeated Unfollow was not idempotent.");

    await Promise.all([
      socialTabA.getByRole("button", { name: "Follow", exact: true }).click(),
      socialTabB.getByRole("button", { name: "Follow", exact: true }).click(),
    ]);
    await Promise.all([
      socialTabA.getByRole("button", { name: "Following", exact: true }).waitFor(),
      socialTabB.getByRole("button", { name: "Following", exact: true }).waitFor(),
    ]);
    check(creatorFollowCount(creatorSlug, userB.id) === 1 && creatorFollowCount(creatorSlug) === 1,
      "Concurrent browser Follows created duplicate relationships or count drift.");

    const creatorContext = await browser.newContext({ locale: "th-TH" });
    const creatorPage = await creatorContext.newPage();
    await setBrowserSession(creatorPage, creatorIdentity.tokens);
    await creatorPage.goto(`${baseUrl}${publicStoryPath}`, { waitUntil: "networkidle" });
    const selfFollowResponse = creatorPage.waitForResponse((response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === `/api/v1/creators/by-slug/${creatorSlug}/follow`);
    await creatorPage.getByRole("button", { name: "Follow", exact: true }).click();
    check((await selfFollowResponse).status() === 400,
      "Creator self-follow did not return the documented validation rejection.");
    check(creatorFollowCount(creatorSlug, creatorIdentity.id) === 0,
      "Creator self-follow created a relationship row.");

    const assignedModerator = await apiCall(`/api/v1/dev/auth/users/${creatorIdentity.id}/role`, {
      method: "PUT", body: { role: "MODERATOR" },
    });
    check(assignedModerator.response.status === 204, "Social E2E moderator role assignment failed.");
    const moderatorSignIn = await apiCall("/api/v1/dev/auth/social-sign-in", {
      method: "POST",
      body: {
        provider: "GOOGLE", providerSubject: `browser-e2e-${runId}`,
        email: `browser-e2e-${runId}@example.test`, displayName: "Browser E2E Creator",
      },
    });
    check(moderatorSignIn.response.ok, "Social E2E moderator token refresh failed.");
    const moderatorToken = moderatorSignIn.content.tokens.accessToken;

    const hideStory = await apiCall("/api/v1/moderation/actions/hide", {
      token: moderatorToken, method: "POST",
      body: { targetType: "STORY", targetId: storyId, reportId: null,
        reasonCode: "OTHER", note: "Social Browser E2E Story retention" },
    });
    check(hideStory.response.ok, "Social E2E Story hide failed.");
    await creatorPage.goto(`${baseUrl}/creator/dashboard`, { waitUntil: "networkidle" });
    await creatorPage.getByRole("heading", { level: 1, name: "Browser E2E Creator" }).waitFor();
    await creatorPage.getByText("Insufficient data", { exact: true }).waitFor();
    const hiddenDashboardStory = creatorPage.locator(
      'section[aria-labelledby="dashboard-content"] li',
    ).filter({ hasText: `Browser E2E Story ${runId}` }).first();
    await hiddenDashboardStory.getByText("Hidden", { exact: true }).waitFor();
    check(await hiddenDashboardStory.getByRole("link", { name: "View public Story" }).count() === 0,
      "Owner Dashboard exposed a public action for a hidden Story.");
    check(!(await creatorPage.locator("body").innerText()).includes("Social Browser E2E Story retention"),
      "Owner Dashboard exposed an internal moderation note.");
    const dashboardBody = await creatorPage.locator("body").innerText();
    check(dashboardBody.includes(`Dashboard Archived Story ${runId}`),
      "Archived Story was not retained in its owner's Dashboard.");
    check(!dashboardBody.includes(`Dashboard Deleted Secret ${runId}`),
      "Deleted Story title leaked into its owner's Dashboard.");
    check(["NOVEL", "COMIC", "VIDEO"].every((type) => dashboardBody.includes(type)),
      "Mixed NOVEL, COMIC, and VIDEO content was not represented in the Dashboard.");
    const persistedStoryCount = databaseScalar(
      `SELECT count(*) FROM stories
       WHERE creator_user_id = ${sqlLiteral(creatorIdentity.id)}::uuid
         AND status <> 'Deleted';`,
    );
    const storyOverviewCard = creatorPage.locator(
      'section[aria-labelledby="dashboard-overview"] li',
    ).filter({ hasText: "Stories" });
    check(await storyOverviewCard.getByText(String(persistedStoryCount), { exact: true }).count() === 1,
      "Dashboard Story overview count did not match persisted owner data.");
    check(await creatorPage.locator(
      'section[aria-labelledby="dashboard-content"] ul > li',
    ).count() <= 10,
    "Dashboard recent content exceeded its two bounded five-item lists.");
    check(await creatorPage.locator(
      'section[aria-labelledby="dashboard-attention"] ul > li',
    ).count() <= 10,
    "Dashboard attention output exceeded ten items.");
    check(await creatorPage.getByRole("link", { name: "Create Story", exact: true }).count() === 1 &&
      await creatorPage.getByRole("link", { name: "Edit Profile", exact: true }).count() === 1,
    "Dashboard quick actions did not match the returned creator capabilities.");
    await creatorPage.reload({ waitUntil: "networkidle" });
    await creatorPage.getByText(`Dashboard Archived Story ${runId}`, { exact: true }).waitFor();
    check(!(await creatorPage.locator("body").innerText()).includes(`Dashboard Deleted Secret ${runId}`),
      "Dashboard reload did not preserve server-authoritative lifecycle truth.");

    await creatorPage.getByRole("button", { name: "Refresh", exact: true }).click();
    await creatorPage.getByText("Insufficient data", { exact: true }).waitFor();
    check(!(await creatorPage.locator("body").innerText()).includes("Qualified Views"),
      "Four-viewer Dashboard cell leaked a sensitive metric label or exact value.");
    databaseCommand(
      `UPDATE engagement_sessions
       SET qualified_at = ${timestampSqlLiteral(metricTimestamp.toISOString())},
           completed_at = ${timestampSqlLiteral(metricTimestamp.toISOString())},
           updated_at = ${timestampSqlLiteral(metricTimestamp.toISOString())}
       WHERE id = ${sqlLiteral(viewerGSessionId)}::uuid;
       UPDATE engagement_activity_facts
       SET server_accepted_at = ${timestampSqlLiteral(metricTimestamp.toISOString())},
           created_at = ${timestampSqlLiteral(metricTimestamp.toISOString())}
       WHERE session_id = ${sqlLiteral(viewerGSessionId)}::uuid;`,
    );
    await creatorPage.getByRole("button", { name: "Refresh", exact: true }).click();
    const qualifiedViewsCard = creatorPage.locator(
      'section[aria-labelledby="dashboard-performance"] li',
    ).filter({ hasText: "Qualified Views" });
    await qualifiedViewsCard.getByText("5", { exact: true }).waitFor();
    check(await creatorPage.getByText("Insufficient data", { exact: true }).count() === 0,
      "Five-viewer Dashboard cell remained suppressed.");
    await anonymousSocialPage.goto(`${baseUrl}${publicStoryPath}`, { waitUntil: "networkidle" });
    check(await anonymousSocialPage.getByText(`Browser E2E Story ${runId}`, { exact: true }).count() === 0,
      "Hidden Story remained available through the public browser route.");
    const hiddenStory = await apiCall(`/api/v1/stories/${creatorSlug}/browser-e2e-story-${runId}`);
    check(hiddenStory.response.status === 404 && storyLikeCount(storyId, userB.id) === 1,
      "Hidden Story leaked publicly or destroyed its retained Like relationship.");
    const restoreStory = await apiCall("/api/v1/moderation/actions/restore", {
      token: moderatorToken, method: "POST",
      body: { targetType: "STORY", targetId: storyId, reportId: null,
        reasonCode: "OTHER", note: "Social Browser E2E Story restore" },
    });
    check(restoreStory.response.ok, "Social E2E Story restore failed.");

    const hideCreator = await apiCall("/api/v1/moderation/actions/hide", {
      token: moderatorToken, method: "POST",
      body: { targetType: "USER", targetId: creatorIdentity.id, reportId: null,
        reasonCode: "OTHER", note: "Social Browser E2E Creator retention" },
    });
    check(hideCreator.response.ok, "Social E2E Creator hide failed.");
    check(creatorFollowCount(creatorSlug, userB.id) === 1,
      "Hidden Creator moderation destroyed the retained Follow relationship.");
    const authoredStoryWhileCreatorHidden = await apiCall(
      `/api/v1/stories/${creatorSlug}/browser-e2e-story-${runId}`);
    check(authoredStoryWhileCreatorHidden.response.ok,
      "Creator-profile moderation incorrectly concealed an independently visible Story.");
    const restoreCreator = await apiCall("/api/v1/moderation/actions/restore", {
      token: moderatorToken, method: "POST",
      body: { targetType: "USER", targetId: creatorIdentity.id, reportId: null,
        reasonCode: "OTHER", note: "Social Browser E2E Creator restore" },
    });
    check(restoreCreator.response.ok, "Social E2E Creator restore failed.");

    const isolationContext = await browser.newContext({ locale: "th-TH" });
    const isolationPage = await isolationContext.newPage();
    await setBrowserSession(isolationPage, creatorIdentity.tokens);
    await isolationPage.goto(`${baseUrl}/creator/dashboard`, { waitUntil: "networkidle" });
    await isolationPage.getByRole("heading", { level: 1, name: "Browser E2E Creator" }).waitFor();
    await isolationPage.evaluate((tokens) => {
      localStorage.setItem("novelverse_access_token", tokens.accessToken);
      localStorage.setItem("novelverse_refresh_token", tokens.refreshToken);
      localStorage.setItem("novelverse_access_token_expires_at", tokens.accessTokenExpiresAt);
      localStorage.setItem("novelverse_refresh_token_expires_at", tokens.refreshTokenExpiresAt);
    }, userB.tokens);
    await isolationPage.reload({ waitUntil: "networkidle" });
    await isolationPage.getByRole("heading", { level: 1, name: `Social User B ${runId}` }).waitFor();
    const isolatedBody = await isolationPage.locator("body").innerText();
    check(!isolatedBody.includes(`Browser E2E Story ${runId}`) &&
      !isolatedBody.includes(`Dashboard Archived Story ${runId}`),
    "Sequential Creator B login retained Creator A Dashboard state.");
    await isolationContext.close();

    const terminalContext = await browser.newContext({ locale: "th-TH" });
    const terminalPage = await terminalContext.newPage();
    await setBrowserSession(terminalPage, viewerD.tokens);
    await terminalPage.goto(`${baseUrl}/creator/dashboard`, { waitUntil: "networkidle" });
    await terminalPage.getByRole("heading", { level: 1, name: `Dashboard Viewer D ${runId}` }).waitFor();
    await terminalPage.evaluate(() => {
      localStorage.setItem("novelverse_access_token", "invalid-dashboard-access");
      localStorage.setItem("novelverse_refresh_token", "invalid-dashboard-refresh");
    });
    await terminalPage.goto(`${baseUrl}/creator/dashboard`, { waitUntil: "domcontentloaded" });
    await terminalPage.waitForURL((url) =>
      url.pathname === "/login" &&
      url.searchParams.get("next") === "/creator/dashboard");
    check(!(await terminalPage.locator("body").innerText()).includes(`Dashboard Viewer D ${runId}`),
      "Terminal Dashboard 401 retained private confirmed content.");
    await terminalContext.close();

    const pendingIdentity = {
      provider: "GOOGLE",
      providerSubject: `dashboard-pending-${runId}`,
      email: `dashboard-pending-${runId}@browser-e2e.test`,
      displayName: `Dashboard Pending ${runId}`,
    };
    const pendingSignIn = await apiCall("/api/v1/dev/auth/social-sign-in", {
      method: "POST", body: pendingIdentity,
    });
    check(pendingSignIn.response.ok, "Dashboard 403 fixture sign-in failed.");
    const forbiddenDashboard = await apiCall("/api/v1/creator/dashboard", {
      token: pendingSignIn.content.tokens.accessToken,
    });
    check(forbiddenDashboard.response.status === 403 &&
      forbiddenDashboard.response.headers.get("content-type")?.startsWith("application/problem+json") &&
      !JSON.stringify(forbiddenDashboard.content).includes("performance"),
    "Inactive creator Dashboard did not return a private-data-free 403 Problem Details response.");
    const pendingDocuments = await apiCall("/api/v1/legal-documents/current", {
      token: pendingSignIn.content.tokens.accessToken,
    });
    const pendingRequired = pendingDocuments.content
      .filter((item) => item.isRequired)
      .map((item) => item.id);
    const pendingAccepted = await apiCall("/api/v1/legal-acceptances", {
      token: pendingSignIn.content.tokens.accessToken,
      method: "POST",
      body: { legalDocumentIds: pendingRequired, acceptanceSource: "DEVELOPMENT" },
    });
    check(pendingAccepted.response.ok, "Dashboard incomplete-profile fixture activation failed.");
    const incompleteSignIn = await apiCall("/api/v1/dev/auth/social-sign-in", {
      method: "POST", body: pendingIdentity,
    });
    const onboardingContext = await browser.newContext({ locale: "th-TH" });
    const onboardingPage = await onboardingContext.newPage();
    await setBrowserSession(onboardingPage, incompleteSignIn.content.tokens);
    await onboardingPage.goto(`${baseUrl}/creator/dashboard`, { waitUntil: "networkidle" });
    await onboardingPage.getByText("Complete your creator profile", { exact: true }).waitFor();
    check(await onboardingPage.getByRole("link", { name: "Create Story", exact: true }).count() === 0 &&
      await onboardingPage.getByRole("link", { name: "Edit Profile", exact: true }).count() === 1,
    "Incomplete-profile Dashboard onboarding ignored capability restrictions.");
    await onboardingContext.close();

    await creatorPage.setViewportSize({ width: 390, height: 844 });
    await creatorPage.reload({ waitUntil: "networkidle" });
    const mobileHeadings = await creatorPage.getByRole("heading", { level: 2 }).allTextContents();
    check(JSON.stringify(mobileHeadings) === JSON.stringify([
      "Overview", "Performance snapshot", "Recent content", "Needs attention", "Quick actions",
    ]), "Mobile Dashboard changed the approved semantic section order.");
    check((await creatorPage.locator('a,button').evaluateAll((elements) =>
      elements.filter((element) => element.textContent?.trim()).every((element) =>
        !(element instanceof HTMLAnchorElement) || Boolean(element.getAttribute("href"))))),
    "Dashboard exposed an unnamed or unreachable action at mobile width.");
    let keyboardReachedAction = false;
    for (let press = 0; press < 30 && !keyboardReachedAction; press += 1) {
      await creatorPage.keyboard.press("Tab");
      keyboardReachedAction = await creatorPage.evaluate(() => {
        const element = document.activeElement;
        return element instanceof HTMLAnchorElement || element instanceof HTMLButtonElement;
      });
    }
    check(keyboardReachedAction, "Dashboard actions were not keyboard reachable.");
    check((await creatorPage.getByText("Hidden", { exact: true }).count()) > 0 &&
      (await creatorPage.getByText("ARCHIVED", { exact: true }).count()) > 0,
    "Dashboard lifecycle status relied on color without textual meaning.");

    const readLimitEvidence = await creatorPage.evaluate(async () => {
      const token = localStorage.getItem("novelverse_access_token");
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const response = await fetch("http://localhost:5039/api/v1/creator/dashboard", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.status === 429) {
          return {
            status: response.status,
            retryAfter: response.headers.get("retry-after"),
            type: response.headers.get("content-type"),
          };
        }
      }
      return null;
    });
    check(readLimitEvidence?.status === 429 &&
      readLimitEvidence.type?.startsWith("application/problem+json"),
    "Real Creator Dashboard read quota did not return browser-observable 429 Problem Details.");
    await creatorPage.getByRole("button", { name: "Refresh", exact: true }).click();
    await creatorPage.getByText("Too many refreshes", { exact: true }).waitFor();
    check(await creatorPage.getByRole("heading", { level: 1, name: "Browser E2E Creator" }).count() === 1,
      "Dashboard 429 destroyed the last confirmed private response.");
    await creatorPage.getByRole("button", { name: "Log out", exact: true }).click();
    await creatorPage.waitForURL("**/login");
    check(await creatorPage.evaluate(() =>
      localStorage.getItem("novelverse_access_token") === null &&
      localStorage.getItem("novelverse_refresh_token") === null),
    "Creator Dashboard logout retained a client session.");
    await userBPage.reload({ waitUntil: "networkidle" });
    await userBPage.getByRole("button", { name: "Unlike", exact: true }).waitFor();
    await userBPage.getByRole("button", { name: "Following", exact: true }).waitFor();

    await userBPage.evaluate(() => {
      localStorage.setItem("novelverse_access_token", "invalid-e2e-access");
      localStorage.setItem("novelverse_refresh_token", "invalid-e2e-refresh");
    });
    const invalidatedMutation = userBPage.waitForResponse((response) =>
      response.request().method() === "DELETE" &&
      new URL(response.url()).pathname === `/api/v1/stories/${storyId}/like`);
    await userBPage.getByRole("button", { name: "Unlike", exact: true }).click();
    check((await invalidatedMutation).status() === 401,
      "Invalidated Social session did not return 401.");
    await userBPage.getByRole("button", { name: "Like", exact: true }).waitFor();
    await userBPage.getByRole("button", { name: "Follow", exact: true }).waitFor();
    check(await userBPage.getByRole("button", { name: "Like", exact: true }).getAttribute("aria-pressed") === "false" &&
      await userBPage.getByRole("button", { name: "Follow", exact: true }).getAttribute("aria-pressed") === "false",
    "401 session invalidation did not clear User B viewer-specific social state.");
    await userBPage.getByText(`Browser E2E Story ${runId}`, { exact: true }).waitFor();
    check(storyLikeCount(storyId, userB.id) === 1 && creatorFollowCount(creatorSlug, userB.id) === 1,
      "Rejected 401 mutation changed User B persisted Social relationships.");
    await anonymousSocialPage.goto(`${baseUrl}${publicStoryPath}`, { waitUntil: "networkidle" });
    check(await anonymousSocialPage.getByRole("button", { name: "Like", exact: true }).getAttribute("aria-pressed") === "false" &&
      await anonymousSocialPage.getByRole("button", { name: "Follow", exact: true }).getAttribute("aria-pressed") === "false",
    "Logout/anonymous viewer leaked User B social state.");
    const userCContext = await browser.newContext({ locale: "th-TH" });
    const userCPage = await userCContext.newPage();
    await setBrowserSession(userCPage, userC.tokens);
    await userCPage.goto(`${baseUrl}${publicStoryPath}`, { waitUntil: "networkidle" });
    check(await userCPage.getByRole("button", { name: "Like", exact: true }).getAttribute("aria-pressed") === "false" &&
      await userCPage.getByRole("button", { name: "Follow", exact: true }).getAttribute("aria-pressed") === "false",
    "User C received User B private social state.");
    const userCDeletes = await userCPage.evaluate(async (value) => Promise.all([
      fetch(`http://localhost:5039/api/v1/stories/${value.storyId}/like`,
        { method: "DELETE", headers: { Authorization: `Bearer ${value.token}` } }).then((response) => response.status),
      fetch(`http://localhost:5039/api/v1/creators/by-slug/${value.creatorSlug}/follow`,
        { method: "DELETE", headers: { Authorization: `Bearer ${value.token}` } }).then((response) => response.status),
    ]), { storyId, creatorSlug, token: userC.tokens.accessToken });
    check(userCDeletes.every((status) => status === 200) &&
      storyLikeCount(storyId, userB.id) === 1 && creatorFollowCount(creatorSlug, userB.id) === 1,
    "User C removed User B social relationships.");

    const socialFailureStatuses = await userCPage.evaluate(async (value) => Promise.all(
      Array.from({ length: 24 }, () => fetch(
        `http://localhost:5039/api/v1/stories/${value.storyId}/like`,
        { method: "PUT", headers: { Authorization: `Bearer ${value.token}` } }).then((response) => response.status)),
    ), { storyId, token: userC.tokens.accessToken });
    check(socialFailureStatuses.includes(429), "Real social mutation failure mechanism did not reach rate limiting.");
    const stateAfterQuota = await userCPage.evaluate(async (value) => Promise.all([
      fetch(`http://localhost:5039/api/v1/social/stories/${value.storyId}/like-state`,
        { headers: { Authorization: `Bearer ${value.token}` } }).then((response) => response.status),
      fetch(`http://localhost:5039/api/v1/social/creators/by-slug/${value.creatorSlug}/follow-state`,
        { headers: { Authorization: `Bearer ${value.token}` } }).then((response) => response.status),
    ]), { storyId, creatorSlug, token: userC.tokens.accessToken });
    check(stateAfterQuota.every((status) => status === 200),
      "Social state GET consumed or remained blocked by the mutation quota.");
    await userCPage.reload({ waitUntil: "networkidle" });
    await userCPage.getByText(`Browser E2E Story ${runId}`, { exact: true }).waitFor();
    check(!(await userCPage.locator("body").innerText()).toLowerCase().includes("mock"),
      "Social API failure replaced Story Detail with mock fallback.");
    check(!/(popular|trending|recommendation|notification|social feed)/i.test(
      await userCPage.locator("body").innerText()),
    "Out-of-scope Popular, Trending, Recommendation, Notification, or Social Feed UI was rendered.");
    await userCPage.locator('a[href*="/read-novel/"]').first().click();
    await userCPage.getByText(testText).waitFor();

    const privacyUnlink = await apiCall("/api/v1/dev/social/privacy/unlink", {
      token: userB.tokens.accessToken,
      method: "DELETE",
    });
    check(privacyUnlink.response.ok &&
      privacyUnlink.content.storyLikes === 1 &&
      privacyUnlink.content.outgoingFollows === 1,
    "Development Social privacy boundary did not remove User B relationships.");
    check(storyLikeCount(storyId, userB.id) === 0 &&
      creatorFollowCount(creatorSlug, userB.id) === 0 &&
      storyLikeCount(storyId, userC.id) === 1,
    "Privacy unlink removed the wrong viewer's relationships or left User B attributable state.");
    const repeatedPrivacyUnlink = await apiCall("/api/v1/dev/social/privacy/unlink", {
      token: userB.tokens.accessToken,
      method: "DELETE",
    });
    check(repeatedPrivacyUnlink.response.ok &&
      repeatedPrivacyUnlink.content.storyLikes === 0 &&
      repeatedPrivacyUnlink.content.outgoingFollows === 0 &&
      repeatedPrivacyUnlink.content.incomingFollows === 0,
    "Repeated Social privacy unlink was not idempotent.");

    await socialTabA.close();
    await socialTabB.close();
    await creatorContext.close();
    await userBContext.close();
    await userCContext.close();
    await anonymousSocialContext.close();

    const anonymousContext = await browser.newContext({ locale: "th-TH" });
    const anonymousPage = await anonymousContext.newPage();
    const anonymousStarts = await collectExpectedEngagementStarts(anonymousPage, async () => {
      await anonymousPage.goto(
      `${baseUrl}/stories/browser-e2e-${runId}/browser-e2e-story-${runId}`,
      { waitUntil: "networkidle" });
    await anonymousPage.getByText(`Browser E2E Story ${runId}`, { exact: true }).waitFor();
    await anonymousPage.getByRole("link", { name: "เปิดอ่าน" }).first().click();
    await anonymousPage.getByText(testText).waitFor();
    await anonymousPage.waitForLoadState("networkidle");
    });
    const anonymousStorySession = anonymousStarts.STORY;
    const anonymousEpisodeSession = anonymousStarts.EPISODE;
    const anonymousVerification = await anonymousPage.evaluate(async (sessionId) =>
      fetch(`http://localhost:5039/api/v1/dev/engagement/sessions/${sessionId}/verification`,
        { credentials: "include" }).then((response) => response.json()), anonymousStorySession.sessionId);
    check(anonymousVerification.viewerKind === "ANONYMOUS" &&
      !anonymousVerification.userLinked && anonymousVerification.anonymousLinked,
    "Anonymous verification exposed an invalid identity shape.");

    const authenticatedSeparation = await page.evaluate(async ({ storyId, anonymousSession, providerSubject, email }) => {
      const api = "http://localhost:5039";
      let token = localStorage.getItem("novelverse_access_token");
      if (!token) {
        const signed = await fetch(`${api}/api/v1/dev/auth/social-sign-in`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: "GOOGLE", providerSubject, email,
            displayName: "Browser E2E Creator" }),
        }).then((response) => response.json());
        token = signed.tokens.accessToken;
        localStorage.setItem("novelverse_access_token", token);
      }
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      const session = await fetch(`${api}/api/v1/engagement/sessions`, {
        method: "POST", credentials: "include", headers,
        body: JSON.stringify({ targetType: "STORY", targetId: storyId,
          clientSessionKey: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() }),
      }).then((response) => response.json());
      const verification = await fetch(
        `${api}/api/v1/dev/engagement/sessions/${session.sessionId}/verification`).then((r) => r.json());
      const wrongOwner = await fetch(
        `${api}/api/v1/engagement/sessions/${anonymousSession.sessionId}/activity`, {
          method: "POST", credentials: "include", headers,
          body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), sequence: 1,
            clientSessionKey: anonymousSession.clientSessionKey, evidenceType: "HEARTBEAT",
            reportedActiveSeconds: 0, progressPercent: 0 }),
        });
      return { verification, wrongOwnerStatus: wrongOwner.status };
    }, { storyId, anonymousSession: anonymousEpisodeSession,
      providerSubject: `browser-e2e-${runId}`, email: `browser-e2e-${runId}@example.test` });
    check(authenticatedSeparation.verification.viewerKind === "AUTHENTICATED" &&
      authenticatedSeparation.verification.userLinked &&
      !authenticatedSeparation.verification.anonymousLinked,
    "Authenticated verification exposed an invalid identity shape.");
    check(authenticatedSeparation.wrongOwnerStatus === 404,
      "Authenticated identity mutated an earlier anonymous session.");

    const tabA = await context.newPage();
    const tabB = await context.newPage();
    await Promise.all([
      tabA.goto(baseUrl, { waitUntil: "domcontentloaded" }),
      tabB.goto(baseUrl, { waitUntil: "domcontentloaded" }),
    ]);
    const createTabActivity = async (tab) => tab.evaluate(async ({ episodeId, runId }) => {
      const api = "http://localhost:5039";
      const token = localStorage.getItem("novelverse_access_token");
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      const content = await fetch(
        `${api}/api/v1/stories/browser-e2e-${runId}/browser-e2e-story-${runId}/episodes/browser-e2e-episode-${runId}/content`,
        { headers }).then((r) => r.json());
      const clientSessionKey = crypto.randomUUID();
      const session = await fetch(`${api}/api/v1/engagement/sessions`, {
        method: "POST", credentials: "include", headers,
        body: JSON.stringify({ targetType: "EPISODE", targetId: episodeId,
          clientSessionKey, idempotencyKey: crypto.randomUUID() }),
      }).then((r) => r.json());
      return { api, headers, content, clientSessionKey, session };
    }, { episodeId, runId });
    const tabSessionA = await createTabActivity(tabA);
    const tabSessionB = await createTabActivity(tabB);
    const submitTabActivity = (tab, value) => tab.evaluate(async ({ value }) => {
      await fetch(`${value.api}/api/v1/dev/engagement/sessions/${value.session.sessionId}/advance`, {
        method: "POST", headers: value.headers, body: JSON.stringify({ seconds: 31 }),
      });
      return fetch(`${value.api}/api/v1/engagement/sessions/${value.session.sessionId}/activity`, {
        method: "POST", credentials: "include", headers: value.headers,
        body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), sequence: 1,
          clientSessionKey: value.clientSessionKey, evidenceType: "COMPLETION",
          reportedActiveSeconds: 30, progressPercent: 100,
          reachedContentId: value.content.blocks.at(-1).id,
          reachedPosition: value.content.blocks.length, totalItems: value.content.blocks.length,
          finalContentReached: true }),
      }).then((r) => r.json());
    }, { value });
    const [oldTabActivity, newTabActivity] = await Promise.all([
      submitTabActivity(tabA, tabSessionA), submitTabActivity(tabB, tabSessionB),
    ]);
    check(oldTabActivity.acceptedActiveSeconds === 0 &&
      oldTabActivity.suppressionReason === "STALE_TAB",
    "Older overlapping browser session was not suppressed.");
    check(newTabActivity.acceptedActiveSeconds === 30 &&
      newTabActivity.qualified && newTabActivity.completed,
    "Newest overlapping browser session was not authoritative.");
    await tabA.close(); await tabB.close();

    const moderationIngestion = await page.evaluate(async ({ episodeId, providerSubject, email }) => {
      const api = "http://localhost:5039";
      let token = localStorage.getItem("novelverse_access_token");
      let headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      const me = await fetch(`${api}/api/v1/users/me`, { headers }).then((r) => r.json());
      await fetch(`${api}/api/v1/dev/auth/users/${me.id}/role`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "MODERATOR" }),
      });
      const signed = await fetch(`${api}/api/v1/dev/auth/social-sign-in`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "GOOGLE", providerSubject, email,
          displayName: "Browser E2E Creator" }),
      }).then((r) => r.json());
      token = signed.tokens.accessToken;
      headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      localStorage.setItem("novelverse_access_token", token);
      const clientSessionKey = crypto.randomUUID();
      const session = await fetch(`${api}/api/v1/engagement/sessions`, {
        method: "POST", credentials: "include", headers,
        body: JSON.stringify({ targetType: "EPISODE", targetId: episodeId,
          clientSessionKey, idempotencyKey: crypto.randomUUID() }),
      }).then((r) => r.json());
      const before = await fetch(
        `${api}/api/v1/dev/engagement/sessions/${session.sessionId}/verification`).then((r) => r.json());
      const hidden = await fetch(`${api}/api/v1/moderation/actions/hide`, {
        method: "POST", headers, body: JSON.stringify({
          targetType: "EPISODE", targetId: episodeId, reportId: null,
          reasonCode: "OTHER", note: "E2E concealment verification",
        }),
      });
      const rejectedActivity = await fetch(
        `${api}/api/v1/engagement/sessions/${session.sessionId}/activity`, {
          method: "POST", credentials: "include", headers,
          body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), sequence: 1,
            clientSessionKey, evidenceType: "HEARTBEAT", reportedActiveSeconds: 0,
            progressPercent: 0 }),
        });
      const hiddenStart = await fetch(`${api}/api/v1/engagement/sessions`, {
        method: "POST", credentials: "include", headers,
        body: JSON.stringify({ targetType: "EPISODE", targetId: episodeId,
          clientSessionKey: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() }),
      });
      const after = await fetch(
        `${api}/api/v1/dev/engagement/sessions/${session.sessionId}/verification`).then((r) => r.json());
      const restored = await fetch(`${api}/api/v1/moderation/actions/restore`, {
        method: "POST", headers, body: JSON.stringify({
          targetType: "EPISODE", targetId: episodeId, reportId: null,
          reasonCode: "OTHER", note: "E2E restoration verification",
        }),
      });
      const restoredStart = await fetch(`${api}/api/v1/engagement/sessions`, {
        method: "POST", credentials: "include", headers,
        body: JSON.stringify({ targetType: "EPISODE", targetId: episodeId,
          clientSessionKey: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() }),
      });
      return { hidden: hidden.status, rejectedActivity: rejectedActivity.status,
        hiddenStart: hiddenStart.status, factsBefore: before.factCount, factsAfter: after.factCount,
        restored: restored.status, restoredStart: restoredStart.status };
    }, { episodeId, providerSubject: `browser-e2e-${runId}`,
      email: `browser-e2e-${runId}@example.test` });
    check(moderationIngestion.hidden === 200 && moderationIngestion.rejectedActivity === 404 &&
      moderationIngestion.hiddenStart === 404 &&
      moderationIngestion.factsBefore === moderationIngestion.factsAfter,
    "Hidden Episode accepted engagement or leaked a non-generic response.");
    check(moderationIngestion.restored === 200 && moderationIngestion.restoredStart === 200,
      "Restored Episode did not accept a new engagement session.");
    await anonymousContext.close();

    console.log(JSON.stringify({
      result: "PASS",
      storyPath: new URL(storyUrl).pathname,
      editorPath: new URL(editorUrl).pathname,
      previewPath: new URL(page.url()).pathname,
      persistedTextVerified: true,
      persistedImageVerified: true,
      comicStoryId,
      comicAuthoringVerified: true,
      comicReaderVerified: true,
      videoAuthoringVerified: true,
      videoReaderVerified: true,
      publicDiscoveryVerified: true,
      storyDetailVerified: true,
      unicodeStoryDetailVerified: true,
      unicodeEpisodeListVerified: true,
      unicodeReaderReloadVerified: true,
      unicodeSingleEncodingVerified: true,
      publicReaderRoutingVerified: true,
      readerNavigationPaginationVerified: true,
      readerNavigationVisibleControlsVerified: true,
      readerNavigationKeyboardVerified: true,
      readerNavigationFirstLastBoundariesVerified: true,
      readerNavigationBackToStoryVerified: true,
      readingHistoryVerified: true,
      readerLibraryVerified: true,
      readingProgressVerified: true,
      readerLibrarySessionIsolationVerified: true,
      readingProgressSessionIsolationVerified: true,
      engagementSessionStartsVerified: true,
      engagementStoryDeduplicationVerified: true,
      engagementVideoNoFalseCompletionVerified: true,
      engagementNovelQualificationCompletionVerified: true,
      engagementComicQualificationCompletionVerified: true,
      engagementIdentitySeparationVerified: true,
      engagementMultiTabArbitrationVerified: true,
      engagementModerationHideRestoreVerified: true,
      socialAnonymousGatingVerified: true,
      socialLikeUnlikeUiVerified: true,
      socialFollowUnfollowUiVerified: true,
      socialMultiTabUniquenessVerified: true,
      socialSelfFollowRejected: true,
      socialPersistedRowsAndCountsVerified: true,
      socialModerationRetentionVerified: true,
      socialViewerIsolationVerified: true,
      socialFailureIsolationVerified: true,
      socialMutationQuotaReadIsolationVerified: true,
      socialSessionInvalidationVerified: true,
      socialPrivacyUnlinkVerified: true,
      creatorDashboardEmptyVerified: true,
      creatorDashboardLegacyRedirectVerified: true,
      creatorDashboardRealContentVerified: true,
      creatorDashboardHiddenOwnerViewVerified: true,
      creatorDashboardSuppressionVerified: true,
      creatorDashboardSuppressionTransitionVerified: true,
      creatorDashboardZeroActivityVerified: true,
      creatorDashboardArchivedDeletedSemanticsVerified: true,
      creatorDashboardCrossOwnerIsolationVerified: true,
      creatorDashboardReadRateLimitVerified: true,
      creatorDashboardTerminal401Verified: true,
      creatorDashboardForbiddenAndOnboardingVerified: true,
      creatorDashboardResponsiveAccessibilityVerified: true,
      creatorDashboardQuickActionsVerified: true,
      creatorDashboardLogoutVerified: true,
      communityDiscussionVerified: communityResult?.verified === true,
      communityDiscussionDurationMs: communityResult?.durationMs ?? null,
      communityStoryVerified: communityResult?.storyDiscussionVerified === true,
      communityNovelVerified: communityResult?.novelDiscussionVerified === true,
      communityComicVerified: communityResult?.comicDiscussionVerified === true,
      communityVideoVerified: communityResult?.videoDiscussionVerified === true,
      communityOwnerCapabilitiesVerified: communityResult?.ownerCapabilitiesVerified === true,
      communityMutationConcurrencyVerified:
        communityResult?.communityMutationConcurrencyVerified === true,
      communityLimiterAssertionsVerified:
        communityResult?.communityLimiterAssertionsVerified === true,
      draftExcludedFromDiscovery: true,
      mockFallbackDetected: communityResult?.mockFallbackDetected ?? true,
    }, null, 2));
  } catch (error) {
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
    console.error(`Browser E2E failed. Failure screenshot: ${screenshotPath}`);
    throw error;
  } finally {
    await fs.rm(imagePath, { force: true }).catch(() => undefined);
    await fs.rm(screenshotPath, { force: true }).catch(() => undefined);
    await context.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
