"use client";
import Link from "next/link";
import { useState } from "react";
import { useRole } from "./RoleProvider";
import styles from "./ui.module.css";

export function GlobalSearch() {
  const [open,setOpen]=useState(false); const [query,setQuery]=useState("");
  return <div className={styles.searchWrap}><form className={styles.search} action="/search"><input name="q" value={query} onChange={e=>{setQuery(e.target.value);setOpen(true)}} onFocus={()=>setOpen(true)} placeholder="ค้นหาเรื่อง ครีเอเตอร์ หรือแท็ก" aria-label="ค้นหา"/><button>ค้นหา</button></form>{open&&<div className={styles.autocomplete}><div className={styles.autoGroup}><strong>เรื่อง</strong><Link href="/story/library-after-rain">ห้องสมุดหลังสายฝน</Link><Link href="/story/last-tram-home">รถรางเที่ยวสุดท้าย</Link></div><div className={styles.autoGroup}><strong>ครีเอเตอร์</strong><Link href="/creator/praewa-writes">แพรวาเล่าเรื่อง</Link></div><div className={styles.autoGroup}><strong>แท็ก</strong><Link href="/search?q=เวทมนตร์">#เวทมนตร์</Link> <Link href="/search?q=อบอุ่นหัวใจ">#อบอุ่นหัวใจ</Link></div><button className="textButton" onClick={()=>setOpen(false)}>ปิดคำแนะนำ</button></div>}</div>
}
export function MockRoleSwitcher(){const {role,setRole}=useRole();return <div className={styles.role}><span>มุมมอง</span>{(["guest","member","admin"] as const).map(r=><button key={r} className={role===r?styles.active:""} onClick={()=>setRole(r)}>{r==="guest"?"Guest":r==="member"?"Member":"Admin"}</button>)}</div>}
export function DesktopNavigation(){return <nav className={styles.nav}><Link href="/">หน้าแรก</Link><Link href="/categories">หมวดหมู่</Link><Link href="/following">กำลังติดตาม</Link><Link href="/dashboard">สร้างผลงาน</Link></nav>}
export function MobileNavigation({close}:{close:()=>void}){return <div className={styles.drawer}><button className="textButton" onClick={close}>✕ ปิดเมนู</button><Link href="/">หน้าแรก</Link><Link href="/categories">หมวดหมู่</Link><Link href="/search">ค้นหา</Link><Link href="/following">กำลังติดตาม</Link><Link href="/history">ประวัติการอ่าน</Link><Link href="/dashboard">แดชบอร์ดผู้เขียน</Link><Link href="/admin">ผู้ดูแลระบบ</Link></div>}
export function GlobalHeader(){const [drawer,setDrawer]=useState(false);return <header className={styles.header}><div className={styles.headerRow}><Link className={styles.brand} href="/">NovelVerse<small>J007LNWZA</small></Link><DesktopNavigation/><GlobalSearch/><MockRoleSwitcher/><button className={styles.mobileButton} onClick={()=>setDrawer(true)}>☰</button>{drawer&&<MobileNavigation close={()=>setDrawer(false)}/>}</div></header>}
