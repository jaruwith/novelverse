# Physical Column Dictionary

## Purpose

นิยามทุก column ของ MVP physical schema รวม **347 columns** โดยใช้ common audit profiles เพื่อลดข้อความซ้ำ แต่ audit profile ที่ระบุในแต่ละ tableถือเป็น columns จริงของ table นั้น

## Reading Convention

| Token | Meaning |
|---|---|
| Null | `N` = nullable, `NN` = NOT NULL |
| Class | `Public`, `Internal`, `Personal`, `Restricted` |
| Index | `PK`, `FK`, `UQ`, `IX`, `—`; รายละเอียด exact indexอยู่ใน [Index Plan](06_PHYSICAL_INDEX_PLAN.md) |
| Default | `generated UUID` และ `current timestamp` เป็น design expressions ไม่ใช่ executable SQL |

ไม่กำหนด `varchar(n)` เพราะยังไม่มี approved hard character limits ใช้ `text` พร้อม business validation ที่ application และ constraint เมื่อ vocabulary/limit ได้รับอนุมัติ

## Common Column Profiles

### Audit Mutable (`A`, 4 columns)

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index / notes |
|---|---|---|---|---|---|---|---|
| `created_at` | `timestamptz` | NN | current timestamp | เวลา UTC ที่สร้าง | Internal | `2026-07-19T09:00:00Z` | timeline candidate |
| `created_by` | `uuid` | N | none | actor FK → `users.id`; null เฉพาะ system/bootstrap | Internal | UUID | FK; audit naming exception |
| `updated_at` | `timestamptz` | NN | current timestamp | เวลา UTC ที่แก้ล่าสุด; ต้องไม่ก่อน created_at | Internal | timestamp | IX บาง workload |
| `updated_by` | `uuid` | N | none | actor FK → `users.id`; null เฉพาะ system | Internal | UUID | FK |

### Audit Soft-delete (`S`, 6 columns)

Profile `S` รวม 4 columns จาก `A` และเพิ่ม:

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index / notes |
|---|---|---|---|---|---|---|---|
| `deleted_at` | `timestamptz` | N | null | เวลา soft delete; null = ไม่ถูกลบ | Internal | timestamp | partial-query predicate |
| `deleted_by` | `uuid` | N | null | actor FK → `users.id`; มีค่าเมื่อ user/admin ลบ | Internal | UUID | FK |

### Audit Immutable (`I`, 2 columns)

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index / notes |
|---|---|---|---|---|---|---|---|
| `created_at` | `timestamptz` | NN | current timestamp | เวลาเกิด relationship/event | Internal | timestamp | ordered-list IX |
| `created_by` | `uuid` | N | none | actor FK → `users.id` เมื่อมี authenticated actor | Internal | UUID | FK |

## Identity and Membership

### `users` — 11 columns (base 5 + `S`)

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NN | generated UUID | principal identity; ไม่ใช้ใน public URL | Internal | UUID | PK |
| `role` | `user_role` | NN | `MEMBER` | authorization role; Guest ไม่ถูกเก็บ | Internal | `ADMIN` | IX |
| `status` | `user_status` | NN | `ACTIVE` | account lifecycle | Internal | `SUSPENDED` | IX |
| `last_login_at` | `timestamptz` | N | null | successful social login ล่าสุด UTC | Personal | timestamp | — |
| `activated_at` | `timestamptz` | N | null | setเมื่อ Terms+Privacy current versionsได้รับการยอมรับและ accountเปลี่ยน ACTIVE | Internal | timestamp | IX/status gate |
| _Audit profile_ | — | — | — | `S`: created/updated/deleted actor+time | Internal | — | audit FKs |

### `social_identities` — 11 columns (base 7 + `A`)

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NN | generated UUID | identity record | Internal | UUID | PK |
| `user_id` | `uuid` | NN | none | owning User | Internal | UUID | FK, UQ pair |
| `provider` | `social_provider` | NN | none | Google/Facebook only | Internal | `GOOGLE` | UQ |
| `provider_subject` | `text` | NN | none | immutable provider user identifier; nonblank | Restricted | `1098…` | global UQ with provider |
| `provider_email` | `text` | N | null | provider email snapshot; ไม่ใช้เป็น identity key | Personal | `reader@example.com` | — |
| `linked_at` | `timestamptz` | NN | current timestamp | เวลา link provider | Internal | timestamp | — |
| `last_login_at` | `timestamptz` | N | null | login ล่าสุดผ่าน identity นี้ | Personal | timestamp | — |
| _Audit profile_ | — | — | — | `A` | Internal | — | audit FKs |

