import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import nextConfig from "../../../next.config";
import { CreatorDashboard } from "./CreatorDashboard";
import { attentionHref } from "./routes";
import type { CreatorDashboardResponse } from "./types";
import * as api from "@/features/novel-editor/api";

const replace = vi.fn();
const router = { replace };
let sessionListener: (() => void) | undefined;
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/novel-editor/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/novel-editor/api")>();
  return {
    ...actual,
    clearSession: vi.fn(),
    getCreatorDashboard: vi.fn(),
    subscribeToSessionChanges: vi.fn((listener: () => void) => {
      sessionListener = listener;
      return () => { sessionListener = undefined; };
    }),
  };
});

const metric = (current: number | null, previous: number | null, suppressed = false) => ({
  current: { value: current, suppressed },
  previous: { value: previous, suppressed },
  absoluteChange: current === null || previous === null ? null : current - previous,
  percentageChange: current === null || previous === null || previous === 0 ? null : (current - previous) / previous,
});

function dashboard(overrides: Partial<CreatorDashboardResponse> = {}): CreatorDashboardResponse {
  return {
    generatedAt: "2026-07-29T08:30:00Z",
    period: {
      kind: "COMPLETE_UTC_DAYS",
      currentStartInclusive: "2026-07-22",
      currentEndExclusive: "2026-07-29",
      previousStartInclusive: "2026-07-15",
      previousEndExclusive: "2026-07-22",
      days: 7,
    },
    creator: {
      creatorProfileId: "creator-1",
      displayName: "Creator A",
      creatorSlug: "creator-a",
      eligibility: "ELIGIBLE",
      profileVisibility: "VISIBLE",
      followerCount: 19,
    },
    overview: {
      stories: { total: 3 },
      storiesByType: { novel: 1, comic: 1, video: 1 },
      storiesByStatus: { draft: 1, published: 2, archived: 0 },
      hiddenStories: 1,
      episodes: { total: 5 },
      episodesByStatus: { draft: 1, published: 4, archived: 0 },
      hiddenEpisodes: 0,
      bookmarkCount: 31,
      likeCount: 27,
    },
    performance: {
      availability: "AVAILABLE",
      suppression: { reason: "NONE", threshold: 5 },
      qualifiedViews: metric(12, 8),
      uniqueViewers: metric(7, 5),
      activeReadSeconds: metric(3720, 2400),
      completedSessions: metric(6, 4),
      completionRate: metric(0.5, 0.5),
    },
    content: {
      recentStories: [{
        storyId: "story-1", title: "A visible Novel", slug: "visible-novel", storyType: "NOVEL",
        status: "PUBLISHED", visibility: "PUBLIC", moderationVisibility: "VISIBLE",
        updatedAt: "2026-07-28T10:00:00Z", publishedAt: "2026-07-20T10:00:00Z",
        publishedEpisodeCount: 2, canEdit: true, canAddEpisode: true, canViewPublic: true,
      }, {
        storyId: "story-hidden", title: "An owned hidden Comic", slug: "hidden-comic", storyType: "COMIC",
        status: "DRAFT", visibility: "PUBLIC", moderationVisibility: "HIDDEN",
        updatedAt: "2026-07-27T10:00:00Z", publishedAt: null,
        publishedEpisodeCount: 0, canEdit: true, canAddEpisode: true, canViewPublic: false,
      }],
      recentDrafts: [],
      recentEpisodes: [{
        episodeId: "episode-1", storyId: "story-1", storyTitle: "A visible Novel",
        title: "Episode one", slug: "episode-one", episodeNumber: 1, storyType: "NOVEL",
        status: "PUBLISHED", visibility: "PUBLIC", moderationVisibility: "VISIBLE",
        contentReadiness: "READY", updatedAt: "2026-07-28T09:00:00Z",
        publishedAt: "2026-07-20T11:00:00Z", canEdit: true, canViewPublic: true,
      }],
    },
    attention: {
      items: [{
        reasonCode: "STORY_HIDDEN", severity: "WARNING", targetType: "STORY",
        targetId: "story-hidden", title: "An owned hidden Comic", action: "MANAGE_STORY",
      }],
      truncated: false,
    },
    capabilities: { canManageProfile: true, canCreateStory: true, canViewPublicProfile: true },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionListener = undefined;
  vi.mocked(api.getCreatorDashboard).mockResolvedValue(dashboard());
});

