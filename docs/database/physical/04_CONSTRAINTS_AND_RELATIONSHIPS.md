# Constraints and Relationships

## Purpose

กำหนด physical keys, referential actions, uniqueness, row checks และ cross-table invariants โดยไม่เขียน SQL

## Constraint Summary

| Kind | Count / mechanism |
|---|---:|
| Primary keys | 34 |
| Foreign keys | 116 (57 domain FKs + 59 audit FKs) |
| Unique business rules | 28 |
| Row-level CHECK constraints | 33 |
| Cross-table deferred validations | 11 |

## Primary Keys

ทุก PK ใช้ UUID:

| Pattern | Tables |
|---|---|
| `id` UUID PK | `users`, `social_identities`, `user_profiles`, `legal_documents`, `user_legal_acceptances`, `membership_entitlements`, `creator_support_profiles`, `creator_support_methods`, `categories`, `tags`, `story_tags`, `stories`, `chapters`, `novel_contents`, `comic_pages`, `media_assets`, `story_follows`, `chapter_likes`, `reading_progress`, `comments`, `reports`, `moderation_actions`, `moderation_evidence`, `warning_emails`, `warning_email_evidence`, `creator_strikes`, `creator_publishing_suspensions`, `advertisements` |
| `report_id` shared UUID PK/FK | `report_user_targets`, `report_story_targets`, `report_chapter_targets`, `report_comment_targets` |
| `advertisement_id` shared UUID PK/FK | `standard_advertisements`, `premium_popup_advertisements` |

UUIDs เป็น internal identity และห้ามใช้ใน public URLs

## Foreign Keys and Delete Policies

### Standard policies

| FK class | ON DELETE | ON UPDATE | Why |
|---|---|---|---|
| Audit `created_by`, `updated_by`, `deleted_by` | SET NULL | NO ACTION | รักษาระเบียนแม้ actor ถูก hard-deleteภายหลัง |
| Aggregate owner เช่น Story→User | RESTRICT | NO ACTION | owner/content ใช้ soft delete; ป้องกันสูญเสีย aggregate |
| Composition shared PK เช่น NovelContent→Chapter | CASCADE | NO ACTION | child ไม่มี lifecycle อิสระ; hard deleteเกิดหลัง retention approvalเท่านั้น |
| Interaction target เช่น Follow→Story | CASCADE เมื่อ hard-delete target ได้รับอนุมัติ | NO ACTION | relationship ไม่มีคุณค่าหลัง principal ถูกลบจริง |
| Moderation target | RESTRICT | NO ACTION | ห้ามทำลาย evidence/report history |
| Optional MediaAsset reference | SET NULL สำหรับ profile/story/support/evidence; RESTRICT สำหรับ ComicPage/Advertisement ที่ต้องมีภาพ | NO ACTION | รักษา owner content โดยไม่ชี้ object ที่หาย |

UUID PK ไม่ถูก update ดังนั้นทุก FK ใช้ ON UPDATE NO ACTION

### Domain FK catalog — 57

| From → To | Count | Delete policy / ownership |
|---|---:|---|
| `social_identities.user_id` → users | 1 | CASCADE หลัง approved User hard delete; User-owned |
| `user_profiles.user_id` → users; avatar → media_assets | 2 | User RESTRICT; avatar SET NULL |
| legal acceptances → users/legal documents | 2 | RESTRICT; immutable acceptance fact |
| `membership_entitlements.user_id` → users | 1 | RESTRICT; entitlement history |
| support profile → user_profiles | 1 | RESTRICT; profile-owned soft delete |
| support method → support profile; QR media; public consent acceptance | 3 | profile RESTRICT; media SET NULL; acceptance RESTRICT |
| `story_tags` → stories/tags | 2 | CASCADE after hard delete; Story relationship |
| stories → creator users/category/media | 3 | creator/category RESTRICT; cover SET NULL |
| chapters → stories | 1 | RESTRICT; Story composition soft-deleted first |
| novel contents → chapters | 1 | CASCADE |
| comic pages → chapters/media | 2 | Chapter CASCADE; media RESTRICT |
| media assets → owner users | 1 | RESTRICT |
| follows → users/stories | 2 | CASCADE after principal hard delete |
| likes → users/chapters | 2 | CASCADE after principal hard delete |
| progress → users/stories/latest chapters | 3 | User/Story CASCADE after hard delete; Chapter RESTRICT/repair first |
| comments → chapters/author users | 2 | Chapter/User RESTRICTเพื่อ moderation context |
| reports → reporter users | 1 | RESTRICT |
| four typed targets → report and target | 8 | report CASCADE to typed child; target RESTRICT |
| actions → report/actor admin | 2 | both RESTRICT |
| evidence → action/warning email/media | 3 | action CASCADE only after retention; warning SET NULL; media RESTRICT |
| warning emails → action/recipient | 2 | RESTRICT |
| warning email evidence → warning/evidence | 2 | CASCADE with warning relation; evidence RESTRICT |
| strikes → creator/action/warning/reversing admin | 4 | RESTRICT; reversing admin SET NULL only on approved hard delete |
| publishing suspensions → creator/source strike/lifting admin | 3 | creator/strike RESTRICT; lifting admin SET NULL after approved hard delete |
| advertisements → media | 1 | RESTRICT |
| subtype → advertisements | 2 | CASCADE |
| **Total** | **57** |  |

