# การตัดสินใจด้านผลิตภัณฑ์

| รายการ | ค่า |
|---|---|
| Purpose | รวบรวม decision ที่ยืนยันแล้วและแยกเรื่องที่ยังต้องอนุมัติ |
| Current Status | Community v1 policy-neutral retention decision is approved for implementation; formal retention and legal-hold operations remain a Beta/Production launch gate |
| Version | v1.2.0-alpha.1 architecture baseline |
| Last Updated | 2 สิงหาคม 2569 |
| Author | Codex — Lead Software Architect and Technical Documentation Engineer |

## Table of Contents

1. [Confirmed Decisions](#confirmed-decisions)
2. [Confirmed Community Decisions](#confirmed-community-decisions)
3. [Open Decisions](#open-decisions)
4. [Decision Governance](#decision-governance)

## Confirmed Decisions

| รหัส | การตัดสินใจ | หลักฐาน |
|---|---|---|
| PD-001 | Public Member Profile และ Creator Profile ใช้หน้าเดียวกัน | `WIREFRAME_DECISIONS.md`, หน้า profile |
| PD-002 | Member ทุกคนเผยแพร่ได้ ไม่มี Creator role แยก | `WIREFRAME_DECISIONS.md`, Login/Dashboard |
| PD-003 | MVP ไม่มี notification center | `WIREFRAME_DECISIONS.md` |
| PD-004 | Following page ใช้แทน notification center | `WIREFRAME_DECISIONS.md`, `/following` |
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

## Open Decisions

| รหัส | เรื่องที่ต้องอนุมัติ | สถานะ |
|---|---|---|
| OD-001 | Creator-follow จะไม่อยู่ใน MVP และแสดงเป็น disabled placeholder ต่อหรือไม่ | Reviewing |
| OD-002 | จุดและกระบวนการ report สำหรับ story/chapter/comment/user | Resolved for Story, Episode, and Community Comment; User-target expansion remains outside Community v1 |
| OD-003 | Hidden/archived content ควรเข้าถึง URL ได้ในเงื่อนไขใด | Reviewing |
| OD-004 | suitability self-rating เดียวเพียงพอหรือไม่ | Reviewing |
| OD-005 | Member hide comment ต้อง reversible และมี audit อย่างไร | Resolved: author delete is irreversible; platform moderator Hide/Restore is reversible and audited; Creator has report-only authority |
| OD-006 | Authentication provider, account linking และ role governance | ยังไม่ได้กำหนด |
| OD-007 | Database/API/hosting/storage architecture | ยังไม่ได้กำหนด |
| OD-008 | Ranking, search และ editorial selection rules | ยังไม่ได้กำหนด |
| OD-009 | Content policy, moderation SLA, appeal และ notification | ยังไม่ได้กำหนด |
| OD-010 | Upload constraints, ownership/licensing และ media processing | ยังไม่ได้กำหนด |
| OD-011 | Accessibility target และ supported browser matrix | ยังไม่ได้กำหนด |
| OD-012 | Production behavior เมื่อ slug/id/route param ไม่พบ | ยังไม่ได้กำหนด |
| OD-013 | นิยาม ราคา สิทธิ์ และ lifecycle ของ Ad-free membership | ยังไม่ได้กำหนด |
| OD-014 | ผู้ให้บริการ เนื้อหาโฆษณา frequency cap การวัดผล และ privacy/consent | ยังไม่ได้กำหนด |
| OD-015 | Community safety-record post-resolution clock, duration, legal-hold authority/release semantics, audit expiry, purge operation/ownership, and privileged staff-account retention | Deferred Beta/Production launch gate; not an implementation blocker under PD-030. The unapproved 24-month proposal was rejected during independent review |

## Decision Governance

Decision owner, approver, วันที่อนุมัติ, supersession process และ ADR format: **ยังไม่ได้กำหนด**
