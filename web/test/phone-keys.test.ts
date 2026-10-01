// LOCAL PATCH (apichat 2026-10-01): covers web/src/mobile/keys.ts.
import { describe, expect, test } from "bun:test";
import { keyBytes, type KeyName } from "../src/mobile/keys.ts";

const SAME: [KeyName, string][] = [
  ["esc", "\x1b"], ["tab", "\t"], ["ctrl-c", "\x03"], ["ctrl-d", "\x04"],
  ["ctrl-r", "\x12"], ["ctrl-l", "\x0c"], ["|", "|"], ["~", "~"], ["/", "/"], ["-", "-"],
];

describe("keyBytes", () => {
  test("keys that do not depend on cursor mode", () => {
    for (const [k, b] of SAME) {
      expect(keyBytes(k, false)).toBe(b);
      expect(keyBytes(k, true)).toBe(b);
    }
  });
  test("arrows in normal cursor mode are CSI", () => {
    expect([keyBytes("up", false), keyBytes("down", false), keyBytes("right", false), keyBytes("left", false)])
      .toEqual(["\x1b[A", "\x1b[B", "\x1b[C", "\x1b[D"]);
  });
  test("arrows in application cursor mode are SS3", () => {
    expect([keyBytes("up", true), keyBytes("down", true), keyBytes("right", true), keyBytes("left", true)])
      .toEqual(["\x1bOA", "\x1bOB", "\x1bOC", "\x1bOD"]);
  });
});