### Audit FKs — 59

- 12 soft-delete tables × `created_by`, `updated_by`, `deleted_by` = 36
- 8 mutable-audit tables × `created_by`, `updated_by` = 16
- `story_tags.created_by`, `moderation_evidence.created_by`, `warning_email_evidence.created_by` = 3
- `legal_documents` และ `creator_publishing_suspensions` เพิ่ม created/updated actorรวม 4
- ทั้งหมดอ้าง `users.id`, nullable, ON DELETE SET NULL, ON UPDATE NO ACTION

## Unique Rules — 28

| # | Proposed rule | Scope / soft-delete behavior |
|---:|---|---|
| 1 | social provider + provider subject | global, all rows |
| 2 | social user + provider | หนึ่ง identity ต่อ provider ต่อ Userใน MVP |
| 3 | user profile user ID | one profile per User |
| 4 | creator slug | global รวม soft-deleted rows |
| 5 | support profile user profile ID | one support profile |
| 6 | support method profile + display order | partial: active and not deleted |
| 7–8 | category normalized name; category slug | global รวม deletedเพื่อกัน reuse |
| 9–10 | tag normalized name; tag slug | global รวม deleted |
| 11 | story + tag pair | one assignment |
| 12 | creator user + story slug | รวม soft-deleted rows |
| 13 | story + chapter slug | รวม soft-deleted rows |
| 14 | story + chapter display order | partial: not deleted; จำเป็นต่อ reorder transaction |
| 15 | NovelContent chapter | one content row per Chapter |
| 16 | ComicPage chapter + display order | partial: not deleted |
| 17 | media storage provider + bucket + object key | one metadata row per object |
| 18 | Follow user + story | one active row; unfollow hard-delete |
| 19 | Like user + chapter | one active row; unlike hard-delete |
| 20 | ReadingProgress user + story | one current row |
| 21 | WarningEmail provider reference | unique when non-null |
| 22 | CreatorStrike moderation action | one strike per qualifying action |
| 23 | CreatorStrike warning email | one strike per sent warning |
| 24 | one active Premium Popup | unique partial rule for `status=ACTIVE`, nondeleted PREMIUM_POPUP; scheduled future rowsต้องยังไม่เป็น ACTIVE |
| 25 | warning email + moderation evidence pair | evidenceหนึ่งไม่ซ้ำใน warning attempt เดียว |
| 26 | legal document type + version | versionหนึ่งต่อ document type |
| 27 | user + legal document | acceptanceหนึ่งต่อ User ต่อ exact version |
| 28 | publishing suspension source strike | third strikeหนึ่งสร้าง suspensionได้หนึ่งรายการ |

Soft-deleted public slugsไม่ถูกนำกลับมาใช้ใน MVP เพราะ slug history/redirect เป็น Future

## Row-level CHECK Constraints — 33