describe("Creator Dashboard", () => {
  it("renders an accessible skeleton while the required composite response is pending", () => {
    vi.mocked(api.getCreatorDashboard).mockReturnValue(new Promise(() => undefined));
    render(<CreatorDashboard />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading Creator Dashboard");
    expect(document.querySelector("main")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("renders sections in the same semantic order with snapshot and fixed-period values", async () => {
    render(<CreatorDashboard />);
    expect(await screen.findByRole("heading", { level: 1, name: "Creator A" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Overview", "Performance snapshot", "Recent content", "Needs attention", "Quick actions",
    ]);
    expect(screen.getByText("31")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("+4 vs previous")).toBeInTheDocument();
    expect(screen.getByText("2026-07-22 to 2026-07-29 UTC")).toBeInTheDocument();
  });

  it("renders suppression as Insufficient data without leaking null metrics as zero", async () => {
    const suppressed = metric(null, null, true);
    vi.mocked(api.getCreatorDashboard).mockResolvedValue(dashboard({
      performance: {
        availability: "SUPPRESSED",
        suppression: { reason: "SMALL_CELL", threshold: 5 },
        qualifiedViews: suppressed, uniqueViewers: suppressed, activeReadSeconds: suppressed,
        completedSessions: suppressed, completionRate: suppressed,
      },
    }));
    render(<CreatorDashboard />);
    expect(await screen.findByText("Insufficient data")).toBeInTheDocument();
    expect(screen.queryByText("Qualified Views")).not.toBeInTheDocument();
    expect(screen.getByText(/Exact values and deltas are not shown/)).toBeInTheDocument();
  });

  it("renders exact zero activity separately from a suppressed small cell", async () => {
    const zero = metric(0, 0);
    vi.mocked(api.getCreatorDashboard).mockResolvedValue(dashboard({
      performance: {
        availability: "NO_ACTIVITY",
        suppression: { reason: "NONE", threshold: 5 },
        qualifiedViews: zero, uniqueViewers: zero, activeReadSeconds: zero,
        completedSessions: zero, completionRate: metric(null, null),
      },
    }));
    render(<CreatorDashboard />);
    const performance = await screen.findByRole("heading", { name: "Performance snapshot" });
    const section = performance.closest("section")!;
    expect(within(section).queryByText("Insufficient data")).not.toBeInTheDocument();
    expect(within(section).getByText("Qualified Views").closest("li")).toHaveTextContent("0");
    expect(within(section).getByText("Unique Readers").closest("li")).toHaveTextContent("0");
  });

  it("shows honest empty states and derives every quick action from capabilities", async () => {
    vi.mocked(api.getCreatorDashboard).mockResolvedValue(dashboard({
      overview: {
        ...dashboard().overview, stories: { total: 0 }, episodes: { total: 0 },
        storiesByStatus: { draft: 0, published: 0, archived: 0 },
      },
      content: { recentStories: [], recentDrafts: [], recentEpisodes: [] },
      capabilities: { canManageProfile: true, canCreateStory: false, canViewPublicProfile: false },
    }));
    render(<CreatorDashboard />);
    expect(await screen.findByText("No Stories yet")).toBeInTheDocument();
    expect(screen.getByText("No Episodes yet")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create Story" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit Profile" })).toHaveAttribute("href", "/creator/profile");
    expect(screen.queryByRole("link", { name: "View public work" })).not.toBeInTheDocument();
  });

  it("marks owned hidden content without exposing moderation notes or a public action", async () => {
    render(<CreatorDashboard />);
    const hiddenTitle = (await screen.findAllByRole("heading", { name: "An owned hidden Comic" }))[0];
    const item = hiddenTitle.closest("li")!;
    expect(within(item).getByText("Hidden")).toBeInTheDocument();
    expect(within(item).queryByRole("link", { name: "View public Story" })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/moderator|audit|internal note/i);
  });

  it("retains confirmed content after 429 and lets the creator retry", async () => {
    render(<CreatorDashboard />);
    expect(await screen.findByText("Creator A")).toBeInTheDocument();
    vi.mocked(api.getCreatorDashboard).mockRejectedValueOnce(new api.ApiError(429));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("Too many refreshes")).toBeInTheDocument();
    expect(screen.getByText("Creator A")).toBeInTheDocument();
  });

  it("logs out by clearing the shared session and removing confirmed creator data", async () => {
    render(<CreatorDashboard />);
    expect(await screen.findByText("Creator A")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(api.clearSession).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/login");
    expect(screen.queryByText("Creator A")).not.toBeInTheDocument();
  });

  it("handles 403 onboarding and terminal 401 without exposing dashboard data", async () => {
    vi.mocked(api.getCreatorDashboard).mockRejectedValueOnce(new api.ApiError(403));
    const first = render(<CreatorDashboard />);
    expect(await screen.findByRole("link", { name: "Creator onboarding" }))
      .toHaveAttribute("href", "/creator/profile");
    expect(screen.queryByText("Creator A")).not.toBeInTheDocument();
    first.unmount();

    vi.mocked(api.getCreatorDashboard).mockRejectedValueOnce(new api.ApiError(401));
    render(<CreatorDashboard />);
    await waitFor(() => expect(api.clearSession).toHaveBeenCalled());
    expect(replace).toHaveBeenCalledWith("/login?next=%2Fcreator%2Fdashboard");
    expect(screen.queryByText("Creator A")).not.toBeInTheDocument();
  });

  it.each([
    [404, "Dashboard unavailable", "Try again"],
    [500, "Dashboard could not be loaded", "Retry"],
    [504, "Dashboard could not be loaded", "Retry"],
  ])("renders a safe %s error and recovers through an explicit retry", async (status, title, action) => {
    vi.mocked(api.getCreatorDashboard).mockRejectedValueOnce(new api.ApiError(status));
    render(<CreatorDashboard />);
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.queryByText("Creator A")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: action }));
    expect(await screen.findByText("Creator A")).toBeInTheDocument();
  });

  it("clears the previous viewer before resolving the next session", async () => {
    render(<CreatorDashboard />);
    expect(await screen.findByText("Creator A")).toBeInTheDocument();
    let resolveNext!: (value: CreatorDashboardResponse) => void;
    vi.mocked(api.getCreatorDashboard).mockReturnValueOnce(new Promise((resolve) => { resolveNext = resolve; }));
    await act(async () => { sessionListener?.(); });
    expect(screen.queryByText("Creator A")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading Creator Dashboard");
    resolveNext(dashboard({ creator: { ...dashboard().creator, displayName: "Creator B" } }));
    expect(await screen.findByText("Creator B")).toBeInTheDocument();
    expect(screen.queryByText("Creator A")).not.toBeInTheDocument();
  });

  it("bounds content and attention output and uses stable, allowed route mappings", async () => {
    const base = dashboard();
    vi.mocked(api.getCreatorDashboard).mockResolvedValue(dashboard({
      content: {
        ...base.content,
        recentStories: Array.from({ length: 7 }, (_, index) => ({
          ...base.content.recentStories[0], storyId: `story-${index}`, title: `Story ${index}`,
        })),
      },
      attention: {
        items: Array.from({ length: 12 }, (_, index) => ({
          ...base.attention.items[0], targetId: `attention-${index}`, title: `Attention ${index}`,
        })),
        truncated: true,
      },
    }));
    render(<CreatorDashboard />);
    await screen.findByText("Story 0");
    expect(screen.getAllByText(/^Story \d$/)).toHaveLength(5);
    expect(screen.getAllByText(/^Attention \d+$/)).toHaveLength(10);
    expect(attentionHref({
      reasonCode: "CREATOR_PROFILE_INCOMPLETE", severity: "WARNING", targetType: "CREATOR_PROFILE",
      targetId: null, title: "Profile", action: "MANAGE_PROFILE",
    })).toBe("/creator/profile");
  });

  it("keeps one DOM order on mobile and desktop and provides responsive single-column CSS", async () => {
    render(<CreatorDashboard />);
    await screen.findByText("Creator A");
    const css = readFileSync(join(process.cwd(), "src/features/creator-dashboard/creatorDashboard.module.css"), "utf8");
    expect(css).toContain("@media(max-width:600px)");
    expect(css).toMatch(/overviewGrid,.performanceGrid\{grid-template-columns:1fr\}/);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(5);
    expect(screen.getAllByRole("link").every((link) => Boolean(link.textContent?.trim()))).toBe(true);
  });
});

describe("legacy dashboard migration", () => {
  it("redirects approved legacy routes and leaves removed comments/settings without a competing page", async () => {
    const redirects = await nextConfig.redirects!();
    expect(redirects).toEqual(expect.arrayContaining([
      { source: "/dashboard", destination: "/creator/dashboard", permanent: true },
      { source: "/dashboard/analytics", destination: "/creator/dashboard", permanent: false },
      { source: "/dashboard/stories/:id/edit", destination: "/creator/stories/:id", permanent: true },
    ]));
    expect(redirects.some((redirect) => redirect.source === "/dashboard/comments")).toBe(false);
    expect(redirects.some((redirect) => redirect.source === "/dashboard/settings")).toBe(false);
  });

  it("has no legacy component, mock-data import, chart dependency, or mock fallback", () => {
    const source = readFileSync(join(process.cwd(), "src/features/creator-dashboard/CreatorDashboard.tsx"), "utf8");
    const packageJson = readFileSync(join(process.cwd(), "package.json"), "utf8");
    expect(source).not.toMatch(/mockData|mock fallback|localStorage|sessionStorage|indexedDB|dangerouslySetInnerHTML/i);
    expect(packageJson).not.toMatch(/chart\.js|recharts|highcharts/i);
  });
});
