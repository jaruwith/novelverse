# Advertisement Business Rules

# Purpose

กำหนดกฎโฆษณา wireframe ที่ยืนยันแล้วสำหรับ Novel Reader และ Comic Reader โดยแยก Standard Advertisement กับ Premium Popup

# Scope

ครอบคลุม mock advertisement pool, eligibility, การเรียงลำดับ, reader placement, link behavior, ad-free upsell และ demo controls ไม่ครอบคลุม ad server, billing, campaign management หรือฐานข้อมูล

# Current Business Rules

| รหัส | กฎธุรกิจ | หลักฐานหลัก |
|---|---|---|
| AD-001 | Novel Reader และ Comic Reader สามารถแสดงโฆษณาทุกชนิดที่ active ตามกฎของแต่ละประเภท | reader routes, `ReaderAdvertisements.tsx` |
| AD-002 | Standard Advertisement แสดงทุกใบที่ `isActive=true` เป็น vertical stack ก่อน reading content | `getActiveStandardAdvertisements`, reader wrapper |
| AD-003 | Standard ads ไม่มีเพดาน 3 รายการ ไม่มี rotation และไม่มี random selection | requirements และ implementation |
| AD-004 | Standard ads เรียง `sortOrder` จากน้อยไปมาก และใช้ `id` จากน้อยไปมากเมื่อ sortOrder เท่ากัน | mock helper |
| AD-005 | mock pool ปัจจุบันมี standard ads active 10 รายการ `ad-001`–`ad-010` | `mockAdvertisement.ts` |
| AD-006 | Standard card แสดง advertiser, label “โฆษณา”, image placeholder, optional title/description และ link | `StandardAdvertisementStack` |
| AD-007 | ผู้ใช้ Guest/Free Member ต้องเลื่อนผ่าน standard stack ทั้งหมดก่อนถึง novel text หรือ comic images | reader DOM order และ visual screenshots |
| AD-008 | เหนือ stack แสดง “โฆษณาจากผู้สนับสนุน” และ CTA “สมัครแบบไม่มีโฆษณา” ไป `/dashboard/settings` | reader wrapper |
| AD-009 | Ad-free Member และ Admin ไม่เห็น standard ads, Premium Popup หรือ upsell | eligibility helper |
| AD-010 | Premium Popup เป็น advertisement type แยก แสดง active item ได้สูงสุด 1 รายการ | `getActivePremiumPopup` |
| AD-011 | Premium Popup ป้องกัน interaction, มี countdown/progress และปุ่มปิดใช้ได้หลัง 5 วินาที | `PremiumAdvertisementPopup` |
| AD-012 | การคลิก standard ad หรือ Premium Popup เปิด target ในแท็บใหม่พร้อม `rel="noopener noreferrer"` | advertisement components |
| AD-013 | Premium Popup ปัจจุบันใช้ mock `premium-ad-001`; ไม่มี left/center/right placement สำหรับ standard ads | mock config และ standard stack |
| AD-014 | ระหว่าง Premium Popup active ระบบล็อก document scroll และป้องกัน wheel, touch และปุ่ม keyboard scrolling ที่กำหนด | `PremiumAdvertisementPopup` |
| AD-015 | Popup บล็อก background interaction, ใช้ modal dialog semantics และกัก focus ไว้ภายใน | `PremiumAdvertisementPopup` |
| AD-016 | Escape ปิด popup ได้เฉพาะหลัง countdown 5 วินาที; ก่อนหน้านั้นไม่มีผล | `PremiumAdvertisementPopup` |
| AD-017 | หลังปิด popup ระบบคืน scroll behavior และพาผู้ใช้ไปต้น standard advertisement section เพื่อไม่ให้ข้าม stack | `ReaderAdvertisementExperience` |

# User Flow

## Guest / Free Member

1. เปิด Novel หรือ Comic chapter
2. หาก Premium Popup active ระบบแสดง popup ก่อน interaction
3. ระหว่างรอ ระบบตรึง reader ไว้ด้านบน ล็อก scroll/background interaction และกัก focus ภายใน dialog
4. รอ 5 วินาทีจึงปิดด้วยปุ่มหรือ Escape ได้
5. หลังปิด ระบบพาไปต้น standard advertisement section และคืน scroll/keyboard behavior
6. เห็น reader header และ ad-free upsell ตามลำดับหน้า
7. เลื่อนผ่าน standard ads active ทุกใบตามลำดับ
8. ถึงเนื้อหานิยายหรือภาพการ์ตูน

## Ad-free Member / Admin

1. เปิด chapter
2. เห็น reader header
3. เข้าถึง reading content ทันที โดยไม่มี popup, stack หรือ upsell

# Confirmed Decisions

- Standard ads เป็น complete vertical stack ไม่จำกัดสาม slot
- ไม่สุ่มและไม่ rotate standard ads
- `sortOrder` และ `id` ควบคุมลำดับแบบ deterministic
- Premium Popup เป็น higher-tier/paid placement แยกจาก standard ads
- Reader scroll และ background interaction ถูกล็อกขณะ Premium Popup active
- Focus อยู่ภายใน popup และ Escape ใช้ได้เมื่อครบ 5 วินาทีแล้วเท่านั้น
- หลังปิด popup ผู้ใช้อยู่ที่จุดเริ่มต้นของ standard advertisement section
- Ad-free Member ไม่เห็นโฆษณาทุกประเภท
- Standard และ Premium link เปิดแท็บใหม่

# Pending Product Owner Decisions

- ⚠ Pending Product Owner Decision — ราคา แพ็กเกจ ระยะเวลา และการขาย Premium Popup
- ⚠ Pending Product Owner Decision — campaign start/end, targeting, frequency และ inactive behavior ใน production
- ⚠ Pending Product Owner Decision — ad content policy, prohibited categories และ approval workflow
- ⚠ Pending Product Owner Decision — impression/click definition, analytics, consent และ privacy
- ⚠ Pending Product Owner Decision — fallback เมื่อ image/target URL ใช้งานไม่ได้
- ⚠ Pending Product Owner Decision — จำนวน active ads สูงสุดเพื่อ performance; กฎปัจจุบันยืนยันให้แสดงทั้งหมด

# Future Ideas

ไม่มีแนวคิดโฆษณาอื่นที่ยืนยันได้จาก project ปัจจุบัน

# Related Documents

- [Membership](01_MEMBERSHIP.md)
- [Reading](03_READING.md)
- [Monetization](06_MONETIZATION.md)
- [Visual Screen Overview](../visual/SCREEN_OVERVIEW.html)
- [Requirements](../01_REQUIREMENTS.md)

# Revision History

| Version | Date | Change |
|---|---|---|
| 1.0 | 19 กรกฎาคม 2569 | รวมกฎ standard stack และ Premium Popup ที่ยืนยันแล้ว |
| 1.1 | 19 กรกฎาคม 2569 | ยืนยัน scroll lock, modal focus trap และตำแหน่งหลังปิด Premium Popup |
