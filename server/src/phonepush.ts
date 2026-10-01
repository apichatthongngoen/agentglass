/**
 * Alerts to every subscribed phone — the installed iPhone app — best effort,
 * never awaited by the caller.
 *
 * The crypto and the subscription store are upstream's own, restored from
 * b35c3fd6^ (push.ts, pushstore.ts). This file is the policy around them: what
 * goes in the payload, how loud it is, and the seam the tests replace.
 */
import { sendPush } from "./push.ts";
import { vapidKeys, subscriptions, removeSubscription, markDelivered } from "./pushstore.ts";
import type { NotifyKind } from "../../shared/notifyPrefs.ts";

export interface PhoneNote { title: string; body: string; kind: NotifyKind; tag?: string }
export interface Fanout { sent: number; failed: number; pruned: number }

/** What the service worker shows. Short, because it lands on a lock screen —
 *  a gate's body carries the start of the command. Pure. */
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
  // Apple's push service refuses the code's fallback `mailto:…@localhost`;
  // the deployment names itself here (an https URL is accepted).
  const subject = process.env.AGENTGLASS_PUSH_SUBJECT || undefined;
  await Promise.all(subs.map(async (s) => {
    // Only an agent stopped on a person is worth waking a radio for.
    const r = await sendPush(s, payload, keys, { urgency: n.kind === "blocked" ? "high" : "normal", subject });
    if (r.gone) { removeSubscription(s.endpoint); out.pruned++; }
    else if (r.ok) { markDelivered(s.endpoint); out.sent++; }
    else { out.failed++; console.warn("[push] send failed:", r.error); }
  }));
  return out;
}

let sender: (n: PhoneNote) => Promise<unknown> = sendToPhones;
/** Test seam. Null restores the real sender. */
export function setPhoneSender(f: ((n: PhoneNote) => Promise<unknown>) | null): void { sender = f ?? sendToPhones; }

/** Fire and forget: an unreachable push service must not hold up an alert. */
export function toPhones(n: PhoneNote): void {
  void sender(n).catch((e) => console.warn("[push] failed:", e));
}
