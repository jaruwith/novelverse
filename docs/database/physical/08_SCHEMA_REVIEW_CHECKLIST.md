# Physical Schema Review Checklist

## Purpose

ใช้เป็น approval checklist ระหว่าง Product Owner, Backend, Security, Data/DBA และ Operations ก่อนอนุญาตให้สร้าง SQL/migrations

## Review Metadata

| Item | Value |
|---|---|
| Baseline | NovelVerse v0.1.0 Architecture Complete |
| Tables | 34 |
| Columns | 347 |
| Foreign keys | 116 |
| Unique rules | 28 |
| Row CHECKs | 33 |
| Cross-table deferred validations | 11 |
| Planned indexes | 95 (93 MVP, 2 Future search) |
| Current gate | Not approved for SQL generation |

## Business Rule Traceability

- [ ] ทุก MBR/AD/RD/CR/MOD/MON ruleที่ต้อง persistมี table/constraintหรือ explicit exclusion
- [ ] Guest, Member, Admin และ Creator capabilityไม่ถูกสร้างเป็น role/entityผิดความหมาย
- [ ] Ad-free eligibilityอ่านจาก MembershipEntitlement ไม่อ่าน boolean
- [ ] Direct Creator supportไม่มี platform donation/payment ledger
- [ ] Coin, notification, slug history และ Creator subscriptionไม่อยู่ใน MVP

## Entity and Column Completeness

- [ ] Conceptual entitiesทุกตัว mapเป็น 34 physical tablesหรือมีเหตุผล exclusion
- [ ] ไม่มี speculative campaign, analytics event, search documentหรือ payment tables
- [ ] ทุก tableมี PK, ownership, growth/read/write profile
- [ ] ทุก nullable columnมีเหตุผล; mandatory owner/type/status/content fieldsเป็น NOT NULL
- [ ] audit profilesถูกใช้สม่ำเสมอและ system actor null policyได้รับอนุมัติ
- [ ] hard character limitsไม่ได้ถูกเดา

## Identity, Membership and Privacy

- [ ] ไม่มี password/local credential columns
- [ ] provider + subject unique global และ User link providerได้ตาม policy
- [ ] account merge/unlink/recovery/deletion flowได้รับคำตอบ
- [ ] entitlement starts/ends/status/sourceและ expiry queryถูกต้อง
- [ ] payment referenceเป็น opaque referenceและไม่เก็บ payment data
- [ ] provider email/reading history/warning recipientถูกจัด Personal/Restricted
- [ ] first login บันทึก Terms + Privacy version/time/source ก่อน activation
- [ ] first publication บันทึก Creator Guidelines + Moderation Rules acceptance

## Public URLs and Uniqueness

- [ ] creator slug global unique
- [ ] Story slug uniqueภายใน Creator
- [ ] Chapter slug uniqueภายใน Story
- [ ] UUIDไม่ปรากฏใน public URL contract
- [ ] soft-deleted slug reservationและ Future redirect boundaryได้รับอนุมัติ
- [ ] normalization/collation/reserved wordsถูกกำหนดก่อน SQL

## Content and Creator Operations

- [ ] Story type NOVEL/COMICตรงกับ content tablesและถูก enforceข้าม table
- [ ] Published Novel Chapterมี NovelContentหนึ่งและไม่มี ComicPage
- [ ] Published Comic Chapterมี ComicPageอย่างน้อยหนึ่งและไม่มี NovelContent
- [ ] Chapter identityไม่พึ่ง display number/title
- [ ] Chapter/ComicPage `display_order` uniqueใน parentและ reorder transactionไม่ชนชั่วคราว
- [ ] Archiveแยกจาก soft deleteและ restoreรักษา ownership/slug
- [ ] Story/Chapter transitions ตรง DRAFT/PUBLISHED/HIDDEN/ARCHIVED/DELETED และ Creator restore HIDDEN ไม่ได้
- [ ] rich-content schema/version migrationได้รับอนุมัติ

## Creator Support / Donation Display

