"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  addBookmark, ApiError, apiErrorMessage, getFollowState, getLikeState, getPublicStory, hasSession,
  listLibrary, likeStory, unlikeStory, followCreator, unfollowCreator, listPublicEpisodes,
  removeBookmark, subscribeToSessionChanges,
} from "@/features/novel-editor/api";
import type { PublicEpisode, PublicStory } from "@/features/novel-editor/types";
import { resolvePublicEpisodeHref } from "./routes";
import styles from "./publicDiscovery.module.css";
import { ReportDialog } from "@/features/moderation/ReportDialog";
import { EngagementSessionController } from "@/features/engagement/controller";
import { DiscussionPanel } from "@/features/community/DiscussionPanel";

export function StoryDetail({ creatorSlug, storySlug }: { creatorSlug: string; storySlug: string }) {
  const [story, setStory] = useState<PublicStory | null>(null);
  const [episodes, setEpisodes] = useState<PublicEpisode[]>([]);
  const [episodePage, setEpisodePage] = useState(1);
  const [episodeTotal, setEpisodeTotal] = useState(0);
  const [hasMoreEpisodes, setHasMoreEpisodes] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [bookmarkError, setBookmarkError] = useState("");
  const [liked, setLiked] = useState(false);
  const [following, setFollowing] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [followAvailable, setFollowAvailable] = useState(true);
  const [socialBusy, setSocialBusy] = useState(false);
  const [socialMessage, setSocialMessage] = useState("");
  useEffect(() => {
    const synchronize = () => {
      const activeSession = hasSession();
      setAuthenticated(activeSession);
      if (!activeSession) {
        setLiked(false);
        setFollowing(false);
        setFollowAvailable(true);
      }
    };
    synchronize();
    return subscribeToSessionChanges(synchronize);
  }, []);
  useEffect(() => {
    let active = true;
    Promise.all([
        getPublicStory(creatorSlug, storySlug),
        listPublicEpisodes(creatorSlug, storySlug, 1, 20),
      ]).then(([storyResult, episodeResult]) => {
      if (!active) return;
      setStory(storyResult);
      setEpisodes(episodeResult.items);
      setEpisodePage(episodeResult.page);
      setEpisodeTotal(episodeResult.totalItems);
      setHasMoreEpisodes(episodeResult.hasNextPage);
    }).catch((reason) => {
      if (!active) return;
      setError(apiErrorMessage(reason));
    }).finally(() => {
      if (!active) return;
      setLoading(false);
    });
    return () => { active = false; };
  }, [creatorSlug, retryKey, storySlug]);

  async function loadMoreEpisodes() {
    if (loadingMore || !hasMoreEpisodes) return;
    setLoadingMore(true);
    setMoreError("");
    try {
      const result = await listPublicEpisodes(creatorSlug, storySlug, episodePage + 1, 20);
      setEpisodes((current) => {
        const existing = new Set(current.map((episode) => episode.id));
        return [...current, ...result.items.filter((episode) => !existing.has(episode.id))];
      });
      setEpisodePage(result.page);
      setEpisodeTotal(result.totalItems);
      setHasMoreEpisodes(result.hasNextPage);
    } catch (reason) {
      setMoreError(apiErrorMessage(reason));
    } finally {
      setLoadingMore(false);
    }
  }
  useEffect(() => {
    if (!story || !authenticated) return;
    listLibrary(1, 100).then((result) => {
      setBookmarked(result.items.some((item) => item.storyId === story.id));
    }).catch(() => undefined);
  }, [authenticated, story]);
  useEffect(() => {
    if (!story) return;
    if (!authenticated) return;
    let active = true;
    void getLikeState(story.id)
      .then((state) => { if (active) setLiked(state.isActive); })
      .catch((reason) => {
        if (!active || !(reason instanceof ApiError)) return;
        if (reason.status === 401) {
          setAuthenticated(false);
          setLiked(false);
          setFollowing(false);
        } else if (reason.status === 404) {
          setError(apiErrorMessage(reason));
        }
      });
    void getFollowState(story.creatorSlug)
      .then((state) => {
        if (!active) return;
        setFollowing(state.isActive);
        setFollowAvailable(true);
      })
      .catch((reason) => {
        if (!active || !(reason instanceof ApiError)) return;
        if (reason.status === 401) {
          setAuthenticated(false);
          setLiked(false);
          setFollowing(false);
        } else if (reason.status === 404) {
          setFollowing(false);
          setFollowAvailable(false);
        }
      });
    return () => { active = false; };
  }, [authenticated, story]);
  useEffect(() => {
    if (!story) return;
    const controller = new EngagementSessionController({ targetType: "STORY", targetId: story.id });
    void controller.start();
    return () => { void controller.stop(); };
  }, [story]);

  async function toggleBookmark() {
    if (!story) return;
    setBookmarkBusy(true);
    setBookmarkError("");
    try {
      if (bookmarked) await removeBookmark(story.id);
      else await addBookmark(story.id);
      setBookmarked((value) => !value);
    } catch (reason) {
      setBookmarkError(apiErrorMessage(reason));
    } finally {
      setBookmarkBusy(false);
    }
  }
  async function toggleLike() {
    if (!story) return;
    if (!authenticated) { window.location.href = `/login?next=${encodeURIComponent(`/stories/${creatorSlug}/${storySlug}`)}`; return; }
    setSocialBusy(true);
    setSocialMessage("");
    try {
      const result = liked ? await unlikeStory(story.id) : await likeStory(story.id);
      setLiked(result.isActive);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        setAuthenticated(false);
        setLiked(false);
        setFollowing(false);
        setSocialMessage("กรุณาเข้าสู่ระบบเพื่อกดถูกใจ");
      } else if (reason instanceof ApiError && reason.status === 404) {
        setError(apiErrorMessage(reason));
      } else if (reason instanceof ApiError && reason.status === 409) {
        try { setLiked((await getLikeState(story.id)).isActive); } catch { /* retain last server-confirmed state */ }
      } else {
        setSocialMessage(apiErrorMessage(reason));
      }
    } finally {
      setSocialBusy(false);
    }
  }
  async function toggleFollow() {
    if (!authenticated) { window.location.href = `/login?next=${encodeURIComponent(`/stories/${creatorSlug}/${storySlug}`)}`; return; }
    const currentStory = story;
    if (!currentStory) return;
    setSocialBusy(true);
    setSocialMessage("");
    try {
      const result = following ? await unfollowCreator(currentStory.creatorSlug) : await followCreator(currentStory.creatorSlug);
      setFollowing(result.isActive);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 400) {
        setFollowing(false);
        setFollowAvailable(false);
        setSocialMessage("ไม่สามารถติดตามโปรไฟล์ผู้สร้างนี้ได้");
      } else if (reason instanceof ApiError && reason.status === 401) {
        setAuthenticated(false);
        setLiked(false);
        setFollowing(false);
        setSocialMessage("กรุณาเข้าสู่ระบบเพื่อติดตามผู้สร้าง");
      } else if (reason instanceof ApiError && reason.status === 404) {
        setFollowing(false);
        setFollowAvailable(false);
      } else if (reason instanceof ApiError && reason.status === 409) {
        try { setFollowing((await getFollowState(currentStory.creatorSlug)).isActive); } catch { /* retain last server-confirmed state */ }
      } else {
        setSocialMessage(apiErrorMessage(reason));
      }
    } finally {
      setSocialBusy(false);
    }
  }

  if (loading) return <main className="container"><p role="status">กำลังโหลดรายละเอียดเรื่อง…</p></main>;
  if (error || !story) return <main className="container"><div role="alert" className={styles.state}>
    <p>{error || "ไม่พบเรื่องนี้"}</p>
    <button type="button" onClick={() => { setLoading(true); setError(""); setRetryKey((value) => value + 1); }}>ลองอีกครั้ง</button>
  </div></main>;

  return (
    <main className="container">
      <Link href="/">← กลับหน้าแรก</Link>
      <section className={styles.detailHero}>
        {story.coverUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={story.coverUrl} alt={`ปก ${story.title}`} />
          : <div className={styles.detailPlaceholder} aria-label="ไม่มีภาพปก">◇</div>}
        <div>
          <span className="eyebrow">{story.storyType}</span>
          <h1>{story.title}</h1>
          <p>โดย {story.creatorDisplayName}</p>
          <p>{story.synopsis || "ยังไม่มีเรื่องย่อ"}</p>
          <p>ระดับเนื้อหา: {story.contentRating} · เผยแพร่ {new Date(story.publishedAt).toLocaleDateString("th-TH")}</p>
          <div className="tagRow">
            <button type="button" disabled={socialBusy} aria-pressed={liked} onClick={() => void toggleLike()}>{liked ? "Unlike" : "Like"}</button>
            {followAvailable && <button type="button" disabled={socialBusy} aria-pressed={following} onClick={() => void toggleFollow()}>{following ? "Following" : "Follow"}</button>}
          </div>
          {socialMessage && <p role="status">{socialMessage}</p>}
          {authenticated
            ? <button type="button" disabled={bookmarkBusy} onClick={() => void toggleBookmark()}>
              {bookmarkBusy ? "กำลังบันทึก…" : bookmarked ? "นำออกจากคลัง" : "บันทึกเข้าคลัง"}
            </button>
            : <Link className="primaryButton" href={`/login?next=${encodeURIComponent(`/stories/${creatorSlug}/${storySlug}`)}`}>
              บันทึกเข้าคลัง
            </Link>}
          {bookmarkError && <p role="alert">{bookmarkError}</p>}
          <ReportDialog targetType="STORY" targetId={story.id} targetSummary={story.title} />
          <div className="tagRow">
            {story.categories.map((category) => <span className="tag" key={category.id}>{category.name}</span>)}
            {story.tags.map((tag) => <span className="tag" key={tag.id}>#{tag.name}</span>)}
          </div>
        </div>
      </section>
      <section className={styles.episodes}>
        <h2>ตอนที่เผยแพร่</h2>
        <p role="status">แสดง {episodes.length} จาก {episodeTotal} ตอน</p>
        {!episodes.length && <p>เรื่องนี้ยังไม่มีตอนที่เผยแพร่</p>}
        {episodes.map((episode) => {
          const href = resolvePublicEpisodeHref(story.storyType, creatorSlug, storySlug, episode.slug);
          return <article key={episode.id}>
            <div><strong>{episode.episodeNumber}. {episode.title}</strong>
              {episode.synopsis && <p>{episode.synopsis}</p>}</div>
            {href ? <Link className="primaryButton" href={href}>เปิดอ่าน</Link> : <span role="alert">ไม่รองรับประเภทเรื่องนี้</span>}
          </article>;
        })}
        {moreError && <div role="alert"><p>{moreError}</p>
          <button type="button" onClick={() => void loadMoreEpisodes()}>ลองโหลดตอนเพิ่มเติมอีกครั้ง</button></div>}
        {hasMoreEpisodes && !moreError && <button type="button" disabled={loadingMore}
          onClick={() => void loadMoreEpisodes()}>
          {loadingMore ? "กำลังโหลดตอนเพิ่มเติม…" : "โหลดตอนเพิ่มเติม"}
        </button>}
      </section>
      <DiscussionPanel target={{ kind: "STORY", creatorSlug, storySlug }} />
    </main>
  );
}
