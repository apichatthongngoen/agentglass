# Spec: agentglass เป็น PWA บน iPhone (fork `local`)

สถานะ: **implemented + deployed บน dev12 (2026-10-03)** — ใช้งานจริงบน iPhone 17: phone mode, pair, Term+KeyBar, Chat, push ผ่าน. ต่างจาก spec: pair ผ่านหน้า Remote บน URL tunnel (แก้ `atMachine`) ไม่ใช่ curl; ไม่ใช้ `viewport-fit=cover`; ไม่ต้อง Bypass Access (T6 ยกเลิก); เพิ่ม freshness reload + ไม่ตอบ DA บนมือถือ. รายละเอียด: runbook §8.15

## Objective

ใช้ agentglass ของ **dev12** บน iPhone แบบ Add to Home Screen ผ่าน `https://agentglass-dev.878383163.xyz` (CF Tunnel + CF Access, session 1 เดือน) ไม่ใช้แอป native ของ upstream. Mac ไม่อยู่ใน scope

ผู้ใช้: เจ้าของเครื่องคนเดียว ใช้ iPhone ตอนไม่อยู่หน้าคอม

ต้องทำได้:
1. **Gate + สถานะ** — เห็น agent ที่รอ แล้วกด Allow/Deny, เห็น Lantern
2. **Chat** — คุยและสั่งงาน agent
3. **Terminal** — พิมพ์ใน tmux ได้จริง มี key bar Esc/Ctrl/Tab/ลูกศร
4. **Dashboard / Plan quota**
5. **Push** ตอนล็อกจอ สำหรับ 4 kind (`shared/notifyPrefs.ts:17`):
   - `blocked` — gate / permission prompt
   - `idle` — agent ทำเสร็จ
   - `stalled` — tool ค้างนาน
   - `autopilot` — Lantern / understudy บอกว่าต้องการคน

### ข้อสันนิษฐาน
1. iOS ≥ 16.4 (Web Push ใช้ได้เฉพาะแอปที่ติดตั้งบนหน้าจอแล้ว)
2. เข้าผ่าน CF Access เท่านั้น ไม่เปิดพอร์ตหรือ LAN เพิ่ม
3. ทำบน fork branch `local` → diff ที่ไฟล์ upstream ต้องเล็กและอยู่จุดที่ระบุเท่านั้น
4. desktop UI ต้องไม่เปลี่ยน
5. ไม่ทำ offline mode

## ของที่มีอยู่แล้ว (สำรวจ v0.22.0)

| ส่วน | สถานะ |
|---|---|
| manifest, apple meta, icon (`web/index.html:26-37`) | มีแล้ว |
| auth ผ่าน browser | `?token=` → `localStorage` → Bearer. ถ้าได้ 401 จะเด้ง `window.prompt` (`web/src/lib/api.ts:316-362,488`) |
| pairing บนเว็บ | `?pair=<ticket>` → `PairScreen` → `adoptServer({token})` (`web/src/main.tsx:82-95`). credential แยกต่อเครื่อง, scope `read`/`answer`/`full` (`server/src/devices.ts:64-70`) |
| alert pipeline | ทุก alert ผ่าน `deliver()` (`server/src/alerts.ts:124`) → webhook / socket frame / notify-send |
| phone layout | **ไม่มี** — upstream ลบ companion ใน `b35c3fd6` (release สุดท้ายที่ยังมีคือ v0.8.0) |
| SW / Web Push | **ไม่มี** — ลบใน `b35c3fd6`. โค้ดเดิมอยู่ใน `b35c3fd6^`: `server/src/push.ts` (305 บรรทัด, ใช้ `node:crypto` ตัวเดียว), `pushstore.ts`, `web/public/sw.js`, `web/src/lib/webpush.ts` + test `push-*.test.ts` |
| terminal touch | ไม่มี key bar, ไม่มี `visualViewport`. ตัวอย่าง layout ปุ่ม: `mobile/src/terminal/keyLayout.ts` |
| safe area | มีจุดเดียว `index.css:1499`, ทั้งที่ใช้ status bar แบบ `black-translucent` |

