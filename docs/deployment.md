# เปิด Shadow Zoo เป็นเว็บไซต์

ใช้ GitHub Pages เพื่อให้ผู้เล่นเปิดเกมผ่าน URL ได้โดยตรง ไม่ต้องดาวน์โหลด HTML ไม่ต้องติดตั้ง Node.js และไม่ต้องสมัครบัญชีเพื่อเล่น

## ตั้งค่า GitHub Pages

เจ้าของ repository หรือผู้มีสิทธิ์แก้ Settings เปิด [Settings → Pages](https://github.com/Volkyanothai/shadow-zoo/settings/pages) แล้วตั้งค่าดังนี้:

1. ใน **Build and deployment** เลือก **Source → Deploy from a branch**
2. เลือก **Branch → gh-pages**
3. เลือกโฟลเดอร์ **/(root)**
4. กด **Save**
5. รอ GitHub เผยแพร่เสร็จ หน้านี้จะแสดงสถานะและปุ่ม **Visit site**

URL เป้าหมายคือ **https://volkyanothai.github.io/shadow-zoo/** URL นี้เป็นเป้าหมายสำหรับการเผยแพร่ ยังไม่ถือว่าออนไลน์จนกว่า Pages จะแสดงว่าการเผยแพร่สำเร็จและเปิดเกมได้จริง

Branch `gh-pages` ใช้ไฟล์เว็บไซต์ที่ build แล้ว ส่วน branch `delivery/shadow-zoo-playable` เก็บซอร์สสำหรับพัฒนา หากยังเลือก `gh-pages` ไม่ได้ ให้ตรวจว่า branch นี้มีอยู่บน GitHub แล้ว

## เมื่อเว็บไซต์พร้อม

เปิด URL ด้วย Chrome, Edge, Firefox หรือ Safari เลือก LEO หรือ KOBA แล้วกด **ENTER THE ARENA** เกมเล่นบนคอมพิวเตอร์ด้วยคีย์บอร์ด หรือบนมือถือด้วยปุ่มสัมผัสใต้สนาม แชร์ URL เดียวกันให้ผู้เล่นคนอื่นได้

หากเห็นหน้า 404 ให้ตรวจค่า Source, branch และโฟลเดอร์ใน Pages และรอการเผยแพร่เสร็จก่อนลองอีกครั้ง

## พัฒนาและอัปเดตเว็บไซต์

ใช้ Node.js 22.12 ขึ้นไป:

```sh
npm ci
npm run dev
npm test
npm run build
```

`npm run build` สร้างเว็บไซต์ใน `dist/` เมื่อต้องการอัปเดตเว็บ ให้นำเนื้อหาใน `dist/` ไปเผยแพร่ที่ root ของ branch `gh-pages` และรอ Pages เผยแพร่รอบใหม่ การตั้งค่านี้ใช้การเผยแพร่จาก branch โดยตรง ไม่ต้องเพิ่ม workflow หรือส่ง credentials ให้ผู้เล่น

ดูการควบคุมและคอมโบทั้งหมดใน [README](../README.md#การควบคุม)
