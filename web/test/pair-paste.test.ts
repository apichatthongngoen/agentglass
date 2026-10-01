// LOCAL PATCH (apichat 2026-10-01): covers web/src/mobile/pairPaste.ts.
import { describe, expect, test } from "bun:test";
import { pairTicketFrom } from "../src/mobile/pairPaste.ts";

describe("pairTicketFrom", () => {
  test("a full pair link from the public host", () => {
    expect(pairTicketFrom("https://agentglass-dev.878383163.xyz/?pair=abc123")).toBe("abc123");
  });
  test("a link from any other host, percent-encoded", () => {
    expect(pairTicketFrom("http://192.168.1.5:4000/?pair=t%2B1")).toBe("t+1");
  });
  test("a bare query", () => {
    expect(pairTicketFrom("?pair=xyz")).toBe("xyz");
  });
  test("an empty ticket is none", () => {
    expect(pairTicketFrom("  https://h/?pair=  ")).toBe(null);
  });
  test("a token is not a pair link", () => {
    expect(pairTicketFrom("sk-some-token")).toBe(null);
  });
  test("nothing pasted", () => {
    expect(pairTicketFrom("")).toBe(null);
  });
});
