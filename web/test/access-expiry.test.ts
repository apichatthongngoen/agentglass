// LOCAL PATCH (apichat 2026-10-01): covers web/src/mobile/accessExpiry.ts.
import { describe, expect, test } from "bun:test";
import { accessExpired } from "../src/mobile/accessExpiry.ts";

const fake = (r: unknown) => (async () => r) as unknown as typeof fetch;

describe("accessExpired", () => {
  test("an opaque redirect is Access sending us to its login", async () => {
    expect(await accessExpired(fake({ type: "opaqueredirect", status: 0 }), "https://h")).toBe(true);
  });
  test("a 200 from our own server is a live session", async () => {
    expect(await accessExpired(fake({ type: "basic", status: 200 }), "https://h")).toBe(false);
  });
  test("a network failure is not expiry", async () => {
    const boom = (async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch;
    expect(await accessExpired(boom, "https://h")).toBe(false);
  });
});
