import { SERVER, authHeaders } from "../lib/api.ts";

/**
 * Web Push for the installed iPhone app: subscribe, unsubscribe, and say which
 * of the two it is. The server half is server/src/phonepush.ts; the worker is
 * web/public/sw.js.
 */
export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

/** base64url → bytes, for applicationServerKey. Pure. */
export function decodeKey(b64url: string): Uint8Array {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const bin = atob((b64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function authed<T = unknown>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(SERVER + path, body === undefined ? { headers: authHeaders() }
    : { method: "POST", headers: authHeaders({ "content-type": "application/json" }), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export async function pushState(): Promise<PushState> {
  // Safari in a tab has no PushManager at all; only the home-screen app does.
  if (!supported()) return (navigator as { standalone?: boolean }).standalone === false ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("./");
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

/** From a tap only: iOS grants the permission prompt to a user gesture, and
 *  only when it is the first thing awaited. */
export async function enablePush(): Promise<PushState> {
  if (!supported()) return pushState();
  if ((await Notification.requestPermission()) !== "granted") return "denied";
  const reg = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
  await navigator.serviceWorker.ready;
  const { key } = await authed<{ key: string }>("/push/key");
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(key) as BufferSource });
  await authed("/push/subscribe", { subscription: sub.toJSON(), label: "iPhone" });
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration("./");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await authed("/push/unsubscribe", { endpoint: sub.endpoint });
    await sub.unsubscribe();
  }
  return "off";
}