### `user_profiles` — 13 columns (base 7 + `S`)

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NN | generated UUID | profile identity | Internal | UUID | PK |
| `user_id` | `uuid` | NN | none | exactly one profile per User | Internal | UUID | FK, UQ |
| `creator_slug` | `text` | NN | none | global public slug; normalized/nonblank | Public | `praewa-writes` | UQ |
| `display_name` | `text` | NN | none | public Creator/Member name; nonblank | Public | `แพรวา` | Future search IX |
| `bio` | `text` | N | null | public biography | Public | `นักเขียน...` | — |
| `avatar_media_asset_id` | `uuid` | N | null | profile image metadata | Public | UUID | FK |
| `social_links` | `jsonb` | NN | empty object | approved public links; JSON object only | Public | `{"website":"…"}` | no generic GIN |
| _Audit profile_ | — | — | — | `S` | Internal | — | audit FKs |

### `legal_documents` — 13 columns (base 9 + `A`)

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NN | generated UUID | immutable document-version identity | Internal | UUID | PK |
| `document_type` | `legal_document_type` | NN | none | Terms/Privacy/Creator Guidelines/Moderation Rules/Support Public Display | Internal | `TERMS_OF_SERVICE` | UQ/current IX |
| `version` | `text` | NN | none | stable nonblank version label | Public | `2026-07-19` | pair UQ |
| `title` | `text` | NN | none | document title; nonblank | Public | `ข้อกำหนดการใช้งาน` | — |
| `content_uri` | `text` | NN | none | immutable canonical document location | Public | `/legal/terms/2026-07-19` | — |
| `content_sha256` | `text` | NN | none | lowercase digest proving accepted content | Internal | 64-char hex | — |
| `published_at` | `timestamptz` | NN | none | version publication time UTC | Public | timestamp | IX |
| `effective_at` | `timestamptz` | NN | none | acceptance-required effective time | Internal | timestamp | IX |
| `is_active` | `boolean` | NN | `false` | current version eligible for new acceptance | Internal | `true` | partial IX |
| _Audit profile_ | — | — | — | `A`; published version content factsไม่แก้ย้อนหลัง | Internal | — | audit FKs |

### `user_legal_acceptances` — 5 columns

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NN | generated UUID | acceptance identity | Internal | UUID | PK |
| `user_id` | `uuid` | NN | none | accepting User | Personal | UUID | FK, pair UQ/lookup |
| `legal_document_id` | `uuid` | NN | none | exact accepted version | Internal | UUID | FK, pair UQ |
| `acceptance_source` | `legal_acceptance_source` | NN | none | LOGIN, FIRST_PUBLICATION หรือ SUPPORT_METHOD_ENABLEMENT | Internal | `LOGIN` | IX |
| `accepted_at` | `timestamptz` | NN | current timestamp | immutable acceptance time UTC | Personal | timestamp | IX |

ไม่มี marketing consentหรือ generic preferenceในสองตารางนี้

### `membership_entitlements` — 12 columns (base 8 + `A`)

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NN | generated UUID | entitlement identity | Internal | UUID | PK |
| `user_id` | `uuid` | NN | none | entitled User | Internal | UUID | FK, IX |
| `entitlement_type` | `text` | NN | `AD_FREE` | MVP value fixed `AD_FREE` | Internal | `AD_FREE` | CHECK |
| `starts_at` | `timestamptz` | NN | none | inclusive start UTC | Internal | timestamp | IX |
| `ends_at` | `timestamptz` | N | null | exclusive end; null only for approved nonexpiring source | Internal | timestamp | IX |
| `status` | `membership_entitlement_status` | NN | `ACTIVE` | current lifecycle; expiry evaluation uses date+status | Internal | `EXPIRED` | IX |
| `source` | `text` | NN | none | controlled source; vocabulary Pending | Internal | `MANUAL_ADMIN` | — |
| `payment_reference` | `text` | N | null | opaque future payment reference; ไม่เก็บ payment data | Restricted | `pay_ref_…` | Future UQ Pending |
| _Audit profile_ | — | — | — | `A`; historyไม่ soft-delete | Internal | — | audit FKs |

