# ภาพรวม Physical PostgreSQL Schema

## Purpose

กำหนดกรอบ physical schema ของ NovelVerse v0.1.0 ก่อนสร้าง SQL และ migrations โดยแปลง business/domain model ที่อนุมัติแล้วเป็นตาราง PostgreSQL จริง

## Scope และสถานะ

เอกสารชุดนี้ครอบคลุม MVP จำนวน **34 ตาราง, 347 คอลัมน์, 116 foreign keys, 28 unique rules, 33 row-level CHECK constraints, 11 cross-table validations และ 95 planned indexes** ตัวเลขรวม audit foreign keys, primary-key indexes และ Future search indexes 2 รายการ แต่ไม่รวม Future tables

สถานะ: **Schema Review Draft — ยังไม่อนุมัติให้สร้าง SQL**

## Physical Schema Goals

- รักษา referential integrity และ business uniqueness ใน PostgreSQL
- แยก public slug ออกจาก UUID identity
- รองรับ soft delete/restore โดยไม่ทำให้ Archive มีความหมายปะปน
- ทำให้ Report targets และ CreatorStrike ตรวจสอบย้อนกลับได้
- รองรับ Novel rich content, ordered ComicPage และไฟล์ภายนอกฐานข้อมูล
- คง MVP ให้อ่านง่ายและไม่ใช้ partitioning, EAV หรือ speculative tables

## PostgreSQL Strategy

| เรื่อง | Decision |
|---|---|
| Engine | PostgreSQL; exact supported major version ต้องกำหนดก่อน migration |
| Namespace | ใช้ schema `public` เดียวสำหรับ MVP เพื่อลด operational complexity; แยก namespace เมื่อมี security/ownership requirement จริง |
| Identifier | UUID สำหรับ principal/relationship records; typed target/subtype tablesใช้ shared UUID PK/FK |
| UUID generation | สร้างใน PostgreSQL ด้วย cryptographically strong random UUID (`gen_random_uuid()` concept); extension/version approval ก่อน SQL |
| Public identifiers | ใช้ scoped slugs; ห้ามเผย UUID ใน public URL |
| Time | ทุก instant ใช้ `timestamptz`, เก็บ/เปรียบเทียบเป็น UTC และแปลง timezone ที่ presentation layer |
| Text | ใช้ `text` เป็นค่าเริ่มต้น; `varchar(n)` ใช้เฉพาะ hard limit ที่อนุมัติแล้ว ซึ่งยังไม่มีใน baseline |
| Structured content | `jsonb` พร้อม schema version สำหรับ Novel content และ limited metadata |
| Money | MVP ไม่เก็บ donation transaction หรือยอดเงิน; pricing/payment fields ยัง Pending |

## Audit Strategy

- Mutable principal tables ใช้ `created_at`, `created_by`, `updated_at`, `updated_by`
- Soft-deletable tablesเพิ่ม `deleted_at`, `deleted_by`
- `created_by`/`updated_by`/`deleted_by` เป็น nullable UUID FK ไป `users.id`; nullable รองรับ bootstrap/system/import และต้องมี actor policy ก่อน production
- Moderation ใช้ domain audit เพิ่มเติม: `acted_at`, before/resulting state, evidence, warning delivery และ strike qualification
- Relationship event tables เช่น follow/like ใช้ immutable `created_at` และ hard deleteเมื่อยกเลิก

## Soft-delete Strategy

- ใช้กับ User/Profile, Creator-owned content/support, taxonomy, comments, media และ advertisements
- `deleted_at IS NULL` หมายถึง active record; `deleted_by` ต้องมีค่าเมื่อผู้ใช้/Admin เป็นผู้ลบ
- Archive เป็น publication state และไม่ตั้ง `deleted_at`
- Public slug uniqueness คงครอบคลุม soft-deleted rows เพื่อป้องกัน URL impersonation ใน MVP; slug reuse/history เป็น Future
- hard delete ทำได้หลัง retention/privacy approval และต้องตรวจ inbound references

## Thai และ Multi-language

