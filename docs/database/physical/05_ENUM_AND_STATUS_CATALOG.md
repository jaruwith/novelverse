# Enum and Status Catalog

## Purpose

กำหนด vocabulary ของ type/status fields และเลือก PostgreSQL enum, text+CHECK หรือ controlled text โดยไม่สร้าง workflow ที่ยังไม่ได้อนุมัติ

## Selection Strategy

- ใช้ **PostgreSQL enum** กับชุดค่าขนาดเล็กที่เป็น identity/type หรือสถานะหลักที่ยืนยันแล้วและเปลี่ยนน้อย
- ใช้ **text + CHECK** เมื่อค่ามีแนวโน้มเพิ่มตาม operational policy แต่ชุด MVP ยืนยันพอสมควร
- ใช้ **controlled text — Pending CHECK** เมื่อ Product Owner ยังไม่อนุมัติ allowed values; ต้องปิดก่อน SQL generation
- ไม่สร้าง lookup table เพราะไม่มี metadata/localization/admin-management behavior ที่ยืนยันสำหรับ vocabularies เหล่านี้

## Vocabulary Catalog

| Vocabulary / mechanism | Allowed values | Meaning / transitions | Terminal | Status |
|---|---|---|---|---|
| `user_role` — PG enum | `MEMBER`, `ADMIN` | role assignment governed by Admin/security; Creatorไม่ใช่ role | none | MVP; governance Pending |
| `user_status` — PG enum | `PENDING_LEGAL_ACCEPTANCE`, `ACTIVE`, `SUSPENDED` | first social login creates PENDING; Terms and Privacy acceptance activates account; SUSPENDED concerns account access only and is not Creator publishing suspension | none | MVP |
| `social_provider` — PG enum | `GOOGLE`, `FACEBOOK` | identity provider immutable per row | both are types, not states | MVP |
| `legal_document_type` — PG enum | `TERMS_OF_SERVICE`, `PRIVACY_NOTICE`, `CREATOR_GUIDELINES`, `MODERATION_RULES`, `SUPPORT_PUBLIC_DISPLAY_CONSENT` | immutable document purpose; no marketing-consent category | type | MVP |
| `legal_acceptance_source` — PG enum | `LOGIN`, `FIRST_PUBLICATION`, `SUPPORT_METHOD_ENABLEMENT` | records the confirmed interaction that produced acceptance | type | MVP |
| `membership_entitlement_status` — PG enum | `ACTIVE`, `EXPIRED`, `REVOKED` | ACTIVE→EXPIRED by end time; ACTIVE→REVOKED by authority; reactivation creates new row | EXPIRED/REVOKED | MVP; grace/reversal Pending |
| `membership_entitlement_source` — controlled text | **⚠ Pending Product Owner Decision**; candidate evidence includes manual/promotion/future payment | source immutable; do not encode unapproved values | n/a | Blocking vocabulary |
| `story_type` — PG enum | `NOVEL`, `COMIC` | immutable once content exists | type | MVP |
| `story_publication_status` — PG enum | `DRAFT`, `PUBLISHED`, `HIDDEN`, `ARCHIVED`, `DELETED` | Creator: DRAFT→PUBLISHED, PUBLISHED→ARCHIVED, ARCHIVED→PUBLISHED, editable owner-controlled state→DELETED; Admin: PUBLISHED→HIDDEN and HIDDEN→PUBLISHED after review | DELETED is soft-deleted state | MVP confirmed |
| `story_progress_status` — PG enum | `ONGOING`, `COMPLETED`, `HIATUS`, `CANCELLED` | Creator-declared; transitions not restricted beyond approved UI | none confirmed | MVP |
| `content_rating` — PG enum | `ALL_AGES`, `AGE_13_PLUS`, `AGE_18_PLUS` | suitability self-rating | type | MVP; policy Pending |
| `chapter_publication_status` — PG enum | `DRAFT`, `PUBLISHED`, `HIDDEN`, `ARCHIVED`, `DELETED` | same owner/Admin transition boundaries as Story; Creator may edit HIDDEN but only Admin may restore it | DELETED is soft-deleted state | MVP confirmed |
| `support_method_type` — PG enum | `BANK_ACCOUNT`, `PROMPTPAY`, `QR_IMAGE`, `EXTERNAL_LINK` | immutable type; payload check by type | type | MVP |
| `comment_status` — PG enum | `VISIBLE`, `CREATOR_HIDDEN`, `ADMIN_HIDDEN` | VISIBLE↔CREATOR_HIDDEN by owner; Admin hide/restore creates audit action | none | MVP |
| `report_status` — PG enum | `OPEN`, `REVIEWING`, `RESOLVED`, `REJECTED` | OPEN→REVIEWING→RESOLVED/REJECTED; reopen rule Pending | RESOLVED/REJECTED unless reopen approved | MVP |
| `report_reason_code` — controlled text | **⚠ Pending Product Owner Decision** | reason taxonomy/content policy not approved | n/a | Blocking vocabulary |
| `moderation_action_type` — text+CHECK | `START_REVIEW`, `HIDE_CONTENT`, `RESTORE_CONTENT`, `SUSPEND_USER`, `RESTORE_USER`, `SUSPEND_PUBLISHING`, `EXPIRE_PUBLISHING_SUSPENSION`, `LIFT_PUBLISHING_SUSPENSION`, `CONFIRM_VIOLATION`, `REJECT_REPORT` | append-only actions; account and publishing suspension are distinct; Creator fix does not overwrite Admin action | individual event immutable | MVP; manual lift authority/reason taxonomy Pending |
| `moderation_action_result` — text+CHECK | `NO_STATE_CHANGE`, `CONTENT_HIDDEN`, `CONTENT_RESTORED`, `USER_SUSPENDED`, `USER_RESTORED`, `PUBLISHING_SUSPENDED`, `PUBLISHING_RESTORED`, `VIOLATION_CONFIRMED`, `REPORT_REJECTED` | records resulting state, not a workflow controller; publishing restoration never restores hidden content | event immutable | MVP |
| `moderation_evidence_type` — PG enum | `MEDIA`, `EXTERNAL_REFERENCE`, `TEXT` | determines required payload | type | MVP |
| `warning_email_status` — PG enum | `QUEUED`, `SENT`, `FAILED` | QUEUED→SENT/FAILED; retry may create new email or FAILED→QUEUED — Pending | SENT; FAILED handling Pending | MVP |
| `creator_strike_status` — PG enum | `ACTIVE`, `REVERSED`, `EXPIRED` | ACTIVE is the MVP qualifying state; reversal, expiry and appeal semantics remain Pending and must not weaken the confirmed third-active-strike rule | REVERSED/EXPIRED when future policy is approved | ACTIVE MVP; others Pending |
| `creator_publishing_suspension_status` — PG enum | `ACTIVE`, `EXPIRED`, `LIFTED` | third active qualifying strike creates ACTIVE for exactly 7 days; automatic time evaluation yields EXPIRED; LIFTED is an audited exceptional/manual outcome | EXPIRED/LIFTED | MVP; manual lift authority Pending |
| `advertisement_type` — PG enum | `STANDARD`, `PREMIUM_POPUP` | immutable subtype discriminator | type | MVP |
| `advertisement_status` — PG enum | `DRAFT`, `ACTIVE`, `INACTIVE` | DRAFT→ACTIVE→INACTIVE; INACTIVE→ACTIVE allowed after validation | none | MVP |
| `media_asset_type` — PG enum | `AVATAR`, `STORY_COVER`, `COMIC_PAGE`, `ADVERTISEMENT`, `SUPPORT_QR`, `MODERATION_EVIDENCE`, `OTHER` | immutable purpose classification | type | MVP |
| `media_asset_status` — PG enum | `PENDING`, `READY`, `FAILED`, `QUARANTINED` | PENDING→READY/FAILED/QUARANTINED; retry/remediation policy Pending | none confirmed | MVP operational baseline |

