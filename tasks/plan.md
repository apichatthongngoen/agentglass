# Implementation Plan: agentglass as an iPhone PWA (fork branch `local`)

Spec: `SPEC.md` (v3, Thai) in this repo root. This plan is self-contained. Where it
and the spec disagree, **this plan wins**: it was written after reading the code,
and it corrects two spec points (pairing, see Task 2; phase order, see below).

## Overview

Make the dev12 instance of agentglass usable as a home-screen web app (PWA) on an
iPhone. It is reached at `https://agentglass-dev.878383163.xyz`, behind a Cloudflare
Tunnel and Cloudflare Access (Access session: 1 month). Four things must work on the
phone:
- answering gates (permission holds)
- Chat
- a real terminal with a key bar
- Dashboard / Plan quota

On top of that, Web Push notifications must arrive with the phone locked, for these
notify kinds:
- `blocked` (gate)
- `idle` (agent finished)
- `stalled` (tool stuck)
- `autopilot` (Lantern / understudy)

dev12 only. The desktop UI must not change.

## Ground rules for every task (copy of the spec's constraints)

- **Repo:** `~/apps/agentglass` on the Mac, branch `local`. This is the **live service directory** of the Mac's agentglass.
  - Never run `git stash -u`: it sweeps up `.bun/`, which the service runs from.
  - Never `git add -A`: `.bun/` is excluded, but stage named files only anyway.
- **Bun:** the project's own Bun, 1.4.2. Prefix every command with `PATH=$HOME/apps/agentglass/.bun/bin:$PATH` on the Mac.
  - The global bun 1.2.4 fails with `hkdfSync` errors.
  - On dev12 Bun is in `~/.bun/bin`.
- **Tests:** run only the named test files, **never** the whole suite (`bun test` with no file argument). The full suite is slow and has known environmental failures.
- **Upstream files vs new files:**
  - New code goes in **new files**, under `web/src/mobile/` or `server/src/phonepush.ts`.
  - Every edit to an existing upstream file carries a comment starting `LOCAL PATCH (apichat 2026-10-xx):` that says why.
  - Upstream style is full-sentence comments that explain *why*. Match it.
- **No new dependencies.** No `web-push`, no `vite-plugin-pwa`, no workbox.
- **Commits:**
  - One commit per task on `local`, message in English.
  - The message ends with exactly one trailer: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. No session link.
  - Never commit `bun.lock` or `SPEC.md`/`tasks/` changes together with code.
- **Restarting a service:**
  - Mac: `launchctl kickstart -k gui/$(id -u)/com.apichat.agentglass`.
  - dev12: `systemctl --user restart agentglass`.
  - Only after `curl -s http://127.0.0.1:4000/chat/active` returns `{"ids":[]}`. On dev12 that check needs `-H "Authorization: Bearer $(grep AGENTGLASS_TOKEN ~/.config/agentglass/env | cut -d= -f2)"`.
  - Web-only changes need `bun run build` and no restart. Server changes need a restart.
  - **Ask the human before any restart.**
- **dev12 access:** `ssh dev12-cf`. Deploy there with `cd ~/apps/agentglass && git pull --ff-only && bun install && bun run build`.
- **Never:**
  - Turn on remote access / LAN binding (`AGENTGLASS_BIND`, `AGENTGLASS_TRUST_LAN`, the Remote switch in Settings).
  - Put a token in a URL that stays in history.
  - Put a full command or secret in a push payload.
  - Use the machine token as the phone's credential.
  - Bypass Access for anything except the static files listed in Task 6.

## Architecture decisions

1. **Phone mode lives inside the existing `App`, not a separate shell.**
   - `web/src/App.tsx` owns all the data plumbing (events, agents, rollups, providers at App.tsx:538-575) and hands it to views as props (App.tsx:1138-1197). A separate shell would duplicate it.
   - Phone mode is: an attribute `data-phone="1"` on `<html>`, CSS in a new file `web/src/mobile/phone.css`, and two small mounts in `App.tsx` (tab bar + key bar).
2. **The ViewRail is hidden by CSS, not rewritten.** `ViewRail` (`web/src/components/workspace/ViewRail.tsx`) has drag/hide/utility logic. Phone mode hides it via its stable `nav[aria-label="Workspace views"]` (ViewRail.tsx:296) and renders a new `PhoneTabBar`.
3. **Pairing uses the existing web flow, made visible over HTTPS.**
   - `PairPanel` only renders when the server is LAN-exposed (`RemoteAccessPane.tsx:127`, `live = st.exposed && st.trustLan && pairUrls.length > 0`), and dev12 is loopback-only.
   - Task 2 also makes it render when the page itself is on `https:`, using `location.origin` as the pair address.
   - The spec's "accept with curl" idea is **rejected**: `/pair/accept` requires `mayReleaseAHold` (server/src/index.ts:1751), i.e. a browser-vouched Origin. Faking that header with curl defeats a deliberate human-presence check.
4. **Web Push: restore the server crypto from git, write the browser side fresh.**
   - Restored verbatim from `b35c3fd6^`: `server/src/push.ts` (uses only `node:crypto`) and `server/src/pushstore.ts`.
   - The old `web/public/sw.js` and `web/src/lib/webpush.ts` were tied to removed pieces (IndexedDB credential, Allow/Deny actions that iOS does not support). They are replaced by short new files whose full text is in this plan.
5. **Push fires before the "somebody is looking" cut-off.** `deliver()` in `server/src/alerts.ts` returns at `if (live > 0 || redraw) return;` when any desk window is live. The phone hook goes **before** that line, otherwise a dashboard left open on the Mac silences the phone.
6. **Phase order differs from the spec:** layout (Phase B) comes before push (Phase C). The push on/off button lives in the phone tab bar built in Phase B.

## Dependency graph

```
T0 spike (human, iPhone)
 └─ T1 phone mode foundation (data-phone, CSS, viewport, keyboard inset)
     ├─ T2 pair over HTTPS + paste-a-pair-link on first launch
     ├─ T3 Access-expiry recovery
     │   └─ CHECKPOINT A (deploy dev12, install, pair)
     ├─ T4 PhoneTabBar + safe areas
     │   └─ T5 terminal KeyBar
     │       └─ CHECKPOINT B
     └─ T6 Access Bypass + VAPID subject env (human ops)
         └─ T7 server push core (restore + phonepush.ts)
             └─ T8 deliver() hook + /push routes
                 └─ T9 sw.js + web push client + toggle in PhoneTabBar (needs T4)
                     └─ CHECKPOINT C
                         └─ T10 docs (runbook README §8.15, SPEC status)
```

---

## Task 0 — Spike on a real iPhone (human; no code)

**Description:** Answer the two questions that decide whether the plan works at all. iOS already installs this page standalone, because `web/index.html:29` has `apple-mobile-web-app-capable`. An installed iOS web app does not share cookies with Safari, so its first launch must go through the Cloudflare Access login on its own.

**Steps for the human:**
1. In Safari on the iPhone, open `https://agentglass-dev.878383163.xyz`, log in to Access, then Share → **Add to Home Screen**.
2. Launch the icon.
   - Note whether the Access login opens **inside** the app (good) or jumps to Safari (bad).
   - Log in. Pass = the app shell renders and the status pill says something other than a blank page.
   - The app may sit at "connecting" because it has no token. That is expected and still a pass.
3. Back in Safari (not the app), open the Term view.
   - Type `echo hello`, use backspace, then type Thai `สวัสดี`.
   - Note any doubled, missing or autocorrected characters.

**Acceptance criteria:**
- [ ] Answer recorded: "Access login stays in app: yes/no".
- [ ] Answer recorded: "xterm typing on iOS: clean / problems (describe)".

