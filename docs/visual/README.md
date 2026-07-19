# Visual Screen Overview — NovelVerse

`SCREEN_OVERVIEW.html` คือสารบัญหน้าจอแบบภาพสำหรับ wireframe ปัจจุบันของ NovelVerse เขียนเป็นภาษาไทยและเปิดดูแบบ offline ได้ เหมาะสำหรับสมาชิกทีมใหม่ที่ต้องการเข้าใจหน้าสาธารณะ หน้าอ่าน Dashboard สมาชิก หน้า Admin และ UX States โดยไม่ต้องเปิด development server

## วิธีเปิด

1. จับภาพหน้าจอให้เรียบร้อยตามขั้นตอนด้านล่าง
2. เปิดไฟล์ `docs/visual/SCREEN_OVERVIEW.html` ด้วย Google Chrome โดยตรง
3. ใช้หมวดหมู่หรือช่องค้นหาด้านบนเพื่อกรองตามชื่อหน้าและ route
4. คลิกภาพ Desktop หรือ Mobile เพื่อดูภาพขนาดใหญ่

ไฟล์ HTML ใช้เฉพาะ HTML, CSS, JavaScript และ PNG ภายในโฟลเดอร์นี้ ไม่ต้องใช้ npm, database หรือ server หลังจากสร้าง screenshots แล้ว

## วิธีสร้าง screenshots ใหม่

ติดตั้ง dependencies และ Chromium ครั้งแรก:

```powershell
npm install
npx playwright install chromium
```

จากโฟลเดอร์รากของโปรเจกต์ รันคำสั่งใดคำสั่งหนึ่ง:

```powershell
npm run capture:screens
```

หรือ:

```powershell
npm run docs:screen-overview
```

สคริปต์จะเปิด development server ชั่วคราว จับภาพ Desktop ขนาด 1440 × 1000 และ Mobile ขนาด 390 × 844 แล้วปิด server ให้อัตโนมัติ รวมถึง Novel/Comic Reader ที่มี standard ads 10 รายการ, Premium Popup และ Ad-free Member

## ตำแหน่งไฟล์

- Visual overview: `docs/visual/SCREEN_OVERVIEW.html`
- Screenshots: `docs/visual/screenshots/`
- Capture script: `scripts/capture-screen-overview.mjs`

## ข้อควรทราบ

ภาพทั้งหมดมาจาก mock data และ role switcher ของ interactive wireframe ไม่ใช่ production UI ปุ่มและข้อมูลหลายรายการเป็นเพียงตัวอย่าง ภาพอาจล้าสมัยหลังมีการแก้ UI, route, mock data หรือ responsive layout จึงควรรันคำสั่ง capture ใหม่ทุกครั้งที่หน้าจอเปลี่ยน