| # | Name | Rule |
|---:|---|---|
| 1 | `ck_membership_entitlements_valid_window` | `ends_at` null หรือหลัง `starts_at` |
| 2 | `ck_support_methods_payload_by_type` | BANK/PROMPTPAY ต้องมี encrypted+masked; QR ต้องมี QR asset; EXTERNAL_LINK ต้องมี URL และ field อื่นว่างตามชนิด |
| 3 | `ck_support_methods_display_order_positive` | > 0 |
| 4 | `ck_categories_display_order_nonnegative` | >= 0 |
| 5 | `ck_tags_display_order_nonnegative` | >= 0 |
| 6 | `ck_user_profiles_creator_slug_nonblank` | trimmed slug nonblank |
| 7 | `ck_stories_slug_nonblank` | trimmed slug nonblank |
| 8 | `ck_chapters_slug_nonblank` | trimmed slug nonblank |
| 9 | `ck_chapters_display_order_positive` | > 0 |
| 10 | `ck_novel_contents_document_object` | JSONB top levelเป็น object |
| 11 | `ck_novel_contents_schema_version_positive` | > 0 |
| 12 | `ck_comic_pages_display_order_positive` | > 0 |
| 13 | `ck_media_assets_size_nonnegative` | size >= 0 |
| 14 | `ck_media_assets_dimensions_positive` | width/height null หรือ > 0 |
| 15 | `ck_reading_progress_position_object` | null หรือ JSONB object |
| 16 | `ck_comments_body_nonblank` | trimmed body nonblank |
| 17 | `ck_moderation_actions_reason_nonblank` | trimmed reason nonblank |
| 18 | `ck_moderation_evidence_has_payload` | อย่างน้อยหนึ่งใน media/reference/note; ต้องสอดคล้อง evidence type |
| 19 | `ck_warning_emails_status_timestamps` | SENT ต้องมี sent_at; FAILED ต้องมี failed_at/reason; mutually coherent |
| 20 | `ck_creator_strikes_reversal_fields` | REVERSED ต้องมี reversed_at/by/reason; สถานะอื่นต้องสอดคล้อง |
| 21 | `ck_advertisements_valid_window` | ends null หรือหลัง starts |
| 22 | `ck_advertisements_target_url_nonblank` | trimmed URL nonblank; HTTPS allowlistเพิ่มที่ application/security layer |
| 23 | `ck_premium_popup_close_delay` | เท่ากับ 5 สำหรับ MVP |
| 24 | `ck_standard_advertisements_sort_order_nonnegative` | >= 0 |
| 25 | `ck_legal_documents_identity_fields` | version/title/URI/hash nonblank, effective_atไม่ก่อน published_at |
| 26 | `ck_support_methods_public_confirmation` | is_publicต้อง activeและมี consent acceptance + public_confirmed_at |
| 27 | `ck_stories_deleted_state_fields` | DELETEDต้องมี deleted fieldsและ prior owner state; stateอื่นต้องสอดคล้อง |
| 28 | `ck_chapters_deleted_state_fields` | เหมือน Story; prior owner stateสำหรับ restoreห้ามใช้ข้าม HIDDEN gate |
| 29 | `ck_warning_emails_rule_reference_nonblank` | qualifying warningต้องมี subject/reason/rule reference nonblank |
| 30 | `ck_creator_strikes_sequence_positive` | sequence_number > 0 |
| 31 | `ck_publishing_suspensions_exact_window` | ends_at = starts_at + exactly 7 days |
| 32 | `ck_publishing_suspensions_lift_fields` | LIFTEDต้องมี lifted_at/by; status/timestamps coherent |
| 33 | `ck_media_assets_cloudflare_r2` | storage_provider=`CLOUDFLARE_R2`, bucket/object key nonblank |

Enum membership checksมาจาก PostgreSQL enum types จึงไม่รวมใน 33 row CHECKs ส่วน `reason_code`/entitlement `source` ต้องเพิ่ม CHECK หลัง vocabulary approval

## Cross-table Deferred Validations — 11

PostgreSQL simple FK/CHECK ไม่สามารถอ่าน table อื่นได้อย่างปลอดภัย จึงใช้ transaction service พร้อม **deferred constraint trigger** หรือ equivalent database-enforced validation ก่อน commit:

