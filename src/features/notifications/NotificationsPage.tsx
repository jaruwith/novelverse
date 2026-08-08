"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { hasSession } from "@/features/novel-editor/api";
import { NotificationItem } from "./NotificationItem";
import { useNotifications } from "./NotificationsProvider";
import type { NotificationFilter } from "./types";
import styles from "./notifications.module.css";

export function NotificationsPage() {
  const router = useRouter();
  const { controller, state } = useNotifications();
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!hasSession()) {
      router.replace("/login?next=%2Fnotifications");
      return;
    }
    if (!state.authenticated) return;
    return controller.mountPage();
  }, [controller, router, state.authenticated, state.sessionGeneration]);

  useEffect(() => {
    if (!state.authenticated && !hasSession()) router.replace("/login?next=%2Fnotifications");
  }, [router, state.authenticated]);

  function choose(filter: NotificationFilter) { controller.setFilter(filter); }
  function restoreFocus() { queueMicrotask(() => heading.current?.focus()); }

  const initialLoading = state.feedStatus === "loading" && state.items.length === 0;
  const initialError = state.feedStatus === "error" && state.items.length === 0;
  return <div className={`container narrow ${styles.page}`}>
    <header className={styles.pageHeader}>
      <div><span className="eyebrow">พื้นที่ส่วนตัว</span><h1 ref={heading} tabIndex={-1}>การแจ้งเตือน</h1></div>
      <button type="button" disabled={state.markAllPending || state.unreadCount === 0}
        onClick={() => void controller.markAllRead()}>
        {state.markAllPending ? "กำลังอัปเดต…" : "อ่านทั้งหมดแล้ว"}
      </button>
    </header>
    <section aria-labelledby="notification-filters">
      <h2 id="notification-filters" className="sr-only">ตัวกรองการแจ้งเตือน</h2>
      <div className={styles.filters} role="group" aria-label="กรองการแจ้งเตือน">
        {(["ALL", "UNREAD"] as const).map((filter) => <button key={filter} type="button"
          aria-pressed={state.filter === filter} onClick={() => choose(filter)}>
          {filter === "ALL" ? "ทั้งหมด" : "ยังไม่ได้อ่าน"}
        </button>)}
      </div>
    </section>
    <section aria-labelledby="notification-list-heading" aria-busy={initialLoading || state.loadingMore}>
      <h2 id="notification-list-heading" className="sr-only">รายการแจ้งเตือน</h2>
      {initialLoading && <div className={styles.loading} role="status" aria-label="กำลังโหลดการแจ้งเตือน"><span /><span /><span /></div>}
      {initialError && <div className={styles.state} role="alert"><p>{state.feedError?.message}</p>
        <button type="button" onClick={() => void controller.refreshFeed()}>ลองอีกครั้ง</button></div>}
      {!initialLoading && !initialError && state.items.length === 0 && <div className={styles.state}>
        <h3>{state.filter === "UNREAD" ? "อ่านครบแล้ว" : "ยังไม่มีการแจ้งเตือน"}</h3>
        <p>{state.filter === "UNREAD" ? "ไม่มีรายการที่ยังไม่ได้อ่าน" : "เมื่อมีกิจกรรมใหม่ รายการจะแสดงที่นี่"}</p>
      </div>}
      {state.items.length > 0 && <ul className={styles.list}>
        {state.items.map((item) => <NotificationItem key={item.id} item={item} controller={controller}
          onRemoved={state.filter === "UNREAD" ? restoreFocus : undefined} />)}
      </ul>}
      {state.feedError && state.items.length > 0 && <div className={styles.incrementalError} role="alert">
        <p>{state.feedError.message}</p><button type="button" onClick={() => state.nextCursor
          ? void controller.loadMore() : void controller.refreshFeed()}>ลองอีกครั้ง</button>
      </div>}
      {state.nextCursor && <button className={styles.loadMore} type="button" disabled={state.loadingMore}
        onClick={() => void controller.loadMore()}>{state.loadingMore ? "กำลังโหลด…" : "โหลดเพิ่มเติม"}</button>}
    </section>
    {state.markAllError && <p className={styles.inlineError} role="alert">{state.markAllError.message}</p>}
    <p className="sr-only" role="status" aria-live="polite">{state.announcement}</p>
  </div>;
}
