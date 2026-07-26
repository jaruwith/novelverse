# Physical Table Catalog

## Purpose

นิยามขอบเขต หน้าที่ ownership และ workload ของ physical PostgreSQL tables ทั้ง 34 ตาราง โดยรายละเอียดทุก column อยู่ใน [Column Dictionary](03_COLUMN_DICTIONARY.md)

## Growth Scale

`Low` = configuration/หนึ่งต่อผู้ใช้, `Medium` = content/master, `High` = interaction/moderation events, `Very High` = media/pages ที่อาจโตตาม content ไม่มีตารางใดใช้ partitioning ใน MVP

## Identity and Membership

| Table | Purpose / PK / Major FKs | Ownership & delete | Growth | Writes / Reads | Rule traceability | Status |
|---|---|---|---|---|---|---|
| `users` | Principal account; UUID `id`; self audit FKs | Account aggregate; soft deleteตาม privacy policy | Medium | create social account, suspend/restore / authorization, owner lookup | MBR-001, MBR-006–007 | MVP; retention Pending |
| `social_identities` | Google/Facebook login identity; UUID `id`; FK `user_id` | User-owned; unlink hard/retain policy Pending | Medium | link/unlink/login timestamp / provider+subject lookup | MBR-011–012 | MVP |
| `user_profiles` | Combined Member/Creator public profile; UUID `id`; FK user/avatar | User-owned; creator delete soft | Medium | edit profile/slug / public creator lookup | MBR-006, CR-001–002, CR-013 | MVP |
| `legal_documents` | Versioned Terms, Privacy, Creator Guidelines, Moderation Rules และ Support Public Display Consent; UUID `id` | Legal/Admin-owned immutable published version; no soft delete | Low | publish version / resolve current required version | MBR-013–015, CR-018–019 | MVP |
| `user_legal_acceptances` | Immutable User acceptance of exact document version/source/time; UUID `id`; FKs user/document | User legal record; no soft delete | Medium | accept once / activation/publication/support gate | MBR-013–015, CR-018–019 | MVP |
| `membership_entitlements` | Time-bound ad-free source of truth; UUID `id`; FK user | User-owned history; expiry/revokeไม่ลบ | Medium | grant/expire/revoke / current entitlement lookup | MBR-008–009, MON-004 | MVP; lifecycle details Pending |

## Creator Support

| Table | Purpose / PK / Major FKs | Ownership & delete | Growth | Writes / Reads | Rule traceability | Status |
|---|---|---|---|---|---|---|
| `creator_support_profiles` | Support message/config; UUID `id`; FK user profile | Creator-owned; soft delete/restore | Low | enable/edit / profile and chapter-end display | CR-017, MON-008–009 | MVP |
| `creator_support_methods` | Encrypted bank/PromptPay, R2 QR หรือ external link; UUID `id`; FKs support profile/media/legal acceptance | Creator-owned; soft delete; public display opt-in | Low–Medium | confirm ownership+consent, enable/reorder/disable / active public display, masked Admin read | CR-017–019, MON-008–011 | MVP; encryption required |

## Taxonomy

| Table | Purpose / PK / Major FKs | Ownership & delete | Growth | Writes / Reads | Rule traceability | Status |
|---|---|---|---|---|---|---|
| `categories` | Primary category master; UUID `id` | Admin-owned; soft delete/disable | Low | admin CRUD/order / browse/filter | CR-005, MOD-011 | MVP |
| `tags` | Reusable tag master; UUID `id` | Admin-owned; soft delete/disable | Low | admin CRUD/order / tag browse/filter | CR-005, MOD-011 | MVP |
| `story_tags` | Story–Tag relationship; UUID `id`; FKs story/tag | Story-owned relationship; hard delete on untag | Medium | attach/detach / list by story or tag | CR-005 | MVP |

## Story, Chapter and Media

| Table | Purpose / PK / Major FKs | Ownership & delete | Growth | Writes / Reads | Rule traceability | Status |
|---|---|---|---|---|---|---|
| `stories` | Novel/Comic aggregate root; UUID `id`; FKs creator/category/cover | Creator-owned; edit/archive/soft-delete/restore | Medium | create/edit/publish/archive / public URL, discovery, dashboard | CR-003–008, CR-010, CR-013, CR-015 | MVP |
| `chapters` | Stable chapter identity/order; UUID `id`; FK story | Story composition; soft-delete/restore; reorder | High | create/edit/publish/reorder / slug lookup, ordered list | CR-009–010, CR-014–015, RD-008–009 | MVP |
| `novel_contents` | Structured rich document; UUID `id`; unique FK chapter | Novel Chapter-owned; no independent delete | High | replace/update document / render novel | CR-009 | MVP; JSON schema Pending |
| `comic_pages` | Ordered Comic pages; UUID `id`; FKs chapter/media | Comic Chapter-owned; soft delete/reorder | Very High | upload link/reorder/delete / vertical render | CR-009, CR-014, CR-016 | MVP |
| `media_assets` | External object metadata; UUID `id`; FK owner user | Media aggregate; soft delete then object cleanup | Very High | register/process/delete / resolve image/object | CR-004, CR-016 | MVP; provider/retention Pending |

## Reading and Community