## Creator Support

### `creator_support_profiles` — 10 columns (base 4 + `S`)

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NN | generated UUID | support aggregate | Internal | UUID | PK |
| `user_profile_id` | `uuid` | NN | none | one support profile per public profile | Internal | UUID | FK, UQ |
| `message` | `text` | N | null | public support invitation | Public | `สนับสนุนผลงาน...` | — |
| `is_active` | `boolean` | NN | `false` | display profile/methods when true | Internal | `true` | IX via methods/read |
| _Audit profile_ | — | — | — | `S` | Internal | — | audit FKs |

### `creator_support_methods` — 20 columns (base 14 + `S`)

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NN | generated UUID | method identity | Internal | UUID | PK |
| `creator_support_profile_id` | `uuid` | NN | none | owning support profile | Internal | UUID | FK, IX |
| `method_type` | `support_method_type` | NN | none | BANK_ACCOUNT/PROMPTPAY/QR_IMAGE/EXTERNAL_LINK | Public | `PROMPTPAY` | IX |
| `label` | `text` | NN | none | public display label; nonblank | Public | `พร้อมเพย์` | — |
| `account_holder_name` | `text` | N | null | bank/PromptPay owner display; mask policy | Personal | `ป*** ใ***` | — |
| `encrypted_value` | `text` | N | null | bank/PromptPay ciphertext at rest; Backend decryptเฉพาะ active+public method; plaintextห้ามลง logs/audit | Restricted | ciphertext envelope | never indexed |
| `masked_value` | `text` | N | null | safe representationสำหรับ Admin/log/public fallback | Public | `xxx-x-x1234-x` | — |
| `media_asset_id` | `uuid` | N | null | Cloudflare R2 QR MediaAsset metadata/object key | Public | UUID | FK |
| `external_url` | `text` | N | null | HTTPS external support link | Public | `https://…` | — |
| `display_order` | `integer` | NN | none | positive ordering within profile | Internal | `1` | IX/UQ active scope |
| `is_active` | `boolean` | NN | `true` | method display state | Internal | `true` | partial IX |
| `is_public` | `boolean` | NN | `false` | explicit Creator opt-in; Backend decrypt/displayได้เมื่อ trueและ activeเท่านั้น | Internal | `true` | partial IX |
| `public_consent_acceptance_id` | `uuid` | N | null | exact Support Public Display legal acceptance including ownership/permission+placement consent | Restricted | UUID | FK, coherence CHECK |
| `public_confirmed_at` | `timestamptz` | N | null | separate confirmation time when method enabled publicly | Personal | timestamp | CHECK |
| _Audit profile_ | — | — | — | `S` | Internal | — | audit FKs |

## Taxonomy

### `categories` — 12 columns (base 6 + `S`)

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NN | generated UUID | category identity | Internal | UUID | PK |
| `name` | `text` | NN | none | nonblank public name | Public | `แฟนตาซี` | UQ |
| `slug` | `text` | NN | none | normalized public/filter slug | Public | `fantasy` | UQ |
| `description` | `text` | N | null | public description | Public | `เรื่องเหนือจินตนาการ` | — |
| `display_order` | `integer` | NN | none | nonnegative admin order | Internal | `10` | IX |
| `is_active` | `boolean` | NN | `true` | available for discovery/selection | Internal | `true` | IX |
| _Audit profile_ | — | — | — | `S` | Internal | — | audit FKs |

### `tags` — 12 columns (same shape as categories)

`id uuid NN generated UUID (PK)`, `name text NN (Public,UQ)`, `slug text NN (Public,UQ)`, `description text N`, `display_order integer NN`, `is_active boolean NN default true`, plus audit profile `S`; validation/classification/index semanticsเหมือน `categories`

### `story_tags` — 5 columns (base 3 + `I`)

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NN | generated UUID | relationship identity | Internal | UUID | PK |
| `story_id` | `uuid` | NN | none | tagged Story | Internal | UUID | FK, pair UQ |
| `tag_id` | `uuid` | NN | none | assigned Tag | Internal | UUID | FK, pair/reverse IX |
| _Audit profile_ | — | — | — | `I` | Internal | — | created_by FK |

