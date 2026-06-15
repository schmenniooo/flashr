self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    return;
  }

  event.waitUntil(
    self.registration.showNotification(data.title ?? "flashr", {
      body:     data.body ?? "Time to study!",
      icon:     "/favicon.svg",
      badge:    "/favicon.svg",
      tag:      "daily-reminder",
      renotify: false,
      data:     { url: data.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((wins) => {
        for (const w of wins) {
          if (w.url.includes(self.location.origin)) {
            return w.focus().then((c) => c.navigate(target));
          }
        }
        return clients.openWindow(target);
      }),
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));
