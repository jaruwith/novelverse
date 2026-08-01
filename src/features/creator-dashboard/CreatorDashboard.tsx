"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  clearSession,
  getCreatorDashboard,
  subscribeToSessionChanges,
} from "@/features/novel-editor/api";
import {
  attentionHref,
  creatorProfileHref,
  creatorStoriesHref,
  episodeOpenHref,
  publicStoryHref,
  storyOpenHref,
} from "./routes";
import type {
  AttentionItem,
  CreatorDashboardResponse,
  MetricComparison,
  RecentEpisodeItem,
  RecentStoryItem,
} from "./types";
import styles from "./creatorDashboard.module.css";

const numberFormatter = new Intl.NumberFormat();
const percentFormatter = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 });
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatNumber = (value: number) => numberFormatter.format(value);
const formatDate = (value: string) => dateFormatter.format(new Date(value));
const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours) return `${formatNumber(hours)}h ${formatNumber(minutes)}m`;
  return `${formatNumber(minutes)}m`;
};

const reasonLabels: Record<AttentionItem["reasonCode"], string> = {
  CREATOR_PROFILE_INCOMPLETE: "Complete your creator profile",
  CREATOR_PROFILE_HIDDEN: "Your creator profile is hidden",
  STORY_HIDDEN: "Story is hidden",
  EPISODE_HIDDEN: "Episode is hidden",
  PUBLISHED_STORY_NO_PUBLIC_EPISODE: "Published Story has no public Episode",
  DRAFT_STORY_NO_EPISODE: "Draft Story has no Episode",
  DRAFT_EPISODE_MISSING_CONTENT: "Draft Episode needs content",
};

function Badge({ children, tone = "neutral" }: {
  children: React.ReactNode;
  tone?: "neutral" | "positive" | "warning" | "critical";
}) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}

function DashboardSkeleton() {
  return <main className={styles.page} aria-busy="true">
    <div className={styles.srOnly} role="status">Loading Creator Dashboard</div>
    <section className={`${styles.headerCard} ${styles.skeletonBlock}`} aria-hidden="true" />
    <section aria-hidden="true"><div className={styles.skeletonHeading} />
      <div className={styles.overviewGrid}>{Array.from({ length: 8 }, (_, index) =>
        <div className={`${styles.metricCard} ${styles.skeletonBlock}`} key={index} />
      )}</div>
    </section>
    <section aria-hidden="true"><div className={styles.skeletonHeading} />
      <div className={`${styles.performanceGrid} ${styles.skeletonBlock}`} />
    </section>
    <section aria-hidden="true"><div className={styles.skeletonHeading} />
      <div className={`${styles.listCard} ${styles.skeletonBlock}`} />
    </section>
  </main>;
}

function SectionError({ error, retry }: { error: ApiError | Error; retry: () => void }) {
  const status = error instanceof ApiError ? error.status : 0;
  const content = status === 403
    ? {
      title: "Creator access is not available",
      detail: "Complete creator onboarding or resolve your account status before using this workspace.",
      action: <Link className={styles.primaryAction} href={creatorProfileHref}>Creator onboarding</Link>,
    }
    : status === 404
      ? {
        title: "Dashboard unavailable",
        detail: "This creator workspace is not available.",
        action: <button type="button" onClick={retry}>Try again</button>,
      }
      : status === 429
        ? {
          title: "Too many refreshes",
          detail: "Please retry later. Your last confirmed Dashboard remains visible when available.",
          action: <button type="button" onClick={retry}>Retry</button>,
        }
        : {
          title: "Dashboard could not be loaded",
          detail: "A temporary service problem interrupted the request.",
          action: <button type="button" onClick={retry}>Retry</button>,
        };
  return <div className={styles.errorPanel} role="alert">
    <div><strong>{content.title}</strong><p>{content.detail}</p></div>{content.action}
  </div>;
}

