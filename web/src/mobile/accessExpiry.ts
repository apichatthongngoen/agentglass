/**
 * True when Cloudflare Access is redirecting this origin to its login — the
 * Access session ran out (a month, on agentglass-dev).
 *
 * A fetch that follows that redirect fails as a CORS TypeError, which looks
 * exactly like the server being down, so the app would retry forever. One that
 * does not follow it comes back as an opaque redirect, which a 200 from our own
 * server never is. `/` on purpose: the manifest and icons bypass Access and
 * would never redirect. Never throws.
 */
export async function accessExpired(fetchImpl: typeof fetch = fetch, origin = location.origin): Promise<boolean> {
  try {
    const r = await fetchImpl(`${origin}/`, { redirect: "manual", cache: "no-store", credentials: "include" });
    return r.type === "opaqueredirect";
  } catch {
    return false;
  }
}
