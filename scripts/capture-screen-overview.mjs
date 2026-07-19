import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const PORT = Number(process.env.NOVELVERSE_CAPTURE_PORT || 3210);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const OUTPUT_DIR = path.resolve("docs", "visual", "screenshots");

const screens = [
  { key: "home", route: "/", role: "guest" },
  { key: "categories", route: "/categories", role: "guest" },
  { key: "category-fantasy", route: "/category/%E0%B9%81%E0%B8%9F%E0%B8%99%E0%B8%95%E0%B8%B2%E0%B8%8B%E0%B8%B5", role: "guest" },
  { key: "search", route: "/search?q=%E0%B9%80%E0%B8%A7%E0%B8%97%E0%B8%A1%E0%B8%99%E0%B8%95%E0%B8%A3%E0%B9%8C", role: "guest" },
  { key: "story-detail", route: "/story/library-after-rain", role: "guest" },
  { key: "creator-profile", route: "/creator/praewa-writes", role: "guest" },
  { key: "login", route: "/login", role: "guest" },
  { key: "following", route: "/following", role: "member" },
  { key: "history", route: "/history", role: "member" },
  { key: "novel-reader", route: "/story/library-after-rain/chapter/1?adFree=true&premium=false", role: "member", standardAds: 0, premium: false },
  { key: "novel-reader-ads-10", route: "/story/library-after-rain/chapter/1?adCount=10&premium=false", role: "member", standardAds: 10, premium: false },
  { key: "comic-reader", route: "/comic/last-tram-home/chapter/1?adFree=true&premium=false", role: "member", standardAds: 0, premium: false },
  { key: "comic-reader-ads-10", route: "/comic/last-tram-home/chapter/1?adCount=10&premium=false", role: "member", standardAds: 10, premium: false },
  { key: "premium-popup-stack", route: "/story/library-after-rain/chapter/1?adCount=10&premium=true", role: "member", standardAds: 10, premium: true, viewports: ["desktop"] },
  { key: "novel-reader-ad-free", route: "/story/library-after-rain/chapter/1?adFree=true&premium=true", role: "member", standardAds: 0, premium: false, viewports: ["desktop"] },
  { key: "member-dashboard", route: "/dashboard", role: "member" },
  { key: "member-profile-edit", route: "/dashboard/profile", role: "member" },
  { key: "member-stories", route: "/dashboard/stories", role: "member" },
  { key: "member-story-create", route: "/dashboard/stories/new", role: "member" },
  { key: "member-story-edit", route: "/dashboard/stories/nv-01/edit", role: "member" },
  { key: "member-chapters", route: "/dashboard/stories/nv-01/chapters", role: "member" },
  { key: "member-chapter-create", route: "/dashboard/stories/nv-01/chapters/new", role: "member" },
  { key: "member-comments", route: "/dashboard/comments", role: "member" },
  { key: "member-analytics", route: "/dashboard/analytics", role: "member" },
  { key: "member-settings", route: "/dashboard/settings", role: "member" },
  { key: "admin-dashboard", route: "/admin", role: "admin" },
  { key: "admin-users", route: "/admin/users", role: "admin" },
  { key: "admin-stories", route: "/admin/stories", role: "admin" },
  { key: "admin-comments", route: "/admin/comments", role: "admin" },
  { key: "admin-reports", route: "/admin/reports", role: "admin" },
  { key: "admin-categories", route: "/admin/categories", role: "admin" },
  { key: "admin-tags", route: "/admin/tags", role: "admin" },
  { key: "ux-states", route: "/_states", role: "guest" },
  { key: "not-found", route: "/screen-overview-not-found", role: null },
  { key: "permission-denied", route: "/permission-denied", role: null },
];

const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer(timeoutMs = 90_000) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(BASE_URL, { redirect: "manual", signal: AbortSignal.timeout(2_000) });
      if (response.status < 500) return;
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }
  throw new Error(`Development server was not ready within ${timeoutMs}ms: ${lastError ?? "unknown error"}`);
}

function stopServer(server) {
  if (!server || server.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }
}

