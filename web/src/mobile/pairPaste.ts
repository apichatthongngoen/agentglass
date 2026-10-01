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
 * /pair/ticket only mints for the machine itself (atMachine): a loopback page,
 * or — with the local server patch — the deployment's public https name
 * (AGENTGLASS_ALLOWED_HOSTS behind a Cloudflare Tunnel) holding the machine
 * token. A plain-http LAN address is neither. The QR's host does not matter:
 * the phone pastes the link and pairTicketFrom keeps only the ticket.
 */
export function pairPanelOrigin(hostname: string, origin: string): string {
  const h = hostname.replace(/^\[|\]$/g, "");
  if (h === "localhost" || h === "::1" || /^127\./.test(h)) return origin;
  return origin.startsWith("https://") ? origin : "";
}