**Gate:**
- If the Access login jumps to Safari and the app never gets past it: **STOP**. Report back. The plan needs a different access route, and no task below starts.
- If typing is broken: continue, but tell the human that Task 5 will not fix input. That needs a separate input box, which is out of this plan.

**Dependencies:** None. **Scope:** none (manual).

---

## Phase A — install, pair, stay logged in

### Task 1 — Phone mode foundation

**Description:** Decide once at startup whether this window is "phone mode", expose it as `<html data-phone="1">`, and give it the base CSS:
- full dynamic-viewport height minus the on-screen keyboard
- notch / status-bar padding
- the ViewRail hidden

Nothing else changes yet.

**Implementation notes:**

1. Create `web/src/mobile/phoneMode.ts`:
```ts
/**
 * Phone mode: the installed iPhone app, or anything forced with ?ui=phone.
 * A pure chooser plus one side-effecting init, so the chooser can be tested
 * without a DOM.
 */
export type UiChoice = "phone" | "desk" | null;
const KEY = "agentglass_ui";

/** Pure. `query` is location.search; `saved` is what localStorage held. */
export function pickUi(query: string, saved: string | null, standalone: boolean, coarse: boolean):
  { phone: boolean; save: UiChoice } {
  const q = new URLSearchParams(query).get("ui");
  if (q === "phone" || q === "desk") return { phone: q === "phone", save: q };
  if (saved === "phone") return { phone: true, save: null };
  if (saved === "desk") return { phone: false, save: null };
  return { phone: standalone && coarse, save: null };
}

export let PHONE = false;

export function initPhone(): boolean {
  let saved: string | null = null;
  try { saved = localStorage.getItem(KEY); } catch { /* private mode */ }
  const standalone = (navigator as { standalone?: boolean }).standalone === true
    || matchMedia("(display-mode: standalone)").matches;
  const coarse = matchMedia("(pointer: coarse)").matches;
  const r = pickUi(location.search, saved, standalone, coarse);
  if (r.save) { try { localStorage.setItem(KEY, r.save); } catch { /* private mode */ } }
  PHONE = r.phone;
  if (!PHONE) return false;
  document.documentElement.dataset.phone = "1";
  // iOS does not shrink the layout viewport for the keyboard; the visual
  // viewport does. --kb is how much of the screen the keyboard covers.
  const vv = window.visualViewport;
  const setKb = () => {
    const kb = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
    document.documentElement.style.setProperty("--kb", `${kb}px`);
    if (kb > 0) window.scrollTo(0, 0);
  };
  vv?.addEventListener("resize", setKb);
  vv?.addEventListener("scroll", setKb);
  setKb();
  return true;
}
```

2. Create `web/src/mobile/phone.css`:
```css
/* Phone mode only — every rule is scoped under html[data-phone]. */
html[data-phone], html[data-phone] body { overscroll-behavior: none; }
html[data-phone] #root > .h-screen {
  height: calc(100dvh - var(--kb, 0px));
  padding-top: env(safe-area-inset-top);
}
html[data-phone] nav[aria-label="Workspace views"] { display: none; }
```

3. Edit `web/src/main.tsx`:
   - Add `import { initPhone } from "./mobile/phoneMode.ts";` and `import "./mobile/phone.css";` directly **after** line 15, `import "./index.css";`. The CSS must load after index.css so it wins on equal specificity.
   - Call `initPhone();` on its own line directly **after** the existing top-level `restoreScale();` call (~line 31).
   - Put the LOCAL PATCH comment above the call.

4. Edit `web/index.html` line 5: change `content="width=device-width, initial-scale=1.0"` to `content="width=device-width, initial-scale=1.0, viewport-fit=cover"`, with a LOCAL PATCH HTML comment on the line above. Without `viewport-fit=cover`, `env(safe-area-inset-*)` is always 0 on iOS.

5. Create `web/test/phone-mode.test.ts` with `bun:test`. Test only `pickUi`. The web test env has **no DOM** (`localStorage`/`document` are undefined), so never import anything that touches them at module load. `phoneMode.ts` only touches them inside `initPhone`. Cases:
   - `pickUi("?ui=phone", null, false, false)` → `{phone:true, save:"phone"}`
   - `pickUi("?ui=desk", "phone", true, true)` → `{phone:false, save:"desk"}`
   - `pickUi("", "phone", false, false)` → `{phone:true, save:null}`
   - `pickUi("", "desk", true, true)` → `{phone:false, save:null}`
   - `pickUi("", null, true, true)` → `{phone:true, save:null}`
   - `pickUi("", null, true, false)` → `{phone:false, save:null}` (an installed desktop app is not a phone)
   - `pickUi("?ui=bogus", null, false, false)` → `{phone:false, save:null}`

**Pitfalls:**
- ⚠️ `App`'s root element is `<div className="h-screen overflow-hidden flex flex-col relative">` (App.tsx:1129). React renders it as the first child of `#root`, because `Mounted` in main.tsx returns a fragment. The selector `#root > .h-screen` relies on that. Do not change App's root classes.
- ⚠️ Do not use `100vh` anywhere. On iOS it includes the area under the browser chrome; `100dvh` is correct.
- ⚠️ `initPhone()` must run before `mount(...)` so the first paint already has `data-phone`.

**Out of scope — do NOT touch:** `ViewRail.tsx`, `Workspace.tsx`, `App.tsx` (Task 4 does App), `index.css`, the manifest.

**Acceptance criteria:**
- [ ] `?ui=phone` on the desktop dev build → `document.documentElement.dataset.phone === "1"` and the left icon rail is gone.
- [ ] `?ui=desk` afterwards → the attribute is absent after reload and the rail is back.
- [ ] A plain desktop load with no saved choice → no attribute.

**Verification:**
- [ ] `cd ~/apps/agentglass/web && PATH=$HOME/apps/agentglass/.bun/bin:$PATH bun test test/phone-mode.test.ts` → `7 pass`, `0 fail`.
- [ ] `cd ~/apps/agentglass/web && PATH=$HOME/apps/agentglass/.bun/bin:$PATH bun run typecheck` → exits 0, prints no errors.
- [ ] `cd ~/apps/agentglass && PATH=$HOME/apps/agentglass/.bun/bin:$PATH bun run build` → ends with `✓ built in`.
- [ ] Manual: open `http://127.0.0.1:4000/?ui=phone` in desktop Chrome (the Mac serves `web/dist`). In devtools console, `document.documentElement.dataset.phone` → `"1"`, and no left rail. Then `/?ui=desk` → `undefined` and the rail is visible.

**Dependencies:** T0 passed. **Files:** `web/src/mobile/phoneMode.ts` (new), `web/src/mobile/phone.css` (new), `web/src/main.tsx`, `web/index.html`, `web/test/phone-mode.test.ts` (new). **Scope:** M.

---

### Task 2 — Pair a phone over HTTPS

**Description:** Two halves.
- **Desk:** make the existing pairing panel (QR + six-digit code + accept with a scope) appear in Settings → Remote when the page is opened over `https:`. That is how the Mac browser reaches dev12.
- **Phone:** on first launch in phone mode with no credential, ask for a pair link. Accept a pasted pair link and route it into the existing `PairScreen` **inside** the installed app.

**Implementation notes:**

1. Edit `web/src/components/RemoteAccessPane.tsx`, lines 125 and 127.

   Current:
```ts
  const url = pairUrls[pick] ?? "";
  ...
  const live = st.exposed && st.trustLan && pairUrls.length > 0;
```

   Change to:
