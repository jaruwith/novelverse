# แนวทาง UI ปัจจุบัน

| รายการ | ค่า |
|---|---|
| Purpose | บันทึก visual language และ responsive behavior ที่พบใน CSS/องค์ประกอบปัจจุบัน |
| Current Status | แนวทางจาก wireframe; ยังไม่ใช่ design system ที่อนุมัติสมบูรณ์ |
| Version | 0.1.0 |
| Last Updated | 19 กรกฎาคม 2569 |
| Author | Codex — Lead Software Architect and Technical Documentation Engineer |

## Table of Contents

1. [ทิศทางภาพ](#ทิศทางภาพ)
2. [สี](#สี)
3. [Typography](#typography)
4. [Layout และ Responsive](#layout-และ-responsive)
5. [องค์ประกอบร่วม](#องค์ประกอบร่วม)
6. [สถานะและ Interaction](#สถานะและ-interaction)
7. [Accessibility และสิ่งที่ยังไม่ได้กำหนด](#accessibility-และสิ่งที่ยังไม่ได้กำหนด)

## ทิศทางภาพ

ใช้ light theme ที่สบายตา พื้นหลัง off-white, card สีขาว, สีเขียวหม่นเป็น primary และ gradient pastel สำหรับภาพ placeholder มุมส่วนใหญ่โค้ง 9–22px พร้อมเส้นขอบอ่อนและเงาบาง

## สี

| Token | ค่า | การใช้งานที่พบ |
|---|---|---|
| `--bg` | `#faf9f6` | พื้นหลังหลัก |
| `--card` | `#fff` | card/panel |
| `--surface2` | `#f0f2ed` | surface รอง/filters |
| `--line` | `#dfe4de` | border |
| `--ink` | `#26312b` | ข้อความหลัก |
| `--muted` | `#68756e` | ข้อความรอง |
| `--green` | `#cfe1d1` | highlight |
| `--greenDark` | `#42664d` | primary action |
| `--orange` | `#f1d2ae` | accent |
| `--blue` | `#d6e7ef` | badge/accent |
| danger | `#a95e55` | destructive action; ยังไม่มี token ชื่อเฉพาะ |

Contrast ratio และ semantic color matrix: **ยังไม่ได้กำหนด**

## Typography

Font stack คือ `Noto Sans Thai`, `Leelawadee UI`, Tahoma, Arial, sans-serif โดยไม่ได้โหลด web font ใน code ปัจจุบัน Body line-height 1.55 และ reader text line-height 2 ไม่มี typography scale ที่ประกาศเป็น token

## Layout และ Responsive

- Content หลักกว้างสูงสุด 1240px; reader 820px; comic canvas 720px
- Desktop story grid 5 คอลัมน์, creator grid 3, stat grid 4
- Layout ลดคอลัมน์ที่ 1000/720/430px
- Global navigation เปลี่ยนเป็น drawer ใต้ 960px
- Dashboard/admin sidebar เปลี่ยนเป็น fixed bottom navigation ใต้ 960px
- Form สองคอลัมน์เปลี่ยนเป็นหนึ่งคอลัมน์ใต้ 720px

## องค์ประกอบร่วม

Primary/secondary/text/danger button, card, panel, badge, tabs/chips, filters, table, modal, empty state, skeleton, stat card, navigation shell, story cover, profile banner และ reader controls มี style ที่ใช้ร่วมกัน

## สถานะและ Interaction

- Hover card ยกขึ้น 2px และมี shadow
- Button/action จำนวนมากให้ feedback เฉพาะ local state
- Loading ใช้ shimmer; empty/error/hidden/archived/permission มีรูปแบบตัวอย่าง
- Focus style, disabled style แบบเป็นระบบ, toast, validation feedback และ motion preference ยังไม่ได้กำหนด

## Accessibility และสิ่งที่ยังไม่ได้กำหนด

พบ `lang="th"`, label ของ form จำนวนมาก, `aria-label` บน search และ `role="dialog"` หนึ่งจุด แต่ยังไม่พบมาตรฐาน WCAG เป้าหมาย, keyboard/focus management, modal semantics ครบถ้วน, skip link, screen-reader announcement, alt-text policy หรือ accessibility test: **ยังไม่ได้กำหนด**
