// LOCAL PATCH (apichat 2026-09-24): covers lastSeen's Claude Code branch.
import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { lastSeen } from "../src/agentprobe.ts";

test("Claude Code is seen by its model, not by a source_app it never uses", () => {
  const q = new Database(":memory:");
  q.exec("CREATE TABLE events (source_app TEXT, model_name TEXT, timestamp INTEGER)");
  const add = q.prepare("INSERT INTO events VALUES (?, ?, ?)");
  add.run("acme-orbit", "claude-opus-5", 100);          // a Claude hook event, labelled by project
  add.run("antigravity", "claude-sonnet-5", 300);       // Antigravity running Claude: not Claude Code
  add.run("acme-orbit", "anthropic/claude-sonnet-5", 400); // OpenCode's spelling
  add.run("codex_cli_rs", null, 500);
  const db = q as never;
  expect(lastSeen("claude", db)).toBe(100);
  expect(lastSeen("codex", db)).toBe(500);
  expect(lastSeen("gemini", db)).toBe(null);
});