1. **Exactly one report target:** แต่ละ `reports.id` ต้องปรากฏใน typed target tableหนึ่งและเพียงหนึ่ง table
2. **Story type/content compatibility:** Chapter ของ NOVEL มีได้เฉพาะ NovelContentและไม่มี ComicPage; COMIC ตรงกันข้าม Published Chapter ต้องมี contentที่ถูกต้อง
3. **Reading progress ownership:** `latest_chapter_id` ต้องอยู่ใต้ `story_id` เดียวกัน
4. **Admin actor:** `moderation_actions.actor_admin_user_id` และ `creator_strikes.reversed_by` ต้องเป็น active Admin ณ action time
5. **Strike qualification:** Report ต้องได้รับการยืนยันว่าถูกต้อง, ModerationAction ต้องยืนยันการละเมิดและซ่อน Story/Chapter ที่ได้รับผลกระทบ, WarningEmail ต้องมีเหตุผล อ้างอิงกฎ และสถานะ `SENT` (แนบหลักฐานได้); warning/action/creator/target ownership ต้องสอดคล้อง และ `counted_at >= sent_at`
6. **Evidence/email consistency:** evidence ที่อ้าง warning emailต้องอยู่ใต้ ModerationActionเดียวกัน
7. **Advertisement subtype:** base rowต้องมี subtypeตรง typeเพียงหนึ่ง; Premium activeสูงสุดหนึ่งและ active windowต้องไม่ขัดกัน
8. **Account activation acceptance:** ก่อนตั้ง User เป็น `ACTIVE` ต้องมี acceptance ของ Terms of Service และ Privacy Notice เวอร์ชันที่มีผล ณ เวลานั้นจากการเข้าสู่ระบบสำเร็จครั้งแรก
9. **First-publication acceptance:** ก่อนเผยแพร่ Story/Chapter ครั้งแรก ต้องมี acceptance ของ Creator Guidelines และ Moderation Rules เวอร์ชันที่มีผล
10. **Public support consent:** SupportMethod ที่ `is_public=true` ต้อง active, มี acceptance ประเภท `SUPPORT_PUBLIC_DISPLAY_CONSENT` ของเจ้าของเดียวกัน และมี `public_confirmed_at`; acceptance นี้ครอบคลุมการยืนยันสิทธิ์ในข้อมูล ตำแหน่งที่แสดง และความยินยอมเปิดเผย
11. **Third-strike suspension:** qualifying strike ลำดับที่ 3 ต้องสร้าง publishing suspension หนึ่งรายการที่อ้าง strike นั้น มีช่วงเวลา 7 วันพอดี และห้ามเปลี่ยน User account status หรือซ่อนผลงานอื่นโดยอัตโนมัติ

การใช้ application-only validationโดยไม่มี database guardไม่ผ่าน approval gate

## State and Content Integrity

- Story/Chapter ใช้สถานะ `DRAFT`, `PUBLISHED`, `HIDDEN`, `ARCHIVED`, `DELETED`; `DELETED` ต้องสอดคล้องกับ soft-delete fields และเก็บสถานะก่อนลบเพื่อรองรับการ restore ที่ปลอดภัย
- Creator ทำได้เฉพาะ `DRAFT -> PUBLISHED`, `PUBLISHED -> ARCHIVED`, `ARCHIVED -> PUBLISHED` และ owner-controlled editable state `-> DELETED`; Admin เท่านั้นที่ทำ `PUBLISHED -> HIDDEN` และ `HIDDEN -> PUBLISHED` หลัง review
- Creator แก้ไขเนื้อหา `HIDDEN` ได้ แต่ไม่มีสิทธิ์เปลี่ยนกลับเป็น `PUBLISHED`; การ restore เนื้อหาต้องเป็น ModerationAction ใหม่ของ Admin และไม่เกิดอัตโนมัติเมื่อ publishing suspension หมดอายุ
- Published Chapter ต้องมี `published_at`; exact first/current publication semantics Pending
- Chapter `display_number` ไม่อยู่ใน unique/identity constraint
- Creator อาจ fix content หลัง warning; Admin restorationสร้าง ModerationAction ใหม่ ไม่แก้ action เดิม
- Comment ไม่มี `parent_comment_id` หรือ comment-like relationship
- Entitlement eligibility = status ACTIVE และ `starts_at <= now < ends_at` (หรือ ends null); expired recordไม่ถูกลบและไม่สร้าง boolean cacheเป็น truth

## Pending Product Owner Decisions

- ⚠ Pending Product Owner Decision: normalized slug/name expression และ reserved-word policy
- ⚠ Pending Product Owner Decision: User hard-delete/cascade retention
- ⚠ Pending Product Owner Decision: exact report reasons และ strike expiry/reversal/appeal lifecycle
- ⚠ Pending Product Owner Decision: Premium scheduling overlap policy beyond one active item
- ⚠ Pending Product Owner Decision: whether a User may link more than one identity from same provider; current MVP rule says one

## Related Documents

- [Column Dictionary](03_COLUMN_DICTIONARY.md)
- [Enums and Statuses](05_ENUM_AND_STATUS_CATALOG.md)
- [Index Plan](06_PHYSICAL_INDEX_PLAN.md)
- [Conceptual ER](../02_ENTITY_RELATIONSHIP.md)

## Revision History

| Version | Date | Author | Change |
|---|---|---|---|
| 1.1 | 2026-07-19 | Lead PostgreSQL Database Architect | Added legal acceptance, public support consent, confirmed publication transitions, strike qualification and seven-day publishing suspension constraints |
| 1.0 | 2026-07-19 | Lead PostgreSQL Database Architect | Defined physical keys, FKs, uniqueness and invariants |
