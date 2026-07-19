# รีวิว Wireframe รายหน้า

| รายการ | ค่า |
|---|---|
| Purpose | ทบทวนทุก route/page ที่มีอยู่ พร้อมช่องว่าง คำถาม และสถานะอนุมัติ |
| Current Status | Reviewing; ไม่พบหลักฐานการอนุมัติรายหน้า |
| Version | 0.1.0 |
| Last Updated | 19 กรกฎาคม 2569 |
| Author | Codex — Lead Software Architect and Technical Documentation Engineer |

## Table of Contents

1. [เกณฑ์สถานะ](#เกณฑ์สถานะ)
2. [Public Pages](#public-pages)
3. [Member Dashboard](#member-dashboard)
4. [Admin Pages](#admin-pages)
5. [System Pages](#system-pages)
6. [คำถามร่วมทุกหน้า](#คำถามร่วมทุกหน้า)

## เกณฑ์สถานะ

- **Approved** — มีหลักฐานว่าได้รับอนุมัติแล้ว
- **Reviewing** — มี wireframe ให้ตรวจ แต่ยังไม่พบหลักฐานอนุมัติ
- **Draft** — เป็นตัวอย่างสถานะ/โครง หรือ behavior สำคัญยังไม่ถูกกำหนด

การมี implementation ไม่เท่ากับการอนุมัติ จึงไม่กำหนดหน้าใดเป็น Approved โดยไม่มีหลักฐาน

## Public Pages

### `/` — หน้าแรก

- **Purpose:** ช่วยค้นพบเรื่อง อ่านต่อ ดู ranking หมวดหมู่ และครีเอเตอร์
- **Status:** มี hero และ 10 shelf/section ตาม role พร้อมข้อมูลจำลอง
- **UX Review:** ลำดับเนื้อหาครบแต่ยาว; Guest ไม่เห็นอ่านต่อ; CTA อ่านและสร้างชัดเจน
- **Missing Features:** ranking/search/personalization จริง, pagination และ loading/error ต่อ section
- **Open Questions:** นิยามมาใหม่/มาแรง/editorial และจำนวน section บน mobile ยังไม่ได้กำหนด
- **Improvement Suggestions:** ทดสอบลำดับ section, content density และ horizontal discovery กับผู้ใช้จริง
- **Approval:** Reviewing

### `/categories` — หมวดหมู่ทั้งหมด

- **Purpose:** แสดง 8 หมวดหลักและจำนวนเรื่อง
- **Status:** แสดงจาก mock data และลิงก์ไป category detail
- **UX Review:** โครงสร้างเรียบง่ายและสื่อกฎหนึ่งเรื่องต่อหนึ่งหมวดหลัก
- **Missing Features:** description/visual identity ต่อหมวด, empty/error และจำนวนจาก backend
- **Open Questions:** taxonomy และลำดับหมวดยังไม่ได้กำหนด
- **Improvement Suggestions:** ยืนยันชื่อหมวด slug และการจัดการหมวดที่ไม่มีเรื่อง
- **Approval:** Reviewing

### `/category/[slug]` — รายละเอียดหมวด

- **Purpose:** แสดงเรื่องในหมวด พร้อม tabs/filter/sort
- **Status:** filter controls ยังไม่ทำงาน; slug ไม่ตรงจะแสดงทุกเรื่อง
- **UX Review:** card grid และตัวกรองเห็นชัด แต่ fallback อาจทำให้ผู้ใช้เข้าใจผิด
- **Missing Features:** filter/sort/pagination จริง, canonical 404 และ empty state
- **Open Questions:** default sort และ URL query synchronization ยังไม่ได้กำหนด
- **Improvement Suggestions:** ไม่ fallback เป็นทุกเรื่องใน production และแสดงผลรวมตาม filter จริง
- **Approval:** Reviewing

### `/search` — ค้นหา

- **Purpose:** รวมผลเรื่อง ครีเอเตอร์ และแท็ก
- **Status:** แสดง mock result และตัวเลขคงที่ ไม่กรองตาม query จริง
- **UX Review:** การจัดกลุ่มผลเข้าใจง่าย; filter bar สื่อความสามารถในอนาคต
- **Missing Features:** search engine, relevance, no-result, typo handling, pagination และ recent search
- **Open Questions:** ranking, debounce, autocomplete source และ content visibility ยังไม่ได้กำหนด
- **Improvement Suggestions:** ทำจำนวนผลให้สัมพันธ์กับข้อมูลและกำหนด empty/error states
- **Approval:** Reviewing

### `/story/[slug]` — รายละเอียดเรื่อง

- **Purpose:** แสดง metadata, metrics, social actions, chapter list และ related works
- **Status:** รองรับ published/hidden/archived จาก mock; slug ไม่พบ fallback ไปเรื่องแรก
- **UX Review:** CTA เริ่มอ่าน/อ่านต่อเด่นและชนิด Novel/Comic ใช้ reader ถูกประเภท
- **Missing Features:** follow/report persistence, real reading position, share, content warnings และ ownership controls
- **Open Questions:** ผู้ใดเข้าถึง hidden/archived และ logic related works ยังไม่ได้กำหนด
- **Improvement Suggestions:** ใช้ not-found สำหรับ slug ไม่ถูกต้องและซ่อน “อ่านต่อ” เมื่อไม่มี progress
- **Approval:** Reviewing

### `/story/[slug]/chapter/[chapterNumber]` — Novel reader

- **Purpose:** อ่านนิยาย พร้อม progress, navigation, like และ comments
- **Status:** Guest/Free Member เห็น Premium Popup สูงสุดหนึ่งรายการ แล้วเห็น standard ads ที่ active ครบทั้งหมดเรียงตาม `sortOrder` ก่อนเนื้อหา; Ad-free/Admin ไม่เห็น ads
- **UX Review:** ผู้ใช้ต้องเลื่อนผ่าน vertical stack ก่อนอ่าน; Premium Popup แยกจาก standard placement และ Wireframe Ad Demo ทดสอบ 3/10 ads กับ popup on/off ได้
- **Missing Features:** font/theme controls, bookmark, persisted progress, report chapter และ backend สำหรับ ads/subscription (อยู่นอกขอบเขต)
- **Open Questions:** รูปแบบเนื้อหา editor/rendering, progress definition, ad inventory/frequency policy และนิยามผลิตภัณฑ์ Ad-free ยังไม่ได้กำหนด
- **Improvement Suggestions:** ทดสอบ countdown/accessibility กับผู้ใช้ และเอา demo control ออกจาก production build เมื่อมี product architecture จริง
- **Approval:** Reviewing

### `/comic/[slug]/chapter/[chapterNumber]` — Comic reader

- **Purpose:** อ่านการ์ตูนแนวตั้งพร้อม navigation และ community actions
- **Status:** ใช้ panel placeholder 5 ภาพ; Guest/Free Member เห็น Premium Popup และ standard stack ก่อนภาพการ์ตูน ส่วน Ad-free/Admin อ่านได้ทันที
- **UX Review:** floating tools และ navigation ท้ายตอนรองรับการเลื่อนยาว
- **Missing Features:** image loading/error, zoom, preload, bandwidth control, progress persistence และระบบ ads/subscription จริง (อยู่นอกขอบเขต)
- **Open Questions:** image dimensions/format/CDN และ content protection ยังไม่ได้กำหนด
- **Improvement Suggestions:** ทดสอบ floating tools ไม่บังภาพและกำหนด behavior ตอนแรก/สุดท้าย
- **Approval:** Reviewing

### `/creator/[username]` — โปรไฟล์สมาชิก/ครีเอเตอร์

- **Purpose:** รวม identity, metrics, published works และ updates
- **Status:** มี empty state; username ไม่พบ fallback ไป creator แรก; creator-follow disabled
- **UX Review:** ใช้หน้าเดียวตาม decision และแยกผลงานทั้งหมด/จบแล้ว/อัปเดตล่าสุด
- **Missing Features:** media/social links จริง, report user และ verification/privacy controls
- **Open Questions:** creator-follow จะอยู่ใน MVP หรือไม่ และ metric definitions ยังไม่ได้กำหนด
- **Improvement Suggestions:** ใช้ 404 เมื่อ username ไม่พบและระบุสถานะ link/identity ชัดเจน
- **Approval:** Reviewing

### `/following` — เรื่องที่ติดตาม

- **Purpose:** รวมเรื่องที่ติดตาม ตอนล่าสุด และตำแหน่งอ่าน
- **Status:** Guest เห็น login gate; Member/Admin เห็น mock list และ empty example พร้อมกัน
- **UX Review:** สื่อบทบาทแทน notification center ได้ แต่ตัวอย่าง empty ข้างข้อมูลจริงอาจสับสน
- **Missing Features:** follow state, updates, unread/read semantics, sorting และ pagination
- **Open Questions:** นิยาม “อัปเดตแล้ว” และ notification behavior ยังไม่ได้กำหนด
- **Improvement Suggestions:** แสดง empty state เฉพาะเมื่อว่างและเพิ่ม unfollow/manage action
- **Approval:** Reviewing

### `/history` — ประวัติการอ่าน

- **Purpose:** แสดงตอนล่าสุดต่อเรื่องและ CTA อ่านต่อ
- **Status:** Guest login gate; Member/Admin เห็น 5 รายการจำลองและ dialog ล้างประวัติ
- **UX Review:** รายการกระชับและแยก reader ตามชนิดเรื่อง
- **Missing Features:** persistence ข้ามอุปกรณ์, remove per item, filtering และ retention disclosure
- **Open Questions:** retention/privacy และความละเอียด progress ยังไม่ได้กำหนด
- **Improvement Suggestions:** เพิ่มลบรายเรื่องและอธิบายผลของการล้างก่อนยืนยัน
- **Approval:** Reviewing

### `/login` — เข้าสู่ระบบ

- **Purpose:** อธิบาย social login และประโยชน์ของสมาชิก
- **Status:** Google/Facebook เป็นปุ่มจำลอง ไม่มี provider จริง
- **UX Review:** ยืนยันว่า Guest อ่านได้และ Member ทุกคนเผยแพร่ได้อย่างชัดเจน
- **Missing Features:** authentication, terms/privacy consent, error/loading, account linking และ recovery
- **Open Questions:** provider และ onboarding หลัง login ยังไม่ได้กำหนด
- **Improvement Suggestions:** ทบทวน legal copy และ callback/error flow ก่อนเชื่อม provider
- **Approval:** Reviewing

### `/_states` — คลังสถานะระบบ

- **Purpose:** ทบทวน loading, empty, error, archived, hidden และ permission states
- **Status:** เป็น gallery ภายในและลิงก์จาก public footer
- **UX Review:** ช่วยเทียบองค์ประกอบร่วม แต่การเปิดเผยผ่าน footer สาธารณะอาจไม่เหมาะกับ production
- **Missing Features:** success/offline/validation/rate-limit states และ component documentation
- **Open Questions:** route นี้จะ deploy production หรือไม่ยังไม่ได้กำหนด
- **Improvement Suggestions:** จำกัดเฉพาะ development/storybook-like environment หากไม่ใช่หน้าผู้ใช้
- **Approval:** Draft

## Member Dashboard

### `/dashboard` — ภาพรวมสมาชิก

- **Purpose:** สรุปผลงาน metrics ความคิดเห็น และการอัปเดต
- **Status:** ดึงบาง metric จาก mock และใช้ creator `praewa-writes`; ไม่มี account binding
- **UX Review:** quick create Novel/Comic และสถิติเข้าใจง่าย
- **Missing Features:** real ownership/session, date range, actionable comments และ data freshness
- **Open Questions:** metric scope และ dashboard personalization ยังไม่ได้กำหนด
- **Improvement Suggestions:** ระบุช่วงเวลา/แหล่งข้อมูลและทำ recent items คลิกไปบริบทจริง
- **Approval:** Reviewing

### `/dashboard/profile` — แก้ไขโปรไฟล์

- **Purpose:** แก้ avatar, banner, identity, bio และ social links พร้อม preview
- **Status:** form/upload/save เป็น wireframe; ลิงก์ public preview ใช้งานได้
- **UX Review:** edit/preview สองคอลัมน์ช่วยเห็นผลลัพธ์
- **Missing Features:** validation, username availability, upload/crop, unsaved changes และ privacy
- **Open Questions:** username change policy และ social fields ยังไม่ได้กำหนด
- **Improvement Suggestions:** preview แบบ live, validation inline และอธิบายข้อจำกัด media
- **Approval:** Reviewing

### `/dashboard/stories` — ผลงานของฉัน

- **Purpose:** filter และจัดการเรื่องที่เป็นเจ้าของ
- **Status:** tabs ไม่กรอง; ตารางแสดง 3 เรื่องของ mock creator พร้อม empty example
- **UX Review:** status และ action หลักมองเห็นง่าย; table ต้อง scroll บนจอเล็ก
- **Missing Features:** filters, pagination, bulk actions และ ownership enforcement
- **Open Questions:** archive/delete semantics และ allowed status transitions ยังไม่ได้กำหนด
- **Improvement Suggestions:** แยก empty example ออกจาก state จริงและใช้ mobile card layout หากจำเป็น
- **Approval:** Reviewing

### `/dashboard/stories/new` — สร้างผลงาน

- **Purpose:** สร้าง Novel/Comic พร้อม metadata, suitability และ media
- **Status:** type toggle ทำงานเฉพาะ local state; save/publish/upload ไม่ทำงานจริง
- **UX Review:** form แสดงข้อมูลจำเป็นและแยก CTA draft/publish ชัดเจน
- **Missing Features:** validation, slug generation, upload, autosave, content policy และ confirmation
- **Open Questions:** required fields, slug rules, suitability และ publish review ยังไม่ได้กำหนด
- **Improvement Suggestions:** แสดง error/character limits และ preview ก่อน publish
- **Approval:** Reviewing

### `/dashboard/stories/[id]/edit` — แก้ไขผลงาน

- **Purpose:** แก้ metadata และ publication ของผลงาน
- **Status:** ทุก `id` แสดงเรื่องตัวอย่างเดียว; route param ไม่ถูกใช้
- **UX Review:** ใช้ form เดียวกับ create ทำให้รูปแบบสอดคล้อง
- **Missing Features:** load ตาม id, ownership, dirty state, revision history และ concurrency handling
- **Open Questions:** ผลของการแก้ slug/ประเภทหลังเผยแพร่ยังไม่ได้กำหนด
- **Improvement Suggestions:** lock ประเภทเมื่อมีตอนหากเป็นกฎ และเพิ่ม audit/version feedback
- **Approval:** Draft

### `/dashboard/stories/[id]/chapters` — จัดการตอน

- **Purpose:** ดู metrics/status และ action ต่อ chapter
- **Status:** ทุก `id` แสดงเรื่องแรกของเจ้าของ mock; edit/archive links บางส่วนเป็น `#`
- **UX Review:** ตารางรวมข้อมูล operation ได้ครบในระดับ wireframe
- **Missing Features:** load ตาม id, reorder, search/filter, bulk/schedule และ pagination
- **Open Questions:** chapter numbering, archive/delete และ publish schedule ยังไม่ได้กำหนด
- **Improvement Suggestions:** ทำ action menu ที่ชัดเจนและป้องกัน navigation ผิดเรื่อง
- **Approval:** Draft

### `/dashboard/stories/[id]/chapters/new` — สร้างตอน

- **Purpose:** สร้างตอนนิยายด้วย editor หรือการ์ตูนด้วย multi-file upload
- **Status:** type toggle local; editor/uploader/reorder/preview/publish เป็น placeholder
- **UX Review:** ความต่างของ content type ชัด แต่ route ของ story ไม่กำหนด type ให้ form
- **Missing Features:** editor, autosave, upload, reorder, validation, preview และ publish pipeline
- **Open Questions:** rich-text format, media limits, scheduling และ author-note policy ยังไม่ได้กำหนด
- **Improvement Suggestions:** derive type จาก story และไม่ให้สลับผิดประเภท
- **Approval:** Draft

### `/dashboard/comments` — ความคิดเห็นในผลงาน

- **Purpose:** ค้นหา/filter และซ่อนความคิดเห็นบนผลงานของตน
- **Status:** filters ไม่ทำงาน; hide เปิด dialog แต่ไม่ persist
- **UX Review:** ระบุขอบเขต ownership และสถานะ reported ชัดเจน
- **Missing Features:** restore, reason, audit, pagination และ deep link ไป chapter
- **Open Questions:** reversible hiding และผลต่อผู้แสดงความคิดเห็นยังไม่ได้กำหนด
- **Improvement Suggestions:** เพิ่มเหตุผล/สถานะหลัง action และแยก report จาก creator moderation
- **Approval:** Reviewing

### `/dashboard/analytics` — สถิติ

- **Purpose:** แสดง summary, trend, popular stories และ chapters
- **Status:** ตัวเลข summary/chart เป็นค่าคงที่; rankings บางส่วนคำนวณจาก mock
- **UX Review:** hierarchy เข้าใจง่ายและรองรับ review ความสำคัญของข้อมูล
- **Missing Features:** event collection, date filtering จริง, definitions, export และ empty/error
- **Open Questions:** metric definitions, timezone และ freshness ยังไม่ได้กำหนด
- **Improvement Suggestions:** เพิ่ม tooltip นิยาม metric และ comparison ที่ตรวจสอบได้
- **Approval:** Draft

### `/dashboard/settings` — การตั้งค่า

- **Purpose:** ตั้งค่าบัญชี ภาษา เขตเวลา publishing default และ account management
- **Status:** form/connection/delete เป็น wireframe; email เป็น example.test
- **UX Review:** แยก dangerous action ชัดและระบุการเชื่อมต่อว่าเป็น wireframe
- **Missing Features:** persistence, authentication recheck, recovery period และ notification preferences
- **Open Questions:** deletion policy, supported locales/timezones และ account link behavior ยังไม่ได้กำหนด
- **Improvement Suggestions:** เพิ่ม confirmation ที่เหมาะกับความเสี่ยงและอธิบาย data impact
- **Approval:** Reviewing

## Admin Pages

### `/admin` — ภาพรวมผู้ดูแล

- **Purpose:** แสดง system totals, recent activity และ moderation queues
- **Status:** ตัวเลขและกิจกรรมเป็นค่าคงที่จำลอง
- **UX Review:** queue CTA ชัด แต่ไม่มี scope/time/freshness
- **Missing Features:** real metrics, alerts, drill-down, audit data และ operational health
- **Open Questions:** admin KPI และ access level ยังไม่ได้กำหนด
- **Improvement Suggestions:** แยก content operations จาก system health และแสดง timestamp
- **Approval:** Draft

### `/admin/users` — ผู้ใช้

- **Purpose:** ค้นหา ดู role/status และ suspend/restore ผู้ใช้
- **Status:** filters/action จำลอง; role/status บางค่า derive จาก array index
- **UX Review:** ตารางครอบคลุมข้อมูลหลัก แต่ action หลายชนิดอยู่ใน cell เดียว
- **Missing Features:** detail, pagination, reason, duration, audit, appeal และ permission tiers
- **Open Questions:** suspension policy และ admin role management ยังไม่ได้กำหนด
- **Improvement Suggestions:** confirmation พร้อมเหตุผลและป้องกัน admin จัดการตนเอง
- **Approval:** Draft

### `/admin/stories` — ตรวจสอบเรื่อง

- **Purpose:** ค้นหา/filter และจัดการ visibility ของเรื่อง
- **Status:** แสดงทั้ง 13 mock stories; filters และ action ไม่ persist
- **UX Review:** เห็น publication state และ owner ชัดเจน
- **Missing Features:** reason/audit, content preview context, bulk action และ appeal
- **Open Questions:** hidden vs archived semantics และ creator notification ยังไม่ได้กำหนด
- **Improvement Suggestions:** แสดง report linkage และกำหนด state transition ที่อนุญาต
- **Approval:** Reviewing

### `/admin/comments` — ตรวจสอบความคิดเห็น

- **Purpose:** ค้นหาและซ่อน/กู้คืนความคิดเห็น
- **Status:** ใช้ 3 mock comments; filters/action จำลอง
- **UX Review:** สถานะ visible/reported เข้าใจง่าย
- **Missing Features:** report detail, reason/audit, pagination และ context preview
- **Open Questions:** policy, escalation และ retention ยังไม่ได้กำหนด
- **Improvement Suggestions:** เปิดบริบท chapter โดยไม่ออกจาก moderation queue
- **Approval:** Reviewing

### `/admin/reports` — รายงาน

- **Purpose:** review, hide target, resolve หรือ reject report
- **Status:** มี 3 report; detail/resolve/reject บาง action เป็น placeholder
- **UX Review:** tabs สื่อ lifecycle แต่ข้อมูล target ไม่มี target id/content preview
- **Missing Features:** assignment, evidence, history, SLA, duplicate grouping และ appeal
- **Open Questions:** workflow/state machine และ outcome notification ยังไม่ได้กำหนด
- **Improvement Suggestions:** กำหนด required reason และ atomic moderation outcome
- **Approval:** Reviewing

### `/admin/categories` — หมวดหมู่

- **Purpose:** เพิ่ม แก้ไข และ archive หมวดหลัก
- **Status:** count/slug เป็นค่าจำลอง; form/action ไม่ persist
- **UX Review:** rule หนึ่งเรื่องต่อหนึ่งหมวดแสดงชัด
- **Missing Features:** validation, ordering, migration of stories และ localization
- **Open Questions:** archive impact และ slug change redirect ยังไม่ได้กำหนด
- **Improvement Suggestions:** แสดงผลกระทบก่อน archive และป้องกันชื่อ/slug ซ้ำ
- **Approval:** Reviewing

### `/admin/tags` — แท็ก

- **Purpose:** เพิ่ม แก้ไข และ archive แท็กที่ใช้ซ้ำ
- **Status:** ใช้ shared Taxonomy wireframe; count/slug/action จำลอง
- **UX Review:** รูปแบบสอดคล้องกับ categories แต่ยังไม่มี merge/alias
- **Missing Features:** autocomplete governance, duplicates, merge, synonyms และ abuse control
- **Open Questions:** ผู้ใช้สร้างแท็กได้หรือ admin-only ยังไม่ได้กำหนด
- **Improvement Suggestions:** เพิ่ม merge/redirect และ normalization rules
- **Approval:** Reviewing

## System Pages

### `/permission-denied` — ไม่มีสิทธิ์

- **Purpose:** แสดง explicit access-denied example
- **Status:** static state พร้อมลิงก์กลับหน้าแรก; shell ยังมี access state แยกอีกชุด
- **UX Review:** ข้อความกระชับ แต่อาจซ้ำกับ inline shell denial
- **Missing Features:** reason-specific recovery, login/role-aware CTA และ logging
- **Open Questions:** จะใช้ route หรือ inline state เป็นมาตรฐานยังไม่ได้กำหนด
- **Improvement Suggestions:** รวม pattern และไม่เปิดเผยข้อมูลสิทธิ์เกินจำเป็น
- **Approval:** Draft

### `not-found` — ไม่พบหน้า

- **Purpose:** แสดง global 404 และกลับหน้าแรก
- **Status:** มี `src/app/not-found.tsx`; dynamic lookup หลายหน้ายัง fallback แทนการเรียก 404
- **UX Review:** ข้อความเข้าใจง่ายและมี recovery CTA
- **Missing Features:** search/recommendation, logging และ dynamic not-found integration
- **Open Questions:** behavior ของ content ที่ถูกลบ/ย้ายยังไม่ได้กำหนด
- **Improvement Suggestions:** ใช้ not-found อย่างสอดคล้องใน slug/username/id ที่ไม่พบ
- **Approval:** Reviewing

## คำถามร่วมทุกหน้า

- ผู้มีอำนาจอนุมัติรายหน้าและเกณฑ์ Approved คือใคร: **ยังไม่ได้กำหนด**
- Accessibility target, browser matrix, performance budget และ analytics plan: **ยังไม่ได้กำหนด**
- ภาษา error/validation, content policy, privacy และ legal review: **ยังไม่ได้กำหนด**
- ทุก action ที่เปลี่ยนข้อมูลต้องกำหนด loading, success, error, retry, permission และ audit behavior ก่อน production
