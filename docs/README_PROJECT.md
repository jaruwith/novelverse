# คู่มือเอกสารโครงการ NovelVerse

| รายการ | ค่า |
|---|---|
| Purpose | เป็นสารบัญและแนวทางอ่านเอกสารโครงการสำหรับทีมพัฒนา |
| Current Status | Documentation baseline สำหรับ wireframe version 0.1.0 |
| Version | 0.1.0 |
| Last Updated | 19 กรกฎาคม 2569 |
| Author | Codex — Lead Software Architect and Technical Documentation Engineer |

## Table of Contents

1. [เริ่มต้นใช้งาน](#เริ่มต้นใช้งาน)
2. [รายการเอกสาร](#รายการเอกสาร)
3. [ขอบเขตและแหล่งข้อมูล](#ขอบเขตและแหล่งข้อมูล)
4. [สถานะคำศัพท์](#สถานะคำศัพท์)
5. [การดูแลเอกสาร](#การดูแลเอกสาร)

## เริ่มต้นใช้งาน

เริ่มจาก `00_PROJECT_OVERVIEW.md` และ `01_REQUIREMENTS.md` จากนั้นอ่าน `03_WIREFRAME_REVIEW.md` สำหรับสถานะรายหน้า และ `11_PRODUCT_DECISIONS.md` ก่อนตัดสินใจเชิงผลิตภัณฑ์หรือสถาปัตยกรรม

## รายการเอกสาร

| ไฟล์ | เนื้อหา |
|---|---|
| `00_PROJECT_OVERVIEW.md` | วิสัยทัศน์ ขอบเขต บทบาท และเทคโนโลยี |
| `01_REQUIREMENTS.md` | functional/non-functional requirements และกฎธุรกิจ |
| `02_SYSTEM_DESIGN.md` | สถาปัตยกรรม prototype และข้อจำกัด |
| `03_WIREFRAME_REVIEW.md` | รีวิวทุกหน้าและสถานะ approval |
| `04_DATABASE_DESIGN.md` | mock domain model และช่องว่างฐานข้อมูล |
| `05_API_DESIGN.md` | API capability inventory และสิ่งที่ยังไม่ได้กำหนด |
| `06_FOLDER_STRUCTURE.md` | โครงสร้าง repository, routes และ components |
| `07_UI_GUIDELINE.md` | token, layout, responsive และ accessibility |
| `08_ROADMAP.md` | Phase 0–6 และ milestone status |
| `09_CHANGELOG.md` | ประวัติการเปลี่ยนแปลงที่ตรวจสอบได้ |
| `10_MEETING_NOTES.md` | แม่แบบและสถานะบันทึกการประชุม |
| `11_PRODUCT_DECISIONS.md` | confirmed/open decisions |
| `README_PROJECT.md` | สารบัญชุดเอกสารนี้ |

เอกสารเดิม `PAGE_INVENTORY.md`, `SITEMAP.md`, `USER_FLOWS.md`, `WIREFRAME_DECISIONS.md` และ `WIREFRAME_SCOPE.md` ยังคงเป็น source material และไม่ได้ถูกแก้ไข

## ขอบเขตและแหล่งข้อมูล

เอกสารสร้างจาก source code, route tree, components, mock data, CSS, README, package.json และเอกสารเดิม ไม่ได้อ้างว่าปุ่ม wireframe เป็น backend feature จริง เมื่อไม่มีหลักฐานจะใช้คำว่า **ยังไม่ได้กำหนด**

## สถานะคำศัพท์

| ค่า | ความหมาย |
|---|---|
| Approved | มีหลักฐานการอนุมัติชัดเจน |
| Reviewing | มี implementation/สมมติฐานและยังต้องทบทวน |
| Draft | ยังเป็นโครงหรือไม่มีข้อสรุป |

## การดูแลเอกสาร

Owner ระยะยาว, review cadence, approval workflow และ versioning policy ของเอกสาร: **ยังไม่ได้กำหนด** ทุกการเปลี่ยนแปลงที่มีผลต่อ product decision ควรอัปเดต requirements, wireframe review, changelog และ product decisions ให้สอดคล้องกัน
