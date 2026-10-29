/* Push handlers are kept separate so Workbox can continue managing app caching. */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { message: event.data?.text() || "Há uma novidade no seu grupo." };
  }

  const title = payload.title || "Novidade no Zelo";
  const options = {
    body: payload.message || "Toque para conferir as novidades do seu grupo.",
    icon: payload.icon || "/pwa-192.png",
    badge: "/pwa-192.png",
    tag: payload.id ? `zelo-${payload.id}` : undefined,
    renotify: false,
    data: { url: payload.url || "/" },
  };

  if (payload.image) options.image = payload.image;
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
