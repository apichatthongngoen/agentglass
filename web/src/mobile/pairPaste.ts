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

/**
 * The origin the pairing panel should offer, or "" to leave upstream's rule
 * (LAN-exposed only) in charge. Pure.
 *
 * Only a loopback page can mint a ticket: /pair/ticket answers "only this
 * machine can do that" unless the request comes from the machine itself, and
 * a request through the Cloudflare Tunnel does not — cloudflared forwards the
 * caller's own address. So the desk side of pairing is a browser on an
 * `ssh -L <port>:127.0.0.1:4000` forward, and the QR's host does not matter:
 * the phone pastes the link and pairTicketFrom keeps only the ticket.
 */
export function pairPanelOrigin(hostname: string, origin: string): string {
  const h = hostname.replace(/^\[|\]$/g, "");
  return h === "localhost" || h === "::1" || /^127\./.test(h) ? origin : "";
}
