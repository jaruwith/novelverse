# Data Lifecycle and Retention

## Purpose

กำหนด creation, mutation, archive/delete/restore, cascade, audit และ privacy behavior ของทุก MVP domain โดยไม่กำหนด retention duration ที่ Product Owner ยังไม่อนุมัติ

## Global Rules

- Archive เป็น business publication state; soft delete เป็น lifecycle operationคนละเรื่อง
- Soft deleteตั้ง `deleted_at/deleted_by`; restoreล้างสองค่าและสร้าง audit/update actor
- Hard deleteห้ามทำก่อนตรวจ retention, legal/privacy และ inbound FKs
- UTC `timestamptz` เป็น authoritative time
- Moderation/delivery factsเป็น append-oriented ห้ามแก้ย้อนหลังเพื่อเปลี่ยนความหมาย
- Binary media ทุกประเภทอยู่ใน Cloudflare R2; PostgreSQL เก็บเฉพาะ metadata และ object key
- ระยะ retention ทุกค่าที่ไม่ระบุ: **⚠ Pending Product Owner Decision**

## Identity and Membership

### User

| Aspect | Behavior |
|---|---|
| Creation | social login สำเร็จครั้งแรกสร้าง User สถานะ PENDING_LEGAL_ACCEPTANCE พร้อม SocialIdentity/UserProfile; activate หลังบันทึก Terms และ Privacy acceptance ครบ |
| Update | role/statusผ่าน authorized Admin/security flow; last loginจาก auth flow |
| Archive | ไม่มี User archive state |
| Soft delete / restore | account delete request soft-deletes User/Profileและปิด public ownershipตาม policy; restoreใน recovery windowที่ Pending |
| Hard delete | หลัง legal/privacy retentionและจัดการ content/moderation references; default RESTRICT |
| Cascade | ไม่ cascade Story/Report/Moderationโดยอัตโนมัติ |
| Audit/privacy | role/status/deleteต้องมี actor; personal-data erasure/pseudonymization Pending |

### Legal Document and User Legal Acceptance

- LegalDocument เป็นเวอร์ชันที่เผยแพร่ของ Terms, Privacy, Creator Guidelines, Moderation Rules หรือ Support Public Display Consent; version/content hash/effective time เปลี่ยนย้อนหลังไม่ได้
- UserLegalAcceptance เป็นหลักฐาน immutable ของ User, document version, accepted_at และ source; ไม่มี marketing consent
- Terms และ Privacy ต้องครบก่อน account activation; Guidelines และ Moderation Rules ต้องครบก่อน first publication; Support consent บันทึกเมื่อ enable method แบบ public
- ไม่ soft-delete acceptance; hard delete/anonymization ต้องรอ legal/privacy retention ซึ่งเป็น **⚠ Pending Product Owner Decision**

### Social Identity

| Aspect | Behavior |
|---|---|
| Creation/update | link Google/Facebook; update email snapshot/last loginโดยไม่เปลี่ยน provider subject |
| Archive/delete/restore | ไม่มี archive/soft delete; unlinkเป็น hard deleteหรือ retained tombstone — **⚠ Pending Product Owner Decision** |
| Cascade | User hard deleteอาจ cascadeหลัง retention approval |
| Audit/privacy | provider subject Restricted, email Personal; account merge/unlink/recovery policy Pending |

### Membership Entitlement

| Aspect | Behavior |
|---|---|
| Creation | grant rowพร้อม start/end/status/source; ไม่ตั้ง booleanบน User |
| Update | ACTIVE→EXPIRED/REVOKED; correctionต้อง audit; renewalสร้าง rowใหม่โดย default |
| Archive/delete/restore | ไม่ archive/soft-delete; เก็บประวัติเพื่อสิทธิ์/audit Hard deleteเฉพาะ retention/privacy policy |
| Cascade | User deletion RESTRICTจน anonymize/retention decision |
| Audit/privacy | payment reference Restricted; expired entitlementทำให้ Free Member behaviorทันที |

## Creator Profile and Support

### User Profile

