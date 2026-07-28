"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hasSession, listReadingProgress } from "@/features/novel-editor/api";
import type { ReadingProgress } from "@/features/novel-editor/types";
import { resolvePublicEpisodeHref } from "@/features/public-discovery/routes";

export function ContinueReading() {
  const [items, setItems] = useState<ReadingProgress[]>([]);
  useEffect(() => {
    if (!hasSession()) return;
    let active = true;
    listReadingProgress(1, 3).then((result) => {
      if (active) setItems(result.items);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  if (!items.length) return null;
  return <section aria-label="อ่านต่อ">
    <h2>อ่านต่อ</h2>
    {items.map((item) => {
      const href = resolvePublicEpisodeHref(item.storyType, item.creatorSlug, item.storySlug, item.episodeSlug);
      return href && <article key={item.storyId}>
        <strong>{item.storyTitle}</strong> — {item.episodeTitle} <Link href={href}>อ่านต่อ</Link>
      </article>;
    })}
  </section>;
}
