# Membership Business Rules

# Purpose

รวบรวมกฎสมาชิกและสิทธิ์การเข้าถึงที่ยืนยันได้จาก role switcher, reader advertising, login, dashboard shell และเอกสาร wireframe ปัจจุบัน

# Scope

ครอบคลุม Guest, Member, Admin, Google/Facebook social login สำหรับ MVP, account linking และ MembershipEntitlement สำหรับสิทธิ์ไม่มีโฆษณา ไม่ครอบคลุม payment processing จริง

# Current Business Rules

| รหัส | กฎธุรกิจ | หลักฐานหลัก |
|---|---|---|
| MBR-001 | ระบบ wireframe มี role หลัก 3 ค่า: Guest, Member และ Admin | `RoleProvider.tsx`, global role switcher |
| MBR-002 | ค่า role เริ่มต้นของ wireframe คือ Member | `RoleProvider.tsx` |
| MBR-003 | Guest อ่านเนื้อหาสาธารณะ นิยาย และการ์ตูนได้โดยไม่เข้าสู่ระบบ | Login, reader routes, `USER_FLOWS.md` |
| MBR-004 | Guest ต้องเข้าสู่ระบบก่อน like chapter, follow story, comment หรือ report | `ProtectedAction`, `CommentList`, login-required dialog |
| MBR-005 | Following และ History เป็นพื้นที่สำหรับ Member; Guest เห็นคำเชิญเข้าสู่ระบบ | `/following`, `/history` |
| MBR-006 | Member ทุกคนเผยแพร่ Novel หรือ Comic ได้ ไม่มี Creator role แยก | `WIREFRAME_DECISIONS.md`, Login, Dashboard |
| MBR-007 | Dashboard ปฏิเสธ Guest; Admin shell ยอมเฉพาะ Admin | `AppShell` |
| MBR-008 | Ad-free ไม่ใช่ role ใหม่; production source of truth คือ MembershipEntitlement ที่มี start date, end date, status, source และ future payment reference ส่วน `isAdFreeMember` เป็น demo flag เท่านั้น | confirmed architecture decision |
| MBR-009 | Guest และ Free Member เห็น reader advertisements; Ad-free Member และ Admin ไม่เห็น | eligibility helper และ reader implementation |
| MBR-010 | role และ ad-free flag อยู่ใน React memory เท่านั้นและไม่ persist | `RoleProvider.tsx`, system design |
| MBR-011 | MVP authentication ใช้ Google และ Facebook social login เท่านั้น | confirmed architecture decision |
| MBR-012 | SocialIdentity แยกจาก User และ User หนึ่งรายเชื่อมหลาย provider ได้ | confirmed architecture decision |

# User Flow

1. Guest สำรวจและอ่านเนื้อหาได้ทันที
2. เมื่อ Guest เรียก social action ระบบเปิด dialog ไปหน้า `/login`
3. เมื่อเป็น Member จะเข้าถึง Following, History และ Dashboard ได้
4. Member ที่ `isAdFreeMember=false` เป็น Free Member ใน demo และเห็นโฆษณาใน reader
5. Member ที่ `isAdFreeMember=true` อ่านโดยไม่มีโฆษณาและไม่มี ad-free upsell
6. Admin เข้าถึง Admin area และไม่เห็น reader advertisements

# Confirmed Decisions

- Public Member Profile และ Creator Profile เป็นหน้าเดียวกัน
- ไม่มี Creator role แยกจาก Member
- Member ทุกคนสร้างและเผยแพร่ผลงานได้
- Notification center เป็น Future และไม่กระทบ MVP schema; MVP ใช้ Following แทน
- Ad-free Member ยังคงเป็น Member ไม่เปลี่ยนชื่อ role เป็น Premium
- Google และ Facebook เป็น authentication providers เท่านั้นสำหรับ MVP
- MembershipEntitlement เป็น source of truth; ห้ามใช้ boolean เป็นข้อมูลสิทธิ์จริง

# Pending Product Owner Decisions

- ⚠ Pending Product Owner Decision — account merge/unlink/recovery และกรณี provider email เปลี่ยน
- ⚠ Pending Product Owner Decision — entitlement status transitions, grace period และ overlapping periods
- ⚠ Pending Product Owner Decision — ราคา ระยะเวลา ต่ออายุ ยกเลิก และคืนเงินของ membership
- ⚠ Pending Product Owner Decision — สิทธิ์ของ Admin ใน Member Dashboard สำหรับ production
- ⚠ Pending Product Owner Decision — account deletion, recovery period, data retention และ privacy policy

# Future Ideas

- การจำประวัติและตอนล่าสุดข้ามอุปกรณ์ถูกกล่าวถึงเป็นความสามารถในอนาคตบนหน้า History
- Creator-follow แสดงเป็นปุ่ม disabled “เร็ว ๆ นี้” และยังไม่ใช่กฎ MVP ที่อนุมัติ

# Related Documents

- [Advertisement](02_ADVERTISEMENT.md)
- [Reading](03_READING.md)
- [Creator](04_CREATOR.md)
- [Requirements](../01_REQUIREMENTS.md)
- [Product Decisions](../11_PRODUCT_DECISIONS.md)

# Revision History

| Version | Date | Change |
|---|---|---|
| 1.0 | 19 กรกฎาคม 2569 | สร้าง baseline จาก interactive wireframe ที่ review แล้ว |
| 1.1 | 19 กรกฎาคม 2569 | ยืนยัน Google/Facebook social identities และ MembershipEntitlement เป็น source of truth |