- [ ] support profileหนึ่งต่อ public profile
- [ ] methodsรองรับ bank, PromptPay, QR และ external linkเท่านั้นใน MVP
- [ ] active methodsเรียง deterministicและแสดงบน Creator Profile/ท้าย Chapter
- [ ] public display เป็น Creator opt-in พร้อม ownership/permission, placement และ consent acceptance
- [ ] type-specific payload constraintป้องกัน fieldผสมผิดชนิด
- [ ] encrypted/masked/tokenized strategy, KMS/key rotationและ privileged accessได้รับ Security sign-off
- [ ] bank/PromptPay encrypted at rest; decrypt เฉพาะ active+public; plaintextไม่ปรากฏใน Admin/log/audit
- [ ] support QR ใช้ Cloudflare R2 และ PostgreSQLเก็บเฉพาะ MediaAsset metadata/object key
- [ ] ไม่มี amount, fee, percentage, wallet, payoutหรือ platform donation columns

## Moderation and Strike Integrity

- [ ] Report transactionสร้าง typed target exactly oneจาก User/Story/Chapter/Comment
- [ ] ไม่มี generic target_type+target_id FK
- [ ] target deletionใช้ RESTRICTเพื่อรักษา report history
- [ ] reportไม่สร้าง strikeโดยตรง
- [ ] ModerationActionเก็บ actor/time/reason/evidence/previous/resulting state
- [ ] warning attachmentsเชื่อมด้วย `warning_email_evidence` และ immutableหลัง SENT
- [ ] strikeมี valid report, Admin-confirmed violation, hidden Story/Chapter และ SENT warningที่มี reason/rule reference ของ action/creatorเดียวกัน
- [ ] Strike 1–2 คง affected content เป็น HIDDEN; Strike 3 สร้าง publishing suspension 7 วันพอดี
- [ ] suspensionไม่เปลี่ยน account/reader accessหรือผลงานอื่น; blockเฉพาะ create/publishและหมดอายุได้อัตโนมัติ
- [ ] suspensionหมดอายุไม่ restore hidden content; Admin review/restoreเท่านั้น
- [ ] Creatorแก้ contentได้แต่ Admin restoreด้วย actionใหม่เท่านั้น
- [ ] report reasons, strike expiry/reversal/appealและ retentionได้รับคำตอบ
- [ ] API attacks/security incidentsไม่ถูกนับ Creator Strike และ security capabilityยังอยู่นอก MVP schema

## Advertisement

- [ ] Advertisement baseมี subtypeตรง typeเพียงหนึ่ง
- [ ] active Standard queryคืนทุก active rowและเรียง `sort_order`, `advertisement_id`
- [ ] Standard sort orderยอม tieและใช้ ID fallbackตาม business rule
- [ ] active Premium Popupมีสูงสุดหนึ่งและ close delayเท่ากับ 5
- [ ] Ad-free/Admin pathไม่ต้องอ่าน/แสดง ads
- [ ] activation schedulingไม่ใช้ volatile timeใน partial unique predicate
- [ ] metrics/campaign billingยังไม่มี schemaและถูกทำเครื่องหมาย Pending

## Reading and Query Performance

- [ ] Follow/Like unique pairและ hard-deleteเมื่อยกเลิก
- [ ] Comment flat; ไม่มี parent/comment-like columns
- [ ] ReadingProgress unique User+Storyและ latest Chapterอยู่ใน Storyเดียวกัน
- [ ] History retention/clear behaviorได้รับคำตอบ
- [ ] public slug, category, chapter list, comments, historyและmoderation queueมี index
- [ ] keyset paginationใช้ stable ID tie-break
- [ ] ไม่มี duplicate indexesที่ composite leading columnรองรับแล้ว

## Search Readiness

- [ ] Story titleและ Creator nameเป็น approved search fields
- [ ] UI default Story titleถูกเก็บใน API/search designภายหลัง
- [ ] Thai normalization/tokenization/collation/operator classได้รับ benchmark
- [ ] Future search indexesยังไม่ถูกสร้างก่อน decision/performance evidence

## Media Lifecycle

- [ ] binaryไม่อยู่ใน PostgreSQL
- [ ] Cloudflare R2 เป็น provider สำหรับ cover/comic/avatar/support QR/ad/evidence/warning attachment อย่างสม่ำเสมอ
- [ ] object key uniqueness, MIME, size, checksum, statusและownerครบ
- [ ] upload limits, allowlist, malware scanning, signed URL/CDNและorphan cleanupได้รับคำตอบ
- [ ] hard deleteเป็น two-phaseและตรวจ referencesก่อนลบ object
- [ ] evidence/media retentionไม่ถูก cascadeโดยไม่ตั้งใจ

## Foreign Keys and Cascades

