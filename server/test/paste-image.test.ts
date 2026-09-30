// LOCAL PATCH (apichat 2026-09-23): covers server/src/pasteimage.ts.
import { describe, expect, test, beforeEach } from "bun:test";
import { mkdtempSync, readdirSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extFor, savePastedImage } from "../src/pasteimage.ts";

let dir = "";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "agx-paste-"));
  process.env.AGENTGLASS_PASTE_DIR = dir;
});

describe("extFor", () => {
  test("maps the allowed image types and nothing else", () => {
    expect(extFor("image/png")).toBe("png");
    expect(extFor("IMAGE/JPEG; charset=binary")).toBe("jpg");
    expect(extFor("image/svg+xml")).toBe(null); // scriptable, not a screenshot
    expect(extFor("text/plain")).toBe(null);
    expect(extFor(null)).toBe(null);
  });
});

describe("savePastedImage", () => {
  test("writes 0600 under a server-chosen name in the paste dir", () => {
    const p = savePastedImage(new Uint8Array([137, 80, 78, 71]), "png");
    expect(p.startsWith(dir + "/paste-")).toBe(true);
    expect(p.endsWith(".png")).toBe(true);
    expect(statSync(p).mode & 0o777).toBe(0o600);
  });

  test("clears pastes older than a day and keeps fresh ones", () => {
    const old = join(dir, "paste-old.png");
    const fresh = join(dir, "paste-fresh.png");
    writeFileSync(old, "x");
    writeFileSync(fresh, "x");
    const twoDaysAgo = (Date.now() - 2 * 24 * 3_600_000) / 1000;
    utimesSync(old, twoDaysAgo, twoDaysAgo);
    savePastedImage(new Uint8Array([1]), "png");
    const names = readdirSync(dir);
    expect(names).not.toContain("paste-old.png");
    expect(names).toContain("paste-fresh.png");
    expect(names.length).toBe(2);
  });
});