```ts
  // LOCAL PATCH (apichat 2026-10-xx): reached over a public HTTPS name (a
  // Cloudflare Tunnel behind Access), the page's own origin is the address a
  // phone pairs over — the server itself stays bound to loopback, so
  // `exposed`/`trustLan` are false and the panel used to stay hidden.
  const publicOrigin = location.protocol === "https:" ? location.origin : "";
  const url = publicOrigin || (pairUrls[pick] ?? "");
  ...
  const live = !!publicOrigin || (st.exposed && st.trustLan && pairUrls.length > 0);
```

   Keep line 126 (`const address = pairAddrs[pick];`) unchanged.

2. Create `web/src/mobile/pairPaste.ts`:
```ts
/** The ticket out of anything a person pastes: a full pair link from any host,
 *  or a bare "?pair=…". Null when there is none. Pure. */
export function pairTicketFrom(text: string): string | null {
  const t = text.trim();
  if (!t.includes("pair=")) return null;
  try {
    const v = new URL(t, "https://x.invalid").searchParams.get("pair");
    return v && v.trim() ? v.trim() : null;
  } catch { return null; }
}
```

3. Edit `reauthPrompt()` in `web/src/lib/api.ts` (~line 485). Current body:
```ts
  const t = window.prompt("This server needs an access token.\nPaste it to reconnect:");
  if (t && t.trim()) {
    try { localStorage.setItem("agentglass_token", t.trim()); } catch { /* private mode */ }
    location.reload();
  }
```

   New body. Add `import { pairTicketFrom } from "../mobile/pairPaste.ts";` at the top of api.ts, beside the other imports.
```ts
  const t = window.prompt("This server needs an access token or a pair link.\nPaste it to connect:");
  if (!t || !t.trim()) return;
  // LOCAL PATCH (apichat 2026-10-xx): an installed iPhone app cannot be
  // opened by a link — the camera and Messages open Safari — so the pair link
  // is pasted here and re-entered on this app's own origin, which keeps the
  // handshake inside the app that will hold the credential.
  const ticket = pairTicketFrom(t);
  if (ticket) { location.href = `${location.origin}/?pair=${encodeURIComponent(ticket)}`; return; }
  try { localStorage.setItem("agentglass_token", t.trim()); } catch { /* private mode */ }
  location.reload();
```

4. Edit `web/src/main.tsx`, the final `else { mount(<App />); }` branch (~line 96). Change it to:
```ts
} else {
  // LOCAL PATCH (apichat 2026-10-xx): the installed phone app starts with no
  // credential and, with no token at all, useLive never reaches "unauthorized"
  // (it only probes when one is held), so nothing would ever ask for one.
  if (PHONE && !hasToken()) reauthPrompt();
  mount(<App />);
}
```

   Import `PHONE` from `./mobile/phoneMode.ts`. Extend the existing `import { adoptServer } from "./lib/api.ts";` (line 10) to `import { adoptServer, hasToken, reauthPrompt } from "./lib/api.ts";`.

5. Create `web/test/pair-paste.test.ts`. Cases for `pairTicketFrom`:
   - `"https://agentglass-dev.878383163.xyz/?pair=abc123"` → `"abc123"`
   - `"http://192.168.1.5:4000/?pair=t%2B1"` → `"t+1"`
   - `"?pair=xyz"` → `"xyz"`
   - `"  https://h/?pair=  "` → `null`
   - `"sk-some-token"` → `null`
   - `""` → `null`

**Pitfalls:**
- ⚠️ `location.protocol === "https:"` is also true for the Mac's own Electron or any other https origin. That is fine: showing the pair panel there is harmless, because accepting still needs a human-vouched Origin server-side.
- ⚠️ Do not flip the Remote **switch**, and do not touch `st.exposed`/`trustLan`. They control LAN binding.
- ⚠️ `PairScreen` already handles the 6-digit code and `adoptServer({ token })`, which writes `localStorage["agentglass_token"]` (api.ts:512-527). Do not write the token yourself.
- ⚠️ A pair ticket expires after **120 s** (`TICKET_TTL_MS` in server/src/pairing.ts:54). Tell the human in the manual check to be quick.

**Out of scope — do NOT touch:** `PairPanel.tsx`, `PairScreen.tsx`, `lib/pairing.ts`, `lib/remoteLink.ts`, every server pairing route, `useLive.ts`.

**Acceptance criteria:**
- [ ] Settings → Remote on `https://agentglass-dev.878383163.xyz` (Mac Chrome) shows "Connect your phone" with a QR and a code. The QR encodes `https://agentglass-dev.878383163.xyz/?pair=<id>`.
- [ ] In phone mode with no token, a prompt appears at launch. Pasting a pair link navigates to `/?pair=<id>` on the same origin.
- [ ] Pasting a plain token still stores it and reloads.

**Verification:**
- [ ] `cd ~/apps/agentglass/web && PATH=$HOME/apps/agentglass/.bun/bin:$PATH bun test test/pair-paste.test.ts` → `6 pass`, `0 fail`.
- [ ] Typecheck and build as in Task 1 → clean.
- [ ] `cd ~/apps/agentglass/web && PATH=$HOME/apps/agentglass/.bun/bin:$PATH bun test test/no-native-dialogs.test.ts` → still passes. That test names `reauthPrompt` as the one allowed `window.prompt`; keep the prompt inside that function.

**Dependencies:** T1. **Files:** `web/src/components/RemoteAccessPane.tsx`, `web/src/lib/api.ts`, `web/src/main.tsx`, `web/src/mobile/pairPaste.ts` (new), `web/test/pair-paste.test.ts` (new). **Scope:** M.

---

### Task 3 — Recover from an expired Access session

**Description:** Every month the Access cookie expires. After that, every API call and the `/stream` socket fail with a CORS-style `TypeError`, which looks exactly like "server down", and the app would retry forever. Detect the expiry with a non-following probe and reload the page, so the top-level navigation reaches the Access login.

**Implementation notes:**

1. Create `web/src/mobile/accessExpiry.ts`:
```ts
/**
 * True when Cloudflare Access is redirecting this origin to its login, i.e. the
 * Access session ran out. A fetch that follows that redirect fails as a CORS
 * TypeError, indistinguishable from the network being down; one that does not
 * follow it comes back as an opaque redirect, which a 200 from our own server
 * never is. Never throws.
 */
export async function accessExpired(fetchImpl: typeof fetch = fetch, origin = location.origin): Promise<boolean> {
  try {
    const r = await fetchImpl(`${origin}/`, { redirect: "manual", cache: "no-store", credentials: "include" });
    return r.type === "opaqueredirect";
  } catch { return false; }
}
```

2. Edit `web/src/lib/useLive.ts`, inside `ws.onclose` (~line 169). Directly **after** the block
```ts
      if (!everOpened && hasToken()) { ... }
```
   insert:
```ts
      // LOCAL PATCH (apichat 2026-10-xx): behind Cloudflare Access an expired
      // session looks exactly like a dead server; a reload takes the top-level
      // page to the Access login instead of retrying forever.
      if (!everOpened && location.protocol === "https:" && await accessExpired()) { location.reload(); return; }
```
   Add `import { accessExpired } from "../mobile/accessExpiry.ts";` at the top.

3. Create `web/test/access-expiry.test.ts`, using fake fetch implementations:
   - returns `{ type: "opaqueredirect" }` → `true`
   - returns `{ type: "basic", status: 200 }` → `false`
   - throws `new TypeError("x")` → `false`
   - Pass `origin` explicitly (`"https://h"`); there is no `location` in the test env.

