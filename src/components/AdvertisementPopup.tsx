"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRole, type Role } from "./RoleProvider";
import { isEligibleForNovelAdvertisement, novelReaderAdvertisement, type AdvertisementConfig, type AdvertisementPosition } from "@/lib/mockAdvertisement";
import styles from "./AdvertisementPopup.module.css";

export function AdvertisementPopup({ config }: { config: AdvertisementConfig }) {
  const { role, isAdFreeMember } = useRole();
  const eligible = config.isActive && isEligibleForNovelAdvertisement(role, isAdFreeMember);
  const [isOpen, setIsOpen] = useState(eligible);
  const [secondsLeft, setSecondsLeft] = useState(config.closeDelaySeconds);

  useEffect(() => {
    if (!isOpen || secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [isOpen, secondsLeft]);

  if (!eligible || !isOpen) return null;
  const progress = config.closeDelaySeconds === 0 ? 100 : ((config.closeDelaySeconds - secondsLeft) / config.closeDelaySeconds) * 100;

  return <div className={`${styles.overlay} ${styles[config.position]}`} role="dialog" aria-modal="true" aria-labelledby="advertisement-title">
    <section className={styles.panel} data-ad-position={config.position}>
      <div className={styles.top}><div>{config.sponsorLabel&&<span className={styles.sponsor}>{config.sponsorLabel}</span>}<h2 id="advertisement-title">{config.title}</h2></div><button className={styles.close} disabled={secondsLeft>0} onClick={()=>setIsOpen(false)} aria-label={secondsLeft>0?`ปิดโฆษณาได้ในอีก ${secondsLeft} วินาที`:"ปิดโฆษณา"}>×</button></div>
      <a className={styles.adLink} href={config.targetUrl} target="_blank" rel="noopener noreferrer" aria-label={`เปิดลิงก์โฆษณา: ${config.title}`}>
        <div className={styles.image}><div><div className={styles.imageVisual} style={{backgroundImage:`url(${config.imageUrl})`}} role="img" aria-label="ภาพตัวอย่างพื้นที่โฆษณา"/><strong>คลิกเพื่อเปิดเว็บไซต์ผู้สนับสนุนในแท็บใหม่</strong></div></div>
      </a>
      <div className={styles.countdown}><span>เวลารอก่อนปิดโฆษณา</span><strong>{secondsLeft>0?`${secondsLeft} วินาที`:"ปิดได้แล้ว"}</strong></div>
      <div className={styles.progress} role="progressbar" aria-label="เวลารอก่อนปิดโฆษณา" aria-valuemin={0} aria-valuemax={config.closeDelaySeconds} aria-valuenow={config.closeDelaySeconds-secondsLeft}><span style={{width:`${progress}%`}}/></div>
      <p className={styles.hint}>โฆษณาจำลองสำหรับทบทวน wireframe เท่านั้น</p>
    </section>
  </div>;
}

export function NovelReaderAdvertisement({ routeKey }: { routeKey: string }) {
  const searchParams = useSearchParams();
  const { role, setRole, isAdFreeMember, setIsAdFreeMember } = useRole();
  const queryPosition = searchParams.get("adPosition");
  const initialPosition: AdvertisementPosition = queryPosition === "left" || queryPosition === "right" ? queryPosition : "center";
  const initialAdFree = searchParams.get("adFree") === "true";
  const queryRole = searchParams.get("adRole");
  const reviewRole: Role | null = queryRole === "guest" || queryRole === "admin" ? queryRole : null;
  const [position, setPosition] = useState<AdvertisementPosition>(initialPosition);

  useEffect(() => { if (reviewRole) setRole(reviewRole); setIsAdFreeMember(initialAdFree); }, [initialAdFree, reviewRole, setIsAdFreeMember, setRole]);
  const config = useMemo(() => ({ ...novelReaderAdvertisement, position }), [position]);
  const selectAudience = (nextRole: Role, adFree: boolean) => { setRole(nextRole); setIsAdFreeMember(adFree); };

  return <>
    <AdvertisementPopup key={`${routeKey}:${position}:${role}:${isAdFreeMember}`} config={config}/>
    <aside className={styles.demo} aria-label="Wireframe Ad Demo">
      <div className={styles.demoHead}><h2>Wireframe Ad Demo</h2><small>เครื่องมือทดสอบเท่านั้น · ไม่ใช่ UI สำหรับ production</small></div>
      <div className={styles.controls}>
        <button className={role==="guest"?styles.active:""} onClick={()=>selectAudience("guest",false)}>Guest with ads</button>
        <button className={role==="member"&&!isAdFreeMember?styles.active:""} onClick={()=>selectAudience("member",false)}>Free Member with ads</button>
        <button className={role==="member"&&isAdFreeMember?styles.active:""} onClick={()=>selectAudience("member",true)}>Ad-free Member</button>
        {(["left","center","right"] as const).map(value=><button key={value} className={position===value?styles.active:""} onClick={()=>setPosition(value)}>Position: {value}</button>)}
      </div>
    </aside>
  </>;
}
