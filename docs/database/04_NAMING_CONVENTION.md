# มาตรฐานการตั้งชื่อฐานข้อมูล

## Purpose

สร้างภาษาการตั้งชื่อที่สม่ำเสมอ อ่านได้ และรองรับ tooling สำหรับการออกแบบฐานข้อมูลในอนาคต

## Scope

ใช้กับ relational database objects ที่อาจสร้างหลังอนุมัติ physical design ได้แก่ table, column, key, constraint, index, junction, audit, timestamp, status, image และ attachment metadata

## Architecture Decisions

### กฎทั่วไป

- ใช้ภาษาอังกฤษตัวพิมพ์เล็กแบบ `snake_case`; หลีกเลี่ยงคำย่อที่ไม่เป็นสากลและ reserved words
- ชื่อสะท้อนความหมายธุรกิจ ไม่สะท้อนชื่อหน้าจอหรือ implementation framework
- table ใช้คำนามพหูพจน์ เช่น `stories`, `chapters`, `advertisements`
- column ใช้คำนามเอกพจน์ เช่น `title`, `publication_status`, `sort_order`
- ชื่อ enum/value ใช้รหัสภาษาอังกฤษแบบ uppercase ในเอกสาร/contract เช่น `STANDARD`, `PREMIUM_POPUP`; วิธี implement enum ใน database ยังเป็น technical decision

### Convention catalog

| Object | Convention | Example | Why |
|---|---|---|---|
| Table | plural `snake_case` | `reading_progress`, `story_follows` | แยก collection จาก entity และอ่านตรงกันทุก domain |
| Column | singular `snake_case` | `advertiser_name` | ค้นหาและ map กับ code/tooling ง่าย |
| Primary key | UUID ชื่อ `id` ภายใน principal table | `stories.id` | stable opaque identity และรองรับ generic tooling |
| Foreign key column | `<referenced_entity>_id` | `story_id`, `created_by_user_id` | เห็น target ชัดเจน |
| Primary key constraint | `pk_<table>` | `pk_stories` | error/diagnostic อ่านได้ |
| Foreign key constraint | `fk_<from>__<to>[_<purpose>]` | `fk_chapters__stories` | บอกทิศและแยกหลาย FK ไป table เดียวได้ |
| Index | `ix_<table>__<columns_or_purpose>` | `ix_stories__creator_publication` | อธิบาย workload ที่รองรับ |
| Unique constraint/index | `uq_<table>__<business_key>` | `uq_chapters__story_slug` | แยก business uniqueness จาก UUID PK |
| Junction table | `<entity_a>_<entity_b>` ตามศัพท์ธรรมชาติ | `story_tags` | สั้นและคงความหมาย many-to-many |
| Boolean | `is_`, `has_`, `can_` + adjective/noun | `is_active` | อ่านเป็นคำถาม true/false; ห้ามใช้ `is_ad_free` เป็น source of truthแทน entitlement |
| Enum/type name | `<domain>_<concept>` | `story_publication_status` | ป้องกัน status คนละความหมายปะปน |
| Enum value | uppercase stable token | `PUBLISHED`, `ARCHIVED` | ไม่ผูกกับข้อความแปลบน UI |
| Created audit | `created_at`, `created_by_user_id` | — | ระบุเวลาและ actor ชัดเจน |
| Updated audit | `updated_at`, `updated_by_user_id` | — | แยกจาก business event time |
| Timestamp | `<event>_at` | `published_at`, `last_read_at` | บอกว่าเป็น instant; เก็บ UTC |
| Date-only | `<event>_date` เฉพาะวันปฏิทิน | `joined_date` ถ้าธุรกิจไม่ต้องการเวลา | ไม่ทำให้ date/time คลุมเครือ |
| Soft delete | `deleted_at`, `deleted_by_user_id` | — | เวลา null สื่อ current visibility; ไม่ซ้ำซ้อนกับ boolean |
| Slug | `slug`; scope อยู่ใน constraint | `stories.slug` | URL identifier ชัดเจน |
| Display order | `sort_order` | `advertisements.sort_order` | ตรงกับกฎโฆษณาและใช้ร่วมกันทั้งระบบ |
| Chapter/Comic order | `display_order` | `chapters.display_order`, `comic_pages.display_order` | แยกการเรียงจาก title, slug และเลขตอนที่แสดง |
| Image reference | `<purpose>_image_asset_id` หรือ `<purpose>_image_url` ชั่วคราว | `cover_image_asset_id` | ระบุ purpose และรูปแบบ reference |
| Attachment reference | `attachment_id`/`media_asset_id` | `media_asset_id` | ไม่เก็บ binary ในชื่อ column คลุมเครือ |
| Status | `<subject>_status` เมื่อมีหลาย status | `publication_status`, `report_status` | ป้องกัน `status` ที่ตีความไม่ได้ |
| Exclusive target relationship | parent `report_targets` + typed child | `reported_stories.story_id` | ทุก report target มี FK จริงและบังคับ referential integrity ได้ |

