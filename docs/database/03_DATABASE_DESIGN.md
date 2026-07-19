# แนวทางออกแบบฐานข้อมูลเชิงกายภาพในอนาคต

## Purpose

กำหนดกรอบการแปลง conceptual model ไปเป็นฐานข้อมูลในระยะ implementation โดยระบุหน้าที่, key, audit, status และ index ที่คาดหวัง แต่ไม่กำหนด SQL, migration หรือรายละเอียดทุก column

## Scope

เป็น architecture baseline สำหรับ MVP บน PostgreSQL หลัง Product Owner อนุมัติประเด็นค้าง เอกสารนี้ไม่ยืนยันว่ามีฐานข้อมูลอยู่ในระบบปัจจุบัน

## Architecture Decisions

### กลยุทธ์ภาพรวม

- ใช้ PostgreSQL และ relational model ที่ normalize ประมาณ Third Normal Form เป็นค่าเริ่มต้น
- principal entities ใช้ UUID primary key; junction ที่มี natural composite uniqueness อาจยังมี UUID เมื่อจำเป็นต่อ audit/reference
- business key ใช้ unique constraint แยกจาก UUID: creator slug ทั้งระบบ, story slug ภายใน creator และ chapter slug ภายใน story
- Report ใช้ report target record และ typed target tables ที่มี foreign key จริง พร้อมข้อบังคับให้มี target เพียงชนิดเดียว ไม่ใช้ unconstrained `target_type/target_id`
- timestamp เก็บเป็น UTC และแปลง timezone ที่ชั้นแสดงผล
- ตัวนับ views, likes, comments, followers อาจเป็น denormalized summary หลังยืนยันแหล่ง event และ consistency requirement; ห้ามใช้ mock counter เป็นหลักฐานว่ามี event table
- Advertisement สองชนิดใช้ **single-table hierarchy** ใน MVP เพราะ field ร่วมมีมากและชนิดมีเพียงสองชนิด; validation บังคับ field เฉพาะ subtype

### Planned persistence structures

คำว่า “table” ในส่วนนี้เป็นชื่อเชิงสถาปัตยกรรมในอนาคต ไม่ใช่ schema ที่อนุมัติแล้ว

