/** What the phone key bar can press. */
export type KeyName = "esc" | "tab" | "ctrl-c" | "ctrl-d" | "ctrl-r" | "ctrl-l"
  | "up" | "down" | "left" | "right" | "|" | "~" | "/" | "-";

/**
 * The bytes a real keyboard would send. Pure. In application-cursor mode (vim,
 * less, some readline setups) arrows are ESC O x, otherwise ESC [ x — the
 * caller reads the mode off the terminal at the moment of the press.
 */
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
