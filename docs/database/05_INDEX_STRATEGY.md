# กลยุทธ์ดัชนีฐานข้อมูล

## Purpose

กำหนดเหตุผลและรูปแบบดัชนีที่คาดว่าจะใช้กับ workload ของ NovelVerse โดยเน้น lookup, discovery, reader, moderation และ advertisement พร้อมควบคุมต้นทุนการเขียน

## Scope

เป็น logical index plan สำหรับ PostgreSQL ก่อนมีข้อมูล production ไม่ใช่คำสั่ง SQL หรือข้อกำหนดให้สร้างดัชนีทั้งหมดทันที

## Architecture Decisions

### ปรัชญา

- ทุกดัชนีต้องผูกกับ query, uniqueness หรือ referential workload ที่ระบุได้
- เริ่มจาก primary key, unique business key และ foreign key ที่ใช้ join/filter แล้ววัดจริงก่อนเพิ่ม covering/partial/search index
- ลำดับ column ใน composite index เริ่มจาก equality filters ตามด้วย sort/range และ stable `id` สำหรับ tie-break
- หลีกเลี่ยงดัชนีซ้ำซ้อนและดัชนีบน boolean เดี่ยว เช่น `is_active`; ใช้ร่วมกับ type/sort เมื่อมี selectivity และ workload
- pagination ของ feed/list ขนาดใหญ่ควรใช้ cursor จาก sort key + `id`; offset เหมาะกับชุดเล็กหรือหน้า Admin ที่ยังมีปริมาณต่ำ
- soft-delete predicate ต้องพิจารณาร่วมกับ active/public query หลังเลือก engine

### Primary Keys และ Foreign Keys

- primary key ทุก entity รองรับ point lookup, stable reference และ cursor tie-break
- index foreign key ที่ใช้ join/delete validation เช่น `story_id` บน Chapter, `chapter_id` บน Comment และ owner `user_id` บน Story
- foreign key ที่เป็น prefix ของ composite index ที่เหมาะสมไม่ต้องมี single-column index ซ้ำ
- actor FK เช่น created_by อาจไม่ต้อง index ทุก column เว้นแต่มี audit query จริง

### Unique และ composite indexes

| Area | Logical index / order | Why it exists |
|---|---|---|
| Social identity | provider + provider_subject unique | social login lookup และป้องกัน identity เชื่อมหลาย User |
| Creator slug | normalized creator_slug global unique | resolve `/@creator-slug` และป้องกันชนทั้งระบบ |
| Story slug | creator_id + slug unique | resolve `/@creator-slug/story-slug` และใช้ slug ซ้ำข้าม Creator ได้ |
| Chapter identity | story_id + slug unique | resolve chapter route โดยไม่ผูกกับชื่อหรือเลขตอนที่แสดง |
| Chapter order | story_id + display_order unique | รองรับ reorder ที่ deterministic และป้องกันลำดับซ้ำ |
| StoryTag | story_id + tag_id unique | ป้องกัน tag ซ้ำใน Story |
| StoryTag reverse | tag_id + story_id | ค้น Story จาก Tag โดยไม่ scan junction |
| StoryFollow | user_id + story_id unique | ป้องกัน follow ซ้ำและตอบสถานะปุ่มรวดเร็ว |
| ChapterLike | user_id + chapter_id unique | ป้องกัน like ซ้ำและตอบสถานะปุ่มรวดเร็ว |
| ReadingProgress | user_id + story_id unique | current position หนึ่งรายการต่อเรื่องใน MVP |
| Membership entitlement | user_id + status + start/end dates | ตรวจสิทธิ์ปัจจุบันโดยไม่พึ่ง boolean และรองรับประวัติช่วงสิทธิ์ |
| Comic page | chapter_id + display_order unique | แสดงหน้าเรียงแน่นอนและรองรับ reorder |
| Creator support method | support_profile_id + status + display_order | แสดงช่องทาง active ตามลำดับบนโปรไฟล์และท้ายตอน |
| Media asset | object_key unique | ป้องกัน metadata ซ้ำสำหรับ object เดียวและช่วย cleanup |

