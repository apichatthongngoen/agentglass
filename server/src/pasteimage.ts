// LOCAL PATCH (apichat 2026-09-23): images pasted into a browser terminal.
//
// A CLI in the pane (Claude Code) reads an image from the clipboard of the
// machine it runs on. When the server is remote — dev12 is headless Linux —
// that clipboard does not exist, and the browser's clipboard never crosses the
// wire, so pasting a screenshot found nothing. The panel now uploads the pasted
// image here, gets a path back and pastes the path into the pane; Claude Code
// attaches an image path pasted into its prompt as an image.
//
// On a Mac serving itself this is simply a second route to the same result:
// Ctrl+V still goes to the CLI untouched, and only a browser paste event that
// carries an image (Cmd+V, the phone's paste button) comes through here.
//
// Re-apply after git pull.
import { mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

/** A full-screen retina screenshot is a few MB; anything past this is not one. */
export const PASTE_MAX_BYTES = 20 * 1024 * 1024;

/** Pastes are for the turn they were pasted into. A day covers a conversation
 *  that is still going; past that they are clutter in someone's home dir. */
const KEEP_MS = 24 * 3_600_000;

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

export function pasteDir(): string {
  return process.env.AGENTGLASS_PASTE_DIR || join(homedir(), ".cache", "agentglass", "paste");
}

/** The file extension for an allowed image type, or null. The extension comes
 *  from this table and never from the request, so nothing a client sends can
 *  reach the path. */
export function extFor(contentType: string | null): string | null {
  const t = (contentType || "").split(";")[0]!.trim().toLowerCase();
  return EXT[t] ?? null;
}

/** Write the image under a server-chosen name (0600, in a 0700 dir) and clear
 *  out pastes older than a day on the way. Returns the absolute path. */
export function savePastedImage(bytes: Uint8Array, ext: string, now: number = Date.now()): string {
  const dir = pasteDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    try { if (now - statSync(p).mtimeMs > KEEP_MS) unlinkSync(p); } catch { /* raced away */ }
  }
  const path = join(dir, `paste-${now}-${randomBytes(4).toString("hex")}.${ext}`);
  writeFileSync(path, bytes, { mode: 0o600 });
  return path;
}
