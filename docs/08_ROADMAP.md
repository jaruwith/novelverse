# Roadmap โครงการ NovelVerse

| รายการ | ค่า |
|---|---|
| Purpose | จัด milestone ตาม phase ที่กำหนด โดยยึดสถานะจาก repository และไม่กำหนดวันส่งมอบเอง |
| Current Status | Community v1 is released at `v1.3.0-alpha.1`; Notifications A1/A2/B are complete and Notifications C process evidence is closed; independent final approval awaits remediation/re-review |
| Version | v1.3.0-alpha.1 architecture baseline |
| Last Updated | 3 สิงหาคม 2569 |
| Author | Codex — Lead Software Architect and Technical Documentation Engineer |

## Table of Contents

1. [หลักการติดตาม](#หลักการติดตาม)
2. [Phase 0 — Project Bible](#phase-0--project-bible)
3. [Phase 1 — UI Review](#phase-1--ui-review)
4. [Phase 2 — Database](#phase-2--database)
5. [Phase 3 — Authentication](#phase-3--authentication)
6. [Phase 4 — Creator Dashboard](#phase-4--creator-dashboard)
7. [Phase 5 — Community](#phase-5--community)
8. [Phase 6 — Notifications](#phase-6--notifications)
9. [Phase 7 — Deployment](#phase-7--deployment)

## หลักการติดตาม

กำหนดวันเริ่ม วันสิ้นสุด owner และ release criteria: **ยังไม่ได้กำหนด** สถานะด้านล่างสะท้อนหลักฐานใน repository ไม่ใช่ commitment

## Phase 0 — Project Bible

**สถานะ:** กำลังดำเนินการ

- รวม overview, requirements, system design, route/component inventory และ confirmed/open decisions
- ทบทวนศัพท์ สถานะ content และขอบเขต MVP
- เกณฑ์เสร็จ: เอกสารได้รับการอนุมัติจากผู้มีอำนาจตัดสินใจ — ผู้อนุมัติยังไม่ได้กำหนด

## Phase 1 — UI Review

**สถานะ:** กำลังทบทวน wireframe

- ตรวจทุก public/member/admin page และ shared state
- ยืนยัน navigation, responsive behavior, accessibility และ content density
- ปิด open questions ใน `03_WIREFRAME_REVIEW.md`
- เกณฑ์เสร็จ: ทุกหน้ามี Approval = Approved

## Phase 2 — Database

**สถานะ:** ยังไม่เริ่ม

- เลือก database/ORM และออกแบบ schema, constraints, indexes, migration, retention
- ครอบคลุม account, content, taxonomy, social action, reading progress, moderation และ audit
- รายละเอียด implementation: **ยังไม่ได้กำหนด**

## Phase 3 — Authentication

**สถานะ:** ยังไม่เริ่ม

- ออกแบบ login/session, provider, roles และ server-side authorization
- กำหนด account linking, suspension, deletion/recovery และ security controls
- Provider และ policy: **ยังไม่ได้กำหนด**

## Phase 4 — Creator Dashboard

**สถานะ:** Epic 13 Creator Dashboard, Epic 14 Reader Navigation, and Community v1 are released; Notifications v1 architecture passed independent review

- Epic 13A: canonical `/creator/dashboard`, owner-scoped overview, recent content, attention, capabilities, and legacy mock-route migration
- Epic 13B: fixed seven-complete-UTC-day performance snapshot, comparison deltas, privacy suppression, and performance proof
- Epic 16: detailed Creator Analytics, arbitrary ranges, charts, drill-down, cohorts, and export
- Final Series/Publishing workflow remains unresolved and is not redesigned by Epic 13

## Phase 5 — Community

**สถานะ:** Community A/B/C and the test-runner closure passed final review and are released at `v1.3.0-alpha.1`

- Community v1 is bounded to Story/Episode Comments, one-level Replies, Comment Like, author edit/delete, spoiler marking, reporting, and platform-moderator Hide/Restore
- Release criteria are executable authorization, lifecycle, privacy, rate-limit, pagination, moderation, accessibility, clean-database, scale, and real-stack Browser E2E evidence with no mock fallback
- Reviews/Ratings require a separate Community v2 architecture; feeds, mentions, multiple reactions, ranking, recommendations, and real-time delivery remain deferred. Notifications now has an independently reviewed v1 architecture package
- Completion is measured by the objective Reader, Creator, Moderator, privacy, abuse-control, and Beta-readiness gates in the Community architecture documents, not an estimated percentage
- Implementation requires immediate privacy unlink, explicit public/operational/restricted record classes, restricted safety evidence, and no numeric retention duration or purge worker
- Community v1 has no automatic time-based safety-record expiry; the rejected 24-month proposal remains recorded as an independent-review finding, not an approved policy
- Beta/Production launch remains blocked until product, privacy, safety, legal, and operations owners approve retention duration/clock, legal-hold authority/release, audit expiry, purge operation/ownership, moderator staffing/SLA, and applicable distributed-limiter deployment

## Phase 6 — Notifications

**สถานะ:** Notifications A1/A2/B are complete and Notifications C process evidence is closed; independent final approval awaits remediation/re-review

- V1 is an authenticated in-app inbox for six approved low-fan-out event families
- PostgreSQL transactional outbox and an API-hosted at-least-once worker are selected; source mutation and outbox intent commit atomically
- Dedicated `/notifications`, unread polling/read state, privacy unlink, moderation-safe wording, bounded pagination, and no mock/persistence are required
- Story Like and follower publication fan-out, email/push/SMS, preferences, grouping, realtime, and dismissal remain deferred
- Notifications B delivered the real API-backed Bell, `/notifications`, polling, read state, accessibility, mobile behavior, and two consecutive real-stack Browser E2E passes
- Notifications C process evidence is closed; independent final approval remains separate, and worker/privacy correctness remains proven in A1/A2 rather than deferred
- Beta/Production launch remains gated on retention/legal-hold policy, dead-letter operational ownership/SLA, monitoring thresholds, shared cursor-secret deployment, and distributed rate limiting when horizontally scaled

## Phase 7 — Deployment

**สถานะ:** ยังไม่เริ่ม

- กำหนด environments, CI/CD, hosting, domain, storage/CDN, secrets, backup, monitoring และ incident response
- ทำ performance, security, accessibility และ launch readiness review
- Platform, budget, SLO และ launch date: **ยังไม่ได้กำหนด**