### Workload-specific strategy

#### Slug และ route lookup

- Story: creator slug + story slug เพื่อเปิด URL `/@creator-slug/story-slug`
- Chapter: story ID + chapter slug; ไม่ใช้ displayed chapter number เป็น identity
- Creator: creator slug global unique เพื่อเปิด public profile
- Category/Tag: slug unique เพื่อ route/filter ที่อ่านได้
- เหตุผล: route เหล่านี้อยู่ใน wireframe และต้องตอบแบบ point lookup โดยไม่ scan title/name

#### Creator และ Story management

- Story index: `owner_user_id, publication_status, updated_at, id` สำหรับ My Stories และ dashboard
- Chapter index: `story_id, publication_status, display_order, id` สำหรับ Manage Chapters, reorder และ navigation
- ComicPage index: `chapter_id, display_order, id` สำหรับ render ภาพตามลำดับ
- เหตุผล: query แบ่งตาม owner/parent ก่อน แล้วเรียงข้อมูลล่าสุดหรือลำดับตอน

#### Discovery, category และ story lists

- `publication_status, published_at, id` สำหรับรายการเผยแพร่ล่าสุด
- `category_id, publication_status, published_at, id` สำหรับ Category detail
- junction `tag_id, story_id` สำหรับ Tag filter
- editorial/ranking index ยังไม่กำหนด เพราะสูตร ranking ไม่ได้รับการยืนยัน

#### Reading และ interaction

- Comment: `chapter_id, visibility_or_moderation_status, created_at, id` เพื่อแสดง flat comments ตามเวลา
- Follow list: `user_id, created_at, id`; reverse `story_id` ใช้ aggregate/reconciliation เมื่อจำเป็น
- Reading history: `user_id, last_read_at, id` เพื่อหน้า History
- Like reverse lookup: `chapter_id` สำหรับ count/reconciliation; ไม่จำเป็นหาก engine ใช้ composite index เดิมได้ตามลำดับ query
- เหตุผล: reader ต้องโหลดข้อมูลตาม chapter และ member list ต้อง scope ด้วย user ก่อน

#### Advertisement lookup

- `type, is_active, sort_order, id` สำหรับดึง STANDARD ที่ active ทั้งหมดในลำดับกำหนด
- PREMIUM_POPUP ใช้ filter type+active; การบังคับ active ไม่เกินหนึ่งอาจใช้ engine-specific unique/partial constraint หรือ application transaction หลังเลือก engine
- เหตุผล: ตรงกับกฎไม่สุ่ม, ไม่ rotate, sortOrder แล้ว id และลด sorting work

#### Moderation lookup

- `report_status, created_at, id` สำหรับ queue Open/Reviewing
- typed target table แต่ละชนิดใช้ target FK + report target key เพื่อดูประวัติและรักษา referential integrity
- `reporter_user_id, created_at` สำหรับตรวจบริบทผู้รายงาน
- ModerationAction: `report_id, acted_at, id` และ `actor_user_id, acted_at, id` สำหรับ audit
- WarningEmail: action+status และ provider reference uniqueเมื่อมี; CreatorStrike: creator+status+counted_at
- User/Story/Comment list ใช้ status+updated/id เมื่อ Admin กรองรายการ
- เหตุผล: moderation ทำงานตาม queue และ target history; exact SLA/risk priority ยัง Pending

#### Sorting และ pagination

- ทุก sort ที่ pagination ต้องมี `id` เป็นตัวตัดสินลำดับสุดท้าย เพื่อไม่ให้แถวซ้ำ/หายเมื่อค่าหลักเท่ากัน
- `sort_order, id` ใช้กับ Advertisement และ taxonomy ที่จัดลำดับด้วยมือ
- `created_at, id`, `updated_at, id` หรือ `published_at, id` ใช้กับ timeline ตามความหมายธุรกิจ