- สร้างหนึ่งต่อ User; แก้ display name/bio/avatar/social linksและ creator slugตาม uniqueness
- Creator deleteใช้ soft delete; restoreใช้ slugเดิมเพราะ uniquenessสงวนไว้
- ไม่มี Archive state; User hard delete RESTRICT
- public fields Public; social linksต้อง allowlist/sanitize; retention Pending

### Creator Support Profile and Methods

| Aspect | Behavior |
|---|---|
| Creation | Profileหนึ่งต่อ UserProfile; methodsสร้างตาม typeและเรียง display_order |
| Update | Creatorแก้ message, enable, method payload/order; reorder transactionally; การเปิด public ต้องยืนยันสิทธิ์/permission, ตำแหน่งแสดง และ consent ใน acceptance แยก |
| Archive | ไม่มี archive; ใช้ is_activeสำหรับ display |
| Soft delete / restore | Creator soft-delete profile/methodและ restoreได้; active unique orderต้องตรวจใหม่ |
| Hard delete/cascade | หลัง retention; profile hard deleteต้องจัดการ methods; QR MediaAssetไม่ cascade |
| Audit/privacy | bank/PromptPay encrypted at rest และ decrypt ได้เฉพาะ backend เมื่อ active+public; Admin/logs ใช้ค่าที่ mask และห้ามบันทึก plaintext; QR อยู่ Cloudflare R2; exact key management/rotation และ retention Pending |

เงินสนับสนุนไม่ผ่าน NovelVerse จึงไม่มี transaction, amount, currency, fee หรือ payout retention

## Taxonomy

### Category and Tag

- Adminสร้าง/แก้ชื่อ slug description order/status
- ไม่มี publication Archive; disableด้วย `is_active`, soft deleteเมื่อเลิกใช้
- restoreรักษา slug/nameเดิม
- hard delete RESTRICTหาก Story/StoryTagยังอ้าง; merge/remap policy Pending
- audit actor required; content Public, operational audit Internal

### StoryTag

- สร้าง/ลบ relationโดย Creatorเมื่อแก้ Story; ไม่มี update/archive/soft delete
- hard deleteเมื่อ untag; cascadeเมื่อ Story/Tag hard-deleteหลัง approval
- เก็บ created actor/time; ไม่มี privacy data

## Story, Chapter and Content

### Story

| Aspect | Behavior |
|---|---|
| Creation | Creatorสร้าง DRAFT พร้อม type/category/scoped slug |
| Update | Creatorใช้ DRAFT→PUBLISHED, PUBLISHED→ARCHIVED, ARCHIVED→PUBLISHED; Adminใช้ PUBLISHED→HIDDEN และ HIDDEN→PUBLISHED ผ่าน ModerationAction |
| Archive | `ARCHIVED` แยกจาก deletion; archived_atบันทึก event |
| Soft delete / restore | owner-controlled editable state→DELETED พร้อม soft-delete fieldsและเก็บสถานะก่อนลบ; slugสงวนรวม deleted; restore ห้ามข้ามข้อจำกัด HIDDEN/Admin review |
| Hard delete | หลัง retentionและจัดการ Chapter/comments/reports/media references; default RESTRICT |
| Cascade | ไม่ cascadeจาก User; StoryTagอาจ cascadeเฉพาะ hard delete; Chapterต้อง lifecycleอย่างชัดเจน |
| Audit/privacy | full audit; public fields Public; hidden/deleted content access policy Pending |

### Chapter

- สร้างใต้ Storyด้วย UUID, scoped slugและ display_order; displayed numberไม่ใช่ identity
- Creator edit/publish/archive/delete และ reorderได้; Admin เท่านั้นที่ hide/restore HIDDEN; reorder sibling setใน transaction
- Creator soft-delete/restore; slugสงวน, active display orderตรวจ uniquenessใหม่
- hard deleteหลัง retentionและจัดการ content/pages/comments/likes/progress/reports
- Admin restore hidden contentด้วย ModerationActionหลัง Creatorแก้; warningไม่ restoreอัตโนมัติ

