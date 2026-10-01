// LOCAL PATCH (apichat 2026-10-01): covers web/src/mobile/phoneMode.ts.
import { describe, expect, test } from "bun:test";
import { pickUi } from "../src/mobile/phoneMode.ts";

describe("pickUi", () => {
  test("?ui=phone forces phone mode and is remembered", () => {
    expect(pickUi("?ui=phone", null, false, false)).toEqual({ phone: true, save: "phone" });
  });
  test("?ui=desk beats a saved phone choice and a standalone touch screen", () => {
    expect(pickUi("?ui=desk", "phone", true, true)).toEqual({ phone: false, save: "desk" });
  });
  test("a saved phone choice holds without a query", () => {
    expect(pickUi("", "phone", false, false)).toEqual({ phone: true, save: null });
  });
  test("a saved desk choice holds on the installed phone app", () => {
    expect(pickUi("", "desk", true, true)).toEqual({ phone: false, save: null });
  });
  test("the installed app on a touch screen is a phone", () => {
    expect(pickUi("", null, true, true)).toEqual({ phone: true, save: null });
  });
  test("an installed desktop app is not a phone", () => {
    expect(pickUi("", null, true, false)).toEqual({ phone: false, save: null });
  });
  test("an unknown ?ui value is ignored", () => {
    expect(pickUi("?ui=bogus", null, false, false)).toEqual({ phone: false, save: null });
  });
});
