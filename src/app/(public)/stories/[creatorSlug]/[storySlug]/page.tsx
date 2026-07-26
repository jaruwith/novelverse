"use client";

import { use } from "react";
import { StoryDetail } from "@/features/public-discovery/StoryDetail";

export default function PublicStoryDetailPage({ params }: {
  params: Promise<{ creatorSlug: string; storySlug: string }>;
}) {
  const { creatorSlug, storySlug } = use(params);
  return <StoryDetail creatorSlug={creatorSlug} storySlug={storySlug} />;
}