| Table | Purpose / PK / Major FKs | Ownership & delete | Growth | Writes / Reads | Rule traceability | Status |
|---|---|---|---|---|---|---|
| `story_follows` | User follows Story; UUID `id`; FKs user/story | User relationship; hard delete on unfollow | High | follow/unfollow / Following page, counts | RD-004, RD-007 | MVP |
| `chapter_likes` | User likes Chapter; UUID `id`; FKs user/chapter | User relationship; hard delete on unlike | High | like/unlike / state and counts | RD-004–005, RD-007 | MVP |
| `reading_progress` | Latest chapter per User/Story; UUID `id`; FKs user/story/chapter | User-owned current projection; hard delete/retention Pending | High | upsert progress / History and resume | RD-010 | MVP; retention Pending |
| `comments` | Flat chapter comments; UUID `id`; FKs chapter/author | Author/community; soft delete/hide/restore | High | create/hide/restore / chapter and dashboard list | RD-006–007, CR-011, MOD-004/010 | MVP |

## Moderation

| Table | Purpose / PK / Major FKs | Ownership & delete | Growth | Writes / Reads | Rule traceability | Status |
|---|---|---|---|---|---|---|
| `reports` | Moderation intake, not a strike; UUID `id`; FK reporter | Moderation aggregate; retain, no routine hard delete | High | submit/review/resolve/reject / queue | MOD-005–007, MOD-013 | MVP |
| `report_user_targets` | Typed User target; shared UUID PK/FK `report_id`, FK target user | Report composition; cascade with report only | Medium | create once / target history | MOD-005, MOD-013 | MVP |
| `report_story_targets` | Typed Story target; shared UUID PK/FK | Report composition | Medium | create once / target history | MOD-005, MOD-007 | MVP |
| `report_chapter_targets` | Typed Chapter target; shared UUID PK/FK | Report composition | Medium | create once / target history | MOD-005, MOD-007 | MVP |
| `report_comment_targets` | Typed Comment target; shared UUID PK/FK | Report composition | Medium | create once / target history | MOD-005 | MVP |
| `moderation_actions` | Admin decision/audit/result state; UUID `id`; FKs report/admin | Append-oriented moderation record; retain | High | confirm/reject/hide/restore / audit timeline | MOD-003–004, MOD-014–015 | MVP |
| `moderation_evidence` | Evidence/attachment/reference; UUID `id`; FKs action/email/media | Action composition; retain with audit | High | attach/note/link to warning / review evidence | MOD-015 | MVP; retention Pending |
| `warning_emails` | Delivery audit for warning; UUID `id`; FKs action/recipient | Action composition; immutable delivery facts | Medium | queue/send/fail/retry / qualification/audit | MOD-014–020 | MVP; email provider Pending |
| `warning_email_evidence` | Attach evidence to one or more warning attempts; UUID `id`; FKs email/evidence | Warning composition; immutable junction | Medium | attach/detach before send / render sent evidence manifest | MOD-014–015 | MVP; required because warning may include attachments/evidence |
| `creator_strikes` | Qualified content-policy strike; UUID `id`; FKs creator/action/sent warning | Creator moderation history; never routine delete | Medium | count/reverse/expire / strike history | MOD-013–020 | MVP; expiry/reversal/appeal Pending |
| `creator_publishing_suspensions` | 7-day publishing-only suspension triggered by third active qualifying strike; UUID `id`; FKs user/strike/lifting Admin | Separate privilege record; no account suspension/content restore | Medium | create/expire/lift / publication authorization audit | MOD-016–020 | MVP; appeal/reversal Pending |

## Advertisement

| Table | Purpose / PK / Major FKs | Ownership & delete | Growth | Writes / Reads | Rule traceability | Status |
|---|---|---|---|---|---|---|
| `advertisements` | Common advertiser/content/active window; UUID `id`; FK image media | Admin-owned aggregate; soft delete | Low–Medium | configure/activate/deactivate / active type lookup | AD-001, AD-006, AD-010–013 | MVP |
| `standard_advertisements` | STANDARD subtype/order; shared UUID PK/FK | Advertisement composition; cascade with base | Low–Medium | configure sort order / active vertical stack | AD-002–008 | MVP |
| `premium_popup_advertisements` | PREMIUM_POPUP subtype/close delay; shared UUID PK/FK | Advertisement composition; cascade with base | Low | configure / at-most-one active lookup | AD-010–017 | MVP |

## Explicitly Excluded Tables

| Concept | Reason |
|---|---|
| `creators`, `admins`, `guests` | Creator/Admin are User capability/role; Guest is anonymous |
| local credentials/passwords | MVP social login only |
| donation transactions/payouts | Money goes directly to Creator; NovelVerse does not process it |
| coins, notifications, slug history, creator subscriptions | Future only |
| campaigns/ad billing/metrics | Not confirmed; no speculative persistence |
| search documents/analytics events | Search/analytics implementation details Pending |

## Related Documents

- [Overview](01_PHYSICAL_SCHEMA_OVERVIEW.md)
- [Column Dictionary](03_COLUMN_DICTIONARY.md)
- [Constraints](04_CONSTRAINTS_AND_RELATIONSHIPS.md)
- [Business Rule Index](../../business/BUSINESS_RULE_INDEX.md)

## Revision History

| Version | Date | Author | Change |
|---|---|---|---|
| 1.1 | 2026-07-19 | Lead PostgreSQL Database Architect | Expanded catalog to 34 tables for legal acceptance and publishing suspension |
| 1.0 | 2026-07-19 | Lead PostgreSQL Database Architect | Initial 31-table physical catalog |
