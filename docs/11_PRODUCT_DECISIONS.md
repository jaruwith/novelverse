# การตัดสินใจด้านผลิตภัณฑ์

| รายการ | ค่า |
|---|---|
| Purpose | รวบรวม decision ที่ยืนยันแล้วและแยกเรื่องที่ยังต้องอนุมัติ |
| Current Status | Confirmed decisions นำมาจากเอกสารเดิม; open decisions ยังรอผู้มีอำนาจอนุมัติ |
| Version | 0.1.0 |
| Last Updated | 19 กรกฎาคม 2569 |
| Author | Codex — Lead Software Architect and Technical Documentation Engineer |

## Table of Contents

1. [Confirmed Decisions](#confirmed-decisions)
2. [Open Decisions](#open-decisions)
3. [Decision Governance](#decision-governance)

## Confirmed Decisions

| รหัส | การตัดสินใจ | หลักฐาน |
|---|---|---|
| PD-001 | Public Member Profile และ Creator Profile ใช้หน้าเดียวกัน | `WIREFRAME_DECISIONS.md`, หน้า profile |
| PD-002 | Member ทุกคนเผยแพร่ได้ ไม่มี Creator role แยก | `WIREFRAME_DECISIONS.md`, Login/Dashboard |
| PD-003 | MVP ไม่มี notification center | `WIREFRAME_DECISIONS.md` |
| PD-004 | Following page ใช้แทน notification center | `WIREFRAME_DECISIONS.md`, `/following` |
| PD-005 | Like ใช้กับ chapter เท่านั้น | `WIREFRAME_DECISIONS.md`, readers |
| PD-006 | Follow ใช้กับ story เท่านั้น | `WIREFRAME_DECISIONS.md`, story detail |
| PD-007 | Comment เป็น flat ไม่มี reply และ comment like | `WIREFRAME_DECISIONS.md`, CommentList |
| PD-008 | Story views เป็นผลรวม chapter views | `WIREFRAME_DECISIONS.md`, `totalViews` |
| PD-009 | Search อยู่ใน global header ของ public page | `WIREFRAME_DECISIONS.md`, public layout/header |
| PD-010 | visual direction แรกเป็น light theme สบายตา | `WIREFRAME_DECISIONS.md`, CSS tokens |
| PD-011 | รองรับ desktop และ mobile browser | `WIREFRAME_DECISIONS.md`, responsive CSS |
| PD-012 | รองรับเนื้อหา Novel และ Comic | routes, forms และ mock type |
| PD-013 | เรื่องมีหมวดหลักหนึ่งหมวดและแท็กได้หลายรายการ | Categories/Dashboard/Admin UI |
| PD-014 | Novel/Comic Reader แสดง standard ads ที่ active ครบทุกใบเป็น vertical stack ก่อน reading content | Requirements และ reader implementation |
| PD-015 | Standard ads ไม่มีเพดานสามรายการ ไม่หมุน/สุ่ม และเรียง `sortOrder` แล้ว `id` | Advertisement pool/helper |
| PD-016 | Guest/Free Member เห็น ads ทั้งหมด; Ad-free Member/Admin ไม่เห็น ads หรือ upsell | mock `isAdFreeMember` และ eligibility helper |
| PD-017 | Premium Popup เป็น paid placement แยก แสดงสูงสุดหนึ่งรายการและปิดได้หลัง 5 วินาที | Premium popup wireframe |
| PD-018 | การคลิกโฆษณาทุกชนิดเปิด target ในแท็บใหม่ | Reader advertisement components |

## Open Decisions

| รหัส | เรื่องที่ต้องอนุมัติ | สถานะ |
|---|---|---|
| OD-001 | Creator-follow จะไม่อยู่ใน MVP และแสดงเป็น disabled placeholder ต่อหรือไม่ | Reviewing |
| OD-002 | จุดและกระบวนการ report สำหรับ story/chapter/comment/user | Reviewing |
| OD-003 | Hidden/archived content ควรเข้าถึง URL ได้ในเงื่อนไขใด | Reviewing |
| OD-004 | suitability self-rating เดียวเพียงพอหรือไม่ | Reviewing |
| OD-005 | Member hide comment ต้อง reversible และมี audit อย่างไร | Reviewing |
| OD-006 | Authentication provider, account linking และ role governance | ยังไม่ได้กำหนด |
| OD-007 | Database/API/hosting/storage architecture | ยังไม่ได้กำหนด |
| OD-008 | Ranking, search และ editorial selection rules | ยังไม่ได้กำหนด |
| OD-009 | Content policy, moderation SLA, appeal และ notification | ยังไม่ได้กำหนด |
| OD-010 | Upload constraints, ownership/licensing และ media processing | ยังไม่ได้กำหนด |
| OD-011 | Accessibility target และ supported browser matrix | ยังไม่ได้กำหนด |
| OD-012 | Production behavior เมื่อ slug/id/route param ไม่พบ | ยังไม่ได้กำหนด |
| OD-013 | นิยาม ราคา สิทธิ์ และ lifecycle ของ Ad-free membership | ยังไม่ได้กำหนด |
| OD-014 | ผู้ให้บริการ เนื้อหาโฆษณา frequency cap การวัดผล และ privacy/consent | ยังไม่ได้กำหนด |

## Decision Governance

Decision owner, approver, วันที่อนุมัติ, supersession process และ ADR format: **ยังไม่ได้กำหนด**
