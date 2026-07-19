# โครงสร้างโฟลเดอร์

| รายการ | ค่า |
|---|---|
| Purpose | อธิบายโครงสร้าง repository และความรับผิดชอบของแต่ละพื้นที่ |
| Current Status | ตรงกับ repository ณ วันที่ตรวจสอบ |
| Version | 0.1.0 |
| Last Updated | 19 กรกฎาคม 2569 |
| Author | Codex — Lead Software Architect and Technical Documentation Engineer |

## Table of Contents

1. [โครงสร้างระดับบน](#โครงสร้างระดับบน)
2. [โครงสร้าง src](#โครงสร้าง-src)
3. [Route Groups](#route-groups)
4. [Components](#components)
5. [ข้อสังเกต](#ข้อสังเกต)

## โครงสร้างระดับบน

```text
novelverse/
├─ docs/                  เอกสารโครงการและเอกสาร wireframe
├─ public/                SVG เริ่มต้นจาก Next.js
├─ src/
│  ├─ app/                App Router pages, layouts และ global CSS
│  ├─ components/         shared UI และ page-level component groups
│  └─ lib/mockData.ts     types, mock records และ aggregate helpers
├─ AGENTS.md              กฎการทำงานกับ Next.js รุ่นใน repository
├─ CLAUDE.md              อ้างอิง AGENTS.md
├─ README.md              README มาตรฐาน create-next-app
├─ package.json           scripts และ dependencies
├─ next.config.ts         config เปล่า
├─ eslint.config.mjs      ESLint config
└─ tsconfig.json          TypeScript strict และ alias @/*
```

## โครงสร้าง src

```text
src/app/
├─ (public)/              public layout + discovery/read/library/login routes
├─ dashboard/             member layout และ publishing routes
├─ admin/                 admin layout และ moderation routes
├─ permission-denied/     explicit permission state
├─ layout.tsx             root metadata + RoleProvider
├─ not-found.tsx          global 404
└─ globals.css            design tokens และ layout styles
```

## Route Groups

- `(public)` ไม่ปรากฏใน URL และครอบด้วย `GlobalHeader`/footer
- `dashboard` ครอบด้วย `AppShell` แบบสมาชิก
- `admin` ครอบด้วย `AppShell admin`
- `%5Fstates` บน filesystem ให้ route `/_states` สำหรับคลังสถานะภายใน

## Components

| ไฟล์ | ความรับผิดชอบ |
|---|---|
| `RoleProvider.tsx` | role state จำลอง |
| `GlobalHeader.tsx` | search, desktop/mobile navigation, role switcher |
| `Shells.tsx` | member/admin side navigation และ access state |
| `Cards.tsx` | story, ranking, creator, status และ stat cards |
| `Content.tsx` | filters, chapter/comment list, dialogs และ shared states |
| `DashboardPages.tsx` | หน้าพื้นที่สมาชิกทั้งหมด |
| `AdminPages.tsx` | หน้าพื้นที่ผู้ดูแลทั้งหมด |

## ข้อสังเกต

Page components ของ dashboard/admin ส่วนใหญ่เป็น wrapper บรรทัดเดียว ขณะที่ implementation รวมอยู่ในไฟล์ component ขนาดใหญ่ ไม่มี test directory, API directory, database directory, feature modules หรือ assets เฉพาะ NovelVerse นอกจาก favicon; แนวทางแยก module ในอนาคต **ยังไม่ได้กำหนด**
