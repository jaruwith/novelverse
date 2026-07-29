# Physical Index Plan

## Purpose

กำหนด exact planned PostgreSQL indexes สำหรับ public lookup, reader, creator, moderation, entitlement และ advertisement โดยไม่เขียน SQL

## Summary

| Class | Count | Status |
|---|---:|---|
| Primary-key indexes | 34 | MVP |
| Unique business indexes/constraint-backed indexes | 28 | MVP |
| Non-unique operational indexes | 31 | MVP |
| Thai search candidate indexes | 2 | Future/Pending |
| **Total** | **95** | 93 MVP + 2 Future |

`INCLUDE` และ predicates ด้านล่างเป็น design plan; ต้องยืนยันด้วย query plans/data distribution ก่อน migration หลีกเลี่ยงการสร้าง single-column FK index เมื่อ composite indexมี FK เป็น leading columnอยู่แล้ว

## Primary-key Indexes — 34

ทุก index เป็น Unique B-tree, ไม่มี predicate/INCLUDE และ write cost ต่ำ–ปานกลางที่จำเป็นต่อ identity/FK lookup

| Index name | Table | Columns | Query pattern |
|---|---|---|---|
| `pk_users` | users | `id` | principal/user FK lookup |
| `pk_social_identities` | social_identities | `id` | identity maintenance |
| `pk_user_profiles` | user_profiles | `id` | profile/support FK lookup |
| `pk_legal_documents` | legal_documents | `id` | accepted document/version lookup |
| `pk_user_legal_acceptances` | user_legal_acceptances | `id` | immutable acceptance audit |
| `pk_membership_entitlements` | membership_entitlements | `id` | entitlement audit lookup |
| `pk_creator_support_profiles` | creator_support_profiles | `id` | support aggregate |
| `pk_creator_support_methods` | creator_support_methods | `id` | method edit |
| `pk_categories` | categories | `id` | category FK |
| `pk_tags` | tags | `id` | tag FK |
| `pk_story_tags` | story_tags | `id` | relationship maintenance |
| `pk_stories` | stories | `id` | Story aggregate/FKs |
| `pk_chapters` | chapters | `id` | Chapter/FKs |
| `pk_novel_contents` | novel_contents | `id` | content edit |
| `pk_comic_pages` | comic_pages | `id` | page edit |
| `pk_media_assets` | media_assets | `id` | media references |
| `pk_story_follows` | story_follows | `id` | relationship event |
| `pk_chapter_likes` | chapter_likes | `id` | relationship event |
| `pk_reading_progress` | reading_progress | `id` | progress update |
| `pk_comments` | comments | `id` | comment moderation |
| `pk_reports` | reports | `id` | report aggregate |
| `pk_report_user_targets` | report_user_targets | `report_id` | target existence/FK |
| `pk_report_story_targets` | report_story_targets | `report_id` | target existence/FK |
| `pk_report_chapter_targets` | report_chapter_targets | `report_id` | target existence/FK |
| `pk_report_comment_targets` | report_comment_targets | `report_id` | target existence/FK |
| `pk_moderation_actions` | moderation_actions | `id` | action/evidence lookup |
| `pk_moderation_evidence` | moderation_evidence | `id` | evidence lookup |
| `pk_warning_emails` | warning_emails | `id` | delivery/strike FK |
| `pk_warning_email_evidence` | warning_email_evidence | `id` | warning attachment relationship |
| `pk_creator_strikes` | creator_strikes | `id` | strike audit |
| `pk_creator_publishing_suspensions` | creator_publishing_suspensions | `id` | publishing privilege audit |
| `pk_advertisements` | advertisements | `id` | base configuration |
| `pk_standard_advertisements` | standard_advertisements | `advertisement_id` | STANDARD subtype join |
| `pk_premium_popup_advertisements` | premium_popup_advertisements | `advertisement_id` | PREMIUM subtype join |
Catalog มี 34 table names และแต่ละ tableมี primary-key indexหนึ่งรายการ

