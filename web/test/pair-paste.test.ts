// LOCAL PATCH (apichat 2026-10-01): covers web/src/mobile/pairPaste.ts.
import { describe, expect, test } from "bun:test";
import { pairPanelOrigin, pairTicketFrom } from "../src/mobile/pairPaste.ts";

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

describe("pairPanelOrigin", () => {
  test("a loopback page — the server's own machine, or an ssh -L to it — pairs from its origin", () => {
    expect(pairPanelOrigin("localhost", "http://localhost:4400")).toBe("http://localhost:4400");
    expect(pairPanelOrigin("127.0.0.1", "http://127.0.0.1:4000")).toBe("http://127.0.0.1:4000");
    expect(pairPanelOrigin("[::1]", "http://[::1]:4000")).toBe("http://[::1]:4000");
  });
  test("the public https name through the tunnel does", () => {
    expect(pairPanelOrigin("agentglass-dev.878383163.xyz", "https://agentglass-dev.878383163.xyz"))
      .toBe("https://agentglass-dev.878383163.xyz");
  });
  test("a plain-http LAN address does not: the server refuses to mint there", () => {
    expect(pairPanelOrigin("192.168.1.5", "http://192.168.1.5:4000")).toBe("");
  });
});