upstream ลบ push / companion เพราะต้องใช้ secure context แต่มือถือที่เปิดผ่าน `http://192.168.x.x` ไม่ใช่ (alerts.ts:105-123, main.tsx:33-51) — **ของเราเป็น HTTPS เหตุผลนี้จึงไม่ใช้**

## แนวทาง

### A. ติดตั้งผ่าน CF Access
- CF Access: เพิ่ม application ใหม่ที่เป็น **Bypass** เฉพาะ `/manifest.webmanifest`, `/icon-192.png`, `/icon-512.png`, `/icon-maskable-512.png`, `/apple-touch-icon.png`, `/favicon.svg`. ทั้งหมดเป็นไฟล์ static ไม่มีความลับ (**ยืนยันแล้ว:** ถ้าขอ manifest โดยไม่มี cookie จะได้ 302)
- **ไม่ Bypass `/sw.js`** — browser ขอ worker script แบบ credentials same-origin จึงส่ง cookie ของ CF ไปด้วยอยู่แล้ว (ยืนยันใน spike)
- `index.html`: `viewport-fit=cover` + padding ด้วย `env(safe-area-inset-top/bottom)` ที่ TopBar และ tab bar
- Access หมดอายุ (ทุก 1 เดือน): fetch ที่ถูก redirect ข้าม origin จะได้ `TypeError` ซึ่งแยกไม่ออกจาก network ล่ม → เมื่อ fetch ล้ม**หรือ `/stream` WebSocket ต่อไม่ติด** ให้ลองขอ `/` แบบ `redirect:"manual"`. ถ้าได้ `opaqueredirect` แปลว่า session หมด → `location.reload()` เพื่อไปหน้า login

### B. Credential ของ PWA
- iOS PWA **ไม่ใช้ storage ร่วมกับ Safari**, และลิงก์ pair ที่เปิดจาก Messages หรือกล้องจะไปเปิดใน Safari ไม่ใช่ในแอป
- **หน้า pairing บน desk ใช้กับ dev12 ไม่ได้:** `PairPanel` แสดงเฉพาะเมื่อ `exposed && trustLan` (`RemoteAccessPane.tsx:148`) แต่ dev12 ฟังแค่ loopback หลัง tunnel. ถ้าเปิดสองค่านี้จะเปิดรับจาก LAN ซึ่งขัดกับข้อ Never
- server ยังรับ credential แยกต่อเครื่องได้ไม่ว่าจะ bind แบบไหน (`auth.ts:485` `deviceFor`)
- ~~pair ด้วย curl~~ (**แก้ตอนเขียน plan:** `/pair/accept` ต้องมี Origin ที่ browser รับรอง — `mayReleaseAHold`, index.ts:1751. ถ้าใช้ curl ต้องปลอม header ซึ่งข้ามการเช็กว่าคนกดเอง) → **ให้ `RemoteAccessPane` แสดง PairPanel เมื่อเปิดผ่าน `https:`** และใช้ `location.origin` เป็นที่อยู่ (ประมาณ 3 บรรทัด). ขั้นตอน: Mac เปิด Settings → Remote บน URL ของ dev12 → iPhone สแกน QR → Copy Link → วางในแอป → พิมพ์ code → กดรับ scope Full
- ฝั่งมือถือ (โค้ดใหม่ ~3 บรรทัด): ใน `reauthPrompt()` (`api.ts:485`) ถ้าค่าที่วางมี `pair=` ให้ดึง ticket ออกมาแล้ว `location.href = location.origin + "/?pair=" + ticket` (URL อยู่ใน scope แอปจึงยังอยู่ในแอป) → `PairScreen` เดิม (`main.tsx:84`)