function Overview({ dashboard }: { dashboard: CreatorDashboardResponse }) {
  const cards = [
    ["Stories", dashboard.overview.stories.total],
    ["Published", dashboard.overview.storiesByStatus.published],
    ["Draft", dashboard.overview.storiesByStatus.draft],
    ["Hidden", dashboard.overview.hiddenStories],
    ["Episodes", dashboard.overview.episodes.total],
    ["Bookmarks", dashboard.overview.bookmarkCount],
    ["Likes", dashboard.overview.likeCount],
    ["Followers", dashboard.creator.followerCount],
  ] as const;
  return <section aria-labelledby="dashboard-overview">
    <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Current snapshot</p>
      <h2 id="dashboard-overview">Overview</h2></div>
      <p>{formatNumber(dashboard.overview.storiesByType.novel)} Novel · {formatNumber(dashboard.overview.storiesByType.comic)} Comic · {formatNumber(dashboard.overview.storiesByType.video)} Video</p>
    </div>
    <ul className={styles.overviewGrid}>{cards.map(([label, value]) =>
      <li className={styles.metricCard} key={label}><span>{label}</span><strong>{formatNumber(value)}</strong></li>
    )}</ul>
  </section>;
}

function Delta({ metric }: { metric: MetricComparison<number> }) {
  if (metric.absoluteChange === null) return <span className={styles.unavailable}>Change unavailable</span>;
  const prefix = metric.absoluteChange > 0 ? "+" : "";
  return <span aria-label={`Change from previous period: ${prefix}${formatNumber(metric.absoluteChange)}`}>
    {prefix}{formatNumber(metric.absoluteChange)} vs previous
  </span>;
}

function Performance({ dashboard }: { dashboard: CreatorDashboardResponse }) {
  const { performance, period } = dashboard;
  const range = `${period.currentStartInclusive} to ${period.currentEndExclusive}`;
  if (performance.availability === "SUPPRESSED") {
    return <section aria-labelledby="dashboard-performance">
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>7 complete UTC days</p>
        <h2 id="dashboard-performance">Performance snapshot</h2></div><p>{range} UTC</p></div>
      <div className={styles.suppressed} role="status">
        <strong>Insufficient data</strong>
        <p>Performance is private until at least {performance.suppression.threshold} qualified readers are present. Exact values and deltas are not shown.</p>
      </div>
    </section>;
  }
  const metrics = [
    ["Qualified Views", performance.qualifiedViews, formatNumber],
    ["Unique Readers", performance.uniqueViewers, formatNumber],
    ["Completion", performance.completionRate, (value: number) => percentFormatter.format(value)],
    ["Read Time", performance.activeReadSeconds, formatDuration],
  ] as const;
  return <section aria-labelledby="dashboard-performance">
    <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>7 complete UTC days</p>
      <h2 id="dashboard-performance">Performance snapshot</h2></div><p>{range} UTC</p></div>
    <ul className={styles.performanceGrid}>{metrics.map(([label, metric, formatter]) => {
      const current = metric.current.value;
      return <li className={styles.performanceCard} key={label}>
        <span>{label}</span>
        {current === null || metric.current.suppressed
          ? <strong className={styles.unavailable}>Unavailable</strong>
          : <strong>{formatter(current)}</strong>}
        <Delta metric={metric} />
      </li>;
    })}</ul>
  </section>;
}

function ContentBadges({ type, status, hidden }: {
  type: string;
  status: string;
  hidden: boolean;
}) {
  return <div className={styles.badgeRow}><Badge>{type}</Badge><Badge>{status}</Badge>
    {hidden && <Badge tone="critical">Hidden</Badge>}</div>;
}

function StoryList({ items, creatorSlug }: { items: RecentStoryItem[]; creatorSlug: string | null }) {
  if (!items.length) return <div className={styles.emptyState}><strong>No Stories yet</strong>
    <p>Create your first Story to begin your creator workspace.</p>
    <Link className={styles.primaryAction} href={creatorStoriesHref}>Create your first Story</Link></div>;
  return <ul className={styles.contentList}>{items.slice(0, 5).map((item) =>
    <li key={item.storyId}><div><ContentBadges type={item.storyType} status={item.status}
      hidden={item.moderationVisibility === "HIDDEN"} />
      <h3>{item.title}</h3><p>Updated {formatDate(item.updatedAt)}</p></div>
      <div className={styles.rowActions}>
        {(item.canEdit || item.canAddEpisode) &&
          <Link href={storyOpenHref(item)}>{item.canAddEpisode ? "Open / add Episode" : "Open"}</Link>}
        {item.canViewPublic && creatorSlug &&
          <Link href={publicStoryHref(creatorSlug, item.slug)}>View public Story</Link>}
      </div>
    </li>
  )}</ul>;
}