- เก็บข้อความเป็น UTF-8 ตาม PostgreSQL database encoding
- slug normalization, Thai collation, case/accent handling และ reserved words: **⚠ Pending Product Owner Decision**
- Search MVP รองรับ Story title และ Creator name โดย UI default เป็น Story title; PostgreSQL Thai tokenization/trigram configurationยัง Pending
- ยังไม่สร้าง translation tables เพราะไม่มี approved multilingual content behavior

## Sensitive Data และ Money

- `creator_support_methods.encrypted_value` ต้องเข้ารหัส at restใน PostgreSQL; Backendถอดรหัสได้เฉพาะ method active+publicและ requestมีสิทธิ์
- public displayเป็น Creator opt-in ใช้ `masked_value` สำหรับ Admin/log และห้าม plaintextใน audit/application logs
- exact cipher/KMS/key rotationและ privileged accessเป็น Security implementation decisionก่อน production
- provider email snapshots และ warning recipient snapshotsเป็น Personal data
- NovelVerse ไม่ประมวลผล donation และไม่มี donation/payment ledger ใน MVP
- `membership_entitlements.payment_reference` เป็น nullable future integration reference ไม่ใช่ payment record

## Media / Object Storage Boundary

- PostgreSQL ไม่เก็บ binary upload; Cloudflare R2 เป็น object storage providerที่ยืนยันแล้ว
- `media_assets` เก็บ storage provider, bucket/container, object key/URL, MIME, size, checksum, dimensions และ lifecycle status
- ownership/reference ใช้ foreign keys จาก profile/story/comic/ad/support/evidence
- R2 bucket/logical containerและ object keyเป็น authoritative reference Signed URL/CDN, malware scan, orphan cleanupและ retentionยัง Pending

## Transactions และ Aggregate Ownership

| Transaction boundary | Required atomic work |
|---|---|
| Social login/link | resolve unique provider subject, create/link User และ SocialIdentity |
| First login activation | บันทึก Terms+Privacy versionsที่ยอมรับก่อนเปลี่ยน Userเป็น ACTIVE |
| First publication | ตรวจ current Creator Guidelines+Moderation Rules acceptancesก่อน publishครั้งแรก |
| Enable public support | บันทึก support public-display/ownership confirmationและผูกกับ methodก่อน active+public |
| Story/Chapter edit | ตรวจ owner, status, slug scope และ audit actor |
| Chapter reorder | lock sibling set, กำหนด `display_order` ใหม่โดยไม่ชน unique rule แล้ว commit พร้อมกัน |
| Comic reorder | เหมือน chapter reorder ภายใน Comic Chapter |
| Report creation | สร้าง `reports` และ typed target เพียงหนึ่งรายการใน transaction เดียว |
| Moderation confirmation | สร้าง ModerationAction/evidence, เปลี่ยน content state และ queue WarningEmail อย่างสอดคล้อง |
| Strike creation | ทำได้หลัง qualifying action และ WarningEmail status `SENT`; cross-table invariant ต้องตรวจใน transaction |
| Third-strike suspension | สร้าง qualifying Strikeลำดับที่ 3 และ publishing suspension 7 วัน atomically; ไม่เปลี่ยน account statusหรือผลงานอื่น |
| Entitlement evaluation | อ่านช่วงเวลา/status ปัจจุบัน; หมดอายุแล้วกลับเป็น Free Member โดยไม่ใช้ boolean |
| Advertisement activation | บังคับ subtype และ Premium active สูงสุดหนึ่งรายการ |

Aggregate roots: `users`, `stories`, `reports`, `moderation_actions`, `advertisements`, `creator_support_profiles`, `categories`, `tags`, `media_assets`

## Planned Physical Tables