### C. Web Push (เอาโค้ด `b35c3fd6^` กลับมา)
- server: เอา `push.ts` + `pushstore.ts` กลับมา. VAPID key อยู่ที่ `~/.config/agentglass/push.json` (mode 600)
- **ตำแหน่งใน `deliver()` สำคัญ:** ใส่ push channel **หลังจุดเช็ก prefs** แต่**ก่อน** `if (live > 0 || redraw) return` (alerts.ts ~187) และไม่ส่งเมื่อเป็น `redraw`. ถ้าวางหลังจุดนั้น เมื่อเปิด dashboard ของ dev12 ค้างไว้บน Mac (live > 0) มือถือจะไม่ได้อะไรเลย
- ไม่ส่งซ้ำไปเครื่องที่แอปเปิดอยู่ (socket ของ device นั้น live) — ถ้าทำยากให้ยอมส่งซ้ำไปก่อน
- เลือก kind ผ่าน prefs เดิม: เปิด `idle`, `stalled`, `autopilot` ใน Settings → Notifications (`blocked` เปิดอยู่แล้วเป็นค่าเริ่มต้น). prefs เป็นค่ารวมของทุก channel จึงขึ้นที่ bell ใน desktop ด้วย. ยอมรับได้เพราะ dev12 เป็น headless ไม่มี notify-send ให้รบกวน
- route `/push/key|subscribe|unsubscribe|test` อยู่ในบล็อกเดียวใน index.ts ติด `LOCAL PATCH`. subscribe ต้องมี credential (ได้ 401 ถ้าไม่มี)
- web: `public/sw.js` (push + notificationclick, ไม่ cache) + `lib/webpush.ts` (ไม่มี import อื่น) ปุ่มเปิด/ปิด ต้องกดจากในแอปที่ติดตั้งแล้ว
- **iOS ไม่มีปุ่ม action บน notification** → ไม่เอา `swAuth.ts` กลับมา และ**ตัดส่วน `actions: gate` (sw.js:110) กับการ decide จาก notification (sw.js:~200-230) ออกจาก sw.js เดิม**
- แตะ notification → `clients.openWindow("./")` เปิดแอปที่หน้าแรก. แอปไม่มี URL route ไปที่ gate (มี hash route แค่ lane) จึงไม่ทำ deep link. gate เห็นได้ที่ TopBar (ดู D)
- ใส่ `tag` ต่อ gate/session เพื่อให้ notification ใหม่แทนอันเก่า. iOS ไม่มี silent push จึงลบ notification ที่ gate ถูกตอบไปแล้วไม่ได้ — ยอมรับ
- payload มีแค่ชื่อ agent + tool + สรุปสั้น — ถึงจะเข้ารหัสระหว่างทาง (aes128gcm) แต่ข้อความจะขึ้นบน lock screen

### D. Phone layout (**ใน `App` เดิม** ไม่สร้าง shell แยก)
- **ทำไมไม่สร้าง shell แยก:** `App.tsx` เป็นตัวโหลดข้อมูลทั้งหมด (events, agents, rollups, providers — App.tsx:538-575) แล้วส่งเป็น props ให้แต่ละ view (App.tsx:1148-1186). ถ้าแยก shell ต้องลอกส่วนนี้ทั้งหมดมาไว้ซ้ำ
- phone mode = `(display-mode: standalone) and (pointer: coarse)` หรือ `?ui=phone` (จำใน localStorage). เพิ่ม `(pointer: coarse)` เพื่อไม่ให้ desktop PWA หรือ Electron เข้า phone mode ไปด้วย
- `Workspace.tsx:188`: phone mode → `flex-col-reverse`. `ViewRail` แสดงเป็น tab bar แนวนอนด้านล่าง เฉพาะ view `dash` / `term` / `chat` / `lantern`
- **ตอบ gate ได้ที่ TopBar** (`TopBarNotes` → `gateStore` → `/gate/decide`, `api.ts:978`) และที่ Dashboard (`Alerts`, `DashboardView.tsx:174`). **Lantern view ตอบ gate ไม่ได้**
- TopBar: ใน phone mode ต้อง**เก็บ `TopBarNotes` ไว้เสมอ** ซ่อนได้เฉพาะส่วนอื่น (มี `hideUnder` อยู่แล้ว TopBar.tsx:234). tab แรกตอนเปิดแอปเป็น `dash`
- Settings / PR / Git: ไม่ทำใน phase นี้

