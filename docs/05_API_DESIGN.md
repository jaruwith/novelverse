# การออกแบบ API

| รายการ | ค่า |
|---|---|
| Purpose | ระบุสถานะ API และรายการ capability ที่ UI ปัจจุบันต้องพึ่งพาในอนาคต |
| Current Status | ไม่มี API implementation หรือสัญญา API |
| Version | 0.1.0 |
| Last Updated | 19 กรกฎาคม 2569 |
| Author | Codex — Lead Software Architect and Technical Documentation Engineer |

## Table of Contents

1. [สถานะปัจจุบัน](#สถานะปัจจุบัน)
2. [Capability ที่ต้องรองรับ](#capability-ที่ต้องรองรับ)
3. [Access Matrix](#access-matrix)
4. [Contract และมาตรฐาน](#contract-และมาตรฐาน)
5. [คำถามเปิด](#คำถามเปิด)

## สถานะปัจจุบัน

ไม่พบ Route Handler, Server Action, API client, backend service หรือ network request ข้อมูลทุกหน้า import จาก mock data โดยตรง ดังนั้น endpoint, HTTP method และ payload ทั้งหมดยังไม่ได้กำหนด

## Capability ที่ต้องรองรับ

ตารางนี้เป็น inventory จาก UI ไม่ใช่ endpoint proposal:

| Domain | Read capability | Write capability ที่ UI แสดง |
|---|---|---|
| Discovery | home shelves, categories, category result, search | ไม่มี |
| Story | detail, chapters, related stories, visibility state | create/edit/draft/publish/follow/report |
| Chapter | novel/comic content, metrics, author note | create/edit/archive/publish/like/report |
| Creator/Profile | public profile และ works | edit profile/media/social links |
| Library | following, history, reading position | follow/unfollow, update progress, clear history |
| Comment | list | create, creator hide, admin hide/restore |
| Account | session/role/settings | social login/link, settings, delete request |
| Admin | dashboard, users, stories, comments, reports, taxonomy | suspend/restore, hide/restore, resolve/reject, taxonomy CRUD/archive |
| Analytics | summary, trend, rankings | event ingestion ยังไม่ปรากฏใน UI |

## Access Matrix

| Capability | Guest | Member | Admin |
|---|---:|---:|---:|
| อ่านเนื้อหา public | ✓ | ✓ | ✓ |
| Like/Follow/Comment/Report | ไม่ได้; แสดง login dialog | แสดงว่าได้ | แสดงว่าได้ |
| Publish และ member dashboard | ไม่ได้ | แสดงว่าได้ | แสดงว่าได้ |
| Admin area | ไม่ได้ | ไม่ได้ | แสดงว่าได้ |

ตารางนี้สะท้อน UI guard เท่านั้น การกำหนด authorization ฝั่ง server ยังไม่ได้กำหนด

## Contract และมาตรฐาน

API style (REST/GraphQL/RPC), URL convention, versioning, authentication mechanism, pagination, sorting/filter syntax, idempotency, validation/error format, rate limit, upload protocol, cache policy, webhook และ API documentation format: **ยังไม่ได้กำหนด**

## คำถามเปิด

- Search/ranking จะคำนวณอย่างไรและต้อง near-real-time หรือไม่
- Reading progress จะบันทึกระดับ chapter หรือ scroll position
- Follow/like จะรองรับ optimistic update และ deduplication อย่างไร
- Moderation action ต้องมี reason, audit trail, appeal และ notification หรือไม่
- การ publish ต้องมี review workflow, scheduling หรือ revision history หรือไม่