## Story, Chapter and Media

### `stories` — 20 columns (base 14 + `S`)

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NN | generated UUID | stable Story identity | Internal | UUID | PK |
| `creator_user_id` | `uuid` | NN | none | owning Member/Creator | Internal | UUID | FK, scoped UQ/IX |
| `category_id` | `uuid` | NN | none | one primary Category | Public | UUID | FK, browse IX |
| `cover_media_asset_id` | `uuid` | N | null | cover metadata | Public | UUID | FK |
| `slug` | `text` | NN | none | unique within Creator; normalized/nonblank | Public | `library-after-rain` | scoped UQ |
| `title` | `text` | NN | none | public title; nonblank | Public | `ห้องสมุดหลังฝน` | Future search IX |
| `description` | `text` | N | null | public summary | Public | `...` | — |
| `story_type` | `story_type` | NN | none | NOVEL หรือ COMIC; immutable after content exists | Public | `NOVEL` | IX |
| `publication_status` | `story_publication_status` | NN | `DRAFT` | discovery/visibility state | Internal | `PUBLISHED` | IX |
| `progress_status` | `story_progress_status` | NN | `ONGOING` | creator-declared story progress | Public | `COMPLETED` | IX |
| `content_rating` | `content_rating` | NN | `ALL_AGES` | suitability vocabulary | Public | `AGE_13_PLUS` | IX/filter |
| `first_published_at` | `timestamptz` | N | null | first transition to Published | Public | timestamp | discovery IX |
| `archived_at` | `timestamptz` | N | null | archive event; coherent with ARCHIVED | Internal | timestamp | — |
| `publication_status_before_delete` | `story_publication_status` | N | null | owner-controlled state captured before DELETEDเพื่อ safe restore; ห้ามใช้ restore HIDDENโดย Creator | Internal | `ARCHIVED` | CHECK |
| _Audit profile_ | — | — | — | `S`; creator delete/restore | Internal | — | audit FKs |

### `chapters` — 16 columns (base 10 + `S`)

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NN | generated UUID | stable identity independent of displayed number | Internal | UUID | PK |
| `story_id` | `uuid` | NN | none | owning Story | Internal | UUID | FK, scoped indexes |
| `slug` | `text` | NN | none | unique within Story; normalized/nonblank | Public | `the-first-letter` | scoped UQ |
| `title` | `text` | NN | none | public chapter title; nonblank | Public | `จดหมายฉบับแรก` | — |
| `display_number` | `text` | N | null | creator-facing label; ไม่ใช่ identity/order | Public | `ตอนที่ 1.5` | — |
| `display_order` | `integer` | NN | none | positive reorderable position | Internal | `10` | scoped UQ/IX |
| `publication_status` | `chapter_publication_status` | NN | `DRAFT` | chapter visibility/lifecycle | Internal | `PUBLISHED` | IX |
| `author_note` | `text` | N | null | note shown with chapter | Public | `ขอบคุณ...` | — |
| `published_at` | `timestamptz` | N | null | current/first publish time policy Pending | Public | timestamp | IX |
| `publication_status_before_delete` | `chapter_publication_status` | N | null | prior owner-controlled state for restore; Creatorห้าม restore HIDDEN | Internal | `DRAFT` | CHECK |
| _Audit profile_ | — | — | — | `S` | Internal | — | audit FKs |

### `novel_contents` — 8 columns (base 4 + `A`)

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NN | generated UUID | content record | Internal | UUID | PK |
| `chapter_id` | `uuid` | NN | none | exactly one content per Novel Chapter | Internal | UUID | FK, UQ |
| `content_document` | `jsonb` | NN | none | structured document JSON object; schema validation required | Public | `{"type":"doc",...}` | no generic GIN |
| `content_schema_version` | `integer` | NN | `1` | positive renderer/migration version | Internal | `1` | — |
| _Audit profile_ | — | — | — | `A`; lifecycle follows Chapter | Internal | — | audit FKs |

