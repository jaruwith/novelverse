# Roadmap โครงการ NovelVerse

| รายการ | ค่า |
|---|---|
| Purpose | จัด milestone ตาม phase ที่กำหนด โดยยึดสถานะจาก repository และไม่กำหนดวันส่งมอบเอง |
| Current Status | Platform Foundation through Epic 12C is complete; Epic 13 Creator Dashboard architecture is approved and implementation is complete pending independent evidence review |
| Version | v1.0.0-alpha.2 architecture baseline |
| Last Updated | 29 กรกฎาคม 2569 |
| Author | Codex — Lead Software Architect and Technical Documentation Engineer |

## Table of Contents

1. [หลักการติดตาม](#หลักการติดตาม)
2. [Phase 0 — Project Bible](#phase-0--project-bible)
3. [Phase 1 — UI Review](#phase-1--ui-review)
4. [Phase 2 — Database](#phase-2--database)
5. [Phase 3 — Authentication](#phase-3--authentication)
6. [Phase 4 — Creator Dashboard](#phase-4--creator-dashboard)
7. [Phase 5 — Community](#phase-5--community)
8. [Phase 6 — Deployment](#phase-6--deployment)

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

**สถานะ:** Epic 13 architecture approved; backend and frontend implementation complete pending independent evidence review

- Epic 13A: canonical `/creator/dashboard`, owner-scoped overview, recent content, attention, capabilities, and legacy mock-route migration
- Epic 13B: fixed seven-complete-UTC-day performance snapshot, comparison deltas, privacy suppression, and performance proof
- Epic 16: detailed Creator Analytics, arbitrary ranges, charts, drill-down, cohorts, and export
- Final Series/Publishing workflow remains unresolved and is not redesigned by Epic 13

## Phase 5 — Community

**สถานะ:** Reader Library, Reading Progress, Moderation, Engagement Measurement, Story Like, and Creator Follow foundations are complete through Epic 12C; remaining Community work is future scope

- Follow story, chapter like, flat comments, history/progress และ reporting
- กำหนด moderation policy, anti-abuse, notification ที่จำเป็น และ privacy
- Creator Follow is implemented as authenticated relational current-state truth; notifications, public identity lists, feeds, comments/reviews, ranking, and recommendations remain future scope

## Phase 6 — Deployment

**สถานะ:** ยังไม่เริ่ม

- กำหนด environments, CI/CD, hosting, domain, storage/CDN, secrets, backup, monitoring และ incident response
- ทำ performance, security, accessibility และ launch readiness review
- Platform, budget, SLO และ launch date: **ยังไม่ได้กำหนด**