| Domain | Tables | Count |
|---|---|---:|
| Identity, Legal & Membership | `users`, `social_identities`, `user_profiles`, `legal_documents`, `user_legal_acceptances`, `membership_entitlements` | 6 |
| Creator Support | `creator_support_profiles`, `creator_support_methods` | 2 |
| Taxonomy | `categories`, `tags`, `story_tags` | 3 |
| Story & Chapter | `stories`, `chapters`, `novel_contents`, `comic_pages`, `media_assets` | 5 |
| Reading & Community | `story_follows`, `chapter_likes`, `reading_progress`, `comments` | 4 |
| Moderation | `reports`, `report_user_targets`, `report_story_targets`, `report_chapter_targets`, `report_comment_targets`, `moderation_actions`, `moderation_evidence`, `warning_emails`, `warning_email_evidence`, `creator_strikes`, `creator_publishing_suspensions` | 11 |
| Advertisement | `advertisements`, `standard_advertisements`, `premium_popup_advertisements` | 3 |
| **Total** |  | **34** |

## Conceptual-to-Physical Mapping

- ทุก confirmed conceptual entityมี table โดยตรง
- Advertisement inheritance ใช้ base table + shared-PK subtype tables
- ReportTarget conceptual association แทนด้วย 4 typed target tables; ไม่ใช้ generic polymorphic column pair
- `warning_email_evidence` เป็น junctionที่จำเป็นจากกฎว่า warning emailอาจแนบหลักฐาน และรักษา sent manifestแบบ many-to-manyโดยไม่ใช้ JSON/FK list
- `legal_documents` + `user_legal_acceptances` เป็น generic versioned modelเดียวสำหรับ Terms, Privacy, Creator Guidelines, Moderation Rules และ Support Public Display Consent; ไม่มี marketing consent
- `creator_publishing_suspensions` แยก publishing privilegeจาก User account status, content HIDDEN และ individual strikes
- Creator เป็น capability ของ `users`/`user_profiles` จึงไม่มี `creators` table
- Admin เป็น `users.role` จึงไม่มี `admins` table
- Guest เป็น anonymous request context จึงไม่มี table
- DonationTransaction, Coin, Notification, SlugHistory, CreatorSubscription และ platform donation ไม่มี table เพราะเป็น Future/นอก MVP
- Search/Analytics ยังเป็น derived capability จึงไม่มี persistence tableจนกว่ากฎจะอนุมัติ

## MVP versus Future Boundary

| MVP | Future / Excluded |
|---|---|
| Google/Facebook identities, ad-free entitlement, content, interactions, moderation, ads, creator support | Local password, coins, notification center, slug redirects, creator subscriptions, platform donation/payment ledger |
| Basic Story title/Creator name lookup | Thai full-text/ranking/search documents |
| Current reading progress | retention archive/cross-device event history beyond current row |

## Pending Product Owner Decisions

- ⚠ Pending Product Owner Decision: PostgreSQL major version และ UUID extension policy
- ⚠ Pending Product Owner Decision: account merge/unlink/recovery/deletion retention
- ⚠ Pending Product Owner Decision: entitlement source vocabulary, overlap, renewal/refund/grace period
- ⚠ Pending Product Owner Decision: rich-content JSON schema/version migration
- ⚠ Pending Product Owner Decision: Cloudflare R2 bucket/container topology, media limits/scanning/retention และ signed/public URL policy
- ⚠ Pending Product Owner Decision: cipher/KMS/key rotationและ privileged support-data access implementation
- ⚠ Pending Product Owner Decision: report reason taxonomy, strike expiry/reversal/appeal และ retention durations
- ⚠ Pending Product Owner Decision: Thai search implementation และ ranking

## Related Documents

- [System Handbook](../../SYSTEM_HANDBOOK.md)
- [Domain Model](../01_DOMAIN_MODEL.md)
- [Conceptual ER](../02_ENTITY_RELATIONSHIP.md)
- [Physical Strategy](../03_DATABASE_DESIGN.md)
- [Table Catalog](02_TABLE_CATALOG.md)
- [Column Dictionary](03_COLUMN_DICTIONARY.md)

## Revision History

| Version | Date | Author | Change |
|---|---|---|---|
| 1.1 | 2026-07-19 | Lead PostgreSQL Database Architect | Added legal acceptance, encrypted public support, publishing suspension and Cloudflare R2 decisions |
| 1.0 | 2026-07-19 | Lead PostgreSQL Database Architect | Initial physical schema overview for v0.1.0 baseline |
