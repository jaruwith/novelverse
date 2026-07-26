import { GlobalHeader } from "@/components/GlobalHeader";
import Link from "next/link";
export default function PublicLayout({children}:{children:React.ReactNode}){return <><GlobalHeader/><main>{children}</main><footer><strong>NovelVerse</strong><span>แพลตฟอร์มเรื่องราวหลายรูปแบบ</span><nav><Link href="/">หน้าแรก</Link><Link href="/creator/stories">พื้นที่ครีเอเตอร์</Link><Link href="/login">เข้าสู่ระบบ</Link></nav></footer></>}
