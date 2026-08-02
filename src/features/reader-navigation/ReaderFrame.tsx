"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getPublicEpisodeNavigation } from "@/features/novel-editor/api";
import type { StoryType } from "@/features/novel-editor/types";
import { recordEpisodeProgress } from "@/features/reader-state/progress";
import { ROUTE_SEGMENT_UNAVAILABLE_MESSAGE } from "@/lib/routeSegments";
import { ReaderNavigationShell } from "./ReaderNavigationShell";
import type { CreatorEpisodeNavigationResponse } from "./types";

type ReaderSlugs = { creatorSlug: string; storySlug: string; episodeSlug: string };
type ContentState<T> = { status: "loading" } | { status: "ready"; value: T } | { status: "error" };
type NavigationState = { status: "loading" | "transient" | "not-found" }
  | { status: "ready"; value: CreatorEpisodeNavigationResponse };

export function ReaderFrame<T>({ slugs, storyType, loadContent, episodeId, renderContent, renderReport }: {
    slugs: ReaderSlugs;
    storyType: StoryType;
    loadContent: (signal: AbortSignal) => Promise<T>;
    episodeId: (content: T) => string;
    renderContent: (content: T) => React.ReactNode;
    renderReport: (content: T) => React.ReactNode;
  }) {
  const [content, setContent] = useState<ContentState<T>>({ status: "loading" });
  const [navigation, setNavigation] = useState<NavigationState>({ status: "loading" });
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);

  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    loadContent(controller.signal).then((value) => {
      if (!controller.signal.aborted && generation.current === current) setContent({ status: "ready", value });
    }).catch((reason) => {
      if (!controller.signal.aborted && !(reason instanceof DOMException && reason.name === "AbortError"))
        setContent({ status: "error" });
    });
    return () => controller.abort();
  }, [loadContent]);

  useEffect(() => {
    const current = generation.current;
    const controller = new AbortController();
    getPublicEpisodeNavigation(slugs.creatorSlug, slugs.storySlug, slugs.episodeSlug, controller.signal)
      .then((value) => {
        if (controller.signal.aborted || generation.current !== current) return;
        setNavigation(value.story.storyType === storyType ? { status: "ready", value } : { status: "not-found" });
      }).catch((reason) => {
        if (controller.signal.aborted || reason instanceof DOMException && reason.name === "AbortError") return;
        const status = reason instanceof ApiError ? reason.status : 0;
        setNavigation(status === 404 ? { status: "not-found" }
          : status === 0 || status === 429 || status === 504 || status >= 500
            ? { status: "transient" } : { status: "not-found" });
      });
    return () => controller.abort();
  }, [retry, slugs.creatorSlug, slugs.episodeSlug, slugs.storySlug, storyType]);

  const contentId = content.status === "ready" ? episodeId(content.value) : null;
  const mismatch = contentId && navigation.status === "ready"
    && contentId.toLowerCase() !== navigation.value.currentEpisode.id.toLowerCase();
  const matched = content.status === "ready" && navigation.status === "ready" && !mismatch;

  useEffect(() => {
    if (!matched || !contentId || navigation.status !== "ready") return;
    const controller = new AbortController();
    void recordEpisodeProgress(navigation.value.story.id, contentId, controller.signal);
    return () => controller.abort();
  }, [contentId, matched, navigation]);

  const retryNavigation = useCallback(() => {
    setNavigation({ status: "loading" });
    setRetry((value) => value + 1);
  }, []);
  if (content.status === "error" || navigation.status === "not-found" || mismatch)
    return <main className="reader"><p role="alert">{ROUTE_SEGMENT_UNAVAILABLE_MESSAGE}</p></main>;
  if (content.status === "loading") return <main className="reader"><p role="status">Loading episode…</p></main>;

  return <ReaderNavigationShell
    navigation={navigation.status === "ready" ? navigation.value : null}
    navigationState={navigation.status === "ready" ? "ready" : navigation.status}
    retryNavigation={retryNavigation}
    report={renderReport(content.value)}>
    {renderContent(content.value)}
  </ReaderNavigationShell>;
}