## Unique Business Indexes — 28

| Index | Table | Columns/order | Predicate | Query / reason | Write cost | Status |
|---|---|---|---|---|---|---|
| `uq_social_identities__provider_subject` | social_identities | `provider, provider_subject` | none | social login lookup; global identity safety | Medium on login/link | MVP |
| `uq_social_identities__user_provider` | social_identities | `user_id, provider` | none | one provider identity per User | Medium | MVP |
| `uq_user_profiles__user` | user_profiles | `user_id` | none | one profile | Low | MVP |
| `uq_user_profiles__creator_slug` | user_profiles | normalized `creator_slug` | none, includes deleted | public creator lookup | Medium on slug edit | MVP |
| `uq_legal_documents__type_version` | legal_documents | `document_type, version` | none | identify exact accepted legal text | Low | MVP |
| `uq_user_legal_acceptances__user_document` | user_legal_acceptances | `user_id, legal_document_id` | none | one immutable acceptance per User/document version | Low | MVP |
| `uq_creator_support_profiles__profile` | creator_support_profiles | `user_profile_id` | none | one support profile | Low | MVP |
| `uq_creator_support_methods__active_order` | creator_support_methods | `creator_support_profile_id, display_order` | `deleted_at IS NULL AND is_active AND is_public` | deterministic publicly displayed methods | Medium on reorder | MVP |
| `uq_categories__normalized_name` | categories | normalized `name` | none | prevent duplicate taxonomy | Low | MVP; normalization Pending |
| `uq_categories__slug` | categories | normalized `slug` | none | category lookup | Low | MVP |
| `uq_tags__normalized_name` | tags | normalized `name` | none | prevent duplicates | Low | MVP; normalization Pending |
| `uq_tags__slug` | tags | normalized `slug` | none | tag lookup | Low | MVP |
| `uq_story_tags__story_tag` | story_tags | `story_id, tag_id` | none | no duplicate assignment | Medium | MVP |
| `uq_stories__creator_slug` | stories | `creator_user_id, normalized slug` | none, includes deleted | `/@creator/story` identity | Medium | MVP |
| `uq_chapters__story_slug` | chapters | `story_id, normalized slug` | none, includes deleted | public Chapter lookup | Medium | MVP |
| `uq_chapters__story_display_order` | chapters | `story_id, display_order` | `deleted_at IS NULL` | safe Creator reorder | High during reorder | MVP |
| `uq_novel_contents__chapter` | novel_contents | `chapter_id` | none | one rich document | Low | MVP |
| `uq_comic_pages__chapter_display_order` | comic_pages | `chapter_id, display_order` | `deleted_at IS NULL` | ordered Comic pages | High during reorder | MVP |
| `uq_media_assets__object` | media_assets | `storage_provider, bucket_name, object_key` | none | one row per object | Medium on upload | MVP |
| `uq_story_follows__user_story` | story_follows | `user_id, story_id` | none | one active follow | High interaction write | MVP |
| `uq_chapter_likes__user_chapter` | chapter_likes | `user_id, chapter_id` | none | one active like | High | MVP |
| `uq_reading_progress__user_story` | reading_progress | `user_id, story_id` | none | one current position | High upsert | MVP |
| `uq_warning_emails__provider_reference` | warning_emails | `provider_reference` | non-null only | email idempotency/audit | Low | MVP |
| `uq_creator_strikes__action` | creator_strikes | `moderation_action_id` | none | no double strike per action | Low | MVP |
| `uq_creator_strikes__warning_email` | creator_strikes | `warning_email_id` | none | no double use of warning | Low | MVP |
| `uq_creator_publishing_suspensions__source_strike` | creator_publishing_suspensions | `source_strike_id` | none | third qualifying strike creates at most one suspension | Low | MVP |
| `uq_advertisements__single_active_premium` | advertisements | `advertisement_type` | nondeleted, `status=ACTIVE`, type PREMIUM_POPUP | at most one active popup | Low | MVP |
| `uq_warning_email_evidence__pair` | warning_email_evidence | `warning_email_id, moderation_evidence_id` | none | no duplicate attachment | Medium | MVP |

