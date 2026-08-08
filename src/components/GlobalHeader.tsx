"use client";
import Link from "next/link";
import { useState } from "react";
import { useRole } from "./RoleProvider";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import styles from "./ui.module.css";

export function GlobalSearch() {
  const [query,setQuery]=useState("");
  return <div className={styles.searchWrap}><form className={styles.search} action="/search"><input name="q" value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหาเรื่อง ครีเอเตอร์ หรือแท็ก" aria-label="ค้นหา"/><button>ค้นหา</button></form></div>
}
export function MockRoleSwitcher(){const {role,setRole}=useRole();return <div className={styles.role}><span>มุมมอง</span>{(["guest","member","admin"] as const).map(r=><button key={r} className={role===r?styles.active:""} onClick={()=>setRole(r)}>{r==="guest"?"Guest":r==="member"?"Member":"Admin"}</button>)}</div>}
export function DesktopNavigation(){return <nav className={styles.nav}><Link href="/">หน้าแรก</Link><Link href="/creator/dashboard">พื้นที่ครีเอเตอร์</Link><Link href="/login">เข้าสู่ระบบ</Link></nav>}
export function MobileNavigation({close}:{close:()=>void}){return <div className={styles.drawer}><button className="textButton" onClick={close}>✕ ปิดเมนู</button><NotificationBell mobile/><Link href="/">หน้าแรก</Link><Link href="/creator/dashboard">พื้นที่ครีเอเตอร์</Link><Link href="/login">เข้าสู่ระบบ</Link></div>}
export function GlobalHeader(){const [drawer,setDrawer]=useState(false);return <header className={styles.header}><div className={styles.headerRow}><Link className={styles.brand} href="/">NovelVerse<small>J007LNWZA</small></Link><DesktopNavigation/><GlobalSearch/><NotificationBell/><button className={styles.mobileButton} aria-label="เปิดเมนู" onClick={()=>setDrawer(true)}>☰</button>{drawer&&<MobileNavigation close={()=>setDrawer(false)}/>}</div></header>}
