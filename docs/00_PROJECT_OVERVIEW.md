# ภาพรวมโครงการ NovelVerse

| รายการ | ค่า |
|---|---|
| Purpose | อธิบายเป้าหมาย ขอบเขต และสถานะปัจจุบันของโครงการจาก implementation ที่ตรวจพบ |
| Current Status | Wireframe prototype สำหรับทบทวนระบบ; ยังไม่ใช่ระบบ production |
| Version | 0.1.0 |
| Last Updated | 19 กรกฎาคม 2569 |
| Author | Codex — Lead Software Architect and Technical Documentation Engineer |

## Table of Contents

1. [บทสรุป](#บทสรุป)
2. [กลุ่มผู้ใช้](#กลุ่มผู้ใช้)
3. [ขอบเขตที่มีในปัจจุบัน](#ขอบเขตที่มีในปัจจุบัน)
4. [สิ่งที่ยังไม่มี](#สิ่งที่ยังไม่มี)
5. [เทคโนโลยี](#เทคโนโลยี)
6. [หลักฐานและข้อจำกัด](#หลักฐานและข้อจำกัด)

## บทสรุป

NovelVerse เป็น wireframe เชิงออกแบบระบบสำหรับแพลตฟอร์มนิยายและการ์ตูนไทยภายใต้แบรนด์ J007lnwza โดยเอกสารเดิมระบุปลายทางที่ `j007lnwza.com/novelverse` ตัวต้นแบบครอบคลุมการค้นพบและอ่านเนื้อหา การเผยแพร่โดยสมาชิก และงานดูแลระบบ บน desktop และ mobile browser

## กลุ่มผู้ใช้

| บทบาท | ความสามารถที่ต้นแบบแสดง |
|---|---|
| Guest | สำรวจ ค้นหา ดูเรื่อง และอ่านตอน; action ที่ต้องเป็นสมาชิกเปิด dialog เข้าสู่ระบบ |
| Member | ความสามารถ Guest รวมถึง Following, History และพื้นที่สร้าง/จัดการผลงาน |
| Admin | เข้าถึงพื้นที่ดูแลผู้ใช้ เรื่อง ความคิดเห็น รายงาน หมวดหมู่ และแท็ก |

`RoleProvider` ใช้ state ใน browser และค่าเริ่มต้นเป็น `member`; ไม่ใช่ authentication หรือ authorization จริง

## ขอบเขตที่มีในปัจจุบัน

- เส้นทางสาธารณะ พื้นที่สมาชิก พื้นที่ผู้ดูแล และหน้าสถานะรวม 31 หน้า/สถานะ
- เนื้อหา 2 ประเภท: `NOVEL` และ `COMIC`
- ข้อมูลจำลอง: 8 หมวดหมู่, 10 แท็ก, 6 ครีเอเตอร์, 13 เรื่อง, 3 ความคิดเห็น และ 3 รายงาน
- สถานะเรื่อง การเผยแพร่ loading, empty, error, hidden, archived, permission denied และ not found
- responsive layout ผ่าน breakpoint ใน CSS
- flow สร้างเรื่อง/ตอน จัดการความคิดเห็น สถิติ และ moderation ในระดับ wireframe

## สิ่งที่ยังไม่มี

ฐานข้อมูล, API, authentication จริง, upload/storage, persistence, payment, email, notification center, production security, analytics collection และ deployment ยังไม่มีตามขอบเขตที่ระบุไว้เดิม

## เทคโนโลยี

| รายการ | เวอร์ชัน/สถานะ |
|---|---|
| Next.js | 16.2.10, App Router |
| React / React DOM | 19.2.4 |
| TypeScript | ^5, strict mode |
| ESLint | ^9 + eslint-config-next 16.2.10 |
| Styling | Global CSS และ CSS Module; ไม่มี UI library |
| Backend / Database | ยังไม่ได้กำหนด |

## หลักฐานและข้อจำกัด

เอกสารนี้อ้างอิง source code, mock data, README, package.json และเอกสาร wireframe ณ วันที่ระบุเท่านั้น README ยังเป็นข้อความมาตรฐานจาก create-next-app และยังไม่อธิบาย NovelVerse โดยตรง การทำงานของปุ่มและฟอร์มจำนวนมากไม่ persist และตัวเลข analytics/admin บางส่วนเป็นค่าคงที่สำหรับการรีวิวหน้าจอ
