import { chromium } from "playwright";
import { deflateSync } from "node:zlib";

const frontend = "http://localhost:3000";
const api = "http://localhost:5039";
const runId = crypto.randomUUID().replaceAll("-", "").slice(0, 10);

function check(condition, message) {
  if (!condition) throw new Error(message);
}
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}
function png() {
  const header = Buffer.alloc(13); header.writeUInt32BE(2, 0); header.writeUInt32BE(2, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const rows = Buffer.from([0, 20, 80, 180, 255, 20, 80, 180, 255, 0, 20, 80, 180, 255, 20, 80, 180, 255]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}
async function call(path, { token, method = "GET", body, form } = {}) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  const content = response.status === 204 ? null : await response.json().catch(() => null);
  return { response, content };
}
async function user(prefix, role = "USER") {
  const identity = {
    provider: "GOOGLE", providerSubject: `${prefix}-${runId}`,
    email: `${prefix}-${runId}@moderation.test`, displayName: `${prefix} ${runId}`,
  };
  const first = await call("/api/v1/dev/auth/social-sign-in", { method: "POST", body: identity });
  check(first.response.ok, `Initial ${prefix} sign-in failed.`);
  const documents = await call("/api/v1/legal-documents/current", {
    token: first.content.tokens.accessToken,
  });
  const required = documents.content.filter((item) => item.isRequired).map((item) => item.id);
  const accepted = await call("/api/v1/legal-acceptances", {
    token: first.content.tokens.accessToken, method: "POST",
    body: { legalDocumentIds: required, acceptanceSource: "DEVELOPMENT" },
  });
  check(accepted.response.ok, `${prefix} legal acceptance failed.`);
  const slug = `${prefix}-${runId}`;
  const profile = await call("/api/v1/users/me/profile", {
    token: first.content.tokens.accessToken, method: "PUT",
    body: { displayName: `${prefix} ${runId}`, creatorSlug: slug },
  });
  check(profile.response.ok, `${prefix} profile setup failed.`);
  if (role === "MODERATOR") {
    const assigned = await call(`/api/v1/dev/auth/users/${first.content.user.id}/role`, {
      method: "PUT", body: { role: "MODERATOR" },
    });
    check(assigned.response.status === 204, "Moderator fixture role assignment failed.");
  }
  const signed = await call("/api/v1/dev/auth/social-sign-in", { method: "POST", body: identity });
  check(signed.response.ok, `Final ${prefix} sign-in failed.`);
  return { id: signed.content.user.id, slug, tokens: signed.content.tokens };
}
async function storyFixture(owner) {
  const categories = await call("/api/v1/categories");
  const category = categories.content.find((item) => item.isActive);
  const title = `Moderation Story ${runId}`;
  const story = await call("/api/v1/creator/stories", {
    token: owner.tokens.accessToken, method: "POST",
    body: {
      title, synopsis: `Moderation browser fixture ${runId}`, languageCode: "th",
      visibility: "PUBLIC", contentRating: "GENERAL", categoryIds: [category.id],
      tags: [`moderation-${runId}`], storyType: "NOVEL", readingMode: "VERTICAL",
    },
  });
  check(story.response.status === 201, "Moderation Story creation failed.");
  const episodes = [];
  for (const number of [1, 2]) {
    const episode = await call(`/api/v1/creator/stories/${story.content.id}/episodes`, {
      token: owner.tokens.accessToken, method: "POST",
      body: { title: `Moderation Episode ${number} ${runId}`, episodeNumber: number,
        sortOrder: number, visibility: "PUBLIC" },
    });
    await call(`/api/v1/creator/stories/${story.content.id}/episodes/${episode.content.id}/content`, {
      token: owner.tokens.accessToken, method: "PUT",
      body: { blocks: [{ type: "TEXT", textContent: `Visible moderation content ${number} ${runId}`, mediaAssetId: null }] },
    });
    episodes.push(episode.content);
  }
  await call(`/api/v1/creator/stories/${story.content.id}/publish`, {
    token: owner.tokens.accessToken, method: "POST",
  });
  for (const episode of episodes) await call(
    `/api/v1/creator/stories/${story.content.id}/episodes/${episode.id}/publish`,
    { token: owner.tokens.accessToken, method: "POST" });
  return { ...story.content, title, episodes };
}
async function comicFixture(owner) {
  const categories = await call("/api/v1/categories");
  const category = categories.content.find((item) => item.isActive);
  const story = await call("/api/v1/creator/stories", {
    token: owner.tokens.accessToken, method: "POST",
    body: {
      title: `Moderation Comic ${runId}`, synopsis: `Comic moderation ${runId}`, languageCode: "th",
      visibility: "PUBLIC", contentRating: "GENERAL", categoryIds: [category.id],
      tags: [], storyType: "COMIC", readingMode: "VERTICAL",
    },
  });
  const episode = await call(`/api/v1/creator/stories/${story.content.id}/episodes`, {
    token: owner.tokens.accessToken, method: "POST",
    body: { title: `Comic Episode ${runId}`, episodeNumber: 1, sortOrder: 1, visibility: "PUBLIC" },
  });
  const form = new FormData();
  form.append("purpose", "COMIC_PAGE");
  form.append("file", new Blob([png()], { type: "image/png" }), `comic-${runId}.png`);
  const media = await call("/api/v1/media-assets", {
    token: owner.tokens.accessToken, method: "POST", form,
  });
  check(media.response.status === 201, "Comic moderation media fixture failed.");
  await call(`/api/v1/creator/stories/${story.content.id}/episodes/${episode.content.id}/comic-pages`, {
    token: owner.tokens.accessToken, method: "PUT",
    body: { pages: [{ mediaAssetId: media.content.id }] },
  });
  await call(`/api/v1/creator/stories/${story.content.id}/publish`, {
    token: owner.tokens.accessToken, method: "POST",
  });
  await call(`/api/v1/creator/stories/${story.content.id}/episodes/${episode.content.id}/publish`, {
    token: owner.tokens.accessToken, method: "POST",
  });
  return { ...story.content, episode: episode.content };
}
async function session(page, tokens) {
  await page.goto(`${frontend}/login`);
  await page.evaluate((value) => {
    localStorage.setItem("novelverse_access_token", value.accessToken);
    localStorage.setItem("novelverse_refresh_token", value.refreshToken);
    localStorage.setItem("novelverse_access_token_expires_at", value.accessTokenExpiresAt);
    localStorage.setItem("novelverse_refresh_token_expires_at", value.refreshTokenExpiresAt);
  }, tokens);
}
async function clearSession(page) {
  await page.evaluate(() => localStorage.clear());
}
async function report(page, reason, comment = "") {
  await page.getByRole("button", { name: "รายงาน", exact: true }).click();
  await page.getByLabel("เหตุผล").selectOption(reason);
  if (comment) await page.getByLabel(/รายละเอียดเพิ่มเติม/).fill(comment);
  await page.getByRole("button", { name: "ส่งรายงาน" }).click();
}
async function moderationAction(page, action, button) {
  const completed = page.waitForResponse((response) =>
    response.request().method() === "POST" &&
    response.url() === `${api}/api/v1/moderation/actions/${action}`);
  await button.click();
  const response = await completed;
  check(response.ok(), `Moderator ${action} action returned ${response.status()}.`);
}

async function run() {
  const ordinary = await user("moderation-user");
  const moderator = await user("moderation-moderator", "MODERATOR");
  const story = await storyFixture(ordinary);
  const comic = await comicFixture(ordinary);
  const storyPath = `/stories/${ordinary.slug}/${story.slug}`;
  const latest = story.episodes[1];
  const first = story.episodes[0];
  const latestReader = `/read-novel/${ordinary.slug}/${story.slug}/${latest.slug}`;
  const firstReader = `/read-novel/${ordinary.slug}/${story.slug}/${first.slug}`;
  const comicReader = `/read-comic/${ordinary.slug}/${comic.slug}/${comic.episode.slug}`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "th-TH" });
  const page = await context.newPage();
  try {
    await page.goto(frontend, { waitUntil: "networkidle" });
    await page.getByText(story.title, { exact: true }).waitFor();
    await page.goto(`${frontend}/?q=${encodeURIComponent(story.title)}`, { waitUntil: "networkidle" });
    await page.getByText(story.title, { exact: true }).waitFor();
    await page.goto(`${frontend}${storyPath}`, { waitUntil: "networkidle" });
    await page.getByText(story.title, { exact: true }).waitFor();
    await page.goto(`${frontend}${latestReader}`, { waitUntil: "networkidle" });
    await page.getByText(`Visible moderation content 2 ${runId}`).waitFor();

    await session(page, ordinary.tokens);
    await page.goto(`${frontend}${storyPath}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /บันทึกเข้า/ }).click();
    await report(page, "SPAM", `Story report ${runId}`);
    await page.getByText("ส่งรายงานเรียบร้อยแล้ว").waitFor();
    await page.getByRole("button", { name: "ส่งรายงาน" }).click();
    await page.getByText("คุณได้รายงานเนื้อหานี้ด้วยเหตุผลเดียวกันแล้ว").waitFor();

    await page.goto(`${frontend}${latestReader}`, { waitUntil: "networkidle" });
    await report(page, "VIOLENCE", `Episode report ${runId}`);
    await page.getByText("ส่งรายงานเรียบร้อยแล้ว").waitFor();
    await page.goto(`${frontend}${comicReader}`, { waitUntil: "networkidle" });
    await page.getByTestId("comic-reader").locator("img").waitFor();
    await report(page, "COPYRIGHT", `Comic Episode report ${runId}`);
    await page.getByText("ส่งรายงานเรียบร้อยแล้ว").waitFor();

    await page.goto(`${frontend}/moderation/reports`, { waitUntil: "networkidle" });
    await page.getByText(/ไม่มีสิทธิ์/).waitFor();
    check(await page.getByRole("button", { name: "ซ่อนและปิดรายงาน" }).count() === 0,
      "Ordinary user received moderator controls.");
    const forbidden = await page.evaluate(async () => {
      const token = localStorage.getItem("novelverse_access_token");
      return fetch("http://localhost:5039/api/v1/moderation/reports", {
        headers: { Authorization: `Bearer ${token}` },
      }).then((response) => response.status);
    });
    check(forbidden === 403, "Ordinary user moderation API did not return 403.");

    await session(page, moderator.tokens);
    await page.goto(`${frontend}/moderation/reports`, { waitUntil: "networkidle" });
    const storyCard = page.locator("article").filter({
      has: page.getByText(`Story report ${runId}`, { exact: true }),
    });
    await storyCard.getByRole("button", { name: "เริ่มตรวจสอบ" }).click();
    await storyCard.getByText("สถานะ: UNDER_REVIEW").waitFor();
    page.once("dialog", (dialog) => dialog.accept());
    await moderationAction(page, "hide", page.locator("article").filter({
      has: page.getByText(`Story report ${runId}`, { exact: true }),
    })
      .getByRole("button", { name: "ซ่อนและปิดรายงาน" }));

    await clearSession(page);
    await page.goto(frontend, { waitUntil: "networkidle" });
    check(await page.getByText(story.title, { exact: true }).count() === 0, "Hidden Story remained on Home.");
    await page.goto(`${frontend}/?q=${encodeURIComponent(story.title)}`, { waitUntil: "networkidle" });
    check(await page.getByText(story.title, { exact: true }).count() === 0, "Hidden Story remained in Search.");
    await page.goto(`${frontend}${storyPath}`, { waitUntil: "networkidle" });
    check(!(await page.locator("body").innerText()).includes("SPAM"), "Public Story route leaked moderation reason.");
    await page.goto(`${frontend}${latestReader}`, { waitUntil: "networkidle" });
    check(!(await page.locator("body").innerText()).includes("VIOLENCE"), "Public Episode route leaked moderation reason.");

    await session(page, ordinary.tokens);
    await page.goto(`${frontend}/library`, { waitUntil: "networkidle" });
    await page.getByText("เนื้อหานี้ไม่พร้อมให้บริการ").waitFor();
    check(await page.getByRole("link", { name: story.title }).count() === 0, "Unavailable Library item retained a link.");
    await page.goto(frontend, { waitUntil: "networkidle" });
    check(!(await page.locator("body").innerText()).toLowerCase().includes("mock"), "Moderation flow used mock fallback.");

    await session(page, moderator.tokens);
    await page.goto(`${frontend}/moderation/reports?status=ACTION_TAKEN`, { waitUntil: "networkidle" });
    page.once("dialog", (dialog) => dialog.accept());
    await moderationAction(page, "restore", page.locator("article").filter({
      has: page.getByText(`Story report ${runId}`, { exact: true }),
    })
      .getByRole("button", { name: "คืนค่าเป้าหมาย" }));
    await clearSession(page);
    await page.goto(frontend, { waitUntil: "networkidle" });
    await page.getByText(story.title, { exact: true }).waitFor();
    await page.goto(`${frontend}${latestReader}`, { waitUntil: "networkidle" });
    await page.getByText(`Visible moderation content 2 ${runId}`).waitFor();

    await session(page, moderator.tokens);
    await page.goto(`${frontend}/moderation/reports`, { waitUntil: "networkidle" });
    const episodeCard = page.locator("article").filter({
      has: page.getByText(`Episode report ${runId}`, { exact: true }),
    });
    page.once("dialog", (dialog) => dialog.accept());
    await moderationAction(page, "hide",
      episodeCard.getByRole("button", { name: "ซ่อนและปิดรายงาน" }));
    await clearSession(page);
    await page.goto(`${frontend}${storyPath}`, { waitUntil: "networkidle" });
    check(await page.getByText(latest.title, { exact: false }).count() === 0, "Hidden Episode remained in list.");
    await page.getByText(first.title, { exact: false }).waitFor();
    await page.goto(`${frontend}${latestReader}`, { waitUntil: "networkidle" });
    check(!(await page.locator("body").innerText()).includes(`Visible moderation content 2 ${runId}`),
      "Hidden Episode reader remained available.");
    await page.goto(`${frontend}${firstReader}`, { waitUntil: "networkidle" });
    await page.getByText(`Visible moderation content 1 ${runId}`).waitFor();
    const publicSummary = await call(`/api/v1/stories/${ordinary.slug}/${story.slug}`);
    check(publicSummary.content.publishedEpisodeCount === 1, "Hidden Episode remained in published count.");
    check(publicSummary.content.latestPublishedEpisodeId === first.id, "Hidden Episode remained latest metadata.");

    await session(page, moderator.tokens);
    await page.goto(`${frontend}/moderation/reports?status=ACTION_TAKEN`, { waitUntil: "networkidle" });
    page.once("dialog", (dialog) => dialog.accept());
    await moderationAction(page, "restore", page.locator("article").filter({
      has: page.getByText(`Episode report ${runId}`, { exact: true }),
    })
      .getByRole("button", { name: "คืนค่าเป้าหมาย" }));
    await clearSession(page);
    await page.goto(`${frontend}${storyPath}`, { waitUntil: "networkidle" });
    await page.getByText(latest.title, { exact: false }).waitFor();

    const profileHide = await call("/api/v1/moderation/actions/hide", {
      token: moderator.tokens.accessToken, method: "POST",
      body: { targetType: "USER", targetId: ordinary.id, reasonCode: "OTHER", note: "E2E profile behavior" },
    });
    check(profileHide.response.ok, "User profile hide API failed.");
    check((await call("/api/v1/users/me", { token: ordinary.tokens.accessToken })).response.ok,
      "Profile concealment invalidated login.");
    check((await call(`/api/v1/stories/${ordinary.slug}/${story.slug}`)).response.ok,
      "Profile concealment cascaded to authored Story.");
    check((await call("/api/v1/moderation/actions/restore", {
      token: moderator.tokens.accessToken, method: "POST",
      body: { targetType: "USER", targetId: ordinary.id, reasonCode: "OTHER", note: "E2E restore" },
    })).response.ok, "User profile restore API failed.");

    console.log(JSON.stringify({
      result: "PASS", storyId: story.id, episodeId: latest.id, comicEpisodeId: comic.episode.id,
      storyReportUi: true, duplicateUi: true, comicReportUi: true, moderatorAuthorization: true,
      storyHideRestore: true, episodeHideRestore: true, readerStatePreserved: true,
      profileApiBehavior: true, mockFallbackDetected: false,
    }, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
