"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { resolvePublicEpisodeHref, resolvePublicStoryHref } from "@/features/public-discovery/routes";
import type { CreatorEpisodeNavigationResponse } from "./types";

type Props = {
  navigation: CreatorEpisodeNavigationResponse | null;
  navigationState: "loading" | "ready" | "transient";
  retryNavigation: () => void;
  children: React.ReactNode;
  report?: React.ReactNode;
};

function ignoresReaderShortcut(event: KeyboardEvent) {
  if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return true;
  const target = event.target instanceof Element ? event.target : null;
  return Boolean(target?.closest(
    "input, textarea, select, button, a, [contenteditable='true'], [role='dialog'], dialog, iframe, [data-reader-shortcuts='off']",
  ));
}

export function ReaderNavigationShell({ navigation, navigationState, retryNavigation, children, report }: Props) {
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  const previousHref = useMemo(() => navigation?.previousEpisode
    ? resolvePublicEpisodeHref(navigation.story.storyType, navigation.story.creatorSlug,
      navigation.story.slug, navigation.previousEpisode.slug)
    : null, [navigation]);
  const nextHref = useMemo(() => navigation?.nextEpisode
    ? resolvePublicEpisodeHref(navigation.story.storyType, navigation.story.creatorSlug,
      navigation.story.slug, navigation.nextEpisode.slug)
    : null, [navigation]);

  useEffect(() => {
    if (navigationState === "ready") heading.current?.focus();
  }, [navigation?.currentEpisode.id, navigationState]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (ignoresReaderShortcut(event)) return;
      const href = event.key === "ArrowLeft" ? previousHref : event.key === "ArrowRight" ? nextHref : null;
      if (!href) return;
      event.preventDefault();
      router.push(href);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nextHref, previousHref, router]);

  const controls = navigationState === "ready" && navigation ? <nav aria-label="Episode navigation">
    {previousHref
      ? <Link href={previousHref}>← Previous: {navigation.previousEpisode?.title}</Link>
      : <span>First episode — Previous unavailable</span>}
    {nextHref
      ? <Link href={nextHref}>Next: {navigation.nextEpisode?.title} →</Link>
      : <span>Last episode — Next unavailable</span>}
    {!previousHref && !nextHref && <p>
      {navigation.currentEpisode.visibility === "UNLISTED"
        ? "This unlisted episode is available by direct link only."
        : "This is the only available episode."}
    </p>}
  </nav> : navigationState === "transient" ? <div role="status">
    <p>Episode navigation is temporarily unavailable. The current episode remains readable.</p>
    <button type="button" onClick={retryNavigation}>Retry navigation</button>
  </div> : <p role="status">Loading episode navigation…</p>;

  return <main className="reader">
    {navigation && <header>
      <Link href={resolvePublicStoryHref(navigation.story.creatorSlug, navigation.story.slug)}>← Back to Story</Link>
      <p>{navigation.story.title}</p>
      <h1 ref={heading} tabIndex={-1}>{navigation.currentEpisode.title}</h1>
      <p aria-live="polite" style={{ position: "absolute", width: 1, height: 1, padding: 0,
        margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}>
        Now reading {navigation.currentEpisode.title}
      </p>
      {controls}
    </header>}
    {!navigation && controls}
    {children}
    {navigation && controls}
    {report}
  </main>;
}
