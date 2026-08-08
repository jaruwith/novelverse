"use client";

import Link from "next/link";
import { useNotifications } from "./NotificationsProvider";
import styles from "./notifications.module.css";

export function NotificationBell({ mobile = false }: { mobile?: boolean }) {
  const { state } = useNotifications();
  if (!state.authenticated || state.eligible === false) return null;
  const count = state.unreadCount ?? 0;
  const label = count === 0
    ? "การแจ้งเตือน ไม่มีรายการที่ยังไม่ได้อ่าน"
    : `การแจ้งเตือน ยังไม่ได้อ่าน ${count.toLocaleString("th-TH")} รายการ`;
  return <Link href="/notifications" className={mobile ? styles.mobileBell : styles.bell} aria-label={label}>
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
    {count > 0 && <span className={styles.badge} aria-hidden="true">{count > 99 ? "99+" : count}</span>}
    {mobile && <span>ศูนย์การแจ้งเตือน</span>}
  </Link>;
}
