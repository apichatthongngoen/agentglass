import { useEffect, useState } from "react";
import { ICON } from "../lib/iconSize.ts";
import { disablePush, enablePush, pushState, type PushState } from "./push.ts";

const TITLE: Record<PushState, string> = {
  on: "Alerts reach this phone when it is locked — tap to stop",
  off: "Tap to get alerts on this phone when it is locked",
  denied: "Notifications are blocked in iOS Settings → agentglass",
  "needs-install": "Add agentglass to the Home Screen to get alerts",
  unsupported: "This browser cannot receive alerts",
};

/** The last item of the phone tab bar: turns Web Push on or off for this
 *  device. Never throws into React — a failed subscribe reads the state back. */
export function PushToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void pushState().then(setState).catch(() => setState("unsupported")); }, []);

  const tap = async () => {
    if (busy || !state || state === "unsupported" || state === "needs-install") return;
    setBusy(true);
    try { setState(state === "on" ? await disablePush() : await enablePush()); }
    catch (e) {
      console.warn("[push] toggle failed:", e);
      setState(await pushState().catch(() => "unsupported" as const));
    }
    finally { setBusy(false); }
  };

  const on = state === "on";
  return (
    <button type="button" onClick={() => void tap()} title={state ? TITLE[state] : undefined} aria-pressed={on}
      className="flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] relative disabled:opacity-50"
      disabled={busy || state === null}
      style={{ color: on ? "var(--primary-hover)" : "var(--text3)" }}>
      <svg width={ICON.rail} height={ICON.rail} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        {state === "denied" && <path d="M3 3l18 18" />}
      </svg>
      <span>Alerts</span>
      {on && <span className="absolute top-1.5 right-1/3 rounded-full" style={{ width: 6, height: 6, background: "var(--success)" }} />}
    </button>
  );
}
