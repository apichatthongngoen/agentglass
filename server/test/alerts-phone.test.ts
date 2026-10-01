// LOCAL PATCH (apichat 2026-10-01): the phone channel in alerts.ts deliver().
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { LanternFinding } from "../src/notePolicy.ts";
import { DEFAULT_NOTIFY_PREFS } from "../../shared/notifyPrefs.ts";
import { writeNotifyPrefs } from "../src/notifyPrefs.ts";
// Plain path on purpose: alerts.ts imports "./phonepush.ts" the same way, so
// both resolve to one module and the seam set here is the one deliver() calls.
import { setPhoneSender, type PhoneNote } from "../src/phonepush.ts";

const NOTIFY0 = process.env.AGENTGLASS_NOTIFY;
const HOOK0 = process.env.AGENTGLASS_WEBHOOK;
process.env.AGENTGLASS_NOTIFY = "1";
delete process.env.AGENTGLASS_WEBHOOK; // no outbound fetch during the test

const ALL_ON = { ...DEFAULT_NOTIFY_PREFS, none: false,
  kinds: { blocked: true, idle: true, stalled: true, failures: true, autopilot: true, reminders: true, usage: true } };

let alerts: typeof import("../src/alerts.ts");
let sent: PhoneNote[] = [];

beforeAll(async () => {
  writeNotifyPrefs(ALL_ON);
  alerts = await import(`../src/alerts.ts?u=${Math.random()}`);
  // A desk window that is attached AND answering pings: the case that used to
  // return before anything else could be told.
  alerts.setAlertSink({ broadcast: () => {}, census: () => ({ attached: 1, live: 1 }) });
  alerts.setDesktopNotifier(() => {});
  setPhoneSender(async (n) => { sent.push(n); });
});
afterAll(() => {
  alerts.setAlertSink(null);
  alerts.setDesktopNotifier(null);
  setPhoneSender(null);
  writeNotifyPrefs(DEFAULT_NOTIFY_PREFS);
  if (HOOK0 !== undefined) process.env.AGENTGLASS_WEBHOOK = HOOK0;
  if (NOTIFY0 === undefined) delete process.env.AGENTGLASS_NOTIFY; else process.env.AGENTGLASS_NOTIFY = NOTIFY0;
});

const NOW = 1_800_000_000_000;
const MIN = 60_000;
const waiting = (name: string, pane: string, since = NOW - 5 * MIN): LanternFinding => ({ kind: "waiting", name, pane, since });
const left = (name: string, pane: string, since = NOW - 70 * MIN): LanternFinding => ({ kind: "waiting", name, pane, since, left: true });

describe("the phone channel", () => {
  test("a gate hold reaches the phone while a desk window is live", () => {
    sent = [];
    alerts.pushGate("app:phone-1", "Bash", "ls phone-one");
    expect(sent).toHaveLength(1);
    expect(sent[0]!.kind).toBe("blocked");
    expect(sent[0]!.title).toContain("Approval needed");
  });

  test("a kind turned off in Settings never reaches the phone", () => {
    writeNotifyPrefs({ ...ALL_ON, kinds: { ...ALL_ON.kinds, blocked: false } });
    sent = [];
    alerts.pushGate("app:phone-2", "Bash", "ls phone-two");
    expect(sent).toHaveLength(0);
    writeNotifyPrefs(ALL_ON);
  });

  test("the Lantern's redraw and clear are not news to a phone", () => {
    alerts.__resetLanternMemory();
    const notice = (f: LanternFinding[]) => ({ title: `🔦 Lantern: ${f.length}`, body: f.map((x) => x.name).join("\n") });
    const two = [waiting("orbit-api", "%1"), left("orbit-web", "%2")];
    sent = [];
    alerts.pushLanternFindings(two, notice, NOW);                                // announce
    alerts.pushLanternFindings(two, notice, NOW + 15 * MIN);                     // nothing new
    alerts.pushLanternFindings([left("orbit-web", "%2")], notice, NOW + 30 * MIN); // redraw
    alerts.pushLanternFindings([], notice, NOW + 45 * MIN);                      // clear
    expect(sent.map((n) => [n.kind, n.tag])).toEqual([["autopilot", "lantern"]]);
  });
});