### Relationship naming

- Parent reference ใช้ entity จริง: `story_id` ไม่ใช้ `parent_id` เว้นแต่เป็น self-reference
- Self-reference ระบุบทบาท เช่น `parent_comment_id`; แต่ threaded comment ยังไม่ได้ยืนยัน
- actor references ระบุการกระทำ เช่น `created_by_user_id`, `resolved_by_user_id`
- aggregate count ใช้ `<noun>_count` เช่น `follower_count`; ต้องระบุว่าเป็น derived value ไม่ใช่ source-of-truth

### ข้อห้าม

- ไม่ใช้ชื่อแปลไทย, ช่องว่าง, camelCase หรือ prefix ตามชื่อระบบ เช่น `nv_story`
- ไม่ใช้ `data`, `info`, `value`, `status` เดี่ยว ๆ เมื่อมีความหมายเฉพาะกว่า
- ไม่ใส่ชนิดข้อมูลในชื่อ เช่น `title_varchar`
- ไม่ใช้ `premium_user` แทน Member; business rule กำหนด role เป็น Member และ entitlement ไม่มีโฆษณาแยกต่างหาก

## Confirmed Decisions

- ชื่อเชิงธุรกิจต้องรักษาคำว่า Member, STANDARD, PREMIUM_POPUP, Story, Chapter, Category และ Tag ตามเอกสารที่อนุมัติ
- ลำดับโฆษณาใช้แนวคิด `sort_order` และ fallback ด้วย `id`
- role กับ ad-free entitlement เป็นคนละ concept
- PostgreSQL เป็น planned engine; principal entities ใช้ UUID
- SocialIdentity ใช้ `provider` และ `provider_subject`; MVP provider คือ Google/Facebook
- creator slug unique global, story slug uniqueต่อ creator และ chapter slug uniqueต่อ story
- structured rich content ใช้ชื่อ `content_document`/`content_schema_version`; media ใช้ `object_key`/`object_url`
- CreatorSupport ใช้ `creator_support_profiles` และ `creator_support_methods`; ชนิด method เป็น controlled vocabulary

## Pending Product Owner Decisions

- ⚠ Pending Product Owner Decision: slug normalization, reserved words และ character policy
- ⚠ Pending Product Owner Decision: controlled vocabulary ขั้นสุดท้ายของ account, chapter และ moderation status
- ⚠ Pending Product Owner Decision: object key/URL exposure policy และ sensitive support-field encryption/masking
- ⚠ Pending Product Owner Decision: localization ของ taxonomy name และ slug

## Future Considerations

Slug history/redirect, coin-per-chapter และ notification center เป็น Future ไม่เพิ่มชื่อ table ใน MVP ตรวจ PostgreSQL reserved words, identifier length และ ORM mapping โดยไม่เปลี่ยนศัพท์ธุรกิจ

## Related Documents

- [Database Design](03_DATABASE_DESIGN.md)
- [Index Strategy](05_INDEX_STRATEGY.md)
- [Domain Model](01_DOMAIN_MODEL.md)

## Revision History

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-07-19 | Lead Solution Architect | กำหนด naming baseline สำหรับ physical design ในอนาคต |
| 1.1 | 2026-07-19 | Lead Solution Architect | ยืนยัน UUID, scoped slugs, display order, typed report targets และ support/media naming |