- [ ] ตรวจ domain FKs 57 และ audit FKs 59 ครบ
- [ ] ทุก FKมี ON DELETE/ON UPDATE policy
- [ ] owner/content/moderation referencesไม่ใช้ unsafe cascade
- [ ] composition cascadeเกิดเฉพาะหลัง principal hard-deleteผ่าน retention gate
- [ ] audit actor SET NULLยังรักษา event facts

## Migration Readiness

- [ ] PostgreSQL major version/extension/UUID generatorได้รับอนุมัติ
- [ ] enum creation/change strategyและ text+CHECK vocabulariesพร้อม
- [ ] 33 CHECKs และ 11 deferred cross-table validationsมี test cases
- [ ] 28 unique rulesรวม soft-delete predicatesถูก review
- [ ] 95 indexesถูกจัด MVP/Futureและไม่มี volatile predicate
- [ ] seed/reference data strategyสำหรับ taxonomyและAdmin bootstrapพร้อม
- [ ] migration transaction/rollback, zero-downtime policyและenvironment promotionกำหนดแล้ว
- [ ] backup/restore, monitoringและdata verification planพร้อม

## Required Validation Scenarios

- [ ] link Google + Facebookเข้ากับ Userเดียว และ reject duplicate provider subject
- [ ] expired entitlementคืน Free Member behavior
- [ ] soft-delete/restore Creator Storyโดย slugไม่ถูกแย่ง
- [ ] reorder Chapters/ComicPagesจำนวนมากโดยไม่มี duplicate order
- [ ] reject NovelContentบน Comicและ ComicPageบน Novel
- [ ] reject Reportที่ไม่มี targetหรือมีมากกว่าหนึ่ง target
- [ ] reject Strikeก่อน warning SENTหรือเมื่อ actionไม่ใช่ confirmed violation
- [ ] attach evidenceกับ warningและรักษา manifestหลังส่ง
- [ ] return active Standard Adsทั้งหมดตาม orderและ Premiumสูงสุดหนึ่ง
- [ ] ensure sensitive support valuesไม่ออกใน public read model/log
- [ ] reject account activationเมื่อ Terms/Privacy acceptanceไม่ครบ และ reject first publicationเมื่อ guideline acknowledgementsไม่ครบ
- [ ] reject public support methodเมื่อไม่มี matching explicit consent acceptance
- [ ] expire third-strike publishing suspensionที่ 7 วันโดยไม่ restore hidden content

## Approval Gate Before SQL Generation

SQL generation เริ่มได้เมื่อทุกรายการต่อไปนี้ลงนามชัดเจน:

| Sign-off | Required approval |
|---|---|
| Product Owner | Approved business vocabularies, lifecycle transitions, retention decisions และ Future boundary |
| Backend Lead | Table/column nullability, transaction boundaries, deferred validation implementation และ API use cases |
| PostgreSQL Architect/DBA | Data types, 34 PKs, 116 FKs, 28 unique rules, 33 CHECKs, 95 indexes และ migration feasibility |
| Security/Privacy | Social identity, support encryption/masking, warning/evidence access, media/uploadและerasure policy |
| Moderation Owner | Report reasons, action/result matrix, warning retry, strike qualification/expiry/reversal/appeal |
| Operations | PostgreSQL version, extension, backup/restore, observability, object storageและemail provider boundaries |
| Documentation Owner | Links/counts/traceabilityตรงกัน และ Pending itemsที่ block SQLถูกปิด |

**Gate result ณ revision นี้: NOT READY FOR SQL GENERATION** เพราะ source/reason vocabularies, exact encryption key management, retention, PostgreSQL version/UUID extension และ warning/strike exception policiesยัง Pending

## Related Documents

- [Physical Overview](01_PHYSICAL_SCHEMA_OVERVIEW.md)
- [Table Catalog](02_TABLE_CATALOG.md)
- [Column Dictionary](03_COLUMN_DICTIONARY.md)
- [Constraints](04_CONSTRAINTS_AND_RELATIONSHIPS.md)
- [Enum Catalog](05_ENUM_AND_STATUS_CATALOG.md)
- [Index Plan](06_PHYSICAL_INDEX_PLAN.md)
- [Lifecycle](07_DATA_LIFECYCLE_AND_RETENTION.md)

## Revision History

| Version | Date | Author | Change |
|---|---|---|---|
| 1.1 | 2026-07-19 | Lead PostgreSQL Database Architect | Added legal consent, public support security, publication-state, seven-day suspension and Cloudflare R2 review gates |
| 1.0 | 2026-07-19 | Lead PostgreSQL Database Architect | Initial Product/Backend/DBA approval checklist |
