// LOCAL PATCH (apichat 2026-10-01): pairing from the public name of a
// Cloudflare Tunnel. cloudflared dials the server over loopback and forwards
// the caller's address, so the request reads as remote; with the machine token
// and an AGENTGLASS_ALLOWED_HOSTS Host it is the owner at their own desk.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { freePort } from "./freePort.ts";
import { TMUX_TEST_TMPDIR } from "./tmuxTmp.ts";
import { SERVER_BOOT_MS } from "./serverBoot.ts";

const TOKEN = "t0k-pair-tunnel";
const HOST = "agentglass.test";

let dir: string, base: string, port = 0, proc: ReturnType<typeof Bun.spawn> | null = null;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "agx-pairtun-"));
  port = await freePort();
  base = `http://127.0.0.1:${port}`;
  proc = Bun.spawn(["bun", "run", new URL("../src/index.ts", import.meta.url).pathname], {
    env: {
      PATH: [dirname(process.execPath), "/usr/local/bin", "/usr/bin", "/bin"].join(":"),
      TMUX_TMPDIR: TMUX_TEST_TMPDIR,
      HOME: dir,
      XDG_CONFIG_HOME: dir,
      AGENTGLASS_STATE_DIR: `${dir}/state`,
      CLAUDE_CONFIG_DIR: join(dir, ".claude"),
      AGENTGLASS_ROOT: dir,
      AGENTGLASS_DB: join(dir, "f.db"),
      AGENTGLASS_SCAN_DISABLED: "1",
      AGENTGLASS_PORT: String(port),
      AGENTGLASS_TOKEN: TOKEN,
      AGENTGLASS_ALLOWED_HOSTS: HOST,
    },
    stdout: "ignore", stderr: "pipe",
  });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base + "/health")).ok) return; } catch { /* not up yet */ }
    await Bun.sleep(100);
  }
  throw new Error("the server did not come up: " + (await new Response(proc.stderr as ReadableStream).text()).slice(0, 400));
}, SERVER_BOOT_MS);

afterAll(() => {
  try { proc?.kill(); } catch { /* already gone */ }
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* fine */ }
});

/** What cloudflared sends: loopback socket, the public Host, the caller's address. */
const viaTunnel = (extra: Record<string, string> = {}) => ({
  host: HOST,
  "x-forwarded-for": "203.0.113.9",
  "content-type": "application/json",
  ...extra,
});
const ticket = (headers: Record<string, string>) =>
  fetch(base + "/pair/ticket", { method: "POST", headers, body: "{}" });
const cancel = (id: string) =>
  fetch(base + "/pair/cancel", { method: "POST", headers: viaTunnel({ authorization: `Bearer ${TOKEN}` }), body: JSON.stringify({ ticket: id }) });

describe("pairing through the tunnel's public name", () => {
  test("the machine token through the allowed host mints a ticket", async () => {
    const r = await ticket(viaTunnel({ authorization: `Bearer ${TOKEN}` }));
    expect(r.status).toBe(200);
    const j = (await r.json()) as { ok: boolean; id?: string };
    expect(j.ok).toBe(true);
    await cancel(j.id!);
  });

  test("a wrong token does not", async () => {
    const r = await ticket(viaTunnel({ authorization: "Bearer nope" }));
    expect(r.status).not.toBe(200);
  });

  test("no token does not", async () => {
    const r = await ticket(viaTunnel());
    expect(r.status).not.toBe(200);
  });

  test("a forwarded request to any other host name is still not at the machine", async () => {
    const r = await ticket(viaTunnel({ host: `127.0.0.1:${port}`, authorization: `Bearer ${TOKEN}` }));
    expect(r.status).toBe(403);
  });
});
