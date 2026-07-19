# Business Rule Index

# Purpose

เป็นสารบัญกลางและ rule registry สำหรับ Business Documentation ของ NovelVerse หลัง Interactive Wireframe review

# Scope

ครอบคลุมกฎที่ยืนยันแล้วใน 6 domains พร้อมจุดขัดแย้งและเรื่องที่ยังรอ Product Owner ไม่แทนที่ system/database/API design documents

# Current Business Rules

| Domain | Rule Range | จำนวนกฎ | เอกสาร |
|---|---:|---:|---|
| Membership | MBR-001–MBR-012 | 12 | [01_MEMBERSHIP.md](01_MEMBERSHIP.md) |
| Advertisement | AD-001–AD-017 | 17 | [02_ADVERTISEMENT.md](02_ADVERTISEMENT.md) |
| Reading | RD-001–RD-012 | 12 | [03_READING.md](03_READING.md) |
| Creator | CR-001–CR-017 | 17 | [04_CREATOR.md](04_CREATOR.md) |
| Moderation | MOD-001–MOD-015 | 15 | [05_MODERATION.md](05_MODERATION.md) |
| Monetization | MON-001–MON-010 | 10 | [06_MONETIZATION.md](06_MONETIZATION.md) |

กฎข้าม domain ให้อ้างเจ้าของกฎหลักเพียงแห่งเดียว เช่น advertisement eligibility อยู่ใน AD-009 และเอกสาร Membership/Monetization อ้างความสัมพันธ์แทนการสร้างกฎใหม่

# User Flow

```text
Guest/Member → Discovery → Story detail → Reader
                                      ├─ Guest/Free: Premium → Upsell → Standard stack → Content
                                      └─ Ad-free/Admin: Header → Content

Member → Dashboard → Profile / Story / Chapter / Comments / Analytics / Settings
Admin  → Admin area → Users / Stories / Comments / Reports / Categories / Tags
```

# Confirmed Decisions

- Interactive Wireframe เป็น frontend-only prototype และ action ส่วนใหญ่ไม่ persist
- Guest อ่านได้; Member ทุกคน publish ได้; ไม่มี Creator role แยก
- Novel/Comic เป็น content types หลัก
- Social model: chapter like, story follow, flat comments
- Standard ads แสดงครบตามลำดับ; Premium Popup แยก; Ad-free/Admin ไม่เห็น ads
- Admin มี user/content/report/taxonomy moderation surfaces
- MVP ใช้ Google/Facebook social login และ MembershipEntitlement เป็นแหล่งสิทธิ์ไม่มีโฆษณา
- Public URL/slug scope, chapter display order, structured Novel content, ComicPage และ external MediaAsset storage ได้รับการยืนยัน
- Report targets มี referential integrity; strike เกิดหลัง confirmed violation และ warning emailเท่านั้น
- Creator support ส่งเงินตรงถึง Creator; รายได้ NovelVerse มาจาก ads และ ad-free membership

# Pending Product Owner Decisions

- ⚠ Pending Product Owner Decision — account merge/unlink/recovery, deletion และ production authorization
- ⚠ Pending Product Owner Decision — final publishing/content/moderation policies
- ⚠ Pending Product Owner Decision — media provider/limits/retention และ rich-content schema versioning
- ⚠ Pending Product Owner Decision — pricing, payment, subscription, advertiser billing และ support-data security
- ⚠ Pending Product Owner Decision — privacy, analytics, retention, accessibility และ operational SLA

# Future Ideas

- Cross-device reading progress
- Creator-follow placeholder
- Appeal queue ที่แสดงเป็น mock บน Admin Overview
- Slug history/redirect, coin-per-chapter และ notification center

รายการนี้สะท้อนเฉพาะสิ่งที่ปรากฏใน project และยังไม่ใช่ approved roadmap

# Related Documents

- [Project Overview](../00_PROJECT_OVERVIEW.md)
- [Requirements](../01_REQUIREMENTS.md)
- [System Design](../02_SYSTEM_DESIGN.md)
- [Wireframe Review](../03_WIREFRAME_REVIEW.md)
- [Product Decisions](../11_PRODUCT_DECISIONS.md)
- [Visual Screen Overview](../visual/SCREEN_OVERVIEW.html)

# Revision History

| Version | Date | Change |
|---|---|---|
| 1.0 | 19 กรกฎาคม 2569 | สร้าง consolidated business rule index หลัง wireframe review |
| 1.1 | 19 กรกฎาคม 2569 | รวมคำตัดสิน architecture ล่าสุดด้าน identity, content, moderation และ creator support |