| Future table | Purpose / keys | FK and ownership | Soft delete / audit / status | Expected indexes |
|---|---|---|---|---|
| `users` | ตัวตน Member/Admin; UUID PK | ไม่มี parent; actor FK จากหลาย domain | soft deleteตาม account policy; created/updated actor+time; account status | role+status; social login lookup อยู่ที่ SocialIdentity |
| `social_identities` | Google/Facebook identities | FK → users; UUID PK | audit; provider+subject immutable | unique provider+subject, user+provider |
| `user_profiles` | โปรไฟล์รวมและ creator slug | unique FK → users; UUID PK | creator soft delete; audit | creator slug global unique, unique user |
| `membership_entitlements` | source of truth ของสิทธิ์ไม่มีโฆษณา | FK → users; future payment reference optional | start/end/status/source/audit; expiry ไม่ใช่ soft delete | user+status+start/end, payment reference |
| `stories` | aggregate root ของ Novel/Comic | FK → creator user/profile และ primary category; UUID PK | creator soft delete; publication Archived แยกจาก deletion; full audit | unique creator+slug, owner+status, discovery indexes |
| `chapters` | ตอนของ Story | FK → stories; UUID PK | soft delete; publication status; full audit | unique story+slug, unique story+display_order, story+status+display_order |
| `novel_contents` | structured rich document | unique FK → novel chapter; UUID PK | audit/version policy Pending | unique chapter; JSON document searchไม่ใช้ใน MVP |
| `comic_pages` | ordered pages | FK → comic chapter/media asset; UUID PK | soft delete/audit | unique chapter+display_order, chapter+display_order |
| `media_assets` | metadata/object key/URL ของไฟล์ภายนอก | UUID PK; owner/reference ตาม domain | status/audit/soft deleteตาม retention | object key unique, status, checksum candidate |
| `categories` | taxonomy หลัก | actor FK สำหรับ audit | soft delete/active status; full audit | slug/name unique ตาม normalization, active+sort order |
| `tags` | taxonomy หลายค่า | actor FK สำหรับ audit | soft delete/active status; full audit | slug/name unique, active+sort order |
| `story_tags` | junction Story–Tag | FK → stories/tags; owned by Story relation | ปกติ hard delete relation; created_at/by เพียงพอ | unique story+tag และ reverse tag+story |
| `comments` | flat chapter comments | FK → chapter และ author user | soft deleteหรือ moderation status; full audit | chapter+status+created, author+created, moderation status |
| `story_follows` | follow relation | FK → user/story | hard deleteเมื่อ unfollow; created_at | unique user+story, story+created, user+created |
| `chapter_likes` | like relation | FK → user/chapter | hard deleteเมื่อ unlike; created_at | unique user+chapter, chapter+created |
| `reading_progress` | current reading/history projection | FK → user/story และ optional chapter | updated_at สำคัญ; retention Pending; ไม่ต้อง soft deleteโดย default | unique user+story, user+updated, chapter reference |
| `reports` | moderation intake; ไม่ใช่ strike | FK → reporter และ unique report_target; UUID PK | status/full audit; retention | status+created, reporter+created |
| `report_targets` | exclusive target association | one-to-one FK → report; UUID PK | audit; ไม่ลบแยกจาก report | unique report |
| `reported_users/stories/chapters/comments` | typed target ที่ปลอดภัยเชิงอ้างอิง | PK/FK → report_targets และ FK → target จริง | cascade ตาม report target ไม่ตาม content deletion | target FK+created ผ่าน report join |
| `moderation_actions` | ใครทำ เมื่อใด เพราะอะไร และ resulting state | FK → report, admin user; UUID PK | append-oriented audit | report+acted_at, actor+acted_at, action type+time |
| `moderation_evidence` | หลักฐานของ action | FK → action และ optional media asset; UUID PK | retention/audit | action, media reference |
| `warning_emails` | warning-email delivery audit | FK → action/recipient user; UUID PK | queued/sent/failed; immutable send facts | recipient+sent_at, action+status, provider reference uniqueถ้ามี |
| `creator_strikes` | strike หลัง confirmed violation + sent warning | FK → creator/action/warning email; UUID PK | status/reversal audit | creator+status+counted_at, unique qualifying action |
| `creator_support_profiles` | support content บน profile/chapter end | FK → creator profile; UUID PK | creator soft delete/status/audit | unique creator profile, status |
| `creator_support_methods` | bank/PromptPay/QR/external link | FK → support profile และ optional QR media; UUID PK | soft delete/status/audit | profile+status+display_order |
| `advertisements` | STANDARD และ PREMIUM_POPUP | advertiser ยังเป็นข้อความ; image อ้าง MediaAsset | is_active/type; full audit; soft delete แนะนำ | type+active+sort_order+id; premium active validation |

### Pending candidate structures

โครงสร้างเหล่านี้ต้องไม่ถูกสร้างจนกว่าจะมีคำตอบ:

| Candidate | Why it may be needed | Blocking decision |
|---|---|---|
| `user_preferences` | เก็บค่าจาก Settings | รายการ preference, default และ privacy |
| `appeals` | workflow อุทธรณ์ | policy, eligibility, SLA และ outcome |
| `search_documents` | dedicated search projection | search engine, Thai analyzer และ freshness |
| `analytics_events` | สร้างสถิติจริง | consent, event taxonomy, volume และ retention |

ทุก candidate ข้างต้นคือ **⚠ Pending Product Owner Decision** ในแง่ business scope และอาจเป็น technical decision ร่วมกับ Security/Platform

### Normalization และ denormalization

- แยก Story/Chapter, Category/Tag และ interaction junction เพื่อป้องกันข้อมูลซ้ำ
- ไม่เก็บรายการ Tag หรือ Chapter เป็น JSON ใน Story
- summary count บน Story/Chapter เป็น denormalization candidate เท่านั้น ต้องมี source-of-truth และ reconciliation ก่อนใช้จริง
- หน้า Home/Search/Analytics อาจใช้ read projection หรือ cache ภายหลังเมื่อมี performance evidence

### JSON usage

PostgreSQL JSONB เหมาะกับ structured rich content และ extensible media metadata เมื่อมี schema/version ชัดเจน ห้ามใช้แทน relationship, status, tag list, report target หรือ audit fields รูปแบบ document schema และ migration ระหว่างเวอร์ชันยังเป็น **⚠ Pending Product Owner Decision**

