# แบบจำลองโดเมนธุรกิจ (Domain Model)

## Purpose

อธิบายขอบเขตข้อมูลเชิงธุรกิจของ NovelVerse จาก Interactive Wireframe และเอกสารธุรกิจที่อนุมัติแล้ว เพื่อเป็นภาษากลางก่อนออกแบบฐานข้อมูลเชิงกายภาพ โดยไม่กำหนดตารางหรือคอลัมน์จริง

## Scope

ครอบคลุม Identity, Membership, Creator, Story, Chapter, Reading, Comment, Moderation, Advertisement, Category และ Tag ตามสิ่งที่พบในโครงการปัจจุบัน ส่วน Search, Analytics, Administration และสื่อแนบอธิบายในฐานะความสามารถหรือขอบเขตที่ยังต้องตัดสินใจ

Creator support ได้รับการยืนยัน แต่เงินโอนตรงถึง Creator จึงไม่สร้าง DonationTransaction, ระบบรับชำระเงิน, revenue-share หรือ payout entity ของ NovelVerse

## Architecture Decisions

### หลักการจำแนก

- **Confirmed**: มีหลักฐานจากเอกสารธุรกิจ เส้นทาง UI หรือ mock data และจำเป็นต่อความหมายของระบบ
- **Pending**: มีความต้องการระดับ UI/ธุรกิจ แต่รูปแบบข้อมูลหรือวงจรชีวิตยังไม่อนุมัติ
- **Future**: แนวคิดที่เอกสารระบุว่าอาจทำภายหลัง ไม่ใช่ขอบเขต MVP
- Guest เป็นผู้ใช้ไม่ระบุตัวตน ไม่ใช่เอนทิตีถาวร ส่วน Member และ Admin เป็นบทบาทของ User ไม่ใช่ชนิดผู้ใช้แยกกัน
- Creator ไม่ใช่ role แยกต่างหาก: Member ทุกคนมีความสามารถเผยแพร่ผลงานและมีโปรไฟล์ครีเอเตอร์รวมอยู่ในโปรไฟล์เดียว

### Confirmed domains และเอนทิตี

#### Identity และ Creator

| Entity | Purpose | Owner | Relationships | Lifecycle | Examples | Expected major attributes |
|---|---|---|---|---|---|---|
| User | ตัวตนสมาชิกหรือผู้ดูแลระบบ | เจ้าของบัญชี; การกำกับดูแลโดย Admin | มี SocialIdentity หลายรายการ, โปรไฟล์, Story และ interactions | สร้างจาก social login; suspend/restore; การลบบัญชียัง Pending | Member, Admin | UUID, บทบาท, account status, timestamps |
| SocialIdentity | ตัวตนจาก Google หรือ Facebook สำหรับ MVP | User | หลาย identity ต่อ User; provider identity หนึ่งเชื่อม User เดียว | link/unlink ตาม account policy | Google subject, Facebook user ID | provider, provider subject, email snapshot, linked time |
| UserProfile | โปรไฟล์สาธารณะเดียวที่รวมข้อมูลสมาชิกและครีเอเตอร์ | User หนึ่งราย | เป็นของ User แบบหนึ่งต่อหนึ่ง, เป็นเจ้าของ creator slug และ CreatorSupportProfile | สร้าง/แก้ไข; creator delete ใช้ soft delete | `@creator-slug` | creator slug, ชื่อแสดงผล, bio, social links, ภาพโปรไฟล์ |

#### Story, Chapter และ Taxonomy