### Search indexes

MVP อาจเริ่มจาก normalized lookup/prefix search บน Story title, Creator name/username, Category และ Tag ตามความสามารถ Search UI แต่ชนิดดัชนีขึ้นกับ engine และคุณภาพภาษาไทยที่ต้องการ

Full-text search ในอนาคตต้องพิจารณา:

- Thai tokenization, Unicode normalization, typo tolerance และ synonym
- searchable fields/weights สำหรับ title, description, creator, category, tag
- เฉพาะ Published/visible content
- freshness เมื่อ Story เปลี่ยนสถานะหรือ taxonomy
- external search engine ใช้เมื่อ relational full-text ไม่ผ่านเป้าหมายที่วัดได้เท่านั้น

ทั้งหมดนี้เป็น **⚠ Pending Product Owner Decision** จนกว่าจะกำหนด ranking, filter และ relevance acceptance criteria

### Index review และ operational safety

- ตรวจ query plan และ slow-query evidence ก่อน release สำคัญ
- วัด write amplification, storage, cache hit และ unused index
- ทบทวนหลังข้อมูลโตหรือ distribution เปลี่ยน; ไม่เดาปริมาณจาก mock data 10 รายการ
- สร้าง/แก้ดัชนี production ด้วยแนวทาง online/concurrent ของ engine ที่เลือก

## Confirmed Decisions

- route lookup ต้องรองรับ Story slug, Creator identifier และ Story+chapter number
- Story discovery แสดงเฉพาะเนื้อหาที่เผยแพร่/มองเห็นตามสถานะ
- STANDARD ads ดึง active ทั้งหมดและเรียง `sort_order`, `id`
- Member มี Following และ History UI; Creator/Admin มีรายการตาม ownership/status
- moderation มี queue ตาม report status และ target
- PostgreSQL รองรับ UUID, composite/partial indexes และ JSONB ตาม planned architecture
- creator/story/chapter slug scopes และ `display_order` ได้รับการยืนยัน
- Report targets ใช้ typed FK relations; report อย่างเดียวไม่สร้าง strike

## Pending Product Owner Decisions

- ⚠ Pending Product Owner Decision: slug normalization, reserved words และ collation
- ⚠ Pending Product Owner Decision: ranking, search filters, Thai relevance และ pagination UX
- ⚠ Pending Product Owner Decision: data volume, latency SLO และ retention เพื่อกำหนด index budget
- ⚠ Pending Product Owner Decision: visibility/status vocabulary ที่ใช้เป็น filter ขั้นสุดท้าย
- ⚠ Pending Product Owner Decision: view/like/follower counters ต้อง realtime หรือ eventual
- ⚠ Pending Product Owner Decision: moderation priority/SLA และ audit query
- ⚠ Pending Product Owner Decision: PostgreSQL extension/configuration สำหรับ Thai full-text search

## Future Considerations

Slug history/redirect, coin-per-chapter และ notification center เป็น Future และไม่มี MVP indexes เมื่อ workload สูงขึ้นอาจใช้ materialized read model, cache, partition หรือ search serviceตาม metric

## Related Documents

- [Database Design](03_DATABASE_DESIGN.md)
- [Naming Convention](04_NAMING_CONVENTION.md)
- [Entity Relationship](02_ENTITY_RELATIONSHIP.md)
- [Reading Business Rules](../business/03_READING.md)
- [Advertisement Business Rules](../business/02_ADVERTISEMENT.md)
- [Moderation Business Rules](../business/05_MODERATION.md)

## Revision History

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-07-19 | Lead Solution Architect | สร้าง logical index strategy พร้อมเหตุผลราย workload |
| 1.1 | 2026-07-19 | Lead Solution Architect | ปรับสำหรับ PostgreSQL, scoped slugs, content order, social identities และ safe moderation |