### E. Terminal บน touch
- `web/src/mobile/KeyBar.tsx` (ไฟล์ใหม่): Esc, Tab, Ctrl (sticky), ↑↓←→, `|`, `~`, `/`, ⌃C → `term.input()`. แสดงเฉพาะ phone mode
- `visualViewport` resize → `fit()` ใหม่ เพื่อให้คีย์บอร์ดไม่บังแถว prompt
- ปัดขึ้นลง → history overlay ที่มีอยู่ (patch 8.8)
- ปิด autocorrect / autocapitalize ที่ textarea ของ xterm

## Tech Stack
ของเดิมทั้งหมด: Bun 1.4.2, React + Vite + Tailwind, xterm.js 6. **ไม่เพิ่ม dependency** (ไม่ใช้ `web-push`, `vite-plugin-pwa` หรือ workbox)

## Commands
```bash
export PATH=$HOME/apps/agentglass/.bun/bin:$PATH          # Mac (dev12: ~/.bun/bin)
bun install
cd server && bun x tsc --noEmit -p .
cd web && bun run typecheck
cd server && bun test test/push-*.test.ts                 # เฉพาะไฟล์ ไม่รันทั้ง suite
cd web && bun test test/<file>.test.ts
bun run build
bun run dev                                               # server :4000 + vite :6180 (ใช้ ?ui=phone ทดสอบบน desktop)
```
deploy: runbook §11 — Mac ก่อน (ใช้รัน test) แล้ว dev12, เช็ก `/chat/active` ก่อน restart

## Project Structure
```
web/src/mobile/              → ใหม่: KeyBar.tsx, phoneMode.ts, accessExpiry.ts
web/public/sw.js             → service worker (plain JS)
web/src/lib/webpush.ts       → subscribe/unsubscribe (นำกลับมา)
server/src/push.ts, pushstore.ts → นำกลับมา
แตะไฟล์ upstream: index.html (viewport), App.tsx/Workspace.tsx/ViewRail.tsx/TopBar.tsx (phone mode),
                  TerminalPanel.tsx (mount KeyBar), api.ts:485 (pair paste + expiry probe), alerts.ts (push channel), index.ts (routes)
ไม่แตะ: PairPanel / PairScreen / remoteLink (แตะ RemoteAccessPane 3 บรรทัด)
```

## Code Style
คอมเมนต์อธิบาย *ทำไม* แบบ upstream. บรรทัดที่แตะไฟล์ upstream ต้องติด `LOCAL PATCH`:
```ts
// LOCAL PATCH (apichat 2026-10-xx): a locked phone is told even while the
// desk has a window open — that window is not the person.
if (!redraw) void pushToDevices({ title, body, kind, ...(extra ?? {}) });
if (live > 0 || redraw) return;
```
commit ภาษาอังกฤษ ทีละเรื่อง บน `local`, ใส่ `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` อย่างเดียว

## Testing Strategy
- **bun test:**
  - encrypt — ใช้ test vector เดิม `push-encrypt.test.ts`
  - pushstore
  - route auth: ไม่มี credential ต้องได้ 401
  - **`deliver()` ส่ง push ทั้งที่ `live > 0`, ไม่ส่งเมื่อ `redraw`, ไม่ส่งเมื่อ kind ปิดใน prefs**
  - `sw.js` ถูก eval ตรงๆ
  - KeyBar map ปุ่ม → byte
  - phone mode selector (`?ui=`, media query)
  - pair-paste ใน prompt
- type check + build ต้องผ่านทุก task. test ของ patch เดิม 85 ตัวต้องผ่าน
- **manual บน iPhone จริง** (ทำแทนไม่ได้): ดู Success Criteria 1–6

## Boundaries
- **Always:**
  - โค้ดใหม่แยกเป็นไฟล์ใหม่
  - รัน type check + test ก่อน commit
  - เช็ก `/chat/active` ก่อน restart
  - ทำ Mac ก่อน dev12
- **Ask first:**
  - เพิ่ม dependency
  - แก้ CF Access (ผู้ใช้ทำเองใน dashboard)
  - แก้ auth/scope ใน server
  - แก้ไฟล์ upstream นอกจุดที่ระบุใน Project Structure
  - restart service
