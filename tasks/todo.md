# Todo: iPhone PWA (details and verification in tasks/plan.md)

## Phase 0 — gate
- [ ] T0 Spike on iPhone (human): Access login stays in the installed app? xterm typing clean? → STOP if login leaves the app

## Phase A — install, pair, stay logged in
- [x] T1 Phone mode foundation — `mobile/phoneMode.ts`, `mobile/phone.css`, `main.tsx`, `index.html` viewport-fit
- [x] T2 Pair over HTTPS — `RemoteAccessPane.tsx` (live when https), `reauthPrompt` accepts a pair link, first-launch prompt in `main.tsx`
- [x] T3 Access-expiry recovery — `mobile/accessExpiry.ts`, `useLive.ts` onclose
- [ ] Checkpoint A — deploy dev12 (web only), install + pair on iPhone, reopen stays LIVE

## Phase B — usable on a phone screen
- [x] T4 PhoneTabBar (dash/term/chat/lantern) + bottom safe area — mounted in `App.tsx`
- [ ] T5 Terminal KeyBar — `mobile/keys.ts`, `mobile/KeyBar.tsx`, `typeIntoFocused` in `TerminalPanel.tsx`
- [ ] Checkpoint B — quota, chat, gate from TopBar chip, terminal + keys on iPhone

## Phase C — Web Push
- [ ] T6 (human ops) CF Access Bypass app `agentglass-dev-static` for manifest + icons; `AGENTGLASS_PUSH_SUBJECT` on dev12
- [ ] T7 Restore `push.ts`/`pushstore.ts` + tests from `b35c3fd6^`; new `phonepush.ts`
- [ ] T8 `deliver()` hook before the live cut-off; `/push/key|subscribe|unsubscribe|test` routes (server restart — ask first)
- [ ] T9 `public/sw.js`, `mobile/push.ts`, `PushToggle` in the tab bar
- [ ] Checkpoint C — locked-phone push for blocked/idle/stalled/autopilot with the Mac dashboard open

## Phase D — docs
- [ ] T10 Runbook README §8.15 + SPEC status