## Database Type Notes

- Enum labelsใช้ uppercase stable tokens; UI แปลภาษาไทยแยกออกจาก database
- การเพิ่ม enum valueต้องใช้ reviewed migration; การ rename/remove ต้องผ่าน data migration
- `membership_entitlements.source` และ `reports.reason_code` คงเป็น `text` ใน dictionary จน vocabularyอนุมัติ ห้ามสร้าง SQL โดยไม่มี CHECK/approved alternative
- `moderation_action_type/result` ใช้ text+CHECK เพื่อเพิ่ม actionใหม่ได้ง่ายกว่า PostgreSQL enum แต่ยังรักษา database validation
- Status timestamps/checksใน [Constraints](04_CONSTRAINTS_AND_RELATIONSHIPS.md) บังคับความสอดคล้องเพิ่มเติม

## Transition Ownership

| Domain | Authorized transition owner |
|---|---|
| User | login/acceptance flow activates account; Admin/security backend governs account suspension independently from publishing privilege |
| Legal acceptance | User action at login, first publication, or support enablement; records are immutable |
| Entitlement | membership service/Admin; expiry evaluator |
| Story/Chapter | owning Creator controls draft/publish/archive/delete; Admin alone hides/restores through ModerationAction |
| Comment | author creates; Creator/Admin hideตาม scope |
| Report | Admin moderation workflow |
| Warning/Strike/Publishing Suspension | Admin moderation + successful warning delivery; automatic seven-day expiry may restore publishing privilege only |
| Advertisement | Admin only |
| Media | upload/processing service; owner requests deletion |

## Pending Product Owner Decisions

- ⚠ Pending Product Owner Decision: membership entitlement source values
- ⚠ Pending Product Owner Decision: report reason taxonomy
- ⚠ Pending Product Owner Decision: warning retry semantics, strike expiration/reversal/appeal และ exceptional manual suspension-lift authority
- ⚠ Pending Product Owner Decision: media quarantine/retry/cleanup workflow

## Related Documents

- [Column Dictionary](03_COLUMN_DICTIONARY.md)
- [Constraints](04_CONSTRAINTS_AND_RELATIONSHIPS.md)
- [Moderation Rules](../../business/05_MODERATION.md)
- [Creator Rules](../../business/04_CREATOR.md)

## Revision History

| Version | Date | Author | Change |
|---|---|---|---|
| 1.1 | 2026-07-19 | Lead PostgreSQL Database Architect | Confirmed legal acceptance vocabularies, publishing states/transitions and seven-day publishing suspension |
| 1.0 | 2026-07-19 | Lead PostgreSQL Database Architect | Initial physical vocabulary catalog |
