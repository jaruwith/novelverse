"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, hasSession, listReadingProgress, subscribeToSessionChanges } from "@/features/novel-editor/api";
import type { ReadingProgress } from "@/features/novel-editor/types";
import { resolvePublicEpisodeHref } from "@/features/public-discovery/routes";

export function ContinueReading() {
  const [items, setItems] = useState<ReadingProgress[]>([]);
  useEffect(() => {
    let active = true;
    let generation = 0;
    const synchronize = () => {
      const current = ++generation;
      setItems([]);
      if (!hasSession()) return;
      listReadingProgress(1, 3).then((result) => {
        if (active && generation === current) setItems(result.items);
      }).catch((reason) => {
        if (active && generation === current && reason instanceof ApiError && reason.status === 401) setItems([]);
      });
    };
    synchronize();
    const unsubscribe = subscribeToSessionChanges(synchronize);
    return () => { active = false; unsubscribe(); };
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