### Attachment และ image strategy

- binary file เก็บนอก PostgreSQL; `media_assets` เก็บ object key/URL, metadata, owner และ lifecycle
- ภาพปก/โปรไฟล์/โฆษณาและ comic pages ต้องมี alt/accessibility metadata ตามความเหมาะสม
- ลำดับ Comic page ต้องมี stable display order ไม่พึ่งชื่อไฟล์
- upload security, file type/size, derivative, CDN และ orphan cleanup เป็น **⚠ Pending Product Owner Decision**

### Slug, DisplayOrder และ status

- URL สาธารณะคือ `/@creator-slug/story-slug`; creator slug unique global, story slug uniqueต่อ creator และ chapter slug uniqueต่อ story Slug history/redirect เป็น Future ไม่ใช่ MVP
- Chapter ใช้ `display_order` อิสระจาก title และเลขตอนที่แสดง; Creator reorder ได้โดยแก้ลำดับอย่างปลอดภัยใน transaction
- ใช้ `sort_order` สำหรับ taxonomy, comic pages และ STANDARD ads เมื่อ business ต้องควบคุมลำดับ; tie-break ด้วย primary key/id ที่ stable
- Story status, publication status, report status, account status และ advertisement type ต้องเป็นคนละ controlled vocabulary ไม่ใช้ enum กลางร่วมกัน

### Audit fields

ข้อมูลหลักคาดว่าจะมี `created_at`, `updated_at`, `created_by_user_id`, `updated_by_user_id` เมื่อมี actor; system-generated records อนุญาต actor ว่างหรือ system identity ตาม policy ที่ต้องยืนยัน Soft delete ใช้ `deleted_at` และ `deleted_by_user_id` เมื่อ domain ต้องกู้คืน

## Confirmed Decisions

- ระบบข้อมูลจริงยังไม่ได้ implement; เอกสารนี้เป็น future architecture เท่านั้น
- Story/Chapter, Category/Tag, follow/like, Comment, Report และ Advertisement มีความหมายชัดจาก wireframe
- STANDARD ad แสดงทั้งหมดตาม sortOrder แล้ว id; PREMIUM_POPUP แยกชนิดและแสดงไม่เกินหนึ่ง
- ไม่มีฐานสำหรับออกแบบ payment, subscription transaction, donation หรือ payout table
- PostgreSQL และ UUID primary keys ได้รับการยืนยัน
- Google/Facebook social identities แยกจาก User และรองรับหลาย provider ต่อ User
- CreatorSupport ไม่สร้าง donation transaction เพราะเงินไป Creator โดยตรง; รายได้ NovelVerse มาจาก ads/ad-free membership

## Pending Product Owner Decisions

- ⚠ Pending Product Owner Decision: account merge/unlink/recovery, deletion และ personal-data retention
- ⚠ Pending Product Owner Decision: rich content schema/versioning และ media storage provider/limits
- ⚠ Pending Product Owner Decision: audit/soft-delete/cascade policy ราย domain
- ⚠ Pending Product Owner Decision: entitlement status transitions, pricing, renewal/refund และ payment provider
- ⚠ Pending Product Owner Decision: strike threshold/expiry/reversal, moderation SLA และ appeal
- ⚠ Pending Product Owner Decision: encryption/masking และ access control ของ bank/PromptPay data
- ⚠ Pending Product Owner Decision: event analytics, view counting และ counter consistency

## Future Considerations

Slug history/redirect, coin-per-chapter และ notification center เป็น Future และไม่เพิ่ม table ใน MVP พิจารณา partitioning, read replicas, search หรือ event streamเมื่อมีข้อมูลจริง

## Related Documents

- [Domain Model](01_DOMAIN_MODEL.md)
- [Entity Relationship](02_ENTITY_RELATIONSHIP.md)
- [Naming Convention](04_NAMING_CONVENTION.md)
- [Index Strategy](05_INDEX_STRATEGY.md)
- [Existing Database Review](../04_DATABASE_DESIGN.md)

## Revision History

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-07-19 | Lead Solution Architect | กำหนด future physical strategy โดยไม่สร้าง schema/SQL |
| 1.1 | 2026-07-19 | Lead Solution Architect | ยืนยัน PostgreSQL/UUID และเพิ่ม identity, content/media, moderation และ creator support structures |
