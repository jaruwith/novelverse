# การตัดสินใจด้านผลิตภัณฑ์

| รายการ | ค่า |
|---|---|
| Purpose | รวบรวม decision ที่ยืนยันแล้วและแยกเรื่องที่ยังต้องอนุมัติ |
| Current Status | Notifications v1 is released at `v1.4.0-alpha.1`; Phase 7 Deployment A and B foundations are complete locally |
| Version | v1.4.0-alpha.1 architecture baseline |
| Last Updated | 8 สิงหาคม 2569 |
| Author | Codex — Lead Software Architect and Technical Documentation Engineer |

## Table of Contents

1. [Confirmed Decisions](#confirmed-decisions)
2. [Confirmed Community Decisions](#confirmed-community-decisions)
3. [Confirmed Notifications Decisions](#confirmed-notifications-decisions)
4. [Confirmed Deployment Decisions](#confirmed-deployment-decisions)
5. [Open Decisions](#open-decisions)
6. [Decision Governance](#decision-governance)

## Confirmed Decisions

| รหัส | การตัดสินใจ | หลักฐาน |
|---|---|---|
| PD-001 | Public Member Profile และ Creator Profile ใช้หน้าเดียวกัน | `WIREFRAME_DECISIONS.md`, หน้า profile |
| PD-002 | Member ทุกคนเผยแพร่ได้ ไม่มี Creator role แยก | `WIREFRAME_DECISIONS.md`, Login/Dashboard |
| PD-003 | Historical MVP decision: ไม่มี notification center; superseded for the separate Notifications v1 architecture by PD-035 | `WIREFRAME_DECISIONS.md`; `NOTIFICATIONS_FRONTEND_CONTRACT.md` |
| PD-004 | Historical MVP decision: Following page ใช้แทน notification center; superseded by keeping `/following` distinct from `/notifications` under PD-040 | `WIREFRAME_DECISIONS.md`; `/following`; `NOTIFICATIONS_FRONTEND_CONTRACT.md` |
| PD-005 | Historical MVP wireframe decision: Like ใช้กับ chapter เท่านั้น; superseded for Community Comment Like by PD-019 while Episode engagement remains unchanged | `WIREFRAME_DECISIONS.md`, readers; Community architecture documents |
| PD-006 | Follow ใช้กับ story เท่านั้น | `WIREFRAME_DECISIONS.md`, story detail |
| PD-007 | Historical MVP wireframe decision: Comment เป็น flat ไม่มี reply และ comment like; superseded for Community v1 by PD-019 | `WIREFRAME_DECISIONS.md`, CommentList; `COMMUNITY_FRONTEND_CONTRACT.md` |
| PD-008 | Story views เป็นผลรวม chapter views | `WIREFRAME_DECISIONS.md`, `totalViews` |
| PD-009 | Search อยู่ใน global header ของ public page | `WIREFRAME_DECISIONS.md`, public layout/header |
| PD-010 | visual direction แรกเป็น light theme สบายตา | `WIREFRAME_DECISIONS.md`, CSS tokens |
| PD-011 | รองรับ desktop และ mobile browser | `WIREFRAME_DECISIONS.md`, responsive CSS |
| PD-012 | รองรับเนื้อหา Novel และ Comic | routes, forms และ mock type |
| PD-013 | เรื่องมีหมวดหลักหนึ่งหมวดและแท็กได้หลายรายการ | Categories/Dashboard/Admin UI |
| PD-014 | Novel/Comic Reader แสดง standard ads ที่ active ครบทุกใบเป็น vertical stack ก่อน reading content | Requirements และ reader implementation |
| PD-015 | Standard ads ไม่มีเพดานสามรายการ ไม่หมุน/สุ่ม และเรียง `sortOrder` แล้ว `id` | Advertisement pool/helper |
| PD-016 | Guest/Free Member เห็น ads ทั้งหมด; Ad-free Member/Admin ไม่เห็น ads หรือ upsell | mock `isAdFreeMember` และ eligibility helper |
| PD-017 | Premium Popup เป็น paid placement แยก แสดงสูงสุดหนึ่งรายการและปิดได้หลัง 5 วินาที | Premium popup wireframe |
| PD-018 | การคลิกโฆษณาทุกชนิดเปิด target ในแท็บใหม่ | Reader advertisement components |

## Confirmed Community Decisions

These entries were confirmed after the independent-review retention blocker was
closed with the approved policy-neutral Community v1 model.

| รหัส | การตัดสินใจ | หลักฐาน |
|---|---|---|
| PD-019 | Community v1 รองรับ Story และ Episode Comments ผ่าน target ที่มี FK จริง พร้อม Reply ระดับเดียวและ Comment Like แบบเดียว | `COMMUNITY_ARCHITECTURE.md`; target/reply ADR |
| PD-020 | Community v1 ใช้ plain text ไม่รองรับ HTML/Markdown และ spoiler ครอบคลุมทั้ง Comment | `COMMUNITY_ARCHITECTURE.md`; `COMMUNITY_FRONTEND_CONTRACT.md` |
| PD-021 | Author delete เป็น irreversible tombstone; moderator Hide/Restore เป็นสถานะแยก; Creator ไม่มีสิทธิ์ moderation จากการเป็นเจ้าของ Story | moderation/deletion ADR |
| PD-022 | Root Comments ใช้ keyset pagination เริ่ม Oldest และเลือก Newest ได้; Replies เป็น Oldest; ไม่มี total หรือ ranking | pagination/rate-limit ADR |
| PD-023 | ทุก Community mutation ใช้ JWT actor, server-confirmed reconciliation, policy-specific rate limits และไม่มี IP/fingerprint database | Community architecture documents |
| PD-024 | Community v1 ไม่มี notification delivery และไม่สร้าง outbox ที่ยังไม่มี consumer | `COMMUNITY_ARCHITECTURE.md` |
| PD-025 | Review และ Rating ไม่รวมใน Community v1 และต้องมี Community v2 architecture แยก | `COMMUNITY_ARCHITECTURE.md` |
| PD-026 | Community privacy cleanup เป็น internal service สำหรับ future account-deletion orchestrator; ไม่มี arbitrary-UserId production endpoint | moderation/deletion ADR |
| PD-027 | Discussion state ไม่ persist ใน browser และผูกกับ centralized session generation, request identity และ cancellation | `COMMUNITY_FRONTEND_CONTRACT.md` |
| PD-028 | Community v1 completion วัดด้วย executable Reader/Creator/Moderator/privacy/abuse/performance/E2E gates ไม่ใช้เปอร์เซ็นต์ประมาณการ | Community architecture documents; `08_ROADMAP.md` |
| PD-029 | Future account deletion must call the internal Community unlink boundary; multi-instance writes require an equivalent distributed limiter | Community architecture documents |
| PD-030 | Community v1 has no automatic time-based safety-record expiry and encodes no duration, expiry date, legal approval, or purge worker; immediate public identity/content/Like unlink is independent while restricted report evidence and audit may remain moderator/safety-only | Community architecture; moderation/deletion ADR |
| PD-031 | The former 24-month proposal was rejected during independent review as unsupported; formal retention duration/clock, legal-hold authority/release, audit expiry, purge operation/ownership, and staff-account policy are Beta/Production launch gates, not implementation prerequisites | Community architecture; `08_ROADMAP.md` |
| PD-032 | Community B author controls use only server `isOwnedByViewer`, `canEdit`, `canDelete`, and nullable `editTag`; display identity, target ownership, creator badge, and moderator role never infer Comment ownership | `COMMUNITY_FRONTEND_CONTRACT.md`; `COMMUNITY_B_FRONTEND_DISCUSSION.md` |
| PD-033 | Community B is the shared Story/NOVEL/COMIC/VIDEO Discussion UI only; Comment Likes, Comment reports, moderator Hide/Restore, and privacy-unlink execution are delivered separately by Community C | `COMMUNITY_B_FRONTEND_DISCUSSION.md`; `08_ROADMAP.md` |
| PD-034 | Community C uses relationship-derived Comment Likes, restricted report-time evidence, platform-moderator COMMENT Hide/Restore, and immediate transactional public privacy unlink; it adds no counter column, creator authority, or automatic evidence expiry | `COMMUNITY_C_MODERATION_PRIVACY_FOUNDATION.md`; `COMMUNITY_C_FRONTEND_MODERATION.md` |

## Confirmed Notifications Decisions

These independently reviewed decisions define the implemented Notifications v1
boundary. Notifications v1 passed Independent Final Approval and is merged and
released at `v1.4.0-alpha.1`.

| รหัส | การตัดสินใจ | หลักฐาน |
|---|---|---|
| PD-035 | Notifications v1 is authenticated in-app only; email, push, SMS, preferences, grouping, dismissal, and realtime are deferred | `NOTIFICATIONS_FRONTEND_CONTRACT.md`; backend delivery-model ADR |
| PD-036 | Reply, first lifetime Comment Like per actor/Comment, creator-owned root Comment, first lifetime Follow per actor/Creator, terminal report outcome, and moderation visibility outcome are the exact v1 event families | backend Notifications architecture |
| PD-037 | Story Like and follower publication notifications are deferred; Bookmark and Reader progress/history are not Notification triggers | backend Notifications architecture |
| PD-038 | A first semantic delivery intent commits atomically with its source mutation; equivalent Like/Follow lifetime reactivation is `ALREADY_NOTIFIED`; worker materialization is at-least-once and idempotent | outbox/worker ADR |
| PD-039 | V1 resolves at most one recipient in the source transaction; high-fan-out publication requires a later ADR | delivery-model and outbox/worker ADRs |
| PD-040 | `/notifications` is the dedicated inbox; `/following` remains a separate followed-content surface and is never a mock fallback | `NOTIFICATIONS_FRONTEND_CONTRACT.md` |
| PD-041 | Read state is server `ReadAt`, unread count is exact and derived, feed pagination is signed recipient-bound keyset, and frontend delivery uses visible-tab polling | read-state ADR; `NOTIFICATIONS_FRONTEND_CONTRACT.md` |
| PD-042 | Actor unlink neutralizes identity, recipient unlink removes addressed inbox/outbox rows, safety data never enters Notifications, and no fixed retention/expiry is invented | backend Notifications architecture |

## Confirmed Deployment Decisions

These decisions bind Phase 7 architecture. Deployment A containers/health and
Deployment B CI/migration/artifact foundations are implemented and locally
validated, but workflows have not run remotely and no cloud resource,
environment deployment, or operational runbook is claimed.

| รหัส | การตัดสินใจ | หลักฐาน |
|---|---|---|
| PD-043 | Azure Container Apps with managed PostgreSQL 16 is the Beta and initial Production target; ACA custom-domain rule-based routing owns the initial same-origin `/api` split, while AKS and Front Door/WAF are deferred until measured requirements justify their operational cost | Backend `DEPLOYMENT_ARCHITECTURE.md`; platform/topology ADR |
| PD-044 | Beta uses one steady API replica with the API-hosted Notifications worker; Production uses horizontally scaled API only after a shared limiter and moves worker execution to a dedicated multi-replica workload without changing outbox semantics | Backend Deployment architecture and platform/topology ADR |
| PD-045 | Deploy reviewed immutable artifacts once and promote identical digests across environments; a version-aligned serialized one-shot migration job applies schema changes, never API startup | migrations/promotion ADR |
| PD-046 | Production browser API traffic uses same-origin `/api` so a single frontend image can be promoted unchanged; `NEXT_PUBLIC_*` is public build-time configuration and never carries secrets | `DEPLOYMENT_FRONTEND_CONTRACT.md`; migrations/promotion ADR |
| PD-047 | Key Vault/Managed Identity is the target secret model; all API replicas share one versioned current/previous cursor HMAC keyset and use a two-phase audited rotation | configuration/security/operations ADR |
| PD-048 | API liveness is dependency-free and readiness checks required configuration plus PostgreSQL; the existing `/api/v1/health` remains service metadata and is not reclassified as database readiness | Backend `DEPLOYMENT_ARCHITECTURE.md` |
| PD-049 | Managed backup/PITR, isolated restore tests, privacy-safe observability, internal audited dead-letter replay, and durable account-deletion orchestration are required operational boundaries; numeric retention/SLA/RPO/RTO/legal-hold values require separate owner approval | Backend `DEPLOYMENT_ARCHITECTURE.md` |
| PD-050 | The current local media filesystem is not an ephemeral-container Production store; durable object/blob or explicitly managed persistent storage must be selected and proven before media-enabled Beta | Backend `DEPLOYMENT_ARCHITECTURE.md` |

## Open Decisions

| รหัส | เรื่องที่ต้องอนุมัติ | สถานะ |
|---|---|---|
| OD-001 | Creator-follow จะไม่อยู่ใน MVP และแสดงเป็น disabled placeholder ต่อหรือไม่ | Reviewing |
| OD-002 | จุดและกระบวนการ report สำหรับ story/chapter/comment/user | Resolved for Story, Episode, and Community Comment; User-target expansion remains outside Community v1 |
| OD-003 | Hidden/archived content ควรเข้าถึง URL ได้ในเงื่อนไขใด | Reviewing |
| OD-004 | suitability self-rating เดียวเพียงพอหรือไม่ | Reviewing |
| OD-005 | Member hide comment ต้อง reversible และมี audit อย่างไร | Resolved: author delete is irreversible; platform moderator Hide/Restore is reversible and audited; Creator has report-only authority |
| OD-006 | Authentication provider, account linking และ role governance | ยังไม่ได้กำหนด |
| OD-007 | Database/API/hosting/storage architecture | Hosting and managed PostgreSQL direction resolved by PD-043; durable media provider, subscription/region/budget, and implementation remain open Beta gates |
| OD-008 | Ranking, search และ editorial selection rules | ยังไม่ได้กำหนด |
| OD-009 | Content policy, moderation SLA, appeal และ notification | Notification v1 public-safe outcome behavior is resolved by PD-036/PD-042; content policy, appeals, and moderator SLA remain open |
| OD-010 | Upload constraints, ownership/licensing และ media processing | ยังไม่ได้กำหนด |
| OD-011 | Accessibility target และ supported browser matrix | ยังไม่ได้กำหนด |
| OD-012 | Production behavior เมื่อ slug/id/route param ไม่พบ | ยังไม่ได้กำหนด |
| OD-013 | นิยาม ราคา สิทธิ์ และ lifecycle ของ Ad-free membership | ยังไม่ได้กำหนด |
| OD-014 | ผู้ให้บริการ เนื้อหาโฆษณา frequency cap การวัดผล และ privacy/consent | ยังไม่ได้กำหนด |
| OD-015 | Community safety-record post-resolution clock, duration, legal-hold authority/release semantics, audit expiry, purge operation/ownership, and privileged staff-account retention | Deferred Beta/Production launch gate; not an implementation blocker under PD-030. The unapproved 24-month proposal was rejected during independent review |
| OD-016 | Notification, processed-outbox, and dead-letter retention clocks; legal-hold applicability; dead-letter operator ownership/SLA; monitoring thresholds; shared cursor-secret operations; distributed rate limits | Architecture direction resolved by PD-044/PD-047/PD-049; owner names, numeric policy values, implemented controls, and launch approval remain Beta/Production gates |

## Decision Governance

Decision owner, approver, วันที่อนุมัติ, supersession process และ ADR format: **ยังไม่ได้กำหนด**
