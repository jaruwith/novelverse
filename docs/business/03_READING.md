# Reading Business Rules

# Purpose

รวบรวมกฎการค้นพบเรื่อง การอ่าน Novel/Comic การเดินตอน ความคืบหน้า และ social action ที่ยืนยันได้จาก wireframe

# Scope

ครอบคลุม public discovery, story detail, chapter readers, Following, History, comments, likes, follows และ reader advertisements ไม่ครอบคลุม persistence หรือ recommendation algorithm จริง

# Current Business Rules

| รหัส | กฎธุรกิจ | หลักฐานหลัก |
|---|---|---|
| RD-001 | Guest อ่าน Novel และ Comic ได้โดยไม่ต้องเข้าสู่ระบบ | Home, Login, readers |
| RD-002 | Content type มี `NOVEL` และ `COMIC`; แต่ละชนิดใช้ reader route แยก | mock types และ routes |
| RD-003 | Story detail แสดง metadata, creator, category, tags, totals, chapter list และ related works | `/story/[slug]` |
| RD-004 | Like ใช้กับ Chapter เท่านั้น; Follow ใช้กับ Story เท่านั้น | wireframe decisions |
| RD-005 | Story views และ story likes เป็นผลรวมค่าของ Chapter | `totalViews`, `totalLikes` |
| RD-006 | Comments เป็น flat ไม่มี replies และไม่มี comment likes | wireframe decisions, `CommentList` |
| RD-007 | Guest ที่ like/follow/comment/report จะถูกขอให้เข้าสู่ระบบ | protected actions |
| RD-008 | Novel Reader แสดงข้อความ ภาพประกอบ optional, author note, progress, navigation และ comments | Novel route |
| RD-009 | Comic Reader แสดงภาพแนวตั้ง, floating tools, author note, navigation และ comments | Comic route |
| RD-010 | Following รวมเรื่องที่ติดตามและตำแหน่งอ่าน; History แสดงตอนล่าสุดต่อเรื่อง | `/following`, `/history` |
| RD-011 | Published stories ใช้ใน discovery; Hidden และ Archived มี explicit state pages | mock filtering และ story detail |
| RD-012 | Guest/Free Member เห็น ads ก่อน reading content; Ad-free/Admin เข้าถึง content ทันที | reader advertisement wrapper |

# User Flow

1. ผู้ใช้เข้าสู่ Home, Categories หรือ Search
2. เปิด Story detail และเลือกเริ่มอ่าน/อ่านต่อ/ตอนที่ต้องการ
3. Reader แสดง flow โฆษณาตาม membership
4. ผู้ใช้อ่าน Novel text หรือเลื่อน Comic images
5. ใช้ previous/list/next navigation
6. Member สามารถ like, comment, follow และ report ตาม action ที่หน้าจอมี
7. Member กลับมาอ่านต่อผ่าน Following หรือ History

# Confirmed Decisions

- Guest อ่านได้โดยไม่ login
- Search อยู่ใน global header ของ public pages
- เรื่องมีหมวดหลักหนึ่งหมวดและแท็กได้หลายรายการ
- Notification center เป็น Future และไม่กระทบ MVP schema; MVP ใช้ Following แทน
- Like เป็นระดับ chapter, follow เป็นระดับ story
- Comments เป็น flat
- รองรับ desktop และ mobile browser

# Pending Product Owner Decisions

- ⚠ Pending Product Owner Decision — นิยาม reading progress วัดระดับ chapter หรือ scroll position
- ⚠ Pending Product Owner Decision — persistence, sync ข้ามอุปกรณ์ และ retention ของ History
- ⚠ Pending Product Owner Decision — search/ranking/recommendation algorithms และ editorial governance
- ⚠ Pending Product Owner Decision — behavior ที่ตอนแรก/สุดท้ายและ invalid chapter/slug
- ⚠ Pending Product Owner Decision — reader typography/theme/accessibility controls
- ⚠ Pending Product Owner Decision — policy สำหรับ hidden/archived accessibility

# Future Ideas

- Cross-device reading position ถูกกล่าวถึงในหน้า History ว่าเป็นความสามารถในอนาคต
- Creator-follow มี placeholder แต่ยังไม่รวมใน current reading/community rules

# Related Documents

- [Membership](01_MEMBERSHIP.md)
- [Advertisement](02_ADVERTISEMENT.md)
- [Creator](04_CREATOR.md)
- [Page Inventory](../PAGE_INVENTORY.md)
- [User Flows](../USER_FLOWS.md)

# Revision History

| Version | Date | Change |
|---|---|---|
| 1.0 | 19 กรกฎาคม 2569 | รวมกฎ reading และ discovery จาก wireframe ปัจจุบัน |
