// LOCAL PATCH (apichat 2026-10-01): covers server/src/phonepush.ts.
import { afterAll, describe, expect, test } from "bun:test";
import { phonePayload, setPhoneSender, toPhones, type PhoneNote } from "../src/phonepush.ts";

afterAll(() => setPhoneSender(null));

describe("phonePayload", () => {
  test("a long body is cut for the lock screen", () => {
    const p = JSON.parse(phonePayload({ title: "t", body: "x".repeat(300), kind: "blocked" }, 1));
    expect(p.body.length).toBe(120);
    expect(p.body.endsWith("…")).toBe(true);
  });
  test("kind and time travel with it", () => {
    const p = JSON.parse(phonePayload({ title: "t", body: "b", kind: "idle" }, 42));
    expect(p.kind).toBe("idle");
    expect(p.at).toBe(42);
  });
  test("tag defaults to kind and title, so a repeat replaces the last one", () => {
    expect(JSON.parse(phonePayload({ title: "✋ Approval needed", body: "b", kind: "blocked" })).tag)
      .toBe("blocked:✋ Approval needed");
    expect(JSON.parse(phonePayload({ title: "t", body: "b", kind: "blocked", tag: "k" })).tag).toBe("k");
  });
});

describe("toPhones", () => {
  test("hands the note to the sender once, without waiting on it", async () => {
    const seen: PhoneNote[] = [];
    setPhoneSender(async (n) => { seen.push(n); });
    const note: PhoneNote = { title: "t", body: "b", kind: "stalled" };
    toPhones(note);
    await Bun.sleep(0);
    expect(seen).toEqual([note]);
  });
});
