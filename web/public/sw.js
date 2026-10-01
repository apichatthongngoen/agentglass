/* agentglass service worker — LOCAL PATCH (apichat 2026-10-01).
 *
 * Shows Web Push notifications and opens the app when one is tapped. That is
 * all it does: it caches nothing, because the app is useless without the
 * server it reports on. iOS draws no action buttons on a web notification, so
 * there are none — a gate is answered in the app, from the TopBar's chip.
 *
 * Plain JavaScript in public/, copied verbatim by Vite: a worker is fetched by
 * the browser at its own URL, and nothing here should depend on a bundler.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  var d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = {}; }
  var title = typeof d.title === "string" && d.title ? d.title : "agentglass";
  var body = typeof d.body === "string" && d.body ? d.body : "Something needs you.";
  // Always show one. iOS revokes a subscription whose push shows nothing, so a
  // payload this worker cannot read still becomes a notification.
  event.waitUntil(self.registration.showNotification(title, {
    body: body,
    icon: "./icon-192.png",
    tag: typeof d.tag === "string" ? d.tag : undefined,
    timestamp: typeof d.at === "number" ? d.at : undefined,
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  var home = new URL("./", self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (all) {
    for (var i = 0; i < all.length; i++) {
      if (all[i].url.indexOf(self.registration.scope) === 0 && "focus" in all[i]) return all[i].focus();
    }
    return self.clients.openWindow(home);
  }));
});