### Novel Content

- สร้างเฉพาะ Novel Chapter; update structured JSON documentพร้อม schema version
- ไม่มี archive/soft deleteอิสระ; lifecycleตาม Chapter
- hard delete cascadeจาก Chapterหลัง retention approval
- revision historyไม่ได้เก็บใน MVP; **⚠ Pending Product Owner Decision**

### Comic Page

- สร้างเฉพาะ Comic Chapterและ READY MediaAsset; reorder transactionally
- soft-delete/restoreโดย Creator; active orderต้อง unique
- hard deleteหลัง retention; media objectไม่ cascadeโดยอัตโนมัติเพราะอาจมี audit/reference
- alt text Public; object metadata Internal/Restricted

### Media Asset

| Aspect | Behavior |
|---|---|
| Creation | upload serviceสร้าง PENDING metadataก่อน/พร้อม upload ไป Cloudflare R2 สำหรับ cover, comic page, avatar, support QR, ad, evidence และ warning attachment |
| Update | processingเปลี่ยน READY/FAILED/QUARANTINED, เติม checksum/dimensions/URL |
| Archive | ไม่มี archive |
| Soft delete / restore | owner/request soft-deletes metadata; restoreได้ถ้า objectยังอยู่และปลอดภัย |
| Hard delete | two-phase cleanup: ตรวจ references → ลบ object → ลบ/anonymize metadataตาม retention |
| Cascade | principal hard deleteไม่ควรลบ objectทันที; orphan job Pending |
| Audit/privacy | object keys/checksum Restricted; signed/public URL policy, malware scanningและ retention Pending |

## Reading and Community

### Follow and Like

- สร้าง immutable relationshipเมื่อ Member action; uniquenessป้องกัน duplicate
- unfollow/unlike hard-delete row; ไม่มี archive/soft-delete/restore
- principal hard deleteอาจ cascadeหลัง retention approval
- aggregate countsเป็น derived data ไม่ใช่ columnsใน schemaนี้

### Reading Progress

- upsertหนึ่ง rowต่อ User/Storyและ latest Chapter; update last_read_at/position
- ไม่มี archive/soft delete; clear Historyอาจ hard-delete
- Story/User hard deleteอาจ cascade; Chapter deletionต้อง repair progressก่อน
- Personal data; retention/clear-history/cross-device details **⚠ Pending Product Owner Decision**

### Comment

- Memberสร้าง flat comment; ไม่มี replies/likes
- author edit behavior **⚠ Pending Product Owner Decision**; Creator/Admin hide/restoreตาม scope
- soft-deleteสำหรับ user deletion/moderation; status hideแยกจาก deletion
- hard deleteหลัง moderation/privacy retention; Chapter/User default RESTRICTเพื่อ context
- body Publicเมื่อ visible; report/moderation copiesไม่ควรถูกทำลาย

## Moderation

### Report and Typed Target

- transactionสร้าง Report + typed targetหนึ่งรายการเท่านั้น
- Adminเปลี่ยน OPEN→REVIEWING→RESOLVED/REJECTED; reportเองไม่สร้าง strike
- ไม่มี archive/soft delete; hard deleteเฉพาะ legal retentionและต้องคง action history
- target hard delete RESTRICT; target soft deleteไม่ทำลาย report
- reporter/รายละเอียดเป็น Restricted; retention duration Pending

### Moderation Action and Evidence

- Action append เมื่อ Admin review/hide/restore/confirm/reject; updateได้เฉพาะ correction policyที่ Pending
- Creator content fixสร้าง content auditใหม่ ไม่เปลี่ยน action; Admin restoreสร้าง actionใหม่
- Evidenceสร้างใต้ action; media/reference/textอย่างน้อยหนึ่ง; warning attachmentเชื่อมผ่าน `warning_email_evidence`
- ไม่มี archive/soft delete; hard deleteหลัง legal retentionเท่านั้น
- actor/reason/before/result/evidenceเป็น Restrictedและต้อง access-control

### Warning Email and Evidence Manifest

