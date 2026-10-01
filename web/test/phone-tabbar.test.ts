// LOCAL PATCH (apichat 2026-10-01): the phone tab bar names four views by id;
// an upstream rename would drop a tab without a sound.
import { describe, expect, test } from "bun:test";
import { PHONE_VIEWS } from "../src/mobile/PhoneTabBar.tsx";
import { VIEWS } from "../src/components/workspace/views.ts";

describe("PhoneTabBar", () => {
  test("every phone tab is a real view", () => {
    const ids = new Set(VIEWS.map((v) => v.id));
    for (const id of PHONE_VIEWS) expect(ids.has(id)).toBe(true);
    expect(PHONE_VIEWS).toEqual(["dash", "term", "chat", "lantern"]);
  });
});