- **Never:**
  - เปิดพอร์ตหรือ LAN เพิ่ม
  - ใส่ token ใน URL ที่ค้างใน history
  - ใส่ command เต็มหรือความลับใน push payload
  - ใช้ machine token เป็น credential ของมือถือ
  - Bypass Access สำหรับ path ที่ไม่ใช่ไฟล์ static ที่ระบุใน A

## Success Criteria
1. Add to Home Screen → เปิดแบบ standalone, ไอคอนถูกต้อง, ไม่มีอะไรถูก status bar หรือ home indicator บัง
2. เปิดครั้งแรก → login Access ในแอป → วาง pair link ใน prompt → พิมพ์ code → accept ด้วย curl → เข้าแอปได้. เปิดใหม่ไม่ต้องทำซ้ำภายใน 1 เดือน. `/pair/forget` แล้วมือถือเข้าไม่ได้ทันที
3. Access หมดอายุ → แอปพาไปหน้า login เอง ไม่ค้างหน้าขาว
4. ล็อกจอ + เปิด dashboard ของ dev12 ค้างไว้บน Mac → agent ติด gate → push ถึงภายใน 10 วินาที → แตะแล้วเปิดแอป → Allow ได้. `idle` / `stalled` / `autopilot` ก็ถึงด้วยเมื่อเปิดไว้
5. Terminal: พิมพ์ `ls`, Esc / ⌃C / ↑ / Tab จาก key bar ใช้ได้, คีย์บอร์ดขึ้นแล้วยังเห็น prompt, ปัดขึ้นดู history ได้
6. Chat ส่งแล้วได้ stream กลับ, gate ตอบได้จาก TopBar ใน phone mode, Dashboard เห็น Plan quota ครบ
7. desktop ไม่เปลี่ยน: test 85/85 ผ่าน, build ผ่าน, เปิดด้วย `?ui=desk` เหมือนเดิม
8. rebase ขึ้น upstream รุ่นถัดไป มี conflict เฉพาะไฟล์ใน Project Structure

## Open Questions
1. **(spike 0)** หน้า login ของ CF Access บน iOS standalone จะเปิดในแอปหรือเด้งไป Safari? ถ้าเด้ง cookie จะไม่กลับมาในแอป → ทั้งแผนต้องเปลี่ยน (ทางสำรองเช่น Cloudflare WARP + policy ตาม device). **ต้องตอบก่อนเขียนโค้ด**
2. **(spike 0)** พิมพ์ใน xterm ด้วยคีย์บอร์ด iOS ได้ปกติไหม (autocorrect, composition, backspace, ภาษาไทย) — ถ้าเพี้ยน E ต้องมีช่อง input แยกแทนการพิมพ์ใส่ xterm ตรงๆ
3. **(Phase 2)** Bypass แค่ manifest กับไอคอนพอให้ iOS เปิด Web Push ได้ไหม และ `/sw.js` register ผ่าน Access ได้จริงไหม
3. ~~Access session~~ → 1 เดือน (ตอบแล้ว)
4. ~~push kind~~ → blocked + idle + stalled + autopilot (ตอบแล้ว)
5. ~~Mac~~ → dev12 อย่างเดียว (ตอบแล้ว)

## Phases (รายละเอียดใน `tasks/plan.md` หลังอนุมัติ)
0. **Spike บน iPhone — ทำได้วันนี้ ไม่ต้องเขียนโค้ดหรือตั้ง Bypass:** iOS ติดตั้งแบบ standalone ได้จาก `apple-mobile-web-app-capable` (`index.html:29`) แม้ manifest จะถูก Access บล็อก, และแอปที่ติดตั้งไม่ได้ใช้ cookie ร่วมกับ Safari จึงต้องผ่านหน้า login ของ Access เองตอนเปิดครั้งแรก. ผ่านถ้าเห็น prompt "This server needs an access token" (แปลว่าผ่าน Access แล้ว) → ตอบ Open Q 1. ลองพิมพ์ใน Terminal ผ่าน Safari → ตอบ Open Q 2
1. A + B: safe-area, Access expiry, pair-paste + สูตร curl ใน runbook
2. C: Bypass manifest/ไอคอน + push 4 kind (ตอบ Open Q 3 ก่อนเริ่ม)
3. D: phone layout
4. E: terminal touch
