# Creator and Publishing Business Rules

# Purpose

รวบรวมกฎการเป็นครีเอเตอร์ โปรไฟล์ การสร้างเรื่อง/ตอน การเผยแพร่ และการจัดการผลงาน

# Scope

ครอบคลุม Member publishing dashboard, public creator profile, Novel/Comic forms, chapter management, creator comments และ analytics wireframe ไม่ครอบคลุม storage/editor backend หรือรายได้ครีเอเตอร์

# Current Business Rules

| รหัส | กฎธุรกิจ | หลักฐานหลัก |
|---|---|---|
| CR-001 | Member ทุกคนเป็นผู้เผยแพร่ได้ ไม่มี Creator role แยก | confirmed wireframe decision |
| CR-002 | Public Member Profile และ Creator Profile เป็นหน้าเดียวกัน | `/creator/[username]`, profile form |
| CR-003 | Creator สร้างผลงานได้ 2 ประเภท: Novel และ Comic | Story form, mock types |
| CR-004 | เรื่องมีชื่อ, slug preview, description, type, story status, publication status, creator, primary category, tags และ media placeholders | Story form/mock data |
| CR-005 | เรื่องเลือกหมวดหลักหนึ่งหมวดและเลือกแท็กได้หลายรายการ | publishing/taxonomy UI |
| CR-006 | Story status ที่พบคือ Ongoing, Completed, Hiatus, Cancelled | mock types |
| CR-007 | Publication status คือ DRAFT, PUBLISHED, HIDDEN, ARCHIVED และ DELETED โดย DELETED เป็น soft delete | confirmed Product Owner decision |
| CR-008 | Publishing form มี suitability self-rating: ทุกวัย, 13+, 18+ | Story form |
| CR-009 | Novel chapter เก็บ structured rich content; Comic chapter มี ordered ComicPage records | confirmed architecture decision |
| CR-010 | Creator จัดการได้เฉพาะผลงานที่ตนเป็นเจ้าของตามข้อความ UI | Stories page |
| CR-011 | Creator ซ่อนความคิดเห็นได้เฉพาะบนผลงานของตน | Member comments page |
| CR-012 | Dashboard แสดงผลงาน ยอดอ่าน chapter likes story followers comments และ mock analytics | Dashboard components |
| CR-013 | Public story URL ใช้ `/@creator-slug/story-slug`; creator slug unique ทั้งระบบ, story slug uniqueภายใน creator และ chapter slug uniqueภายใน story | confirmed architecture decision |
| CR-014 | Chapter ใช้ `display_order` อิสระจาก title/เลขตอนที่แสดง และ Creator reorder ได้อย่างอิสระ | confirmed architecture decision |
| CR-015 | Creator delete ใช้ soft delete; Archive เป็น publication state แยก | confirmed architecture decision |
| CR-016 | Media file อยู่นอก relational database และ MediaAsset เก็บ metadata/object key/URL | confirmed architecture decision |
| CR-017 | CreatorSupportProfile/Method รองรับ bank, PromptPay, QR และ external links; แสดงบน Creator Profile และท้ายทุก Chapter | confirmed architecture decision |
| CR-018 | ก่อนเผยแพร่ครั้งแรก Creator ต้องยอมรับ Creator Guidelines และ moderation rules เวอร์ชันที่มีผล | confirmed Product Owner decision |
| CR-019 | การเปิด support method ต่อสาธารณะเป็น opt-in; Creator ต้องยืนยันสิทธิ์/permission, ตำแหน่งแสดง และ consent; bank/PromptPay เข้ารหัสและ mask, QR อยู่ Cloudflare R2 | confirmed Product Owner decision |
| CR-020 | Creator เปลี่ยน DRAFT→PUBLISHED, PUBLISHED→ARCHIVED, ARCHIVED→PUBLISHED และ owner-controlled state→DELETED; Admin เท่านั้นที่ HIDDEN→PUBLISHED | confirmed Product Owner decision |

# User Flow

1. Member เปิด Dashboard
2. เลือกสร้าง Novel หรือ Comic
3. กรอก metadata, category, tags, story status และ suitability
4. บันทึก Draft หรือ Publish ในระดับ wireframe
5. เปิด chapter management และสร้างตอนตาม content type
6. Preview/Publish ตอนในระดับ wireframe
7. ดู public profile, works, comments และ analytics

# Confirmed Decisions

- ไม่มี Creator role แยก
- โปรไฟล์ Member/Creator รวมเป็นหน้าเดียว
- รองรับ Novel และ Comic
- หนึ่งเรื่องมีหนึ่ง primary category และหลาย tags
- Creator comment hiding ถูกออกแบบให้ reversible ในแนวคิด แต่ prototype ไม่ persist
- Creator support ส่งเงินตรงถึง Creator; NovelVerse ไม่ประมวลผลหรือหักเปอร์เซ็นต์

# Pending Product Owner Decisions

- ⚠ Pending Product Owner Decision — required fields, validation, character limits, slug normalization และ reserved words
- ⚠ Pending Product Owner Decision — publishing scheduling และ revision historyที่นอกเหนือ transition ที่ยืนยันแล้ว
- ⚠ Pending Product Owner Decision — suitability taxonomy และ content warning policy ขั้นสุดท้าย
- ⚠ Pending Product Owner Decision — upload types, sizes, ownership/licensing, media processing และ retention (storage provider ยืนยันเป็น Cloudflare R2)
- ⚠ Pending Product Owner Decision — key management/rotation และรายละเอียด support-method validation
- ⚠ Pending Product Owner Decision — ownership transfer, collaborator/co-author และ organization model
- ⚠ Pending Product Owner Decision — analytics definitions, collection, freshness และ export

# Future Ideas

- Creator-follow ปรากฏเป็น disabled placeholder “เร็ว ๆ นี้”
- Promotional square/vertical media มี optional placeholders ใน Story form
- Slug history/redirect, coin-per-chapter และ notification center ไม่อยู่ใน MVP schema

# Related Documents

- [Membership](01_MEMBERSHIP.md)
- [Reading](03_READING.md)
- [Moderation](05_MODERATION.md)
- [Monetization](06_MONETIZATION.md)
- [Folder Structure](../06_FOLDER_STRUCTURE.md)

# Revision History

| Version | Date | Change |
|---|---|---|
| 1.0 | 19 กรกฎาคม 2569 | รวมกฎ creator และ publishing จาก dashboard wireframe |
| 1.1 | 19 กรกฎาคม 2569 | ยืนยัน URL/slug, chapter ordering/content/media และ creator support |
| 1.2 | 19 กรกฎาคม 2569 | ยืนยัน support consent/security, Cloudflare R2 และ publishing transitions |
