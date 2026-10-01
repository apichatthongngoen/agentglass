/**
 * An installed iPhone app has no reload button, and iOS keeps it alive in the
 * background, so a deploy never reaches it until somebody kills it by hand.
 * Each time the app comes back to the foreground, ask the server which bundle
 * it serves now, and reload when that is not the one running.
 */
const BUNDLE = /\/assets\/index-[\w-]+\.js/;

/** The entry bundle a page of HTML loads, or null (the vite dev server has
 *  none). Pure. */
export function bundleOf(html: string): string | null {
  return html.match(BUNDLE)?.[0] ?? null;
}

/** Only when both sides are known and differ: an unreadable answer is never a
 *  reason to throw away what is on screen. Pure. */
export function isStale(running: string | null, served: string | null): boolean {
  return !!running && !!served && running !== served;
}

const MIN_GAP_MS = 30_000;

export function watchFreshness(): void {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  const running = el ? bundleOf(new URL(el.src, location.href).pathname) : null;
  if (!running) return;
  let last = 0;
  const check = async () => {
    if (document.visibilityState !== "visible" || Date.now() - last < MIN_GAP_MS) return;
    last = Date.now();
    try {
      const r = await fetch(`${location.origin}/`, { cache: "no-store", credentials: "include" });
      if (r.ok && isStale(running, bundleOf(await r.text()))) location.reload();
    } catch {
      // Offline, or Access wants a login — useLive's accessExpiry handles that.
    }
  };
  document.addEventListener("visibilitychange", () => { void check(); });
  window.addEventListener("pageshow", (e) => { if (e.persisted) void check(); });
}
