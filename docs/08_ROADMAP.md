# Roadmap โครงการ NovelVerse

| รายการ | ค่า |
|---|---|
| Purpose | จัด milestone ตาม phase ที่กำหนด โดยยึดสถานะจาก repository และไม่กำหนดวันส่งมอบเอง |
| Current Status | Phase 0 และ Phase 1 อยู่ระหว่างดำเนินการ; phase หลังจากนั้นยังไม่เริ่มใน implementation |
| Version | 0.1.0 |
| Last Updated | 19 กรกฎาคม 2569 |
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

**สถานะ:** มี wireframe; production implementation ยังไม่เริ่ม

- เชื่อม profile, story/chapter CRUD, upload, draft/publish, comments, analytics และ settings กับระบบจริง
- เพิ่ม validation, ownership, error handling และ revision workflow
- Publishing workflow ขั้นสุดท้าย: **ยังไม่ได้กำหนด**

## Phase 5 — Community

**สถานะ:** มี wireframeบางส่วน; production implementation ยังไม่เริ่ม

- Follow story, chapter like, flat comments, history/progress และ reporting
- กำหนด moderation policy, anti-abuse, notification ที่จำเป็น และ privacy
- Creator-follow เป็น placeholder อนาคตและยังไม่อนุมัติสำหรับ MVP

## Phase 6 — Deployment

**สถานะ:** ยังไม่เริ่ม

- กำหนด environments, CI/CD, hosting, domain, storage/CDN, secrets, backup, monitoring และ incident response
- ทำ performance, security, accessibility และ launch readiness review
- Platform, budget, SLO และ launch date: **ยังไม่ได้กำหนด**