async function selectRole(page, role) {
  if (!role || role === "member") return;
  const roleButton = page.getByRole("button", { name: role === "guest" ? "Guest" : "Admin", exact: true });
  if (await roleButton.count()) {
    await roleButton.first().click();
    await page.waitForTimeout(100);
  }
}

async function verifyAdvertisementBehavior(browser) {
  const checks = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const dialog = () => page.getByRole("dialog", { name: "โฆษณาพรีเมียม" });
  const check = async (name, action) => { await action(); checks.push(name); console.log(`✓ ตรวจสอบ: ${name}`); };
  try {
    await page.goto(`${BASE_URL}/story/library-after-rain/chapter/1?adCount=10&premium=true`, { waitUntil: "networkidle" });
    await check("Free Member เห็น Premium Popup", async () => dialog().waitFor({ state: "visible" }));
    await check("Premium Popup ล็อก document และตรึง reader ไว้ด้านบน",async()=>{const state=await page.evaluate(()=>({scrollY,htmlOverflow:document.documentElement.style.overflow,bodyPosition:document.body.style.position,bodyTouchAction:document.body.style.touchAction}));if(state.scrollY!==0||state.htmlOverflow!=="hidden"||state.bodyPosition!=="fixed"||state.bodyTouchAction!=="none")throw new Error(JSON.stringify(state))});
    await check("mouse wheel และปุ่มเลื่อนหน้าไม่ทำให้ reader เคลื่อน",async()=>{for(const key of ["PageDown","PageUp","Space","Home","End","ArrowDown","ArrowUp","ArrowLeft","ArrowRight"]){await page.keyboard.press(key)}await page.mouse.wheel(0,800);await page.waitForTimeout(100);if(await page.evaluate(()=>scrollY)!==0)throw new Error("Reader scrolled behind popup")});
    await check("Escape ก่อนครบ 5 วินาทีไม่ปิด popup",async()=>{await page.keyboard.press("Escape");if(!await dialog().isVisible())throw new Error("Escape closed popup too early")});
    await check("Tab และ Shift+Tab กัก focus ใน popup",async()=>{for(const key of ["Tab","Tab","Shift+Tab"]){await page.keyboard.press(key);const inside=await page.evaluate(()=>{const popup=document.querySelector("[data-premium-popup]");return Boolean(popup&&popup.contains(document.activeElement))});if(!inside)throw new Error(`Focus escaped after ${key}`)}});
    await check("ปุ่มปิดยังใช้ไม่ได้ก่อนครบ 5 วินาที", async () => { if (!(await page.getByRole("button", { name: /ปิดโฆษณาพรีเมียมได้ในอีก/ }).isDisabled())) throw new Error("Close button is enabled too early"); });
    await check("คลิกโฆษณาเปิดแท็บใหม่", async () => {
      const popupPromise = context.waitForEvent("page");
      await page.getByRole("link", { name: /เปิดลิงก์โฆษณาพรีเมียม/ }).click();
      const targetPage = await popupPromise;
      if (!targetPage.url().startsWith("https://example.com")) throw new Error(`Unexpected target: ${targetPage.url()}`);
      await targetPage.close();
    });
    await check("ปุ่มปิด Premium ใช้ได้เมื่อ countdown เป็นศูนย์", async () => { const close=page.getByRole("button",{name:"ปิดโฆษณาพรีเมียม",exact:true});await close.waitFor({state:"visible",timeout:7_000});if(await close.isDisabled())throw new Error("Close button remains disabled");await close.click() });
    await check("หลังปิดอยู่ต้น standard advertisement section และคืน document styles",async()=>{await page.waitForTimeout(100);const state=await page.evaluate(()=>{const section=document.querySelector("[data-reader-ad-section]");return{top:section?.getBoundingClientRect().top,htmlOverflow:document.documentElement.style.overflow,bodyPosition:document.body.style.position,bodyTouchAction:document.body.style.touchAction,focusInside:section?.contains(document.activeElement)}});if(Math.abs(state.top??999)>1||state.htmlOverflow||state.bodyPosition||state.bodyTouchAction||!state.focusInside)throw new Error(JSON.stringify(state))});
    await check("scrolling กลับมาใช้งานหลังปิด popup",async()=>{const before=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,500);await page.waitForTimeout(100);const after=await page.evaluate(()=>scrollY);if(after<=before)throw new Error(`Scroll remained locked: ${before} -> ${after}`)});
    await check("standard ads ครบ 10 ใบและเรียง ad-001 ถึง ad-010", async()=>{const ids=await page.locator("[data-standard-ad-id]").evaluateAll((nodes)=>nodes.map((node)=>node.getAttribute("data-standard-ad-id")));const expected=Array.from({length:10},(_,index)=>`ad-${String(index+1).padStart(3,"0")}`);if(JSON.stringify(ids)!==JSON.stringify(expected))throw new Error(`Unexpected order: ${ids.join(",")}`)});
    await check("Novel content อยู่หลัง standard stack",async()=>{const last=await page.locator('[data-standard-ad-id="ad-010"]').boundingBox();const content=await page.locator(".readerText").boundingBox();if(!last||!content||content.y<last.y+last.height)throw new Error("Novel content is not after the full stack")});
    await check("standard advertisement เปิดแท็บใหม่",async()=>{const popupPromise=context.waitForEvent("page");await page.locator('[data-standard-ad-id="ad-001"]').click();const target=await popupPromise;if(!target.url().includes("ad=001"))throw new Error(`Unexpected standard target: ${target.url()}`);await target.close()});
    await check("โหมด 3 standard ads แสดง 3 ใบ",async()=>{await page.goto(`${BASE_URL}/story/library-after-rain/chapter/1?adCount=3&premium=false`,{waitUntil:"networkidle"});if(await page.locator("[data-standard-ad-id]").count()!==3)throw new Error("Expected 3 standard ads")});
    await check("Guest เห็น standard ads ทั้งหมด",async()=>{await page.goto(`${BASE_URL}/story/library-after-rain/chapter/1?adRole=guest&adCount=10&premium=false`,{waitUntil:"networkidle"});if(await page.locator("[data-standard-ad-id]").count()!==10)throw new Error("Guest did not receive all ads")});
    await check("Admin ไม่เห็นโฆษณาหรือ upsell",async()=>{await page.goto(`${BASE_URL}/story/library-after-rain/chapter/1?adRole=admin`,{waitUntil:"networkidle"});if(await page.locator("[data-standard-ad-id], [data-premium-popup]").count())throw new Error("Admin received ads");if(await page.getByText("โฆษณาจากผู้สนับสนุน").count())throw new Error("Admin received upsell")});
    await check("Ad-free Member ไม่เห็นโฆษณาหรือ upsell",async()=>{await page.goto(`${BASE_URL}/story/library-after-rain/chapter/1?adFree=true`,{waitUntil:"networkidle"});if(await page.locator("[data-standard-ad-id], [data-premium-popup]").count())throw new Error("Ad-free member received ads");if(await page.getByText("โฆษณาจากผู้สนับสนุน").count())throw new Error("Ad-free member received upsell")});
    await check("Premium Popup off ไม่แสดง popup",async()=>{await page.goto(`${BASE_URL}/story/library-after-rain/chapter/1?premium=false`,{waitUntil:"networkidle"});if(await dialog().count())throw new Error("Premium popup remained enabled")});
    await check("Comic Reader แสดง 10 ads ก่อนภาพ",async()=>{await page.goto(`${BASE_URL}/comic/last-tram-home/chapter/1?adCount=10&premium=false`,{waitUntil:"networkidle"});if(await page.locator("[data-standard-ad-id]").count()!==10)throw new Error("Comic did not receive 10 ads");const last=await page.locator('[data-standard-ad-id="ad-010"]').boundingBox();const content=await page.locator(".comicCanvas").boundingBox();if(!last||!content||content.y<last.y+last.height)throw new Error("Comic images are not after the full stack")});
  } finally {
    await context.close();
  }

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const mobilePage = await mobileContext.newPage();
  try {
    await mobilePage.goto(`${BASE_URL}/comic/last-tram-home/chapter/1?adCount=10&premium=true`,{waitUntil:"networkidle"});
    const touchBlocked=await mobilePage.evaluate(()=>!document.dispatchEvent(new TouchEvent("touchmove",{bubbles:true,cancelable:true})));
    if(!touchBlocked||await mobilePage.evaluate(()=>scrollY)!==0)throw new Error("Premium popup did not block mobile touch scrolling");
    checks.push("Premium Popup บล็อก touch scrolling บน mobile");console.log("✓ ตรวจสอบ: Premium Popup บล็อก touch scrolling บน mobile");
    for(const route of ["/story/library-after-rain/chapter/1?adCount=10&premium=false","/comic/last-tram-home/chapter/1?adCount=10&premium=false"]){await mobilePage.goto(`${BASE_URL}${route}`,{waitUntil:"networkidle"});const overflow=await mobilePage.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);if(overflow)throw new Error(`Mobile horizontal overflow on ${route}`);if(await mobilePage.locator("[data-standard-ad-id]").count()!==10)throw new Error(`Missing mobile ads on ${route}`)}
    checks.push("Novel/Comic mobile stacks ไม่มี horizontal overflow");console.log("✓ ตรวจสอบ: Novel/Comic mobile stacks ไม่มี horizontal overflow");
  } finally {
    await mobileContext.close();
  }
  return checks;
}

