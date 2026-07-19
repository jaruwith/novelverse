# การออกแบบฐานข้อมูล

| รายการ | ค่า |
|---|---|
| Purpose | บันทึกแบบจำลองข้อมูลที่พบใน mock data และสิ่งที่ยังไม่ได้ออกแบบสำหรับฐานข้อมูลจริง |
| Current Status | ไม่มีฐานข้อมูล; มีเพียง TypeScript types และ arrays จำลอง |
| Version | 0.1.0 |
| Last Updated | 19 กรกฎาคม 2569 |
| Author | Codex — Lead Software Architect and Technical Documentation Engineer |

## Table of Contents

1. [สถานะปัจจุบัน](#สถานะปัจจุบัน)
2. [แบบจำลองข้อมูลที่พบ](#แบบจำลองข้อมูลที่พบ)
3. [ความสัมพันธ์ที่อนุมานได้จากโค้ด](#ความสัมพันธ์ที่อนุมานได้จากโค้ด)
4. [Enum ที่พบ](#enum-ที่พบ)
5. [ข้อมูลที่ UI ต้องการแต่ยังไม่มี model](#ข้อมูลที่-ui-ต้องการแต่ยังไม่มี-model)
6. [สิ่งที่ยังไม่ได้กำหนด](#สิ่งที่ยังไม่ได้กำหนด)

## สถานะปัจจุบัน

ไม่มี database configuration, ORM, migration หรือ schema file ข้อมูลอยู่ใน `src/lib/mockData.ts` เท่านั้น จึงไม่ถือว่าเป็น database design ที่อนุมัติแล้ว

## แบบจำลองข้อมูลที่พบ

| Model | Field ที่มีใน mock type/data |
|---|---|
| Creator | `username`, `name`, `bio`, `joined`, `likes`, `works` |
| Story | `id`, `slug`, `title`, `type`, `status`, `publication`, `creator`, `category`, `tags[]`, `description`, `followers`, `editorial?`, `firstPublished`, `updated`, `color`, `chapters[]` |
| Chapter | `number`, `title`, `views`, `likes`, `comments`, `published`, `status` |
| Comment | `user`, `time`, `text`, `reported` |
| Report | `id`, `target`, `reporter`, `reason`, `status` |
| Category / Tag | string array; ไม่มี entity metadata ใน data layer |

## ความสัมพันธ์ที่อนุมานได้จากโค้ด

ความสัมพันธ์ต่อไปนี้เป็นความต้องการที่ UI แสดง ไม่ใช่ schema ที่ยืนยันแล้ว:

- Creator/Member 1 คนมี Story ได้หลายเรื่อง โดยอ้างผ่าน `Story.creator` → username
- Story 1 เรื่องมี Chapter หลายตอน
- Story มี Category หลัก 1 รายการ และ Tag หลายรายการ
- Like ผูกกับ Chapter; Follow ผูกกับ Story
- Comment แสดงในบริบท Story/Chapter แต่ mock comment ไม่มี foreign key
- Report ชี้ชนิดเป้าหมาย `COMMENT`, `STORY` หรือ `USER` แต่ไม่มี target id ใน mock data

## Enum ที่พบ

| Enum | ค่า |
|---|---|
| StoryType | `NOVEL`, `COMIC` |
| StoryStatus | `ONGOING`, `COMPLETED`, `HIATUS`, `CANCELLED` |
| PublicationStatus | `DRAFT`, `PUBLISHED`, `HIDDEN`, `ARCHIVED` |
| Role ใน UI | `guest`, `member`, `admin` |
| Report status ที่พบ | `OPEN`, `REVIEWING`; UI ยังแสดง resolved/rejected เป็นตัวเลือก |

## ข้อมูลที่ UI ต้องการแต่ยังไม่มี model

Account/email/social identity, role assignment, suspension, follow, chapter like, reading history/progress, story media, comic page, author note, suitability, social link, user settings, moderation action, report target, appeal, audit activity และ analytics event ยังไม่มี model จริง

## สิ่งที่ยังไม่ได้กำหนด

Database engine, ORM, keys, indexes, constraints, timestamps, soft delete, versioning, transaction boundary, retention, backup, encryption, PII handling, migration workflow, pagination model และ data ownership: **ยังไม่ได้กำหนด**
