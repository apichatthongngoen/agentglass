// LOCAL PATCH (apichat 2026-10-02): covers web/src/mobile/freshness.ts.
import { describe, expect, test } from "bun:test";
import { bundleOf, isStale } from "../src/mobile/freshness.ts";

const page = (js: string) =>
  `<!doctype html><html><head><script type="module" crossorigin src="${js}"></script>` +
  `<link rel="stylesheet" crossorigin href="/assets/index-DTSyejN1.css"></head><body><div id="root"></div></body></html>`;

describe("bundleOf", () => {
  test("the entry bundle a served page loads", () => {
    expect(bundleOf(page("/assets/index-BNDaZ_8S.js"))).toBe("/assets/index-BNDaZ_8S.js");
  });
  test("a page with no built bundle (the vite dev server) has none", () => {
    expect(bundleOf(page("/src/main.tsx"))).toBe(null);
    expect(bundleOf("")).toBe(null);
  });
});

describe("isStale", () => {
  test("a different bundle on the server means the app is behind", () => {
    expect(isStale("/assets/index-old.js", "/assets/index-new.js")).toBe(true);
  });
  test("the same bundle is current", () => {
    expect(isStale("/assets/index-same.js", "/assets/index-same.js")).toBe(false);
  });
  test("an unknown side is never a reason to reload", () => {
    expect(isStale(null, "/assets/index-new.js")).toBe(false);
    expect(isStale("/assets/index-old.js", null)).toBe(false);
  });
});