### `comic_pages` — 11 columns (base 5 + `S`)

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NN | generated UUID | page identity | Internal | UUID | PK |
| `chapter_id` | `uuid` | NN | none | owning Comic Chapter | Internal | UUID | FK, scoped IX |
| `media_asset_id` | `uuid` | NN | none | page image object metadata | Public | UUID | FK |
| `display_order` | `integer` | NN | none | positive order within Chapter | Internal | `1` | scoped UQ |
| `alt_text` | `text` | N | null | accessible description | Public | `ตัวละครบนรถราง` | — |
| _Audit profile_ | — | — | — | `S` | Internal | — | audit FKs |

### `media_assets` — 21 columns (base 15 + `S`)

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NN | generated UUID | media identity | Internal | UUID | PK |
| `owner_user_id` | `uuid` | NN | none | uploader/owner | Internal | UUID | FK, IX |
| `asset_type` | `media_asset_type` | NN | none | COVER/AVATAR/COMIC_PAGE/AD/QR/EVIDENCE/OTHER | Internal | `COMIC_PAGE` | IX |
| `status` | `media_asset_status` | NN | `PENDING` | processing/lifecycle | Internal | `READY` | IX |
| `storage_provider` | `text` | NN | `CLOUDFLARE_R2` | fixed MVP object provider; CHECK exact value | Internal | `CLOUDFLARE_R2` | IX with object key |
| `bucket_name` | `text` | NN | none | R2 bucket/logical container; nonblank | Restricted | `novelverse-media` | UQ scope |
| `object_key` | `text` | NN | none | immutable nonblank object key | Restricted | `comic/.../001.webp` | UQ scope |
| `object_url` | `text` | N | null | public/CDN URL when allowed | Public | `https://cdn...` | — |
| `mime_type` | `text` | NN | none | approved MIME | Internal | `image/webp` | — |
| `size_bytes` | `bigint` | NN | none | nonnegative file size | Internal | `245760` | — |
| `checksum_sha256` | `text` | N | null | canonical lowercase digest if calculated | Restricted | 64-char hex | — |
| `width_px` | `integer` | N | null | positive image width | Internal | `1200` | — |
| `height_px` | `integer` | N | null | positive image height | Internal | `1800` | — |
| `alt_text` | `text` | N | null | default accessibility text | Public | `หน้าปกเรื่อง...` | — |
| `metadata` | `jsonb` | NN | empty object | extensible non-sensitive metadata object | Internal | `{}` | no generic GIN |
| _Audit profile_ | — | — | — | `S` | Internal | — | audit FKs |

## Reading and Community

### `story_follows` — 4 columns

`id uuid NN generated UUID (PK)`, `user_id uuid NN (FK,pair UQ)`, `story_id uuid NN (FK,pair UQ)`, `created_at timestamptz NN current timestamp (IX)`; all Internal ไม่มี soft delete—unfollow hard-deletes relationship

### `chapter_likes` — 4 columns

`id uuid NN generated UUID (PK)`, `user_id uuid NN (FK,pair UQ)`, `chapter_id uuid NN (FK,pair UQ)`, `created_at timestamptz NN current timestamp (IX)`; all Internal ไม่มี soft delete—unlike hard-deletes relationship

### `reading_progress` — 10 columns (base 6 + `A`)

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NN | generated UUID | progress identity | Internal | UUID | PK |
| `user_id` | `uuid` | NN | none | reader | Personal | UUID | FK, pair UQ |
| `story_id` | `uuid` | NN | none | tracked Story | Personal | UUID | FK, pair UQ |
| `latest_chapter_id` | `uuid` | NN | none | latest Chapter; must belong to Story | Personal | UUID | FK |
| `position_data` | `jsonb` | N | null | optional scroll/anchor data; JSON object | Personal | `{"percent":62}` | — |
| `last_read_at` | `timestamptz` | NN | current timestamp | History ordering UTC | Personal | timestamp | IX |
| _Audit profile_ | — | — | — | `A` | Personal/Internal | — | audit FKs |

### `comments` — 11 columns (base 5 + `S`)

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NN | generated UUID | comment identity | Internal | UUID | PK |
| `chapter_id` | `uuid` | NN | none | parent Chapter; flat only | Public | UUID | FK, IX |
| `author_user_id` | `uuid` | NN | none | Member author | Personal | UUID | FK, IX |
| `body` | `text` | NN | none | nonblank comment; no reply/like columns | Public | `ชอบตอนนี้มาก` | CHECK |
| `status` | `comment_status` | NN | `VISIBLE` | visible/creator-hidden/admin-hidden | Internal | `ADMIN_HIDDEN` | IX |
| _Audit profile_ | — | — | — | `S` | Internal | — | audit FKs |