**Pitfalls:**
- ⚠️ The `location.protocol === "https:"` guard keeps plain-http desktop dev (`127.0.0.1:4000`) out of this path entirely.
- ⚠️ `/` is served by our server with a 200 when the session is valid (server/src/index.ts serves built assets without a token). Do **not** probe `/manifest.webmanifest` or an icon: Task 6 bypasses Access for those, so they never redirect.

**Out of scope — do NOT touch:** the reconnect backoff (`reconnectDelay`), `probeAuth`, any fetch wrapper in `api.ts`.

**Acceptance criteria:**
- [ ] With an invalid Access cookie, the installed app reloads into the Access login within one reconnect cycle instead of showing a permanent "closed".

**Verification:**
- [ ] `cd ~/apps/agentglass/web && PATH=$HOME/apps/agentglass/.bun/bin:$PATH bun test test/access-expiry.test.ts` → `3 pass`, `0 fail`.
- [ ] Typecheck and build → clean.
- [ ] Manual, desktop Chrome on `https://agentglass-dev.878383163.xyz`, after the build is deployed to dev12:
  1. In devtools → Application → Cookies, delete `CF_Authorization` for that host.
  2. devtools → Network → tick **Offline**, wait for the status pill to leave LIVE, then untick **Offline**.
  3. Expected: within one reconnect cycle the tab navigates to the Cloudflare Access login (`*.cloudflareaccess.com`).

**Dependencies:** T1. **Files:** `web/src/mobile/accessExpiry.ts` (new), `web/src/lib/useLive.ts`, `web/test/access-expiry.test.ts` (new). **Scope:** S.

### Checkpoint A (human present)

- [ ] Commit T1–T3 separately and `git push origin local`.
- [ ] dev12: `ssh dev12-cf 'cd ~/apps/agentglass && git pull --ff-only && PATH=$HOME/.bun/bin:$PATH bun install && PATH=$HOME/.bun/bin:$PATH bun run build'`. Web-only, so no restart.
- [ ] iPhone, end to end:
  1. Delete the old home-screen icon and add it again.
  2. Launch → Access login → the paste prompt appears.
  3. On the Mac: Settings → Remote on the dev12 URL → a QR + code appear.
  4. On the iPhone: scan the QR with the Camera, long-press the yellow banner → **Copy Link**.
  5. Paste into the app's prompt → type the code → on the Mac accept with scope **Full**.
  6. The app loads with the LIVE pill. Kill the app and reopen → still LIVE, with no prompt.
- [ ] Desktop regression: `cd ~/apps/agentglass/server && PATH=$HOME/apps/agentglass/.bun/bin:$PATH bun test test/paste-image.test.ts test/agent-probe-claude-seen.test.ts test/codex-usage-rollover.test.ts` → `0 fail`.

---

## Phase B — usable on a phone screen

### Task 4 — PhoneTabBar and bottom safe area

**Description:** In phone mode, render a bottom tab bar with four views: Dashboard (`dash`), Terminal (`term`), Chat (`chat`), Lantern (`lantern`). It switches views through App's existing `goView`. Gates stay answerable through the TopBar's needs chip (TopBar.tsx ~707-760, `data-topbar-slot`) and the Dashboard alerts (`DashboardView.tsx:174`). Lantern **cannot** answer gates, so do not promise that.

**Implementation notes:**

1. Create `web/src/mobile/PhoneTabBar.tsx`:
```tsx
import { VIEWS, type ViewId } from "../components/workspace/views.ts";
import { ICON } from "../lib/iconSize.ts";

export const PHONE_VIEWS: ViewId[] = ["dash", "term", "chat", "lantern"];

export function PhoneTabBar({ view, onView, extra }: { view: ViewId; onView: (v: ViewId) => void; extra?: React.ReactNode }) {
  const defs = PHONE_VIEWS.map((id) => VIEWS.find((v) => v.id === id)!).filter(Boolean);
  return (
    <nav aria-label="Phone views" className="shrink-0 flex items-stretch"
      style={{ borderTop: "1px solid var(--surface-line)", background: "var(--surface-nav)",
               paddingBottom: "env(safe-area-inset-bottom)" }}>
      {defs.map((v) => {
        const Icon = v.icon;
        const on = v.id === view;
        return (
          <button key={v.id} type="button" onClick={() => onView(v.id)} aria-current={on ? "page" : undefined}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px]"
            style={{ color: on ? "var(--primary-hover)" : "var(--text3)" }}>
            <Icon size={ICON.rail} />
            <span>{v.label}</span>
          </button>
        );
      })}
      {extra}
    </nav>
  );
}
```
   - Add `import React from "react";` only if the file's JSX needs it under this repo's tsconfig. Check another component (e.g. `web/src/components/workspace/ViewRail.tsx`) for whether it imports React.

2. Edit `web/src/App.tsx`. Directly **after** the line `      />}` that closes the `<Workspace` element (line ~1197, immediately before `<EventModal`), insert:
```tsx
      {/* LOCAL PATCH (apichat 2026-10-xx): the installed phone app navigates
          from a bottom bar; the rail is hidden by mobile/phone.css. */}
      {PHONE && <PhoneTabBar view={wsView} onView={goView} />}
```
   - Imports: `import { PHONE } from "./mobile/phoneMode.ts";` and `import { PhoneTabBar } from "./mobile/PhoneTabBar.tsx";`.
   - `wsView` (App.tsx:169) and `goView` (App.tsx:196) already exist.
   - **Use `goView`, not `setWsView`.** goView un-hides a view the user had hidden in the rail.

3. Create `web/test/phone-tabbar.test.ts`. Import `PHONE_VIEWS` and `VIEWS` and assert that every id in `PHONE_VIEWS` exists in `VIEWS`. This catches an upstream rename. If importing `views.ts` pulls in DOM-touching modules and fails in the no-DOM test env, **drop this test** and say so in the commit body. Do not add a DOM shim.

**Pitfalls:**
- ⚠️ `PHONE` is a module-level `let` set by `initPhone()` before the first mount. Reading it during render is fine; it never changes without a reload.
- ⚠️ Do not filter `VIEWS` by the user's rail layout (`loadRail`). On the phone the four views are fixed.
- ⚠️ The TopBar's centred needs chip is absolutely positioned (`left-1/2 -translate-x-1/2`). On a 390-px screen it can overlap other items. That is acceptable for this task; record what you see in the commit body and do not restyle TopBar.

**Out of scope — do NOT touch:** `ViewRail.tsx`, `Workspace.tsx`, `TopBar.tsx`, `views.ts`, `DashboardView.tsx`.

**Acceptance criteria:**
- [ ] With `?ui=phone` at a 390×844 window, a 4-button bar sits at the bottom. Tapping each switches the view, and the active one is highlighted.
- [ ] With `?ui=desk`, there is no bar and the left rail is visible.

**Verification:**
- [ ] The tab-bar test (if kept) → `1 pass`.
- [ ] Typecheck and build → clean.
- [ ] Manual in Chrome devtools device mode, iPhone 14 Pro, at `http://127.0.0.1:4000/?ui=phone`: the bar is visible, nothing is clipped behind it, and the TopBar is visible at the top.

**Dependencies:** T1. **Files:** `web/src/mobile/PhoneTabBar.tsx` (new), `web/src/App.tsx`, `web/test/phone-tabbar.test.ts` (new). **Scope:** S.

---

### Task 5 — Terminal key bar

**Description:** In phone mode, while the Terminal view is active, show a strip of keys above the tab bar:

| Key | Sends |
|---|---|
| Esc | `\x1b` |
| Tab | `\t` |
| ⌃C | `\x03` |
| ⌃D | `\x04` |
| ⌃R | `\x12` |
| ⌃L | `\x0c` |
| ← ↑ ↓ → | arrow sequences (below) |
| `\|` `~` `/` `-` | the character itself |