Time-dependent `now()` ไม่ใช้ใน partial predicatesเพราะไม่ immutable Scheduled Premium rowsต้องเป็น DRAFT/INACTIVEจน activation transaction

## Non-unique MVP Indexes — 31

| Index | Table | Columns/order | Predicate / INCLUDE | Query supported | Write cost |
|---|---|---|---|---|---|
| `ix_membership_entitlements__current_user` | membership_entitlements | `user_id, status, starts_at DESC, ends_at` | status ACTIVE | ad eligibility/current entitlement | Medium |
| `ix_legal_documents__current_type` | legal_documents | `document_type, effective_at DESC, id` | `is_active`; INCLUDE version,content_sha256 | current document/version presented for acceptance | Low |
| `ix_user_legal_acceptances__user_time` | user_legal_acceptances | `user_id, accepted_at DESC, id` | INCLUDE legal_document_id,acceptance_source | activation/publication/support consent audit | Low |
| `ix_categories__active_order` | categories | `display_order, id` | active, not deleted; INCLUDE name,slug | category browse | Low |
| `ix_tags__active_order` | tags | `display_order, id` | active, not deleted; INCLUDE name,slug | tag browse | Low |
| `ix_story_tags__tag_story` | story_tags | `tag_id, story_id` | none | stories by tag | Medium |
| `ix_stories__public_category` | stories | `category_id, first_published_at DESC, id` | PUBLISHED, not deleted; INCLUDE title,slug,creator_user_id | category/discovery | Medium |
| `ix_stories__creator_manage` | stories | `creator_user_id, publication_status, updated_at DESC, id` | not deleted | My Stories | Medium |
| `ix_chapters__story_public_order` | chapters | `story_id, display_order, id` | PUBLISHED, not deleted; INCLUDE slug,title,display_number | reader chapter list/navigation | High reorder |
| `ix_media_assets__owner_status` | media_assets | `owner_user_id, status, created_at DESC, id` | not deleted | media management/orphan review | Medium |
| `ix_story_follows__user_created` | story_follows | `user_id, created_at DESC, id` | none; INCLUDE story_id | Following page | High |
| `ix_chapter_likes__chapter_created` | chapter_likes | `chapter_id, created_at DESC, id` | none | like count/reconciliation | High |
| `ix_reading_progress__user_history` | reading_progress | `user_id, last_read_at DESC, id` | none; INCLUDE story_id,latest_chapter_id | History/resume | High updates |
| `ix_comments__chapter_visible_time` | comments | `chapter_id, created_at, id` | visible, not deleted; INCLUDE author_user_id | flat comments | High |
| `ix_comments__author_time` | comments | `author_user_id, created_at DESC, id` | not deleted | author/creator moderation context | Medium |
| `ix_reports__unresolved_queue` | reports | `status, submitted_at, id` | OPEN/REVIEWING | Admin queue | Medium |
| `ix_reports__reporter_time` | reports | `reporter_user_id, submitted_at DESC, id` | none | reporter history/abuse review | Medium |
| `ix_report_user_targets__target` | report_user_targets | `target_user_id, report_id` | none | reports by User target | Medium |
| `ix_report_story_targets__target` | report_story_targets | `target_story_id, report_id` | none | reports by Story | Medium |
| `ix_report_chapter_targets__target` | report_chapter_targets | `target_chapter_id, report_id` | none | reports by Chapter | Medium |
| `ix_report_comment_targets__target` | report_comment_targets | `target_comment_id, report_id` | none | reports by Comment | Medium |
| `ix_moderation_actions__report_time` | moderation_actions | `report_id, acted_at, id` | none | action timeline | Medium |
| `ix_moderation_actions__actor_time` | moderation_actions | `actor_admin_user_id, acted_at DESC, id` | none | Admin audit | Medium |
| `ix_warning_emails__action_status` | warning_emails | `moderation_action_id, status, queued_at, id` | none | warning delivery/qualification | Medium |
| `ix_warning_email_evidence__evidence` | warning_email_evidence | `moderation_evidence_id, warning_email_id` | none | audit which emails included evidence | Medium |
| `ix_creator_strikes__creator_history` | creator_strikes | `creator_user_id, counted_at DESC, id` | none; INCLUDE status | strike history/count | Medium |
| `ix_creator_publishing_suspensions__user_current` | creator_publishing_suspensions | `user_id, ends_at, id` | status ACTIVE; INCLUDE starts_at,source_strike_id | block create/publish while active and expire after seven days | Medium |
| `ix_advertisements__active_standard` | advertisements | `starts_at, ends_at, id` | active, nondeleted, STANDARD; INCLUDE advertiser_name,title,image_media_asset_id,target_url | fetch eligible base ads | Low |
| `ix_standard_advertisements__sort` | standard_advertisements | `sort_order, advertisement_id` | none | final vertical order; ID tie-break | Low |
| `ix_advertisements__active_premium` | advertisements | `starts_at, ends_at, id` | active, nondeleted, PREMIUM_POPUP; INCLUDE content fields | popup lookup | Low |
| `ix_advertisements__admin_status` | advertisements | `status, updated_at DESC, id` | not deleted; INCLUDE type,advertiser_name | Admin configuration list | Low |

