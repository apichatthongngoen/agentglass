import { typeIntoFocused } from "../components/TerminalPanel.tsx";
import type { KeyName } from "./keys.ts";

/**
 * The keys an iPhone keyboard does not have, above the tab bar while the
 * terminal is on screen. Each goes to the shell last touched.
 *
 * `preventDefault` on pointerdown is what keeps focus — and with it the iOS
 * keyboard — in xterm's textarea; without it every tap would close the
 * keyboard.
 */
const KEYS: [KeyName, string][] = [
  ["esc", "Esc"], ["tab", "Tab"], ["ctrl-c", "⌃C"], ["ctrl-d", "⌃D"], ["ctrl-r", "⌃R"], ["ctrl-l", "⌃L"],
  ["left", "←"], ["up", "↑"], ["down", "↓"], ["right", "→"], ["|", "|"], ["~", "~"], ["/", "/"], ["-", "-"],
];

export function KeyBar() {
  return (
    <div role="toolbar" aria-label="Terminal keys" className="shrink-0 flex gap-1 px-2 py-1 overflow-x-auto"
      style={{ borderTop: "1px solid var(--surface-line)", background: "var(--surface-nav)" }}>
      {KEYS.map(([k, label]) => (
        <button type="button" key={k}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => typeIntoFocused(k)}
          className="shrink-0 min-w-[40px] h-9 px-2 rounded-md text-[13px] t-mono"
          style={{ color: "var(--text2)", border: "1px solid var(--surface-line)" }}>
          {label}
        </button>
      ))}
    </div>
  );
}