| Entity | Purpose | Owner | Relationships | Lifecycle | Examples | Expected major attributes |
|---|---|---|---|---|---|---|
| Story | Aggregate root ของผลงาน Novel หรือ Comic | User ผู้สร้าง | มี Chapter, Category หลัก, Tags และ reports | Draft/Published/Hidden/Archived; creator delete เป็น soft deleteและไม่เท่ากับ Archive | `/@creator-slug/story-slug` | UUID, creator-scoped slug, ประเภท, metadata, story/publication status |
| Chapter | หน่วยเนื้อหาที่อ่านได้ของ Story | เจ้าของ Story | มี NovelContent หรือ ComicPage ตามชนิด; รับ like/comment/report | สร้าง/เผยแพร่/จัดลำดับใหม่/soft delete | chapter slug ภายใน Story | UUID, slug, title, displayed number/label, `display_order`, status |
| NovelContent | structured rich content ของ Novel Chapter | Chapter | หนึ่งต่อหนึ่งกับ Novel Chapter | แก้ไขตาม revision policy ที่ยัง Pending | rich document | structured document, format/schema version |
| ComicPage | หน้าการ์ตูนที่มีลำดับ | Comic Chapter | หลายรายการต่อ Chapter และอ้าง MediaAsset | เพิ่ม/ลบ/เรียงใหม่ | หน้า 1 | UUID, media asset, `display_order`, alt text |
| MediaAsset | metadata ของไฟล์ที่เก็บนอก PostgreSQL | domain object ที่อ้างใช้ | ใช้กับ profile, story, comic page, advertisement, QR และ evidence | upload/active/deleted ตาม retention policy | cover, comic page, QR image | UUID, object key/URL, MIME type, size, metadata, status |
| Category | หมวดหลักสำหรับการค้นพบ Story | Admin | Category หนึ่งมี Story หลายเรื่อง; Story มี Category หลักหนึ่งรายการ | Admin จัดการรายการ; เงื่อนไขลบ/รวมหมวดยัง Pending | แฟนตาซี | ชื่อ, slug, ลำดับแสดงผล, สถานะใช้งาน |
| Tag | ป้ายกำกับหลายค่าของ Story | Admin | เชื่อม Story แบบ many-to-many ผ่าน StoryTag | Admin จัดการรายการ; เงื่อนไขลบ/รวมแท็กยัง Pending | ผจญภัย | ชื่อ, slug, ลำดับแสดงผล, สถานะใช้งาน |
| StoryTag | ความสัมพันธ์ระหว่าง Story และ Tag | Story aggregate | เป็น junction ของ Story กับ Tag | เพิ่ม/ถอดระหว่างแก้ไขเรื่อง | Story A + Tag แฟนตาซี | ตัวอ้างอิง Story และ Tag, เวลาสร้างความสัมพันธ์ |

#### Reading และ Community interaction

| Entity | Purpose | Owner | Relationships | Lifecycle | Examples | Expected major attributes |
|---|---|---|---|---|---|---|
| StoryFollow | บันทึกว่า Member ติดตาม Story | User | เชื่อม User กับ Story แบบ many-to-many | สร้างเมื่อ follow และยกเลิกเมื่อ unfollow | Member A follows Story B | User, Story, เวลาติดตาม |
| ChapterLike | บันทึกว่า Memberกดถูกใจ Chapter | User | เชื่อม User กับ Chapter แบบ many-to-many | สร้าง/ยกเลิกจากปุ่ม like | Member A likes Chapter 1 | User, Chapter, เวลากดถูกใจ |
| Comment | ความเห็นแบบ flat บนหน้าการอ่าน | User ผู้เขียน; ผู้สร้างเรื่องดูแลในขอบเขตผลงานตน | อยู่ใต้ Chapter และจึงสืบถึง Story; ถูก report/hide ได้ | สร้าง, แสดง, ซ่อน/กู้คืน; การแก้ไข/ลบถาวรยัง Pending | ความเห็นตัวอย่างใน reader | ผู้เขียน, ข้อความ, สถานะ, เวลาสร้าง/แก้ไข |
| ReadingProgress | ตำแหน่งหรือประวัติการอ่านของ Member | User | เชื่อม User กับ Story และ chapter ล่าสุด | UI มี History; วิธีอัปเดต, retention และการ sync ยัง Pending | อ่านถึงตอนที่ 3 | Story, chapter ล่าสุด, เวลาที่อ่านล่าสุด, ตำแหน่งภายในตอนถ้ามี |

#### Moderation และ Administration

| Entity | Purpose | Owner | Relationships | Lifecycle | Examples | Expected major attributes |
|---|---|---|---|---|---|---|
| Report | คำร้องให้ Admin ตรวจ User, Story หรือ Comment; UI Comic แสดงการรายงาน Chapter ด้วย | User ผู้รายงาน; Admin ผู้พิจารณา | มี reporter หนึ่งรายและ target หนึ่งรายการ | Open → Reviewing → Resolve/Reject ตาม UI; นิยามผลลัพธ์และ SLA ยัง Pending | `RPT-001` | target type/reference, เหตุผล, สถานะ, reporter, เวลา |