function EpisodeList({ items }: { items: RecentEpisodeItem[] }) {
  if (!items.length) return <div className={styles.emptyState}><strong>No Episodes yet</strong>
    <p>Open a Story to add your first Episode.</p>
    <Link className={styles.primaryAction} href={creatorStoriesHref}>Add your first Episode</Link></div>;
  return <ul className={styles.contentList}>{items.slice(0, 5).map((item) =>
    <li key={item.episodeId}><div><ContentBadges type={item.storyType} status={item.status}
      hidden={item.moderationVisibility === "HIDDEN"} />
      <h3>{item.title}</h3><p>{item.storyTitle} · Updated {formatDate(item.updatedAt)}</p></div>
      <div className={styles.rowActions}>{item.canEdit && <Link href={episodeOpenHref(item)}>Open</Link>}</div>
    </li>
  )}</ul>;
}

function RecentContent({ dashboard }: { dashboard: CreatorDashboardResponse }) {
  const stories = useMemo(() => {
    const unique = new Map<string, RecentStoryItem>();
    [...dashboard.content.recentStories, ...dashboard.content.recentDrafts]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .forEach((story) => unique.set(story.storyId, story));
    return [...unique.values()].slice(0, 5);
  }, [dashboard.content.recentDrafts, dashboard.content.recentStories]);
  return <section aria-labelledby="dashboard-content">
    <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Continue working</p>
      <h2 id="dashboard-content">Recent content</h2></div></div>
    <div className={styles.contentColumns}>
      <div className={styles.listCard}><h3>Recent Stories</h3>
        <StoryList items={stories} creatorSlug={dashboard.creator.creatorSlug} /></div>
      <div className={styles.listCard}><h3>Recent Episodes</h3>
        <EpisodeList items={dashboard.content.recentEpisodes.slice(0, 5)} /></div>
    </div>
  </section>;
}

function Attention({ dashboard }: { dashboard: CreatorDashboardResponse }) {
  const items = dashboard.attention.items.slice(0, 10);
  return <section aria-labelledby="dashboard-attention">
    <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Operational status</p>
      <h2 id="dashboard-attention">Needs attention</h2></div>
      {dashboard.attention.truncated && <p>Showing the 10 highest-priority items</p>}</div>
    {!items.length ? <div className={styles.emptyState}><strong>Nothing needs attention</strong>
      <p>Your returned content state has no current action items.</p></div>
      : <ul className={styles.attentionList}>{items.map((item, index) =>
        <li key={`${item.targetType}-${item.targetId ?? "profile"}-${item.reasonCode}-${index}`}>
          <div><Badge tone={item.severity === "CRITICAL" ? "critical" : item.severity === "WARNING" ? "warning" : "neutral"}>
            {item.severity}</Badge><h3>{item.title}</h3><p>{reasonLabels[item.reasonCode]}</p></div>
          <Link href={attentionHref(item)}>Resolve</Link>
        </li>
      )}</ul>}
  </section>;
}

function QuickActions({ dashboard }: { dashboard: CreatorDashboardResponse }) {
  const actions: { href: string; label: string }[] = [];
  if (dashboard.capabilities.canCreateStory) actions.push({ href: creatorStoriesHref, label: "Create Story" });
  if (dashboard.capabilities.canManageProfile) actions.push({ href: creatorProfileHref, label: "Edit Profile" });
  if (dashboard.capabilities.canViewPublicProfile && dashboard.creator.creatorSlug) {
    actions.push({
      href: `/search?creatorSlug=${encodeURIComponent(dashboard.creator.creatorSlug)}`,
      label: "View public work",
    });
  }
  return <section aria-labelledby="dashboard-actions">
    <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Available now</p>
      <h2 id="dashboard-actions">Quick actions</h2></div></div>
    {actions.length ? <ul className={styles.quickActions}>{actions.map((action) =>
      <li key={action.label}><Link href={action.href}>{action.label}</Link></li>
    )}</ul> : <p className={styles.emptyState}>No creator actions are currently available.</p>}
  </section>;
}

