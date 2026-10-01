/**
 * The ticket out of whatever a person pastes into the token prompt: a full
 * pair link from any host (the QR's own address, a LAN one, the public name),
 * or a bare "?pair=…". Null when there is none, so a plain token falls through
 * to being stored as a token. Pure.
 */
export function pairTicketFrom(text: string): string | null {
  const t = text.trim();
  if (!t.includes("pair=")) return null;
  try {
    const v = new URL(t, "https://x.invalid").searchParams.get("pair");
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}
