"use client";
import Link from "next/link";
import {useCallback,useEffect,useMemo,useRef,useState,type KeyboardEvent as ReactKeyboardEvent,type ReactNode} from "react";
import {useSearchParams} from "next/navigation";
import {useRole,type Role} from "./RoleProvider";
import {getActivePremiumPopup,getActiveStandardAdvertisements,isEligibleForReaderAdvertisements,type PremiumPopupAdvertisement,type StandardAdvertisement} from "@/lib/mockAdvertisement";
import styles from "./ReaderAdvertisements.module.css";

const scrollKeys=new Set(["PageDown","PageUp"," ","Spacebar","Home","End","ArrowDown","ArrowUp","ArrowLeft","ArrowRight"]);
const focusableSelector='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function PremiumAdvertisementPopup({advertisement,onDismiss}:{advertisement:PremiumPopupAdvertisement;onDismiss:()=>void}){
  const[open,setOpen]=useState(true);
  const[seconds,setSeconds]=useState(advertisement.closeDelaySeconds);
  const dialogRef=useRef<HTMLElement>(null);
  const closableRef=useRef(false);
  const dismissedRef=useRef(false);
  useEffect(()=>{closableRef.current=seconds<=0},[seconds]);

  useEffect(()=>{
    if(!open||seconds<=0)return;
    const timer=window.setTimeout(()=>setSeconds((value)=>Math.max(0,value-1)),1000);
    return()=>window.clearTimeout(timer);
  },[open,seconds]);

  useEffect(()=>{
    if(!open)return;
    const html=document.documentElement;
    const body=document.body;
    const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const htmlOverflow=html.style.overflow;
    const bodyOverflow=body.style.overflow;
    const bodyPosition=body.style.position;
    const bodyInset=body.style.inset;
    const bodyWidth=body.style.width;
    const bodyTouchAction=body.style.touchAction;
    const bodyPaddingRight=body.style.paddingRight;
    const scrollbarWidth=window.innerWidth-html.clientWidth;

    window.scrollTo(0,0);
    html.style.overflow="hidden";
    if(scrollbarWidth>0)body.style.paddingRight=`${scrollbarWidth}px`;
    body.style.overflow="hidden";
    body.style.position="fixed";
    body.style.inset="0";
    body.style.width="100%";
    body.style.touchAction="none";

    const preventScroll=(event:Event)=>event.preventDefault();
    const handleKeyDown=(event:KeyboardEvent)=>{
      if(scrollKeys.has(event.key)){event.preventDefault();return;}
      if(event.key==="Escape"){
        event.preventDefault();
        if(closableRef.current){dismissedRef.current=true;setOpen(false);}
        return;
      }
      if(event.key!=="Tab")return;
      const dialog=dialogRef.current;
      if(!dialog)return;
      const focusable=Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter((element)=>!element.hasAttribute("disabled"));
      if(focusable.length===0){event.preventDefault();dialog.focus();return;}
      const first=focusable[0];
      const last=focusable[focusable.length-1];
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog)){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    const keepFocusInside=(event:FocusEvent)=>{if(dialogRef.current&&!dialogRef.current.contains(event.target as Node))dialogRef.current.focus();};

    window.addEventListener("wheel",preventScroll,{passive:false});
    window.addEventListener("touchmove",preventScroll,{passive:false});
    document.addEventListener("keydown",handleKeyDown,true);
    document.addEventListener("focusin",keepFocusInside,true);
    dialogRef.current?.focus();

    return()=>{
      window.removeEventListener("wheel",preventScroll);
      window.removeEventListener("touchmove",preventScroll);
      document.removeEventListener("keydown",handleKeyDown,true);
      document.removeEventListener("focusin",keepFocusInside,true);
      html.style.overflow=htmlOverflow;
      body.style.overflow=bodyOverflow;
      body.style.position=bodyPosition;
      body.style.inset=bodyInset;
      body.style.width=bodyWidth;
      body.style.touchAction=bodyTouchAction;
      body.style.paddingRight=bodyPaddingRight;
      window.scrollTo(0,0);
      if(!dismissedRef.current&&previousFocus?.isConnected)previousFocus.focus();
    };
  },[open]);

  useEffect(()=>{if(!open)onDismiss()},[onDismiss,open]);
  const close=()=>{if(seconds>0)return;dismissedRef.current=true;setOpen(false);};
  const trapReactTab=(event:ReactKeyboardEvent)=>{if(event.key==="Tab")event.stopPropagation();};
  if(!open)return null;
  const progress=((advertisement.closeDelaySeconds-seconds)/advertisement.closeDelaySeconds)*100;
  return <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="premium-ad-title"><section ref={dialogRef} className={styles.popup} data-premium-popup="true" tabIndex={-1} onKeyDown={trapReactTab}><div className={styles.popupTop}><div><span className={styles.sponsor}>ผู้สนับสนุน · {advertisement.advertiserName}</span><h2 id="premium-ad-title">{advertisement.title}</h2></div><button className={styles.close} disabled={seconds>0} onClick={close} aria-label={seconds>0?`ปิดโฆษณาพรีเมียมได้ในอีก ${seconds} วินาที`:"ปิดโฆษณาพรีเมียม"}>×</button></div><a className={styles.premiumLink} href={advertisement.targetUrl} target="_blank" rel="noopener noreferrer" aria-label={`เปิดลิงก์โฆษณาพรีเมียม: ${advertisement.title}`}><div className={styles.premiumImage}><div><div className={styles.imageVisual} style={{backgroundImage:`url(${advertisement.imageUrl})`}} role="img" aria-label="ภาพตัวอย่างโฆษณาพรีเมียม"/><strong>คลิกเพื่อเปิดเว็บไซต์ผู้สนับสนุนในแท็บใหม่</strong></div></div></a><div className={styles.countdown}><span>เวลารอก่อนปิดโฆษณา</span><strong>{seconds>0?`${seconds} วินาที`:"ปิดได้แล้ว"}</strong></div><div className={styles.progress} role="progressbar" aria-label="เวลารอก่อนปิดโฆษณาพรีเมียม" aria-valuemin={0} aria-valuemax={advertisement.closeDelaySeconds} aria-valuenow={advertisement.closeDelaySeconds-seconds}><span style={{width:`${progress}%`}}/></div><p className={styles.hint}>Premium Popup เป็นตำแหน่งแยกจากโฆษณามาตรฐาน · wireframe เท่านั้น</p></section></div>
}

