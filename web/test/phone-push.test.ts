// LOCAL PATCH (apichat 2026-10-01): covers the pure part of web/src/mobile/push.ts.
import { describe, expect, test } from "bun:test";
import { decodeKey } from "../src/mobile/push.ts";

describe("decodeKey", () => {
  test("a P-256 public key is 65 bytes, uncompressed", () => {
    const k = decodeKey("BAyQHUI8gxyoXifHPCY7oTJyG7nXqExPA4CypnVv1gEzHIhwI03sh4UEwXQUT6SxS2amUWkWBtgXPlW9N-OBVp4");
    expect(k.length).toBe(65);
    expect(k[0]).toBe(4);
  });
  test("base64url without padding", () => {
    expect([...decodeKey("AQID")]).toEqual([1, 2, 3]);
    expect([...decodeKey("-_8")]).toEqual([0xfb, 0xff]);
  });
});
