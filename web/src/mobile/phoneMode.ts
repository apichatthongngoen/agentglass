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
  if (!vv) return true;
  const root = document.documentElement;
  let last = -1;
  const setKb = (pin: boolean) => {
    const kb = keyboardInset(root.clientHeight, vv.height, vv.offsetTop);
    if (kb !== last) { last = kb; root.style.setProperty("--kb", `${kb}px`); root.toggleAttribute("data-kb", kb > 0); }
    // iOS scrolls the page up to keep the caret visible; with the app already
    // shrunk above the keyboard that only pushes the TopBar off screen.
    if (pin && kb > 0) window.scrollTo(0, 0);
  };
  vv.addEventListener("resize", () => setKb(true));
  vv.addEventListener("scroll", () => setKb(false));
  setKb(true);
  return true;
}

/**
 * How much of the layout viewport the on-screen keyboard covers. Pure.
 *
 * clientHeight, not innerHeight: innerHeight counts a scrollbar and the visual
 * viewport does not, so on a desktop ?ui=phone window a scrollbar would read
 * as a keyboard and the height it takes off could make the scrollbar come and
 * go. Anything under KEYBOARD_MIN is a scrollbar or rounding, never a keyboard.
 */
export const KEYBOARD_MIN = 80;
export function keyboardInset(layoutH: number, visualH: number, visualTop: number): number {
  const raw = layoutH - visualH - visualTop;
  return raw >= KEYBOARD_MIN ? Math.round(raw) : 0;
}