| ModerationAction | บันทึกการตัดสินใจของ Admin | Admin | อ้าง Report, target, evidence และ resulting content state | append เมื่อดำเนินการ | hide, restore, confirm violation | actor, time, reason, action type, before/after state |
| WarningEmail | audit ของอีเมลเตือน | ModerationAction | อยู่ใต้ actionและอ้าง recipient User | queued/sent/failed | warning email | recipient, template/version, status, sent time, provider reference |
| CreatorStrike | strike หลัง Admin ยืนยัน violation และส่ง warning emailแล้วเท่านั้น | Creator/User | อ้าง qualifying ModerationAction และ WarningEmail | counted/reversed/expired ตาม policy Pending | strike 1 ครั้ง | creator, action, email, counted time, status |
| ModerationEvidence | หลักฐานของ ModerationAction | ModerationAction | หลายรายการต่อ action; อาจอ้าง MediaAsset | เก็บตาม retention policy | screenshot/reference | type, media/reference, note, captured time |

Report เพียงอย่างเดียวไม่ใช่ strike และ target ต้องอ้าง User, Story, Chapter หรือ Comment ด้วยความสัมพันธ์ที่บังคับ referential integrity ได้ ไม่ใช้เพียง `target_type/target_id` แบบไร้ข้อบังคับ Admin เป็น role ของ User ไม่ใช่เอนทิตีแยก

#### Advertisement และ Membership

| Entity | Purpose | Owner | Relationships | Lifecycle | Examples | Expected major attributes |
|---|---|---|---|---|---|---|
| Advertisement | แนวคิดหลักของโฆษณาที่ active และแสดงตามชนิด | ผู้ดูแลข้อมูลโฆษณา; ผู้ลงโฆษณายังเป็นเพียงข้อความ | แบ่งชนิด STANDARD และ PREMIUM_POPUP | เปิด/ปิดด้วย isActive; STANDARD เรียงครบทุกชิ้น, PREMIUM แสดงไม่เกินหนึ่ง | `ad-001`, `premium-ad-001` | ชนิด, advertiser name, title/description, image URL, target URL, active, sort order, close delay |
| MembershipEntitlement | source of truth ของสิทธิ์ “สมาชิกไม่มีโฆษณา” โดยไม่เปลี่ยน Member role | User | User มี entitlement ตามช่วงเวลาได้ | เริ่ม, active/expire/revoke | Ad-free Member | start date, end date, status, source, future payment reference |

#### Creator Support

| Entity | Purpose | Owner | Relationships | Lifecycle | Examples | Expected major attributes |
|---|---|---|---|---|---|---|
| CreatorSupportProfile | ข้อมูลสนับสนุนบน Creator Profile และท้ายทุก Chapter | Creator/UserProfile | มี CreatorSupportMethod หลายรายการ | เปิด/ปิดและ soft delete | ข้อความเชิญสนับสนุน | status, message, disclosure |
| CreatorSupportMethod | ช่องทางรับเงินตรงของ Creator | CreatorSupportProfile | อาจอ้าง MediaAsset สำหรับ QR | สร้าง/เรียง/ปิดใช้/soft delete | bank, PromptPay, QR, external link | type, destination details, QR media, URL, display order |

NovelVerse ไม่รับหรือหักเปอร์เซ็นต์จากเงินสนับสนุน รายได้ของ NovelVerse มาจากโฆษณาและ ad-free membership

### Pending domains และเอนทิตีผู้สมัคร

รายการต่อไปนี้ **ยังไม่ใช่เอนทิตีที่อนุมัติให้สร้างจริง**:

- UserPreference — ⚠ Pending Product Owner Decision: ขอบเขตและการคงอยู่ของค่าจากหน้า Settings
- Appeal — ⚠ Pending Product Owner Decision: workflow, ผู้อนุมัติ และ SLA ของการอุทธรณ์
- AdvertisementCampaign / Advertiser — ⚠ Pending Product Owner Decision: โครงการปัจจุบันยืนยันเพียงชื่อผู้ลงโฆษณาและรายการโฆษณา ไม่ได้ยืนยัน campaign หรือบัญชี advertiser
- SearchDocument / AnalyticsEvent — ⚠ Pending Product Owner Decision: ปัจจุบัน Search และ Analytics เป็น UI/mock capability และยังไม่มี event collection