## Future Thai Search Indexes — 2

| Index | Table | Columns | Method/predicate | Query | Status |
|---|---|---|---|---|---|
| `ix_stories__search_title_th` | stories | normalized/title search expression | GIN/trigram or Thai text-search expression; Published/nondeleted | Story title search; UI default | ⚠ Pending Product Owner Decision |
| `ix_user_profiles__search_creator_name_th` | user_profiles | normalized display name | GIN/trigram or Thai analyzer; nondeleted | Creator name search | ⚠ Pending Product Owner Decision |

ต้อง benchmark PostgreSQL collation, `pg_trgm` และ Thai tokenizer ก่อนเลือก expression/operator class ห้ามสร้างทั้ง trigramและfull-textซ้ำโดยไม่มี query evidence

## Pagination and Sorting

- ใช้ keyset cursor `(sort_value, id)` กับ discovery, History, comments, reports และ audit timelines
- Chapter/Comic/Support orderingใช้ `(parent_id, display_order, id)`
- Advertisement stackใช้ Standard subtype `(sort_order, advertisement_id)` หลัง filter base active rows
- offset paginationใช้ได้เฉพาะ Admin master listsขนาดเล็กใน MVP

## Soft-delete Filtering

ไม่สร้าง index บน `deleted_at` เดี่ยว ใช้ partial predicates `deleted_at IS NULL` บน public/active workloads Unique public slugsจงใจรวม deleted rowsเพื่อกัน reuse

## Review and Maintenance

- ตรวจ `EXPLAIN`/query statisticsก่อนเพิ่ม INCLUDE หรือ duplicate FK index
- วัด write amplificationของ progress/likes/follows/comments
- ไม่ partition ใน MVP
- review unused indexesหลังมี production workload

## Related Documents

- [Constraints](04_CONSTRAINTS_AND_RELATIONSHIPS.md)
- [Column Dictionary](03_COLUMN_DICTIONARY.md)
- [Architecture Index Strategy](../05_INDEX_STRATEGY.md)
- [Review Checklist](08_SCHEMA_REVIEW_CHECKLIST.md)

## Revision History

| Version | Date | Author | Change |
|---|---|---|---|
| 1.1 | 2026-07-19 | Lead PostgreSQL Database Architect | Expanded to 95 indexes for legal acceptance and publishing suspension; tightened public support lookup |
| 1.0 | 2026-07-19 | Lead PostgreSQL Database Architect | Exact 86-index physical plan |
