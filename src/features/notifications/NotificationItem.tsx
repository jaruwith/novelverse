"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import type { NotificationsController } from "./controller";
import type { NotificationItem as Item } from "./types";
import styles from "./notifications.module.css";

function actor(item: Item) {
  return item.actor?.displayName ?? "สมาชิกที่ไม่เปิดเผยชื่อ";
}

export function notificationMessage(item: Item) {
  switch (item.type) {
    case "COMMENT_REPLY_CREATED": return `${actor(item)} ตอบกลับความคิดเห็นของคุณ`;
    case "COMMENT_LIKE_CREATED": return `${actor(item)} ถูกใจความคิดเห็นของคุณ`;
    case "CREATOR_CONTENT_COMMENT_CREATED": return `${actor(item)} แสดงความคิดเห็นใหม่ในผลงานของคุณ`;
    case "CREATOR_FOLLOW_CREATED": return `${actor(item)} เริ่มติดตามคุณ`;
    case "MODERATION_REPORT_RESOLVED": return item.outcome === "ACTION_TAKEN"
      ? "รายงานของคุณได้รับการตรวจสอบและมีการดำเนินการแล้ว" : "รายงานของคุณได้รับการตรวจสอบแล้ว";
    case "MODERATION_VISIBILITY_CHANGED": return item.outcome === "HIDDEN"
      ? "ผู้ดูแลซ่อนเนื้อหาหรือบัญชีที่เกี่ยวข้องกับคุณ"
      : "ผู้ดูแลคืนการแสดงผลเนื้อหาหรือบัญชีที่เกี่ยวข้องกับคุณ";
  }
}

export function NotificationItem({ item, controller, onRemoved }: {
  item: Item;
  controller: NotificationsController;
  onRemoved?: () => void;
}) {
  const router = useRouter();
  const unread = item.readAt === null;
  const snapshot = controller.getSnapshot();
  const pending = snapshot.markPendingIds.includes(item.id);
  const mutationError = snapshot.markErrors[item.id];
  const route = item.target.route;
  async function mark() {
    const succeeded = await controller.markRead(item.id);
    if (succeeded) onRemoved?.();
  }
  async function follow(event: MouseEvent<HTMLAnchorElement>) {
    if (!unread) return;
    event.preventDefault();
    await mark();
    router.push(route!.href);
  }
  return <li className={`${styles.item} ${unread ? styles.unread : ""}`} data-notification-id={item.id}>
    <article aria-labelledby={`notification-${item.id}`}>
      <div className={styles.itemBody}>
        <div>
          <p id={`notification-${item.id}`} className={styles.message}>{notificationMessage(item)}</p>
          {item.target.title && <p className={styles.targetTitle}>{item.target.title}</p>}
          {!item.target.available && item.type !== "CREATOR_FOLLOW_CREATED" &&
            <p className={styles.unavailable} role="status">ปลายทางนี้ไม่พร้อมให้บริการแล้ว</p>}
          <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("th-TH", {
            dateStyle: "medium", timeStyle: "short",
          })}</time>
        </div>
        <span className={styles.readState}>{unread ? "ยังไม่ได้อ่าน" : "อ่านแล้ว"}</span>
      </div>
      <div className={styles.itemActions}>
        {route && <Link className="secondaryButton" href={route.href} onClick={follow}>
          เปิดปลายทาง<span className="sr-only">ของการแจ้งเตือน {notificationMessage(item)}</span>
        </Link>}
        {unread && !route && <button type="button" disabled={pending} onClick={() => void mark()}
          aria-label={`ทำเครื่องหมายว่าอ่านแล้ว: ${notificationMessage(item)}`}>
          {pending ? "กำลังบันทึก…" : "ทำเครื่องหมายว่าอ่านแล้ว"}
        </button>}
      </div>
      {mutationError && <p className={styles.inlineError} role="alert">{mutationError.message}</p>}
    </article>
  </li>;
}
