import { chromium } from "playwright";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { deflateSync } from "node:zlib";

const baseUrl = "http://localhost:3000";
const runId = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
const testText = `NovelVerse browser E2E content ${runId}`;
const screenshotPath = path.join(os.tmpdir(), `novelverse-e2e-failure-${runId}.png`);
const imagePath = path.join(os.tmpdir(), `novelverse-e2e-${runId}.png`);

function check(condition, message) {
  if (!condition) throw new Error(message);
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