export function StandardAdvertisementStack({advertisements}:{advertisements:StandardAdvertisement[]}){return <section className={styles.stack} aria-label={`โฆษณามาตรฐาน ${advertisements.length} รายการ`} data-standard-ad-count={advertisements.length}>{advertisements.map((ad)=><a className={styles.standardCard} key={ad.id} href={ad.targetUrl} target="_blank" rel="noopener noreferrer" data-standard-ad-id={ad.id}><div className={styles.standardImage}><div className={styles.imageVisual} style={{backgroundImage:`url(${ad.imageUrl})`}} role="img" aria-label={`ภาพโฆษณาของ ${ad.advertiserName}`}/></div><div className={styles.standardBody}><span className={styles.adLabel}>โฆษณา</span>{ad.title&&<h3>{ad.title}</h3>}<span className={styles.advertiser}>{ad.advertiserName}</span>{ad.description&&<p className={styles.description}>{ad.description}</p>}<span className={styles.order}>ลำดับ {ad.sortOrder} · {ad.id} · เปิดในแท็บใหม่</span></div></a>)}</section>}

export function ReaderAdvertisementExperience({routeKey,header,children}:{routeKey:string;header:ReactNode;children:ReactNode}){
  const query=useSearchParams();
  const{role,setRole,isAdFreeMember,setIsAdFreeMember}=useRole();
  const adSectionRef=useRef<HTMLElement>(null);
  const initialAdFree=query.get("adFree")==="true";
  const queryRole=query.get("adRole");
  const reviewRole:Role|null=queryRole==="guest"||queryRole==="admin"?queryRole:null;
  const[count,setCount]=useState<3|10>(query.get("adCount")==="3"?3:10);
  const[premium,setPremium]=useState(query.get("premium")!=="false");
  useEffect(()=>{if(reviewRole)setRole(reviewRole);setIsAdFreeMember(initialAdFree)},[initialAdFree,reviewRole,setIsAdFreeMember,setRole]);
  const eligible=isEligibleForReaderAdvertisements(role,isAdFreeMember);
  const standardAds=useMemo(()=>getActiveStandardAdvertisements(count),[count]);
  const premiumAd=premium?getActivePremiumPopup():null;
  const audience=(nextRole:Role,adFree:boolean)=>{setRole(nextRole);setIsAdFreeMember(adFree)};
  const moveToAdvertisementStack=useCallback(()=>{requestAnimationFrame(()=>{const section=adSectionRef.current;if(!section)return;const html=document.documentElement;const previousBehavior=html.style.scrollBehavior;html.style.scrollBehavior="auto";window.scrollTo(0,window.scrollY+section.getBoundingClientRect().top);html.style.scrollBehavior=previousBehavior;section.focus({preventScroll:true})})},[]);
  return <>{eligible&&premiumAd&&<PremiumAdvertisementPopup key={`${routeKey}:${role}:${isAdFreeMember}:${premium}`} advertisement={premiumAd} onDismiss={moveToAdvertisementStack}/>} {header}{eligible&&<section ref={adSectionRef} className={styles.adSection} tabIndex={-1} data-reader-ad-section="true"><div className={styles.upsell}><div><h2>โฆษณาจากผู้สนับสนุน</h2><p>สมัครสมาชิกแบบไม่มีโฆษณา เพื่ออ่านเนื้อหาได้ทันที</p></div><Link className="primaryButton" href="/dashboard/settings">สมัครแบบไม่มีโฆษณา</Link></div><StandardAdvertisementStack advertisements={standardAds}/></section>}{children}<aside className={styles.demo} aria-label="Wireframe Ad Demo"><div className={styles.demoHead}><h2>Wireframe Ad Demo</h2><small>เครื่องมือทดสอบเท่านั้น · ไม่ใช่ UI สำหรับ production</small></div><div className={styles.controls}><button className={role==="guest"?styles.active:""} onClick={()=>audience("guest",false)}>Guest with all advertisements</button><button className={role==="member"&&!isAdFreeMember?styles.active:""} onClick={()=>audience("member",false)}>Free Member with all advertisements</button><button className={role==="member"&&isAdFreeMember?styles.active:""} onClick={()=>audience("member",true)}>Ad-free Member</button><button className={count===3?styles.active:""} onClick={()=>setCount(3)}>3 standard advertisements</button><button className={count===10?styles.active:""} onClick={()=>setCount(10)}>10 standard advertisements</button><button className={premium?styles.active:""} onClick={()=>setPremium(true)}>Premium Popup on</button><button className={!premium?styles.active:""} onClick={()=>setPremium(false)}>Premium Popup off</button></div></aside></>
}
