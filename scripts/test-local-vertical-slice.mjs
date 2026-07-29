import { chromium } from "playwright";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { deflateSync } from "node:zlib";

const baseUrl = "http://localhost:3000";
const apiUrl = "http://localhost:5039";
const runId = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
const testText = `NovelVerse browser E2E content ${runId}`;
const screenshotPath = path.join(os.tmpdir(), `novelverse-e2e-failure-${runId}.png`);
const imagePath = path.join(os.tmpdir(), `novelverse-e2e-${runId}.png`);

function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function apiCall(route, { token, method = "GET", body } = {}) {
  const response = await fetch(`${apiUrl}${route}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const content = response.status === 204 ? null : await response.json().catch(() => null);
  return { response, content };
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
    const episode = await call(`/api/v1/creator/stories/${story.id}/episodes`, {
      method: "POST",
      body: JSON.stringify({
        title: `ตอนทดสอบ ${suffix}`, episodeNumber: 1, sortOrder: 1,
        slug: null, synopsis: null, visibility: "PUBLIC",
      }),
    });
    await call(`/api/v1/creator/stories/${story.id}/episodes/${episode.id}/content`, {
      method: "PUT",
      body: JSON.stringify({ blocks: [{ type: "TEXT", textContent: `เนื้อหาทดสอบ ${suffix}`, mediaAssetId: null }] }),
    });
    await call(`/api/v1/creator/stories/${story.id}/publish`, { method: "POST" });
    await call(`/api/v1/creator/stories/${story.id}/episodes/${episode.id}/publish`, { method: "POST" });
    return { storyId: story.id, title, tag, categorySlug: category.slug };
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
  page.on("response", async (response) => {
    if (response.request().method() === "POST" &&
        /\/api\/v1\/engagement\/sessions$/.test(new URL(response.url()).pathname) &&
        response.ok()) {
      const body = await response.json().catch(() => null);
      const requestBody = response.request().postDataJSON();
      engagementStarts.push(body ? { ...body, clientSessionKey: requestBody.clientSessionKey,
        targetId: requestBody.targetId } : null);
    }
  });
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
    await page.getByLabel("Video URL").fill("https://youtu.be/dQw4w9WgXcQ");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
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

    const thaiStoryTitle = `นักรบแห่งเงา ${runId}`;
    await createSearchFixture(page, {
      title: thaiStoryTitle, tag: "  Fantasy-Thai  ", suffix: runId,
    });

    // Authenticated reader state: bookmark Stories and retain one Episode-level resume per Story.
    await page.goto(`${baseUrl}/stories/browser-e2e-${runId}/browser-e2e-story-${runId}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "บันทึกเข้าคลัง" }).click();
    await page.getByRole("button", { name: "นำออกจากคลัง" }).waitFor();
    await page.locator('a[href*="/read-novel/"]').click();
    await page.getByText(testText).waitFor();

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
    await page.getByText(`ตอนล่าสุด: Browser E2E Episode ${runId}`, { exact: false }).waitFor();
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
    await page.getByRole("link", { name: "เปิดอ่าน" }).click();
    await page.waitForURL(`**/read-novel/browser-e2e-${runId}/browser-e2e-story-${runId}/browser-e2e-episode-${runId}`);
    await page.getByText(testText).waitFor();
    await page.getByTestId("novel-content-renderer").locator("img").waitFor();
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
    const userB = await createSocialUser("social-user-b", `Social User B ${runId}`);
    const userC = await createSocialUser("social-user-c", `Social User C ${runId}`);

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
    await userCPage.locator('a[href*="/read-novel/"]').click();
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
    const anonymousStarts = [];
    anonymousPage.on("response", async (response) => {
      if (response.request().method() === "POST" &&
          /\/api\/v1\/engagement\/sessions$/.test(new URL(response.url()).pathname) &&
          response.ok()) {
        const body = await response.json().catch(() => null);
        const requestBody = response.request().postDataJSON();
        if (body) anonymousStarts.push({ ...body, clientSessionKey: requestBody.clientSessionKey });
      }
    });
    await anonymousPage.goto(
      `${baseUrl}/stories/browser-e2e-${runId}/browser-e2e-story-${runId}`,
      { waitUntil: "networkidle" });
    await anonymousPage.getByText(`Browser E2E Story ${runId}`, { exact: true }).waitFor();
    await anonymousPage.getByRole("link", { name: "เปิดอ่าน" }).click();
    await anonymousPage.getByText(testText).waitFor();
    const anonymousStorySession = anonymousStarts.find((item) => item.targetType === "STORY");
    const anonymousEpisodeSession = anonymousStarts.find((item) => item.targetType === "EPISODE");
    check(anonymousStorySession && anonymousEpisodeSession,
      "Anonymous Story and Episode sessions were not both accepted.");
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
      publicReaderRoutingVerified: true,
      readerLibraryVerified: true,
      readingProgressVerified: true,
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
      draftExcludedFromDiscovery: true,
      mockFallbackDetected: false,
    }, null, 2));
  } catch (error) {
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
    console.error(`Browser E2E failed. Failure screenshot: ${screenshotPath}`);
    throw error;
  } finally {
    await fs.rm(imagePath, { force: true }).catch(() => undefined);
    await context.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