Keys go to the terminal the user last touched. Arrows respect application-cursor mode.

**Implementation notes:**

1. Create `web/src/mobile/keys.ts`:
```ts
export type KeyName = "esc" | "tab" | "ctrl-c" | "ctrl-d" | "ctrl-r" | "ctrl-l"
  | "up" | "down" | "left" | "right" | "|" | "~" | "/" | "-";

/** Bytes a real keyboard would send. Pure. In application-cursor mode (vim,
 *  less, readline in some setups) arrows are ESC O x, otherwise ESC [ x. */
export function keyBytes(k: KeyName, appCursor: boolean): string {
  const arrow = (c: string) => (appCursor ? `\x1bO${c}` : `\x1b[${c}`);
  switch (k) {
    case "esc": return "\x1b";
    case "tab": return "\t";
    case "ctrl-c": return "\x03";
    case "ctrl-d": return "\x04";
    case "ctrl-r": return "\x12";
    case "ctrl-l": return "\x0c";
    case "up": return arrow("A");
    case "down": return arrow("B");
    case "right": return arrow("C");
    case "left": return arrow("D");
    default: return k;
  }
}
```

2. Edit `web/src/components/TerminalPanel.tsx`:
   - (a) Near the module-level `const sessions = new Map<string, Sess>();` (line ~287), add directly below it:
```ts
// LOCAL PATCH (apichat 2026-10-xx): the phone key bar types into whichever
// shell was touched last; see mobile/KeyBar.tsx.
let lastFocused: Sess | null = null;
export function typeIntoFocused(k: import("../mobile/keys.ts").KeyName): boolean {
  const s = lastFocused;
  if (!s || !sessions.has(s.id)) return false;
  s.term.input(keyBytes(k, s.term.modes.applicationCursorKeysMode));
  s.term.focus();
  return true;
}
```
     Add `import { keyBytes } from "../mobile/keys.ts";` beside the other imports.
   - (b) In `createSession()`, directly **after** `sessions.set(id, sess);` (line ~1121), add:
```ts
  holder.addEventListener("focusin", () => { lastFocused = sess; }); // LOCAL PATCH: see typeIntoFocused
```

3. Create `web/src/mobile/KeyBar.tsx`. One row of buttons, horizontally scrollable (`overflow-x-auto`, `flex`, `gap-1`, `px-2 py-1`), `shrink-0`, with the same background and border as `PhoneTabBar`. Each button:
```tsx
<button type="button" key={k}
  onPointerDown={(e) => e.preventDefault()}   // keep focus (and the iOS keyboard) in xterm
  onClick={() => typeIntoFocused(k)}
  className="shrink-0 min-w-[40px] h-9 px-2 rounded-md text-[13px] t-mono"
  style={{ color: "var(--text2)", border: "1px solid var(--surface-line)" }}>{label}</button>
```
   - Order and labels: Esc, Tab, ⌃C, ⌃D, ⌃R, ⌃L, ←, ↑, ↓, →, `|`, `~`, `/`, `-`.

4. Edit `web/src/App.tsx`. Directly **above** the `{PHONE && <PhoneTabBar ... />}` line from Task 4, insert:
```tsx
      {PHONE && wsView === "term" && <KeyBar />}
```
   with `import { KeyBar } from "./mobile/KeyBar.tsx";`.

5. Create `web/test/phone-keys.test.ts`:
   - `keyBytes` for every name in both modes (14 names; the arrows differ by mode).
   - Specifically `keyBytes("up", false) === "\x1b[A"` and `keyBytes("up", true) === "\x1bOA"`.

**Pitfalls:**
- ⚠️ `term.input(data)` behaves as if the user typed `data`. It flows through xterm's `onData` to the PTY socket exactly like a keystroke, which is what local patch 8.12 (Cmd+←/→) already relies on. Do **not** write to the socket directly.
- ⚠️ `onPointerDown` + `preventDefault` is what stops the button stealing focus. Without it, iOS hides the keyboard on every tap.
- ⚠️ There are two `new Terminal(` calls in TerminalPanel.tsx. Line ~949 is the read-only **history overlay** from patch 8.8. Do not add `focusin` there. Only `createSession()` (line ~780) creates real shells.
- ⚠️ The visual-viewport keyboard inset (`--kb`) from Task 1 already shrinks the app. The terminal refits through its own `ResizeObserver` (TerminalPanel.tsx ~1644 / ~2617). Do not add another fit call.

**Out of scope — do NOT touch:** the existing key handler (`attachCustomKeyEventHandler`, patches 8.7/8.12), the wheel/history overlay code, the tmux tab strip.

**Acceptance criteria:**
- [ ] In phone mode in Terminal, the key bar is visible. Tapping Esc/⌃C/↑/Tab acts on the shell the user last tapped. The iOS keyboard stays open while tapping keys.
- [ ] With the iOS keyboard up, the prompt line is still visible above the keyboard + key bar.

**Verification:**
- [ ] `cd ~/apps/agentglass/web && PATH=$HOME/apps/agentglass/.bun/bin:$PATH bun test test/phone-keys.test.ts` → all pass, `0 fail`.
- [ ] Typecheck and build → clean.
- [ ] Manual, desktop with `?ui=phone`, Terminal view:
  - Run `sleep 100` and tap ⌃C → the prompt returns.
  - Tap ↑ → the previous command appears.

**Dependencies:** T4. **Files:** `web/src/mobile/keys.ts` (new), `web/src/mobile/KeyBar.tsx` (new), `web/src/components/TerminalPanel.tsx`, `web/src/App.tsx`, `web/test/phone-keys.test.ts` (new). **Scope:** M.

### Checkpoint B (human present)

- [ ] Commit, push, then deploy to dev12 as in Checkpoint A (web-only, no restart).
- [ ] iPhone app:
  - Dashboard shows Plan quota (Claude / Codex / Codex S).
  - Chat sends and streams a reply.
  - A gate can be answered from the TopBar chip.
  - Terminal + key bar work.
  - Nothing is hidden under the notch or the home indicator.

---

## Phase C — Web Push

### Task 6 — Cloudflare Access Bypass and VAPID subject (human ops)

**Description:** Two settings changes, done by the human. Claude does not edit Cloudflare.

**Steps for the human:**
1. **Cloudflare dashboard → Zero Trust → Access → Applications → Add → Self-hosted.**
   - Name: `agentglass-dev-static`.
   - Add one destination per path, all on host `agentglass-dev.878383163.xyz`:
     - `/manifest.webmanifest`
     - `/icon-192.png`
     - `/icon-512.png`
     - `/icon-maskable-512.png`
     - `/apple-touch-icon.png`
     - `/favicon.svg`
   - Policy: action **Bypass**, include **Everyone**.
   - **Do not add `/sw.js`.** A service-worker script is fetched with same-origin credentials, so the Access cookie goes with it.
2. On dev12, append `AGENTGLASS_PUSH_SUBJECT=https://agentglass-dev.878383163.xyz` to `~/.config/agentglass/env`. Apple's push service rejects the code's default `mailto:agentglass@localhost`. It takes effect at the next restart (Task 8).

**Verification:**
- [ ] `curl -s -o /dev/null -w '%{http_code}\n' https://agentglass-dev.878383163.xyz/manifest.webmanifest` → `200` (was `302`).
- [ ] `curl -s -o /dev/null -w '%{http_code}\n' https://agentglass-dev.878383163.xyz/` → `302` (still protected).
- [ ] `ssh dev12-cf 'grep -c AGENTGLASS_PUSH_SUBJECT ~/.config/agentglass/env'` → `1`.

**Dependencies:** none (can be done any time before T9). **Scope:** none (ops).

---

### Task 7 — Server push core: restore crypto, add `phonepush.ts`

**Description:**
- Bring back the RFC 8291 encryption + VAPID signing (`push.ts`) and the subscription store (`pushstore.ts`) exactly as they were before upstream removed them, together with their unit tests.
- Add a thin new module that turns an alert into a phone push and owns the test seam.

**Implementation notes:**

1. Restore, from the repo root:
```bash
git show 'b35c3fd6^:server/src/push.ts'               > server/src/push.ts
git show 'b35c3fd6^:server/src/pushstore.ts'          > server/src/pushstore.ts
git show 'b35c3fd6^:server/test/push-encrypt.test.ts' > server/test/push-encrypt.test.ts
git show 'b35c3fd6^:server/test/push-send.test.ts'    > server/test/push-send.test.ts
```
   - Do not edit these four files except where a typecheck error forces it. If one does, make the smallest change and mark it `LOCAL PATCH`.
   - Add one line at the top of each restored file: `// LOCAL PATCH (apichat 2026-10-xx): restored from upstream b35c3fd6^ for the iPhone PWA.`
   - The store writes `~/.config/agentglass/push.json` (mode 0600) holding the VAPID keypair and subscriptions. Under `bun test` it only touches the temp dir (`offLimits()`).

2. Create `server/src/phonepush.ts`:
```ts
/**
 * Alerts to every subscribed phone, best effort, never awaited by the caller.
 * Restored crypto lives in push.ts/pushstore.ts; this file is the policy:
 * what goes in the payload, how loud, and the seam tests replace.
 */
import { sendPush } from "./push.ts";
import { vapidKeys, subscriptions, removeSubscription, markDelivered } from "./pushstore.ts";
import type { NotifyKind } from "../../shared/notifyPrefs.ts";

export interface PhoneNote { title: string; body: string; kind: NotifyKind; tag?: string }
export interface Fanout { sent: number; failed: number; pruned: number }

/** Lock-screen text: short, no full command. Pure. */
export function phonePayload(n: PhoneNote, now = Date.now()): string {
  const body = n.body.length > 120 ? n.body.slice(0, 119) + "…" : n.body;
  return JSON.stringify({ title: n.title.slice(0, 60), body, kind: n.kind, tag: n.tag ?? `${n.kind}:${n.title}`, at: now });
}

export async function sendToPhones(n: PhoneNote): Promise<Fanout> {
  const out: Fanout = { sent: 0, failed: 0, pruned: 0 };
  const subs = subscriptions();
  if (!subs.length) return out;
  const keys = await vapidKeys();
  const payload = new TextEncoder().encode(phonePayload(n));
  const subject = process.env.AGENTGLASS_PUSH_SUBJECT || undefined;
  await Promise.all(subs.map(async (s) => {
    const r = await sendPush(s, payload, keys, { urgency: n.kind === "blocked" ? "high" : "normal", subject });
    if (r.gone) { removeSubscription(s.endpoint); out.pruned++; }
    else if (r.ok) { markDelivered(s.endpoint); out.sent++; }
    else { out.failed++; console.warn("[push] send failed:", r.error); }
  }));
  return out;
}

let sender: (n: PhoneNote) => Promise<unknown> = sendToPhones;
/** Test seam. Pass null to restore the real sender. */
export function setPhoneSender(f: ((n: PhoneNote) => Promise<unknown>) | null): void { sender = f ?? sendToPhones; }
/** Fire and forget. */
export function toPhones(n: PhoneNote): void {
  void sender(n).catch((e) => console.warn("[push] failed:", e));
}
```

3. Create `server/test/phonepush.test.ts`:
   - `phonePayload` truncates a 300-char body to 120 chars ending in `…`.
   - `phonePayload` keeps `kind`.
   - `phonePayload` defaults `tag` to `` `${kind}:${title}` ``.
   - `toPhones` calls the seam set by `setPhoneSender` exactly once with the same object.
   - Restore with `setPhoneSender(null)` in `afterAll`.

**Pitfalls:**
- ⚠️ zsh: quote `'b35c3fd6^:server/…'`. Unquoted, `^` and `:s` are zsh modifiers and the command fails with "ambiguous argument".
- ⚠️ `sendPush`'s `opts.subject` falls back to `"mailto:agentglass@localhost"` when `undefined`. That is why `subject` is passed as `undefined`, not `""`. Apple rejects that fallback, so dev12 must have `AGENTGLASS_PUSH_SUBJECT` set (Task 6).
- ⚠️ Check `markDelivered` and `removeSubscription` are exported by the restored `pushstore.ts` (lines 194 and 201). They were at `b35c3fd6^`.

**Out of scope — do NOT touch:** `alerts.ts` and `index.ts` (Task 8), any web file.

**Acceptance criteria:**
- [ ] Restored files are byte-identical to `b35c3fd6^` apart from the one-line header.
- [ ] The new module compiles and its tests pass.

**Verification:**
- [ ] `cd ~/apps/agentglass/server && PATH=$HOME/apps/agentglass/.bun/bin:$PATH bun test test/push-encrypt.test.ts test/push-send.test.ts test/phonepush.test.ts` → `0 fail`. The pass count is whatever the restored files hold plus 4 new.
- [ ] `cd ~/apps/agentglass/server && PATH=$HOME/apps/agentglass/.bun/bin:$PATH bun x tsc --noEmit -p .` → exits 0, no output.
- [ ] `git diff --no-index <(git show 'b35c3fd6^:server/src/push.ts') server/src/push.ts | grep '^[-+][^-+]' | wc -l` → `1` (the header line only).

**Dependencies:** none in code (T6 only matters at runtime). **Files:** `server/src/push.ts`, `server/src/pushstore.ts`, `server/src/phonepush.ts`, `server/test/push-encrypt.test.ts`, `server/test/push-send.test.ts`, `server/test/phonepush.test.ts`. **Scope:** M (four of the files are restored verbatim).

---

### Task 8 — Hook `deliver()` and add `/push/*` routes

**Description:** Every alert that passes the user's notification preferences also goes to subscribed phones, **even while a desk window is live**, except redraw/clear frames. Add the routes the phone uses to subscribe.

**Implementation notes:**

1. Edit `server/src/alerts.ts`, in `deliver()` (starts ~line 124). Find the line:
```ts
  const { attached, live } = sink?.census() ?? { attached: 0, live: 0 };
```
   Insert directly **above** it:
```ts
  // LOCAL PATCH (apichat 2026-10-xx): a locked phone is told even while a desk
  // window is open — that window is not the person, and the return below would
  // otherwise swallow the one channel that reaches a pocket. Redraws and clears
  // are not news and never wake a phone.
  if (!redraw) toPhones({ title, body, kind, tag: extra?.key });
```
   Add `import { toPhones } from "./phonepush.ts";` beside the other imports (lines 19-25).

2. Edit `server/src/index.ts`.
   - Add `import { vapidKeys, addSubscription, removeSubscription } from "./pushstore.ts";` and `import { sendToPhones } from "./phonepush.ts";` beside the other `./…` imports at the top.
   - Insert the block below directly **above** the comment that precedes `if (pathname === "/pair/whoami")` (line ~4949, the comment starting `/** What this device is, as this server sees it.`):
```ts
    // LOCAL PATCH (apichat 2026-10-xx): Web Push for the installed iPhone app.
    // Restored from upstream b35c3fd6^ (removed when no phone could reach a
    // secure context; this deployment is HTTPS behind Cloudflare Access).
    // GET /push/key needs `read`; the POSTs fall to `full` via scopeNeeded's
    // deny-by-default (auth.ts:561) — the global gate above already enforced it.
    if (pathname === "/push/key") {
      return json({ key: (await vapidKeys()).publicKey });
    }
    if (pathname === "/push/subscribe" && req.method === "POST") {
      let b: any = {};
      try { b = await req.json(); } catch { return json({ ok: false, error: "bad body" }, 400); }
      const sub = b?.subscription;
      if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
        return json({ ok: false, error: "a subscription needs an endpoint and both keys" }, 400);
      }
      const subs = addSubscription(sub, typeof b.label === "string" ? b.label.slice(0, 60) : undefined);
      return json({ ok: true, devices: subs.length });
    }
    if (pathname === "/push/unsubscribe" && req.method === "POST") {
      let b: any = {};
      try { b = await req.json(); } catch { return json({ ok: false, error: "bad body" }, 400); }
      const subs = removeSubscription(String(b?.endpoint || ""));
      return json({ ok: true, devices: subs.length });
    }
    if (pathname === "/push/test" && req.method === "POST") {
      const r = await sendToPhones({ title: "✅ agentglass", body: "Push is working.", kind: "blocked", tag: "push-test" });
      return json({ ok: r.sent > 0, ...r });
    }
```

3. Create `server/test/alerts-phone.test.ts`, modelled on `server/test/alerts-sink.test.ts`:
   - Set env and prefs the same way (`process.env.AGENTGLASS_NOTIFY = "1"`, `delete process.env.AGENTGLASS_WEBHOOK`, `writeNotifyPrefs({...all kinds true...})`).
   - Import alerts with `await import(\`../src/alerts.ts?u=${Math.random()}\`)`.
   - Import `setPhoneSender` from `../src/phonepush.ts` with a **plain** path. alerts.ts imports `./phonepush.ts` without a query, so both resolve to the same module instance.
   - Cases:
     - (a) With `census = { attached: 1, live: 1 }`, `alerts.pushGate("app:s1","Bash","ls one")` → the recorded sender was called once with `kind: "blocked"`.
     - (b) With `writeNotifyPrefs({... kinds.blocked: false ...})` plus `__resetNotifyPrefsCache()`, `pushGate("app:s2","Bash","ls two")` → the sender is **not** called.
     - (c) If alerts.ts exports a function that sends a redraw (`update`/`clear` in `extra`), assert it does not reach the sender. If no exported function produces a redraw, skip (c) and say so in the commit body.
   - Use a fresh summary string per test: `pushGate` is debounced per `gate:${agent}:${summary}`.

4. Create `server/test/push-routes.test.ts`, modelled on `server/test/agent-routes.test.ts` (subprocess server, `freePort`, `SERVER_BOOT_MS`, `TMUX_TEST_TMPDIR`, same env block) **plus** `AGENTGLASS_TOKEN: "t0k"` in the env. Cases:
   - `GET /push/key` with no auth → `401`.
   - `GET /push/key` with `Authorization: Bearer t0k` → `200` and `key` is a non-empty string.
   - `POST /push/subscribe` (Bearer) with `{subscription:{endpoint:"https://push.example/x",keys:{p256dh:P256DH,auth:AUTH}}}` → `{ok:true, devices:1}`. Copy `P256DH`/`AUTH` from `git show 'b35c3fd6^:server/test/push-routes.test.ts'`.
   - `POST /push/subscribe` with a missing key → `400`.
   - `POST /push/unsubscribe` with that endpoint → `{ok:true, devices:0}`.

**Pitfalls:**
- ⚠️ The insertion in `deliver()` must sit **after** `if (prefs.none || !prefs.kinds[kind]) return;` (so turned-off kinds never push) and **before** the `census()` line. Re-read both lines after editing.
- ⚠️ `deliver()` is not `async` at that point and the hook must not `await`. `toPhones` is fire-and-forget by design.
- ⚠️ Under `bun test` the real sender reads `subscriptions()`, which returns nothing outside the temp dir, so other alert test files make no network calls. Still, do not remove `setPhoneSender` restoration from your tests.
- ⚠️ `index.ts` is ~9000 lines. Search for the exact anchor string `if (pathname === "/pair/whoami")`. Do not insert inside another `if` block.
- ⚠️ This task changes the server, so dev12 needs a **restart**. Ask the human first, and check `/chat/active` is empty.

**Out of scope — do NOT touch:** `shared/notifyPrefs.ts` (no new kind, no new channel), the webhook and `notify-send` branches, `scopeNeeded`/`auth.ts`, `pushGate`'s text.

**Acceptance criteria:**
- [ ] A gate hold reaches `toPhones` while a desk client is live. A kind turned off in prefs does not.
- [ ] `/push/*` routes behave as listed and require a credential.

**Verification:**
- [ ] `cd ~/apps/agentglass/server && PATH=$HOME/apps/agentglass/.bun/bin:$PATH bun test test/alerts-phone.test.ts test/push-routes.test.ts test/alerts-sink.test.ts test/notify-prefs-gate.test.ts` → `0 fail`. The last two are existing upstream tests and must still pass.
- [ ] `bun x tsc --noEmit -p .` in `server/` → clean.

**Dependencies:** T7. **Files:** `server/src/alerts.ts`, `server/src/index.ts`, `server/test/alerts-phone.test.ts` (new), `server/test/push-routes.test.ts` (new). **Scope:** M.

---

### Task 9 — Service worker, subscribe client, toggle

**Description:** A minimal service worker that shows pushes and opens the app on tap, a small client that subscribes and unsubscribes, and a bell toggle at the end of the phone tab bar.

**Implementation notes:**

1. Create `web/public/sw.js`. Plain JS, copied verbatim by Vite, no bundling:
```js
/* agentglass service worker — LOCAL PATCH (apichat 2026-10-xx).
   Shows Web Push notifications and opens the app when one is tapped. Caches
   nothing: the app is useless without its server. iOS shows no action buttons,
   so there are none; answering happens in the app. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  var d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = {}; }
  var title = typeof d.title === "string" && d.title ? d.title : "agentglass";
  var body = typeof d.body === "string" && d.body ? d.body : "Something needs you.";
  // iOS revokes a subscription whose push does not show a notification, so
  // this always shows one — even for a payload it cannot read.
  event.waitUntil(self.registration.showNotification(title, {
    body: body,
    icon: "./icon-192.png",
    tag: typeof d.tag === "string" ? d.tag : undefined,
    timestamp: typeof d.at === "number" ? d.at : undefined,
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  var home = new URL("./", self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (all) {
    for (var i = 0; i < all.length; i++) {
      if (all[i].url.indexOf(self.registration.scope) === 0 && "focus" in all[i]) return all[i].focus();
    }
    return self.clients.openWindow(home);
  }));
});
```

2. Create `web/src/mobile/push.ts`:
```ts
import { SERVER, authHeaders } from "../lib/api.ts";
export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

/** base64url → Uint8Array, for applicationServerKey. Pure. */
export function decodeKey(b64url: string): Uint8Array {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const bin = atob((b64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export async function pushState(): Promise<PushState> {
  if (!supported()) return (navigator as { standalone?: boolean }).standalone === false ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("./");
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

/** Must be called from a tap (iOS requires a user gesture for permission). */
export async function enablePush(): Promise<PushState> {
  if (!supported()) return "unsupported";
  if ((await Notification.requestPermission()) !== "granted") return "denied";
  const reg = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
  await navigator.serviceWorker.ready;
  const { key } = await authed<{ key: string }>("/push/key");
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(key) });
  await authed("/push/subscribe", { subscription: sub.toJSON(), label: "iPhone" });
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration("./");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) { await authed("/push/unsubscribe", { endpoint: sub.endpoint }); await sub.unsubscribe(); }
  return "off";
}
```
   - Add this helper to the same file (below `decodeKey`). `SERVER` (`export let`, api.ts:148) and `authHeaders` (`export const`, api.ts:356) are already exported; `SERVER` is a live binding, so read it at call time as written:
```ts
async function authed<T = unknown>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(SERVER + path, body === undefined ? { headers: authHeaders() }
    : { method: "POST", headers: authHeaders({ "content-type": "application/json" }), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json() as Promise<T>;
}
```
     (`authHeaders(h)` takes extra headers and returns them with `Authorization` added — signature at api.ts:356.)

3. Create `web/src/mobile/PushToggle.tsx`:
   - A button styled like a `PhoneTabBar` item, label `Alerts`, using the `NotifyBell`-like glyph. If no icon is easily importable, use the text `🔔`.
   - On mount it calls `pushState()`.
   - On tap: if the state is `"on"`, call `disablePush()`; otherwise call `enablePush()`. Store the result.
   - Show a small dot when `on`.
   - If the state is `"denied"`, show `title="Notifications are blocked in iOS Settings → agentglass"`.
   - Catch errors and set the state back from `pushState()`. Never throw into React.

4. Edit `web/src/App.tsx`: change the Task 4 line to `{PHONE && <PhoneTabBar view={wsView} onView={goView} extra={<PushToggle />} />}`, with `import { PushToggle } from "./mobile/PushToggle.tsx";`.

5. Create `web/test/phone-push.test.ts`:
   - `decodeKey` on a known 65-byte P-256 public key gives length `65` with first byte `4`. Use `P256DH` from the old push-routes test.
   - `decodeKey("AQID")` gives `[1,2,3]`.
   - Do not test the browser APIs; there is no DOM.

**Pitfalls:**
- ⚠️ `sw.js` must be served from the app root (`/sw.js`). Vite copies `web/public/*` to `web/dist/`.
  - Check after build: `ls web/dist/sw.js` exists.
  - Check that the server serves it with a JavaScript content type: `curl -sI http://127.0.0.1:4000/sw.js | grep -i content-type` → contains `javascript`. If it does not, stop and report; do not patch the static server blind.
- ⚠️ iOS only offers Web Push to an app **installed to the home screen** whose manifest loads. That is why Task 6 bypasses Access for the manifest. Test from the installed app, not Safari.
- ⚠️ `register("./sw.js", { scope: "./" })` — relative, because the manifest's `start_url`/`scope` are relative (`./`).
- ⚠️ `Notification.requestPermission()` must be the first await in the tap handler, or iOS treats it as not user-initiated.

**Out of scope — do NOT touch:** `web/src/lib/sysNotify.ts` (desktop notifications), `SettingsModal.tsx`, the manifest file contents.

**Acceptance criteria:**
- [ ] Installed iPhone app → tap Alerts → iOS permission prompt → allow → `/push/test` delivers "✅ agentglass / Push is working." to the lock screen.
- [ ] Lock the phone with a desk window open on the Mac. An agent hits a gate → a notification arrives within 10 s. Tapping it opens the app.

**Verification:**
- [ ] `cd ~/apps/agentglass/web && PATH=$HOME/apps/agentglass/.bun/bin:$PATH bun test test/phone-push.test.ts` → `0 fail`.
- [ ] Typecheck and build clean, and `ls ~/apps/agentglass/web/dist/sw.js` → the path prints.
- [ ] After deploy, on dev12: `curl -s -X POST -H "Authorization: Bearer $(grep AGENTGLASS_TOKEN ~/.config/agentglass/env | cut -d= -f2)" http://127.0.0.1:4000/push/test` → `{"ok":true,"sent":1,...}` once the phone subscribed.

**Dependencies:** T4, T6, T8. **Files:** `web/public/sw.js` (new), `web/src/mobile/push.ts` (new), `web/src/mobile/PushToggle.tsx` (new), `web/src/App.tsx`, `web/src/lib/api.ts` (only if `authHeaders` needs `export`), `web/test/phone-push.test.ts` (new). **Scope:** M.

### Checkpoint C (human present)

- [ ] Commit T7–T9 and push.
- [ ] Deploy to dev12, then **restart** after checking `/chat/active`.
- [ ] Turn on the kinds `idle`, `stalled` and `autopilot` in Settings → Notifications on the dev12 URL. `blocked` is on by default.
- [ ] iPhone: SC 4 from the spec. Lock the phone with the Mac's dashboard open → gate → push arrives → tap → answer from the TopBar chip. Then trigger an idle (finish a chat turn) → push arrives.
- [ ] Regression: `cd ~/apps/agentglass/server && PATH=$HOME/apps/agentglass/.bun/bin:$PATH bun test test/paste-image.test.ts test/agent-probe-claude-seen.test.ts test/codex-usage-rollover.test.ts test/alerts-sink.test.ts` → `0 fail`. The desktop at `http://127.0.0.1:4000/` (no `?ui`) looks unchanged.

---

## Phase D — docs

### Task 10 — Runbook and spec status

**Description:** Record what was built and how to operate it.

**Implementation notes:**
- Runbook repo `/Users/apichat/ProjectLocal/P-apichat/agentglass/README.md` (Thai, terse): add `### 8.15 iPhone PWA` after §8.14. It covers:
  - install steps
  - pairing steps (Settings → Remote on the dev12 URL, QR → Copy Link, paste in the app, type the code, accept **Full**)
  - forgetting a phone (Settings → Remote → Paired → Forget)
  - the CF Access Bypass app `agentglass-dev-static` and its paths
  - `AGENTGLASS_PUSH_SUBJECT`
  - `~/.config/agentglass/push.json` (VAPID key; deleting it invalidates every phone subscription)
  - `?ui=phone` / `?ui=desk`
  - which push kinds are on and where to change them
- `SPEC.md` (fork root): set the status line to "implemented" and note the two plan corrections: pairing via the HTTPS pair panel, not curl; and the phase order.
- Commit the runbook in its own repo, and `SPEC.md` + `tasks/` in the fork, separately from code.

**Verification:**
- [ ] `grep -n '8.15' /Users/apichat/ProjectLocal/P-apichat/agentglass/README.md` → one heading.

**Dependencies:** Checkpoint C. **Scope:** S.

---

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Access login leaves the standalone app | High: blocks everything | Task 0 gate before any code |
| iOS keyboard mangles xterm input | Med: terminal half-usable | Task 0 detects it. A separate input box is a follow-up, not this plan |
| Apple rejects VAPID JWT | Med: no push | `AGENTGLASS_PUSH_SUBJECT` https subject (T6). `/push/test` surfaces the push service status in `failed` + server log `[push] send failed:` |
| `idle` pushes are noisy (one per finished turn per agent) | Low | Existing per-key debounce in alerts.ts. The user can turn `idle` off in Settings |
| Upstream renames `nav[aria-label="Workspace views"]` or the `#root > .h-screen` shape | Low: rail reappears or height is wrong | Both selectors are listed here. Check them on every rebase (runbook §11) |
| Stale notification after a gate is answered elsewhere | Low | iOS has no silent push. `tag` collapses repeats. Accepted |
| Rebase conflicts | Low | Upstream files touched, each by a few lines: `index.html`, `main.tsx`, `App.tsx`, `RemoteAccessPane.tsx`, `api.ts`, `useLive.ts`, `TerminalPanel.tsx`, `alerts.ts`, `index.ts` |

## Open questions

None blocking. Task 0 answers the two spike questions; the plan stops there if the first one fails.
