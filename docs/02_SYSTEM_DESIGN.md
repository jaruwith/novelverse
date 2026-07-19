# การออกแบบระบบปัจจุบัน

| รายการ | ค่า |
|---|---|
| Purpose | อธิบายสถาปัตยกรรมของ prototype และขอบเขตที่ยังต้องออกแบบ |
| Current Status | Frontend-only wireframe บน Next.js App Router |
| Version | 0.1.0 |
| Last Updated | 19 กรกฎาคม 2569 |
| Author | Codex — Lead Software Architect and Technical Documentation Engineer |

## Table of Contents

1. [ภาพรวมสถาปัตยกรรม](#ภาพรวมสถาปัตยกรรม)
2. [ชั้นของระบบ](#ชั้นของระบบ)
3. [Routing และ Layout](#routing-และ-layout)
4. [State และ Access](#state-และ-access)
5. [Data Flow ปัจจุบัน](#data-flow-ปัจจุบัน)
6. [สถานะและข้อจำกัด](#สถานะและข้อจำกัด)
7. [สถาปัตยกรรม production](#สถาปัตยกรรม-production)

## ภาพรวมสถาปัตยกรรม

Prototype เป็นแอป Next.js เดียว ใช้ App Router, React Server Components ตามค่าเริ่มต้น และ Client Components เฉพาะส่วนที่มี local state เช่น role switcher, dialog, form toggle และหน้าบางหน้า ข้อมูลทั้งหมดมาจาก `src/lib/mockData.ts`

## ชั้นของระบบ

| ชั้น | ตำแหน่ง | หน้าที่ |
|---|---|---|
| Route/Page | `src/app` | กำหนด URL, params และประกอบหน้าจอ |
| Shared UI | `src/components` | header, shell, cards, content states, dashboard/admin pages |
| Mock domain data | `src/lib/mockData.ts` | type และข้อมูลตัวอย่าง พร้อม helper คำนวณยอดรวม |
| Presentation | `globals.css`, `ui.module.css` | token, layout, component styling, responsive behavior |
| Provider | `RoleProvider.tsx` | เก็บ role จำลองใน memory |

## Routing และ Layout

- Root layout กำหนด metadata, ภาษาไทย และ `RoleProvider`
- Route group `(public)` ใช้ global header และ footer โดยไม่เปลี่ยน URL
- `/dashboard` ใช้ member shell และ sidebar
- `/admin` ใช้ admin shell และ sidebar
- Dynamic routes ใช้ `[slug]`, `[chapterNumber]` และ `[id]`
- `generateStaticParams` สร้าง params จาก mock data หลาย route

## State และ Access

ค่า role เริ่มต้นคือ `member` และเปลี่ยนได้ระหว่าง `guest`, `member`, `admin` เฉพาะใน React state พื้นที่ dashboard ปฏิเสธ Guest; พื้นที่ admin ยอมเฉพาะ Admin การตรวจนี้เป็น UI guard ไม่ใช่ security boundary และไม่มี middleware/session/server-side authorization

## Data Flow ปัจจุบัน

1. Page/component import array จาก mock data โดยตรง
2. helper คำนวณยอดอ่าน/ถูกใจจาก chapter ใน memory
3. control บางส่วนเปลี่ยน local state เพื่อแสดงผลตอบกลับ
4. form/action ส่วนใหญ่ไม่มี handler เชื่อม backend และไม่ persist

ข้อสังเกต: `storyBySlug` และหน้า creator fallback ไป record แรกเมื่อไม่พบค่า; category ที่ไม่ตรง fallback แสดงทุกเรื่องสาธารณะ พฤติกรรมนี้เหมาะกับ wireframe แต่ต้องตัดสินใจใหม่สำหรับ production

## สถานะและข้อจำกัด

- ไม่มี API, service layer, repository หรือ schema validation
- ไม่มี error boundary/loading route เฉพาะ; มีเพียง gallery สถานะร่วม
- ไม่มี authentication, authorization จริง หรือ audit log
- ไม่มี persistence, caching policy, upload pipeline หรือ observability
- Dynamic dashboard routes สร้าง param สำหรับทุก story แต่ component แสดงข้อมูลเรื่องแรกของ `praewa-writes` โดยไม่ได้ใช้ `id`
- ลิงก์บางรายการใช้ `href="#"` หรือ action จำลอง

## สถาปัตยกรรม production

รูปแบบ backend, database engine, hosting, storage, CDN, authentication provider, API style, queue, cache, monitoring และ deployment topology: **ยังไม่ได้กำหนด**
