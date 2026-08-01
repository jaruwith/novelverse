"use client";

import { use } from "react";
import { StoryDetail } from "@/features/public-discovery/StoryDetail";
import {
  decodeRouteSegmentOnce,
  ROUTE_SEGMENT_UNAVAILABLE_MESSAGE,
} from "@/lib/routeSegments";

export default function PublicStoryDetailPage({ params }: {
  params: Promise<{ creatorSlug: string; storySlug: string }>;
}) {
  const routeParams = use(params);
  const creatorSlug = decodeRouteSegmentOnce(routeParams.creatorSlug);
  const storySlug = decodeRouteSegmentOnce(routeParams.storySlug);
  if (creatorSlug === null || storySlug === null) {
    return <main className="container"><p role="alert">{ROUTE_SEGMENT_UNAVAILABLE_MESSAGE}</p></main>;
  }
  return <StoryDetail creatorSlug={creatorSlug} storySlug={storySlug} />;
}
