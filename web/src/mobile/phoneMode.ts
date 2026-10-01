/**
 * Phone mode: the installed iPhone app, or any window forced with ?ui=phone.
 *
 * A pure chooser plus one side-effecting init, so the choice can be tested
 * without a DOM. Decided once, before the first mount, and never changed
 * without a reload — everything that reads PHONE may treat it as a constant.
 */
export type UiChoice = "phone" | "desk" | null;
const KEY = "agentglass_ui";

/** Pure. `query` is location.search; `saved` is what localStorage held. An
 *  installed app counts as a phone only on a coarse pointer, so a desktop PWA
 *  or the Electron window keeps the cockpit. */
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
  // iOS does not shrink the layout viewport for the on-screen keyboard; the
  // visual viewport does. --kb is how much of the screen the keyboard covers,
  // and phone.css takes it off the app's height so the prompt stays in view.
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
