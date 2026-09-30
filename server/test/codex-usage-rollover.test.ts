// LOCAL PATCH (apichat 2026-09-25): covers rolledOver in src/codexusage.ts.
import { expect, test } from "bun:test";
import { rolledOver } from "../src/codexusage.ts";

test("a window past its reset reads empty; one still running is untouched", () => {
  const now = Date.parse("2026-09-25T12:00:00Z");
  const v = {
    provider: "codex", label: "Codex", available: true, observedAt: now - 30 * 3_600_000,
    windows: [
      { label: "5h", minutes: 300, usedPercent: 93, resetsAt: "2026-09-23T19:03:45.000Z" },
      { label: "weekly", minutes: 10080, usedPercent: 72, resetsAt: "2026-09-29T00:00:00.000Z" },
    ],
  } as never;
  const r = rolledOver(v, now) as { windows: { usedPercent: number; resetsAt: string | null }[] };
  expect(r.windows[0]).toMatchObject({ usedPercent: 0, resetsAt: null });
  expect(r.windows[1]).toMatchObject({ usedPercent: 72, resetsAt: "2026-09-29T00:00:00.000Z" });
  expect(rolledOver(v, Date.parse("2026-09-23T00:00:00Z"))).toBe(v); // nothing expired: same object
});