## Moderation

### `reports` — 11 columns (base 7 + `A`)

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NN | generated UUID | report aggregate | Internal | UUID | PK |
| `reporter_user_id` | `uuid` | NN | none | authenticated reporter | Personal | UUID | FK, IX |
| `reason_code` | `text` | NN | none | controlled report reason; vocabulary Pending | Internal | `SPAM` | future CHECK |
| `details` | `text` | N | null | reporter context | Restricted | `...` | — |
| `status` | `report_status` | NN | `OPEN` | queue lifecycle | Internal | `REVIEWING` | partial IX |
| `submitted_at` | `timestamptz` | NN | current timestamp | queue time UTC | Internal | timestamp | IX |
| `resolved_at` | `timestamptz` | N | null | set for RESOLVED/REJECTED | Internal | timestamp | — |
| _Audit profile_ | — | — | — | `A` | Internal | — | audit FKs |

### Typed report targets — 3 columns each, 12 total

| Table | Columns | Validation / class / index |
|---|---|---|
| `report_user_targets` | `report_id uuid NN`, `target_user_id uuid NN`, `created_at timestamptz NN current timestamp` | report_id shared PK/FK; target FK/IX; Internal/Restricted |
| `report_story_targets` | `report_id uuid NN`, `target_story_id uuid NN`, `created_at timestamptz NN current timestamp` | same; Story FK/IX |
| `report_chapter_targets` | `report_id uuid NN`, `target_chapter_id uuid NN`, `created_at timestamptz NN current timestamp` | same; Chapter FK/IX |
| `report_comment_targets` | `report_id uuid NN`, `target_comment_id uuid NN`, `created_at timestamptz NN current timestamp` | same; Comment FK/IX |

### `moderation_actions` — 14 columns (base 10 + `A`)

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NN | generated UUID | action identity | Internal | UUID | PK |
| `report_id` | `uuid` | NN | none | source Report | Restricted | UUID | FK, IX |
| `actor_admin_user_id` | `uuid` | NN | none | acting Admin; role validated transactionally | Restricted | UUID | FK, IX |
| `action_type` | `moderation_action_type` | NN | none | operation performed | Internal | `CONFIRM_VIOLATION` | IX |
| `result` | `moderation_action_result` | NN | none | resulting outcome | Internal | `CONTENT_HIDDEN` | IX |
| `reason` | `text` | NN | none | nonblank decision rationale | Restricted | `ละเมิดนโยบาย...` | CHECK |
| `evidence_summary` | `text` | N | null | human-readable evidence summary | Restricted | `พบข้อความ...` | — |
| `previous_state` | `jsonb` | N | null | bounded state snapshot object | Restricted | `{"status":"PUBLISHED"}` | — |
| `resulting_state` | `jsonb` | N | null | bounded state snapshot object | Restricted | `{"status":"HIDDEN"}` | — |
| `acted_at` | `timestamptz` | NN | current timestamp | authoritative action time | Internal | timestamp | IX |
| _Audit profile_ | — | — | — | `A`; append-oriented | Internal | — | audit FKs |

### `moderation_evidence` — 10 columns (base 8 + `I`)

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NN | generated UUID | evidence identity | Internal | UUID | PK |
| `moderation_action_id` | `uuid` | NN | none | owning action | Restricted | UUID | FK, IX |
| `warning_email_id` | `uuid` | N | null | evidence/attachment included with warning | Restricted | UUID | FK |
| `media_asset_id` | `uuid` | N | null | evidence file metadata | Restricted | UUID | FK |
| `external_reference` | `text` | N | null | trusted URL/reference | Restricted | `case://...` | — |
| `note` | `text` | N | null | evidence description | Restricted | `ภาพก่อนซ่อน` | — |
| `evidence_type` | `moderation_evidence_type` | NN | none | MEDIA/EXTERNAL_REFERENCE/TEXT | Internal | `MEDIA` | IX |
| `captured_at` | `timestamptz` | N | null | source capture time | Restricted | timestamp | — |
| _Audit profile_ | — | — | — | `I`; evidence must have payload | Internal | — | created_by FK |