function DashboardView({ dashboard, error, retry, logout }: {
  dashboard: CreatorDashboardResponse;
  error: ApiError | Error | null;
  retry: () => void;
  logout: () => void;
}) {
  const profileStatus = dashboard.creator.profileVisibility === "HIDDEN"
    ? "Hidden profile"
    : dashboard.creator.eligibility === "ELIGIBLE" ? "Eligible creator" : "Profile incomplete";
  return <main className={styles.page}>
    {error && <SectionError error={error} retry={retry} />}
    <header className={styles.headerCard}>
      <div><p className={styles.eyebrow}>Creator Dashboard</p><h1>{dashboard.creator.displayName}</h1>
        <div className={styles.badgeRow}>
          <Badge tone={dashboard.creator.eligibility === "ELIGIBLE" ? "positive" : "warning"}>{profileStatus}</Badge>
          <span>{formatNumber(dashboard.creator.followerCount)} followers</span>
        </div>
      </div>
      <div className={styles.headerActions}>
        {dashboard.capabilities.canViewPublicProfile && dashboard.creator.creatorSlug &&
          <Link href={`/search?creatorSlug=${encodeURIComponent(dashboard.creator.creatorSlug)}`}>Public profile</Link>}
        <button type="button" className={styles.secondaryButton} onClick={retry}>Refresh</button>
        <button type="button" className={styles.secondaryButton} onClick={logout}>Log out</button>
      </div>
    </header>
    <Overview dashboard={dashboard} />
    <Performance dashboard={dashboard} />
    <RecentContent dashboard={dashboard} />
    <Attention dashboard={dashboard} />
    <QuickActions dashboard={dashboard} />
    <p className={styles.generated} aria-live="polite">Last confirmed {formatDate(dashboard.generatedAt)}</p>
  </main>;
}

export function CreatorDashboard() {
  const router = useRouter();
  const confirmed = useRef<CreatorDashboardResponse | null>(null);
  const requestSequence = useRef(0);
  const [dashboard, setDashboard] = useState<CreatorDashboardResponse | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(() => {
    const sequence = ++requestSequence.current;
    getCreatorDashboard().then((response) => {
      if (sequence !== requestSequence.current) return;
      confirmed.current = response;
      setDashboard(response);
    }).catch((reason: unknown) => {
      if (sequence !== requestSequence.current) return;
      const nextError = reason instanceof Error ? reason : new Error("Dashboard request failed.");
      if (nextError instanceof ApiError && nextError.status === 401) {
        confirmed.current = null;
        setDashboard(null);
        clearSession();
        router.replace("/login?next=%2Fcreator%2Fdashboard");
        return;
      }
      setDashboard(confirmed.current);
      setError(nextError);
    });
  }, [router]);

  useEffect(() => {
    load();
  }, [attempt, load, sessionEpoch]);

  useEffect(() => subscribeToSessionChanges(() => {
    ++requestSequence.current;
    confirmed.current = null;
    setDashboard(null);
    setError(null);
    setSessionEpoch((value) => value + 1);
  }), []);

  if (!dashboard && !error) return <DashboardSkeleton />;
  if (!dashboard && error) return <main className={styles.page}><header className={styles.pageIntro}>
    <p className={styles.eyebrow}>Creator workspace</p><h1>Creator Dashboard</h1></header>
    <SectionError error={error} retry={() => { setError(null); setAttempt((value) => value + 1); }} /></main>;
  return <DashboardView dashboard={dashboard!} error={error}
    retry={() => { setError(null); setAttempt((value) => value + 1); }}
    logout={() => {
      ++requestSequence.current;
      confirmed.current = null;
      setDashboard(null);
      setError(null);
      clearSession();
      router.replace("/login");
    }} />;
}