async function capture() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const previousScreenshots=await readdir(OUTPUT_DIR);await Promise.all(previousScreenshots.filter((file)=>file.endsWith(".png")).map((file)=>rm(path.join(OUTPUT_DIR,file),{force:true})));

  const serverCommand = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npm";
  const serverArgs = process.platform === "win32"
    ? ["/d", "/s", "/c", `npm.cmd run dev -- --hostname 127.0.0.1 --port ${PORT}`]
    : ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(PORT)];
  const server = spawn(serverCommand, serverArgs, {
    cwd: process.cwd(),
    detached: process.platform !== "win32",
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  const successes = [];
  const failures = [];

  server.stdout.on("data", (chunk) => process.stdout.write(`[next] ${chunk}`));
  server.stderr.on("data", (chunk) => process.stderr.write(`[next] ${chunk}`));

  try {
    await waitForServer();
    browser = await chromium.launch({ headless: true });
    await verifyAdvertisementBehavior(browser);

    for (const screen of screens) {
      for (const viewport of viewports.filter((candidate) => !screen.viewports || screen.viewports.includes(candidate.name))) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
          locale: "th-TH",
          colorScheme: "light",
          reducedMotion: "reduce",
        });
        const page = await context.newPage();
        const filename = `${screen.key}-${viewport.name}.png`;
        try {
          const response = await page.goto(`${BASE_URL}${screen.route}`, { waitUntil: "networkidle", timeout: 45_000 });
          if (!response || response.status() >= 500) throw new Error(`HTTP ${response?.status() ?? "no response"}`);
          await selectRole(page, screen.role);
          if(screen.premium===true)await page.getByRole("dialog",{name:"โฆษณาพรีเมียม"}).waitFor({state:"visible"});
          if(screen.premium===false&&await page.locator("[data-premium-popup]").count())throw new Error("Premium popup should be hidden");
          if(typeof screen.standardAds==="number"&&await page.locator("[data-standard-ad-id]").count()!==screen.standardAds)throw new Error(`Expected ${screen.standardAds} standard advertisements`);
          await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
          await page.screenshot({ path: path.join(OUTPUT_DIR, filename), fullPage: true });
          successes.push(filename);
          console.log(`✓ ${filename} (${screen.route}, ${screen.role ?? "no role"})`);
        } catch (error) {
          failures.push({ filename, route: screen.route, error: error instanceof Error ? error.message : String(error) });
          console.error(`✗ ${filename}: ${failures.at(-1).error}`);
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    if (browser) await browser.close();
    stopServer(server);
  }

  console.log("\nสรุปการจับภาพหน้าจอ");
  const expectedCaptures = screens.reduce((total, screen) => total + (screen.viewports?.length ?? viewports.length), 0);
  console.log(`สำเร็จ: ${successes.length}/${expectedCaptures}`);
  console.log(`ล้มเหลว: ${failures.length}`);
  for (const failure of failures) console.log(`- ${failure.filename} (${failure.route}): ${failure.error}`);
  if (failures.length) process.exitCode = 1;
}

capture().catch((error) => {
  console.error("ไม่สามารถดำเนินการจับภาพหน้าจอได้:", error);
  process.exitCode = 1;
});