### `warning_emails` — 18 columns (base 14 + `A`)

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NN | generated UUID | delivery audit identity | Internal | UUID | PK |
| `moderation_action_id` | `uuid` | NN | none | qualifying action | Restricted | UUID | FK, IX |
| `recipient_user_id` | `uuid` | NN | none | warned Creator/User | Restricted | UUID | FK, IX |
| `status` | `warning_email_status` | NN | `QUEUED` | delivery lifecycle | Internal | `SENT` | IX |
| `recipient_email_snapshot` | `text` | NN | none | delivery address snapshot; encrypt/access restrict | Restricted | `creator@example.com` | never search broadly |
| `subject` | `text` | NN | none | sent subject; nonblank | Restricted | `คำเตือน...` | — |
| `rule_reference` | `text` | NN | none | nonblank Creator Guideline/moderation rule reference required for qualifying warning | Restricted | `CG-4.2` | CHECK |
| `template_key` | `text` | NN | none | stable template identifier | Internal | `creator-warning` | — |
| `template_version` | `integer` | NN | none | positive version | Internal | `1` | — |
| `provider_reference` | `text` | N | null | email provider message ID | Restricted | `msg_...` | partial UQ |
| `queued_at` | `timestamptz` | NN | current timestamp | queued UTC | Internal | timestamp | — |
| `sent_at` | `timestamptz` | N | null | required for SENT | Internal | timestamp | — |
| `failed_at` | `timestamptz` | N | null | required for FAILED | Internal | timestamp | — |
| `failure_reason` | `text` | N | null | provider-safe failure detail | Restricted | `mailbox unavailable` | — |
| _Audit profile_ | — | — | — | `A` | Internal | — | audit FKs |

### `creator_strikes` — 15 columns (base 11 + `A`)

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NN | generated UUID | strike identity | Internal | UUID | PK |
| `creator_user_id` | `uuid` | NN | none | affected Creator/Member | Restricted | UUID | FK, IX |
| `moderation_action_id` | `uuid` | NN | none | confirmed violation action | Restricted | UUID | FK, UQ |
| `warning_email_id` | `uuid` | NN | none | SENT warning for same action/user | Restricted | UUID | FK, UQ |
| `status` | `creator_strike_status` | NN | `ACTIVE` | strike lifecycle | Internal | `REVERSED` | IX |
| `reason_summary` | `text` | NN | none | nonblank strike reason | Restricted | `ยืนยันการละเมิด...` | — |
| `sequence_number` | `integer` | NN | none | positive qualifying strike number for Creator; third active strike triggers suspension | Internal | `3` | IX/CHECK |
| `counted_at` | `timestamptz` | NN | none | after warning sent | Internal | timestamp | IX |
| `reversed_at` | `timestamptz` | N | null | required for REVERSED | Internal | timestamp | — |
| `reversed_by` | `uuid` | N | null | reversing Admin FK | Restricted | UUID | FK |
| `reversal_reason` | `text` | N | null | required for REVERSED | Restricted | `อุทธรณ์สำเร็จ` | — |
| _Audit profile_ | — | — | — | `A`; no routine delete | Internal | — | audit FKs |

### `warning_email_evidence` — 5 columns (base 3 + `I`)

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NN | generated UUID | attachment relationship identity | Internal | UUID | PK |
| `warning_email_id` | `uuid` | NN | none | warning delivery attempt | Restricted | UUID | FK, pair UQ |
| `moderation_evidence_id` | `uuid` | NN | none | included evidence/attachment | Restricted | UUID | FK, pair UQ/reverse IX |
| _Audit profile_ | — | — | — | `I`; immutable after email SENT | Internal | — | created_by FK |

### `creator_publishing_suspensions` — 13 columns (base 9 + `A`)

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NN | generated UUID | publishing-suspension identity | Internal | UUID | PK |
| `user_id` | `uuid` | NN | none | Creator whose create/publish privilege is suspended; reader/dashboard access unaffected | Restricted | UUID | FK, current IX |
| `source_strike_id` | `uuid` | NN | none | third active qualifying strike | Restricted | UUID | FK, UQ |
| `starts_at` | `timestamptz` | NN | none | strike issue/suspension start UTC | Internal | timestamp | IX |
| `ends_at` | `timestamptz` | NN | none | exactly starts_at + 7 days | Internal | timestamp | IX |
| `status` | `creator_publishing_suspension_status` | NN | `ACTIVE` | ACTIVE/EXPIRED/LIFTED; distinct from User status | Internal | `ACTIVE` | IX |
| `lifted_at` | `timestamptz` | N | null | manual early lift time | Internal | timestamp | CHECK |
| `lifted_by` | `uuid` | N | null | Admin who lifts suspension | Restricted | UUID | FK |
| `reason` | `text` | NN | none | nonblank reason including third-strike context | Restricted | `Third qualifying strike` | CHECK |
| _Audit profile_ | — | — | — | `A`; no soft delete | Internal | — | audit FKs |