### Future domains

- การ sync reading progress ข้ามอุปกรณ์เป็น Future Idea
- creator-follow และ appeals queue เป็น Future Idea
- Slug history/redirect, coin-per-chapter และ notification center เป็น Future และไม่กระทบ MVP schema

## Confirmed Decisions

- User role มี Guest, Member และ Admin; Guest ไม่ต้องมีระเบียนถาวร
- Member ทุกคนเป็น Creator ได้ และมีโปรไฟล์สาธารณะรวมหนึ่งโปรไฟล์
- Story รองรับ Novel/Comic, มีหนึ่ง Category หลัก, หลาย Tag และหลาย Chapter
- Like อยู่ระดับ Chapter; Follow อยู่ระดับ Story; Comment เป็นโครงสร้าง flat
- Report ครอบคลุม COMMENT/STORY/CHAPTER/USER ด้วย referentially safe target relationships
- โฆษณามี STANDARD แบบเรียงเต็ม stack และ PREMIUM_POPUP แยกชนิด
- Guest/Free Member เห็นโฆษณา; Ad-free Member/Admin ไม่เห็น
- PostgreSQL เป็น planned engine และ principal entities ใช้ UUID primary keys
- MVP login ใช้ Google/Facebook; User เชื่อม SocialIdentity ได้หลายรายการ
- Public story URL คือ `/@creator-slug/story-slug`; creator slug unique ทั้งระบบ, story slug unique ภายใน Creator และ chapter slug unique ภายใน Story
- Chapter ใช้ `display_order`; Novel ใช้ structured rich content; Comic ใช้ ordered ComicPage
- MediaAsset เก็บ metadata/object reference โดยไฟล์อยู่นอก relational database
- Creator support ส่งเงินตรงถึง Creator และไม่ผ่าน NovelVerse

## Pending Product Owner Decisions

- ⚠ Pending Product Owner Decision: account merge/unlink/recovery และกรณี provider email เปลี่ยน
- ⚠ Pending Product Owner Decision: entitlement status vocabulary, grace period, renewal/refund และ payment provider
- ⚠ Pending Product Owner Decision: structured rich-content schema/versioning และ revision history
- ⚠ Pending Product Owner Decision: media limits, storage provider, malware scan, retention และ orphan cleanup
- ⚠ Pending Product Owner Decision: ReadingProgress ต้องละเอียดระดับใดและเก็บนานเท่าใด
- ⚠ Pending Product Owner Decision: strike expiry/reversal/threshold/appeal และ moderation SLA
- ⚠ Pending Product Owner Decision: retention และ audit policy ราย domain
- ⚠ Pending Product Owner Decision: Campaign, impression/click metrics และ privacy ของ Advertisement
- ⚠ Pending Product Owner Decision: การเข้ารหัส/ปกปิดข้อมูลบัญชีธนาคารและ PromptPay

## Future Considerations

Slug history/redirect, coin-per-chapter และ notification center เป็น Future ไม่ใช่ MVP รักษา aggregate ให้เล็ก และเพิ่ม search/analytics store เมื่อมีข้อกำหนดด้านปริมาณจริงเท่านั้น

## Related Documents

- [Business Rule Index](../business/BUSINESS_RULE_INDEX.md)
- [Membership](../business/01_MEMBERSHIP.md)
- [Advertisement](../business/02_ADVERTISEMENT.md)
- [Reading](../business/03_READING.md)
- [Creator](../business/04_CREATOR.md)
- [Moderation](../business/05_MODERATION.md)
- [Monetization](../business/06_MONETIZATION.md)
- [Entity Relationship](02_ENTITY_RELATIONSHIP.md)

## Revision History

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-07-19 | Lead Solution Architect | สร้าง domain model จาก business documentation และ wireframe ปัจจุบัน |
| 1.1 | 2026-07-19 | Lead Solution Architect | เพิ่ม confirmed identity, content/media, safe moderation และ creator support architecture |
