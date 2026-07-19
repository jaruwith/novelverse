# Moderation Business Rules

# Purpose

รวบรวมกฎการดูแลผู้ใช้ เรื่อง ความคิดเห็น รายงาน หมวดหมู่ และแท็กที่ยืนยันได้จาก Admin/Member wireframe

# Scope

ครอบคลุม creator comment controls, Admin routes, visibility/status actions, report queue และ taxonomy management ไม่ครอบคลุม enforcement backend, SLA หรือ legal policy

# Current Business Rules

| รหัส | กฎธุรกิจ | หลักฐานหลัก |
|---|---|---|
| MOD-001 | Admin area เข้าถึงได้เฉพาะ role Admin ใน wireframe | `AppShell admin` |
| MOD-002 | Admin มีหน้าภาพรวม Users, Stories, Comments, Reports, Categories และ Tags | Admin routes/sidebar |
| MOD-003 | Admin สามารถระงับ/กู้คืนผู้ใช้ใน UI | Admin Users |
| MOD-004 | Admin สามารถซ่อน/กู้คืนเรื่องและความคิดเห็นใน UI | Admin Stories/Comments |
| MOD-005 | Report target รองรับ Comment, Story, Chapter และ User โดยต้องใช้ความสัมพันธ์ที่รักษา referential integrity ไม่ใช้ target_type/target_id แบบไร้ข้อบังคับ | confirmed architecture decision |
| MOD-006 | Report status ที่พบใน data คือ Open และ Reviewing; UI มี Resolve และ Reject actions | reports mock/UI |
| MOD-007 | Story reporting แสดงบน Story detail; Comic chapter reporting แสดงบน Comic Reader | public routes |
| MOD-008 | Hidden story แสดง state ว่าถูกซ่อนระหว่างตรวจสอบ; owner ยังดูสถานะใน dashboard | Story detail hidden state |
| MOD-009 | Archived story ไม่แสดงใน discovery แต่ URL state ยังอยู่สำหรับอ้างอิงใน wireframe | publicStories filter, archived state |
| MOD-010 | Creator ซ่อน comment ได้เฉพาะ comment บนผลงานของตน | Member Comments |
| MOD-011 | Admin จัดการ primary categories และ reusable tags; category หนึ่งต่อ story และ tags หลายรายการ | Taxonomy UI |
| MOD-012 | Action ทั้งหมดเป็น confirmation/feedback แบบ mock และไม่ persist | shared ConfirmButton, scope docs |
| MOD-013 | Report เพียงอย่างเดียวไม่นับเป็น creator strike | confirmed Product Owner decision |
| MOD-014 | Strike นับเมื่อ Admin ยืนยัน violation และส่ง warning emailแล้วเท่านั้น | confirmed Product Owner decision |
| MOD-015 | ModerationAction, evidence, warning-email audit และ resulting content state ต้องเก็บว่าใครทำ เมื่อใด และเพราะอะไร | confirmed architecture decision |

# User Flow

1. Member รายงาน target จากจุดที่ UI รองรับ
2. Report เข้าคิว Admin Reports ในระดับ wireframe
3. Admin ตรวจข้อมูลและเลือก hide target, Resolve หรือ Reject
4. Admin อาจเปิด User, Story หรือ Comment context ที่เกี่ยวข้อง
5. Creator แยกต่างหากสามารถซ่อน comment บนผลงานของตน
6. Taxonomy admin เพิ่ม/แก้ไข/archive Category หรือ Tag ผ่านฟอร์มจำลอง

# Confirmed Decisions

- Comments เป็น flat จึงไม่มี moderation ระดับ reply
- มี report target อย่างน้อย User, Story และ Comment ตาม mock data
- Hidden และ Archived เป็นคนละ publication state
- Creator moderation จำกัดเฉพาะ comments บนผลงานตน
- Admin มี content, user, report และ taxonomy moderation surfaces
- Report target ทั้ง Story, Chapter, Comment และ User ต้องอ้างอิง target จริงอย่างปลอดภัย
- Report ไม่ใช่ strike; confirmed violation พร้อม warning email เท่านั้นที่สร้าง strike

# Pending Product Owner Decisions

- ⚠ Pending Product Owner Decision — moderation policy, reason taxonomy และ prohibited content
- ⚠ Pending Product Owner Decision — report lifecycle/state machine ที่สมบูรณ์และ moderation SLA
- ⚠ Pending Product Owner Decision — assignment, evidence retention, strike expiry/reversal/threshold และ appeal
- ⚠ Pending Product Owner Decision — suspension duration, account recovery และ admin permission tiers
- ⚠ Pending Product Owner Decision — Hidden/Archived visibility ต่อ owner, reporter และ public ใน production

# Future Ideas

- Admin Overview แสดง “คำขออุทธรณ์” เป็น mock queue แต่ยังไม่มี route/workflow
- Reversible creator comment hiding ถูกระบุเป็นแนวคิด แต่ยังไม่มี persistence

# Related Documents

- [Membership](01_MEMBERSHIP.md)
- [Creator](04_CREATOR.md)
- [Reading](03_READING.md)
- [API Design](../05_API_DESIGN.md)
- [Wireframe Review](../03_WIREFRAME_REVIEW.md)

# Revision History

| Version | Date | Change |
|---|---|---|
| 1.0 | 19 กรกฎาคม 2569 | รวมกฎ moderation จาก Member/Admin wireframe |
| 1.1 | 19 กรกฎาคม 2569 | ยืนยัน safe report targets, ModerationAction, warning audit และ strike qualification |
