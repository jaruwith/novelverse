import Link from "next/link";
import { Suspense } from "react";
import { ReaderAdvertisementExperience } from "@/components/ReaderAdvertisements";
import { CommentList, ProtectedAction } from "@/components/Content";
import { stories, storyBySlug } from "@/lib/mockData";

export function generateStaticParams() {
  return stories.filter((story) => story.type === "NOVEL").flatMap((story) => story.chapters.map((chapter) => ({ slug: story.slug, chapterNumber: String(chapter.number) })));
}

export default async function Page({ params }: { params: Promise<{ slug: string; chapterNumber: string }> }) {
  const { slug, chapterNumber } = await params;
  const story = storyBySlug(slug);
  const chapterNumberValue = Number(chapterNumber);
  const chapter = story.chapters.find((item) => item.number === chapterNumberValue) ?? story.chapters[0];

  const header=<div className="reader"><header className="readerHeader"><div><small className="muted">{story.title}</small><strong>ตอนที่ {chapter.number}: {chapter.title}</strong></div><Link href={`/story/${story.slug}`}>สารบัญ</Link></header><div className="readerProgress"><span/></div></div>;
  return <Suspense fallback={header}><ReaderAdvertisementExperience routeKey={`novel:${slug}:${chapter.number}`} header={header}><div className="reader"><article className="readerText"><span className="eyebrow">นิยาย · ตอนที่ {chapter.number}</span><h1>{chapter.title}</h1><div className="heroArt" style={{height:180,borderRadius:12,margin:"24px 0"}}>ภาพประกอบ (ถ้ามี)</div><p>สายฝนหยุดลงเมื่อเสียงระฆังจากหอคอยดังเป็นครั้งที่เจ็ด กลิ่นกระดาษเก่าลอยผ่านชั้นหนังสือที่ทอดยาวเกินกว่าผนังของห้องจะรับไหว</p><p>ลินวางตะเกียงบนโต๊ะและเปิดสมุดบันทึก หน้ากระดาษที่เคยว่างเปล่าปรากฏเส้นหมึกสีเขียวเป็นแผนที่ เส้นทางเริ่มจากจุดที่เธอยืนอยู่ และจบลงหลังประตูบานเล็กซึ่งเมื่อวานยังไม่มีอยู่</p><p>เธอรู้ดีว่ากฎข้อแรกของห้องสมุดคือห้ามเปิดประตูหลังฝน แต่บางครั้งเรื่องราวก็เลือกผู้อ่านของมันเอง</p><aside className="panel"><strong>บันทึกจากผู้เขียน</strong><p className="muted">ขอบคุณที่อ่านมาถึงตอนนี้ ตอนถัดไปเราจะได้รู้ว่าหลังประตูมีอะไร</p></aside></article><div className="sectionTitle"><span>อ่านแล้วประมาณ 62%</span><ProtectedAction>♡ ถูกใจตอนนี้ · {chapter.likes}</ProtectedAction></div><nav className="readerNav"><Link className="secondaryButton" href={`/story/${slug}/chapter/${Math.max(1,chapterNumberValue-1)}`}>← ตอนก่อนหน้า</Link><Link className="secondaryButton" href={`/story/${slug}`}>รายการตอน</Link><Link className="primaryButton" href={`/story/${slug}/chapter/${Math.min(story.chapters.length,chapterNumberValue+1)}`}>ตอนถัดไป →</Link></nav><CommentList/></div></ReaderAdvertisementExperience></Suspense>;
}