- queue warningพร้อม recipient snapshot/template, reason และ rule_reference; attach optional evidenceผ่าน immutable junctionก่อนส่ง
- deliveryเปลี่ยน QUEUED→SENT/FAILED; sent factsและ manifestต้อง immutable
- retry semantics (rowใหม่หรือ status reset) Pending
- ไม่มี archive/soft delete; hard deleteตาม communication/legal retention
- recipient email/evidence Restricted; provider referenceใช้ idempotency/audit

### Creator Strike

- สร้างเฉพาะ content-policy violation หลัง Admin ยืนยัน report, ซ่อน Story/Chapter ที่ได้รับผลกระทบ และ WarningEmail ที่มี reason/rule reference เป็น SENT; Report หรือ security incident เพียงอย่างเดียวไม่สร้าง strike
- ไม่แก้ qualifying references; statusอาจ ACTIVE→REVERSED/EXPIRED
- ไม่มี archive/soft delete; reversalเก็บ actor/time/reason
- hard deleteไม่ควรทำใน routine operation
- Strike 1–2 เป็น warningและเนื้อหายังคง HIDDEN; Strike 3 ที่ active สร้าง publishing suspension 7 วัน
- strike expiry/reversal/appeal และ retention **⚠ Pending Product Owner Decision**

### Creator Publishing Suspension

- qualifying active strike ลำดับที่ 3 สร้าง suspension หนึ่งรายการ เริ่ม ณ เวลาออก strike และสิ้นสุดหลัง 7 วันพอดี
- ระหว่าง ACTIVE Creator เข้า Dashboardและแก้ hidden content ได้ แต่สร้างหรือ publish Story/Chapter ใหม่ไม่ได้; reader access, User account status และผลงานอื่นที่เผยแพร่อยู่ไม่เปลี่ยน
- automatic expiry คืนเฉพาะ publishing privilege; hidden content ไม่ restore อัตโนมัติและต้องให้ Admin review/restore
- ไม่มี soft delete; lift/expire ทุกครั้งต้อง audit actor/time/reason ตามชนิดการเปลี่ยนแปลง; manual lift authority และ retention Pending
- API attack/security abuse ไม่อยู่ใน lifecycle นี้; rate limiting, WAF, abuse detection, IP blocking และ security audit logs เป็น Future capability โดยไม่มี MVP table

## Advertisement

- Adminสร้าง base DRAFT + subtypeตรง typeใน transaction
- update content/window/order; activate/deactivateโดย Admin
- Standard activeทั้งหมดถูกอ่านและเรียง sort_order/id; Premium activeสูงสุดหนึ่ง
- ไม่มี business Archive; soft delete configและ restoreได้หลัง uniqueness/subtype validation
- hard deleteหลัง audit retentionและ media reference cleanup
- metrics/campaign billingไม่มี tables; retention/ad privacy Pending

## Hard-delete Eligibility Matrix

| Class | Default eligibility |
|---|---|
| Follow/Like/StoryTag | Immediate on explicit unlink action |
| ReadingProgress | On clear-history request subject to Pending retention |
| Soft-deleted creator/taxonomy/media/ad data | After approved recovery+retention window and reference scan |
| Identity/Personal data | After privacy/legal process and pseudonymization plan |
| Reports/Actions/Evidence/Warnings/Strikes | Not routine; legal/audit retention required |

## Related Documents

- [Table Catalog](02_TABLE_CATALOG.md)
- [Constraints](04_CONSTRAINTS_AND_RELATIONSHIPS.md)
- [Review Checklist](08_SCHEMA_REVIEW_CHECKLIST.md)
- [Moderation Business Rules](../../business/05_MODERATION.md)

## Revision History

| Version | Date | Author | Change |
|---|---|---|---|
| 1.1 | 2026-07-19 | Lead PostgreSQL Database Architect | Added legal consent, encrypted public support, confirmed publication lifecycle, strike/suspension policy and Cloudflare R2 boundary |
| 1.0 | 2026-07-19 | Lead PostgreSQL Database Architect | Initial lifecycle and retention design |