## Advertisement

### `advertisements` — 16 columns (base 10 + `S`)

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `id` | `uuid` | NN | generated UUID | base advertisement identity | Internal | UUID | PK |
| `advertisement_type` | `advertisement_type` | NN | none | STANDARD/PREMIUM_POPUP | Public | `STANDARD` | active IX |
| `status` | `advertisement_status` | NN | `DRAFT` | config lifecycle | Internal | `ACTIVE` | IX |
| `advertiser_name` | `text` | NN | none | nonblank sponsor label | Public | `Sponsor A` | — |
| `title` | `text` | N | null | optional public title | Public | `พื้นที่โฆษณา` | — |
| `description` | `text` | N | null | optional short description | Public | `...` | — |
| `image_media_asset_id` | `uuid` | NN | none | advertisement image metadata | Public | UUID | FK |
| `target_url` | `text` | NN | none | nonblank HTTPS target; opened new tab by UI | Public | `https://example.com` | CHECK |
| `starts_at` | `timestamptz` | N | null | optional inclusive active window | Internal | timestamp | IX |
| `ends_at` | `timestamptz` | N | null | optional exclusive end after start | Internal | timestamp | IX |
| _Audit profile_ | — | — | — | `S` | Internal | — | audit FKs |

### `standard_advertisements` — 2 columns

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `advertisement_id` | `uuid` | NN | none | shared PK/FK; base type must STANDARD | Internal | UUID | PK, FK |
| `sort_order` | `integer` | NN | none | nonnegative stack order; ties fallback by ID | Internal | `10` | IX |

### `premium_popup_advertisements` — 2 columns

| Column | Type | Null | Default | Purpose / validation | Class | Example | Index |
|---|---|---|---|---|---|---|---|
| `advertisement_id` | `uuid` | NN | none | shared PK/FK; base type must PREMIUM_POPUP | Internal | UUID | PK, FK |
| `close_delay_seconds` | `integer` | NN | `5` | MVP must equal 5 | Public | `5` | CHECK |

## Column Count Reconciliation

| Domain | Columns |
|---|---:|
| Identity, Legal & Membership | 65 |
| Creator Support | 30 |
| Taxonomy | 29 |
| Story/Chapter/Media | 76 |
| Reading & Community | 29 |
| Moderation | 98 |
| Advertisement | 20 |
| **Total** | **347** |

Audit-profile columns are included once per table in these totals. The authoritative physical count is **347 columns**.

## Pending Product Owner Decisions

- ⚠ Pending Product Owner Decision: hard text limits และ slug normalization
- ⚠ Pending Product Owner Decision: entitlement source allowed values และ payment-reference uniqueness
- ⚠ Pending Product Owner Decision: exact cipher/KMS/key rotation and privileged decrypt authorization; encryption/masking itself is confirmed
- ⚠ Pending Product Owner Decision: rich-content JSON schema และ position-data shape
- ⚠ Pending Product Owner Decision: report reason codes, media provider/limits และ retention fields/policies

## Related Documents

- [Table Catalog](02_TABLE_CATALOG.md)
- [Constraints](04_CONSTRAINTS_AND_RELATIONSHIPS.md)
- [Enum Catalog](05_ENUM_AND_STATUS_CATALOG.md)
- [Index Plan](06_PHYSICAL_INDEX_PLAN.md)

## Revision History

| Version | Date | Author | Change |
|---|---|---|---|
| 1.1 | 2026-07-19 | Lead PostgreSQL Database Architect | Expanded to 347 columns with consent, encryption, publication-state and suspension fields |
| 1.0 | 2026-07-19 | Lead PostgreSQL Database Architect | Full MVP column dictionary |
