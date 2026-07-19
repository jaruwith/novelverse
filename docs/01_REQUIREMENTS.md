# ข้อกำหนดโครงการ NovelVerse

| รายการ | ค่า |
|---|---|
| Purpose | รวบรวมข้อกำหนดที่ยืนยันได้จากหน้าจอ โค้ด และเอกสารเดิม |
| Current Status | Draft จาก wireframe; ต้องผ่านการยืนยันก่อนพัฒนา production |
| Version | 0.1.0 |
| Last Updated | 19 กรกฎาคม 2569 |
| Author | Codex — Lead Software Architect and Technical Documentation Engineer |

## Table of Contents

1. [ขอบเขตผลิตภัณฑ์](#ขอบเขตผลิตภัณฑ์)
2. [ข้อกำหนดเชิงฟังก์ชัน](#ข้อกำหนดเชิงฟังก์ชัน)
3. [กฎธุรกิจที่ยืนยันแล้ว](#กฎธุรกิจที่ยืนยันแล้ว)
4. [ข้อกำหนดไม่ใช่เชิงฟังก์ชัน](#ข้อกำหนดไม่ใช่เชิงฟังก์ชัน)
5. [นอกขอบเขตปัจจุบัน](#นอกขอบเขตปัจจุบัน)
6. [Acceptance ที่ยังไม่ได้กำหนด](#acceptance-ที่ยังไม่ได้กำหนด)

## ขอบเขตผลิตภัณฑ์

ระบบต้องรองรับการสำรวจและอ่านนิยาย/การ์ตูน การจัดการคลังส่วนตัวของสมาชิก การสร้างและจัดการผลงาน และการดูแลเนื้อหา/ผู้ใช้ โดย wireframe ปัจจุบันใช้ข้อมูลจำลองและไม่มี persistence

## ข้อกำหนดเชิงฟังก์ชัน

| รหัส | ข้อกำหนด | หลักฐาน/สถานะ |
|---|---|---|
| FR-P01 | Guest ต้องอ่านนิยายและการ์ตูนได้โดยไม่เข้าสู่ระบบ | ยืนยันในหน้า Home/Login และ flow เดิม |
| FR-P02 | ระบบต้องมี Home, Categories, Category detail, Search, Story detail และ Creator profile | มี route และหน้าจอแล้ว |
| FR-P03 | Novel reader ต้องมีเนื้อหา ความคืบหน้า navigation ถูกใจ และความคิดเห็น | มี wireframe; persistence ยังไม่มี |
| FR-AD01 | Novel Reader และ Comic Reader ต้องแสดง standard advertisements ที่ active ครบทุกใบเป็น vertical stack ก่อน reading content | Wireframe-confirmed |
| FR-AD02 | Standard advertisements ไม่มีเพดานสามรายการ ไม่มี rotation/random selection และเรียง `sortOrder` จากน้อยไปมาก จากนั้น `id` จากน้อยไปมาก | Wireframe-confirmed |
| FR-AD03 | Guest และ Free Member (`isAdFreeMember=false`) ต้องเห็น standard advertisements ทั้งหมดและ Premium Popup เมื่อ active | Wireframe-confirmed |
| FR-AD04 | Ad-free Member (`isAdFreeMember=true`) และ Admin ต้องไม่เห็น standard ads, Premium Popup หรือ ad-free upsell | Wireframe-confirmed; ไม่มี subscription backend |
| FR-AD05 | Premium Popup เป็น paid placement แยก แสดงได้สูงสุดหนึ่งรายการ และปุ่มปิดใช้ได้หลัง countdown 5 วินาที | Wireframe-confirmed |
| FR-AD06 | การคลิก standard advertisement หรือ Premium Popup ต้องเปิด target URL ในแท็บใหม่ด้วย `noopener noreferrer` | Wireframe-confirmed |
| FR-AD07 | ระหว่าง Premium Popup active ต้องล็อก wheel/touch/keyboard scroll, บล็อก background interaction และกัก focus ใน dialog | Wireframe-confirmed |
| FR-AD08 | Escape ปิดได้เมื่อครบ 5 วินาทีเท่านั้น และหลังปิดต้องกลับไปต้น standard advertisement section | Wireframe-confirmed |
| FR-AD07 | เหนือ standard stack ต้องแสดงข้อความ “โฆษณาจากผู้สนับสนุน” และ CTA mock ไป `/dashboard/settings` | Wireframe-confirmed |
| FR-P04 | Comic reader ต้องอ่านแนวตั้ง มี floating navigation, ถูกใจ รายงาน และความคิดเห็น | มี wireframe; รูปเป็น placeholder |
| FR-P05 | การค้นหาต้องแบ่งผลเป็นเรื่อง ครีเอเตอร์ และแท็ก พร้อมตัวกรอง | มีหน้าจอ; logic ค้นหาจริงยังไม่มี |
| FR-M01 | Member ต้องติดตามเรื่อง ดู Following/History และอ่านต่อ | มีหน้าจอ; state ไม่ persist |
| FR-M02 | สมาชิกทุกคนต้องสร้าง Novel หรือ Comic ได้ | เป็น decision ที่ยืนยันแล้ว |
| FR-M03 | Member ต้องจัดการโปรไฟล์ เรื่อง ตอน ความคิดเห็น สถิติ และการตั้งค่าได้ | มี wireframe |
| FR-M04 | การสร้างเรื่องต้องรับชื่อ slug preview คำโปรย หมวด สถานะ แท็ก suitability และภาพ | มีฟอร์มจำลอง |
| FR-M05 | การสร้างตอนต้องแยก editor นิยายและ uploader/reorder สำหรับการ์ตูน | มี wireframe |
| FR-A01 | Admin ต้องดูภาพรวม ผู้ใช้ เรื่อง ความคิดเห็น รายงาน หมวดหมู่ และแท็กได้ | มี route และหน้าจอ |
| FR-A02 | Admin ต้องซ่อน/กู้คืนเนื้อหา ระงับ/กู้คืนผู้ใช้ และ resolve/reject report ได้ | มี action จำลอง |
| FR-S01 | ระบบต้องแสดง loading, empty, error, hidden, archived, permission denied และ 404 | มีตัวอย่างหน้าจอ |

## กฎธุรกิจที่ยืนยันแล้ว

- Member profile และ Creator profile เป็นหน้าเดียวกัน
- ไม่มีบทบาท Creator แยก; Member ทุกคนเผยแพร่ได้
- ไม่มี notification center ใน MVP; ใช้ Following แทน
- Like ใช้กับ chapter เท่านั้น; Follow ใช้กับ story เท่านั้น
- Comment เป็นแบบ flat ไม่มี reply และไม่มี comment like
- Story views เป็นผลรวม chapter views
- เรื่องมีหมวดหลักหนึ่งหมวดและมีแท็กได้หลายรายการ
- Search อยู่ใน global header ของหน้าสาธารณะ
- รองรับ desktop และ mobile browser
- Advertisement เป็น wireframe สำหรับ Novel/Comic Reader; ไม่มีฐานข้อมูล ระบบชำระเงิน subscription backend หรือ external ad service

## ข้อกำหนดไม่ใช่เชิงฟังก์ชัน

| ด้าน | ข้อกำหนดที่พบ |
|---|---|
| ภาษา | UI ปัจจุบันเป็นภาษาไทย; `html lang="th"` |
| Responsive | มี breakpoint 1000, 960, 720, 600 และ 430px |
| Theme | โทนสว่างสบายตา เป็น direction แรกที่ยืนยันแล้ว |
| Accessibility | มี `aria-label` สำหรับช่องค้นหาและ `role="dialog"` บาง dialog; เกณฑ์มาตรฐานยังไม่ได้กำหนด |
| Performance | ยังไม่ได้กำหนด |
| Availability / SLA | ยังไม่ได้กำหนด |
| Security / Privacy | ยังไม่ได้กำหนด |
| Browser matrix | ระบุเพียง desktop/mobile browser; รายชื่อและเวอร์ชันยังไม่ได้กำหนด |

## นอกขอบเขตปัจจุบัน

Authentication จริง, database, API, uploads, storage, payments, email, notifications, production security, analytics collection และ deployment

## Acceptance ที่ยังไม่ได้กำหนด

เกณฑ์รับมอบรายหน้า, validation rules, content policy, moderation SLA, suitability taxonomy, ขีดจำกัดไฟล์, slug rules, pagination, ranking algorithm, data retention และ recovery policy: **ยังไม่ได้กำหนด**
