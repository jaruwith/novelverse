"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, apiErrorMessage, getCurrentUser } from "./api";
import type { CurrentUser } from "./types";
import styles from "./studioPages.module.css";

export function CreatorAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    getCurrentUser().then((current) => {
      if (!active) return;
      setUser(current);
    }).catch((reason: unknown) => {
      if (!active) return;
      if (reason instanceof ApiError && reason.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      setError(apiErrorMessage(reason));
    });
    return () => { active = false; };
  }, [attempt, pathname, router]);

  if (error) return <main className={styles.page}><div className={styles.alert} role="alert">{error}</div>
    <button type="button" onClick={() => { setError(""); setAttempt((value) => value + 1); }}>ลองอีกครั้ง</button></main>;
  if (!user) return <main className={styles.page}><p aria-live="polite">กำลังตรวจสอบบัญชี…</p></main>;
  if (user.status !== "ACTIVE") return <main className={styles.page}><div className={styles.alert} role="alert">
    บัญชีต้องมีสถานะ ACTIVE ก่อนใช้งาน Creator Studio
  </div></main>;
  if (!user.creatorSlug) return <main className={styles.page}><div className={styles.alert} role="alert">
    กรุณาตั้งค่าโปรไฟล์ผู้สร้างและ Creator slug ก่อนใช้งาน Creator Studio
  </div><a href="/dashboard/profile">ไปที่โปรไฟล์เดิม</a></main>;
  return children;
}
