import { chromium } from "playwright";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}

const baseUrl = argument("--base-url");
const approvedHostname = argument("--approved-hostname");
const environment = argument("--environment");
const coordinatedRelease = argument("--coordinated-release");
const validateOnly = process.argv.includes("--validate-config-only");
check(baseUrl && approvedHostname && environment && coordinatedRelease,
  "Deployed Beta E2E requires base URL, approved hostname, environment, and coordinated release.");
const parsedBaseUrl = new URL(baseUrl);
check(environment === "Beta", "Deployed Browser E2E is authorized only for Beta.");
check(parsedBaseUrl.protocol === "https:" && parsedBaseUrl.hostname === approvedHostname,
  "Deployed Browser E2E requires the exact approved HTTPS hostname.");
check(parsedBaseUrl.pathname === "/" && !parsedBaseUrl.search && !parsedBaseUrl.hash && !parsedBaseUrl.port,
  "Deployed Browser E2E requires the approved origin root on the default HTTPS port.");
check(!["localhost", "127.0.0.1", "::1"].includes(parsedBaseUrl.hostname) &&
  !/(^|[.-])(prod|production)([.-]|$)/i.test(parsedBaseUrl.hostname),
"Deployed Browser E2E rejected a local or Production-like target.");
check(/^v\d+\.\d+\.\d+/.test(coordinatedRelease), "Coordinated release identity is malformed.");
if (validateOnly) {
  console.log(JSON.stringify({ result: "CONFIG_VALID", environment, approvedHostname, coordinatedRelease }));
  process.exit(0);
}

const accessToken = process.env.NOVELVERSE_BETA_ACCESS_TOKEN;
check(accessToken, "A protected synthetic Beta actor token is required; no mock or anonymous fallback is allowed.");
const origin = parsedBaseUrl.origin;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ baseURL: origin, locale: "th-TH" });
try {
  const page = await context.newPage();
  const apiHealth = await page.request.get("/api/v1/health/ready");
  check(apiHealth.ok(), "Same-origin API readiness failed.");
  const storiesResponse = await page.request.get("/api/v1/stories?pageSize=1");
  check(storiesResponse.ok(), "Anonymous public Story API read failed.");
  const stories = await storiesResponse.json();
  check(Array.isArray(stories.items) && stories.items.length > 0,
    "Beta has no approved synthetic public Story fixture for Browser E2E.");
  const story = stories.items[0];
  check(story.creatorSlug && story.slug, "Public Story fixture has no canonical route identity.");

  await page.goto(`/stories/${encodeURIComponent(story.creatorSlug)}/${encodeURIComponent(story.slug)}`,
    { waitUntil: "networkidle" });
  check(page.url().startsWith(origin), "Public Story navigation left the approved Beta origin.");
  check((await page.locator("body").innerText()).includes(story.title), "Public Story did not render real API content.");
  check(!/(mock fallback|mock data)/i.test(await page.locator("body").innerText()),
    "Public Story rendered a mock fallback.");

  await page.goto("/login", { waitUntil: "networkidle" });
  check(page.url().startsWith(`${origin}/login`), "Login boundary left the approved Beta origin.");
  await page.evaluate((token) => {
    localStorage.setItem("novelverse_access_token", token);
    localStorage.setItem("novelverse_access_token_expires_at", new Date(Date.now() + 10 * 60_000).toISOString());
  }, accessToken);
  await page.goto("/notifications", { waitUntil: "networkidle" });
  check(page.url().startsWith(`${origin}/notifications`), "Authenticated Notifications route was not retained.");
  const notificationResponse = await page.request.get("/api/v1/notifications?pageSize=1", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  check(notificationResponse.ok(), "Authenticated Notifications API route failed.");
  check(!/(mock fallback|mock data)/i.test(await page.locator("body").innerText()),
    "Notifications rendered a mock fallback.");

  console.log(JSON.stringify({
    result: "PASS",
    environment,
    coordinatedRelease,
    hostname: approvedHostname,
    sameOriginApi: true,
    publicStoryRead: true,
    loginBoundary: true,
    notificationsAuthenticated: true,
    mockFallbackDetected: false,
    actorCreatedByTest: false,
    cleanupRequired: false,
  }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
