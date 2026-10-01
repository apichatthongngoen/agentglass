// LOCAL PATCH (apichat 2026-10-02): covers web/src/mobile/terminalQuiet.ts.
import { describe, expect, test } from "bun:test";
import { quietDeviceAttributes } from "../src/mobile/terminalQuiet.ts";

type Id = { prefix?: string; intermediates?: string; final: string };

function fakeTerm() {
  const handlers: { id: Id; cb: () => boolean }[] = [];
  return {
    handlers,
    parser: {
      registerCsiHandler: (id: Id, cb: () => boolean) => {
        handlers.push({ id, cb });
        return { dispose() {} };
      },
    },
  };
}

describe("quietDeviceAttributes", () => {
  test("takes over DA1 (CSI c) and DA2 (CSI > c) and answers neither", () => {
    const t = fakeTerm();
    quietDeviceAttributes(t);
    const ids = t.handlers.map((h) => `${h.id.prefix ?? ""}${h.id.final}`).sort();
    expect(ids).toEqual([">c", "c"]);
    // true = handled: xterm's own reply never runs, and nothing is written back.
    for (const h of t.handlers) expect(h.cb()).toBe(true);
  });
});
