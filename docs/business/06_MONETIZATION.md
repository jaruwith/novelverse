# Monetization Business Rules

# Purpose

สรุป monetization surface ที่มีหลักฐานใน wireframe โดยไม่ออกแบบราคา การชำระเงิน หรือ revenue model ที่ยังไม่ได้รับอนุมัติ

# Scope

ครอบคลุมรายได้ NovelVerse จาก advertisements/ad-free membership และ creator support ที่ผู้สนับสนุนโอนตรงถึง Creator ไม่ครอบคลุม payment processing ของ NovelVerse สำหรับเงินสนับสนุนครีเอเตอร์

# Current Business Rules

| รหัส | กฎธุรกิจ | หลักฐานหลัก |
|---|---|---|
| MON-001 | Monetization surface ที่ implement ใน wireframe คือ Standard Advertisement, Premium Popup และ Ad-free membership CTA | reader components |
| MON-002 | Standard ads แสดงครบทุก active item ก่อน content สำหรับ Guest/Free Member | advertisement rules |
| MON-003 | Premium Popup เป็น higher-tier/paid placement แยกและแสดงได้สูงสุดหนึ่งรายการ | confirmed product decision |
| MON-004 | Ad-free membership ไม่ใช่ role; MembershipEntitlement เป็น source of truth ส่วน `isAdFreeMember` เป็น wireframe demo flag | confirmed architecture decision |
| MON-005 | CTA “สมัครแบบไม่มีโฆษณา” ลิงก์ไป settings ที่มีอยู่ ไม่ใช่ checkout | reader wrapper |
| MON-006 | ไม่มี database, payment, subscription backend หรือ external advertising service | scope docs และ source tree |
| MON-007 | ไม่มี paywall สำหรับ reading; Guest ยังอ่าน Novel/Comic ได้ | Login และ reader flow |
| MON-008 | CreatorSupportProfile/Method รองรับ bank, PromptPay, QR image และ external links โดยแสดงบน Creator Profile และท้ายทุก Chapter | confirmed Product Owner decision |
| MON-009 | เงินสนับสนุนไปยัง Creator โดยตรง; NovelVerse ไม่ประมวลผลและไม่หักเปอร์เซ็นต์ | confirmed Product Owner decision |
| MON-010 | รายได้ NovelVerse มาจาก advertisements และ ad-free membership | confirmed Product Owner decision |
| MON-011 | public support เป็น opt-in; bank/PromptPay เข้ารหัส at rest และ mask ใน Admin/log; QR ใช้ Cloudflare R2 โดยไม่เก็บ binary ใน PostgreSQL | confirmed Product Owner decision |

# User Flow

1. Guest/Free Member เปิด reader และเห็น Premium Popup เมื่อ active
2. หลังปิด popup ผู้ใช้เห็น upsell และ standard ad stack
3. CTA ad-free พาไป `/dashboard/settings` ซึ่งเป็น wireframe settings เท่านั้น
4. Ad-free Member อ่านได้ทันทีโดยไม่เห็น ads หรือ upsell
5. ไม่มีขั้นตอนชำระเงินจริงใน flow ปัจจุบัน

# Confirmed Decisions

- Premium Popup เป็น paid placement แยกจาก standard ads
- Ad-free entitlement ซ่อน standard ads, Premium Popup และ upsell
- Reading ไม่ถูกล็อกด้วย paywall
- Wireframe ไม่เชื่อม payment หรือ external ad network
- Creator support เป็น direct-to-creator flow ไม่ใช่ NovelVerse donation transaction หรือ payout
- MembershipEntitlement เก็บช่วงเวลา สถานะ แหล่งที่มา และ future payment reference

# Pending Product Owner Decisions

- ⚠ Pending Product Owner Decision — business model, currency, pricing, tax และ invoice
- ⚠ Pending Product Owner Decision — Ad-free pricing, renewal, cancellation, refund, grace period และ payment provider
- ⚠ Pending Product Owner Decision — advertiser packages, Premium Popup pricing และ campaign billing
- ⚠ Pending Product Owner Decision — key management/rotation, retention และ validation details ของ bank/PromptPay
- ⚠ Pending Product Owner Decision — sponsored content disclosure, metrics และ reporting obligations
- ⚠ Pending Product Owner Decision — payment provider, fraud, chargeback และ compliance

# Future Ideas

Coin-per-chapter เป็น Future และต้องไม่กระทบ MVP schema Notification center เป็น Future เช่นกัน Direct creator support เป็น Confirmed แต่ไม่สร้าง coin, wallet, NovelVerse donation transaction หรือ creator payout

# Related Documents

- [Advertisement](02_ADVERTISEMENT.md)
- [Membership](01_MEMBERSHIP.md)
- [Creator](04_CREATOR.md)
- [Project Scope](../WIREFRAME_SCOPE.md)
- [Roadmap](../08_ROADMAP.md)

# Revision History

| Version | Date | Change |
|---|---|---|
| 1.0 | 19 กรกฎาคม 2569 | สร้าง monetization baseline โดยจำกัดเฉพาะหลักฐานใน wireframe |
| 1.1 | 19 กรกฎาคม 2569 | ยืนยันแหล่งรายได้ NovelVerse, entitlement และ direct creator support |
| 1.2 | 19 กรกฎาคม 2569 | ยืนยัน opt-in, encryption/masking และ Cloudflare R2 สำหรับ creator support |
