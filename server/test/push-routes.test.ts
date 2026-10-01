// LOCAL PATCH (apichat 2026-10-01): /push/* for the installed iPhone app.
// A real server in its own process, with a token, as agent-routes.test.ts does.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { freePort } from "./freePort.ts";
import { TMUX_TEST_TMPDIR } from "./tmuxTmp.ts";
import { SERVER_BOOT_MS } from "./serverBoot.ts";
import { b64uEncode } from "../src/push.ts";

const TOKEN = "t0k-push-routes";
const P256DH = "BAyQHUI8gxyoXifHPCY7oTJyG7nXqExPA4CypnVv1gEzHIhwI03sh4UEwXQUT6SxS2amUWkWBtgXPlW9N-OBVp4";
const AUTH = b64uEncode(new Uint8Array(16).fill(0x11));
const ENDPOINT = "https://push.example.invalid/sub-1";

let dir: string, base: string, proc: ReturnType<typeof Bun.spawn> | null = null;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "agx-pushrt-"));
  const port = await freePort();
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

const authed = { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" };
const post = (path: string, body: unknown, headers: Record<string, string> = authed) =>
  fetch(base + path, { method: "POST", headers, body: JSON.stringify(body) });

describe("/push routes", () => {
  test("the key needs a credential", async () => {
    expect((await fetch(base + "/push/key")).status).toBe(401);
  });

  test("the key is the VAPID public key", async () => {
    const r = await fetch(base + "/push/key", { headers: authed });
    expect(r.status).toBe(200);
    const j = (await r.json()) as { key?: string };
    expect(typeof j.key).toBe("string");
    expect(j.key!.length).toBeGreaterThan(40);
  });

  test("subscribe needs a credential", async () => {
    const r = await post("/push/subscribe", { subscription: { endpoint: ENDPOINT, keys: { p256dh: P256DH, auth: AUTH } } },
      { "content-type": "application/json" });
    expect(r.status).toBe(401);
  });

  test("a subscription without both keys is refused", async () => {
    const r = await post("/push/subscribe", { subscription: { endpoint: ENDPOINT, keys: { p256dh: P256DH } } });
    expect(r.status).toBe(400);
  });

  test("subscribe, then unsubscribe by endpoint", async () => {
    const a = await post("/push/subscribe", { subscription: { endpoint: ENDPOINT, keys: { p256dh: P256DH, auth: AUTH } }, label: "iPhone" });
    expect(await a.json()).toEqual({ ok: true, devices: 1 });
    const b = await post("/push/unsubscribe", { endpoint: ENDPOINT });
    expect(await b.json()).toEqual({ ok: true, devices: 0 });
  });
});
