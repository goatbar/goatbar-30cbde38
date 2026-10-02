const SHELL_CACHE = "goatbar-pwa-shell-v4";
const RUNTIME_CACHE = "goatbar-pwa-runtime-v4";
const APP_SHELL = "/";

const PRECACHE = [
  APP_SHELL,
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icons/apple-touch-icon.png?v=5",
  "/icons/goatbar-192.png?v=4",
  "/icons/goatbar-512.png?v=4",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("goatbar-pwa-") &&
                key !== SHELL_CACHE &&
                key !== RUNTIME_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Never intercept Supabase, Assinafy, WhatsApp or any other external integration.
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const cachedCopy = response.clone();
            void caches
              .open(SHELL_CACHE)
              .then((cache) => cache.put(APP_SHELL, cachedCopy))
              .catch(() => undefined);
          }
          return response;
        })
        .catch(() =>
          caches
            .match(APP_SHELL)
            .then((cached) => cached || Response.error()),
        ),
    );
    return;
  }

  const isStaticAsset =
    ["style", "script", "font", "image", "worker"].includes(
      request.destination,
    ) ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/favicon.ico";

  if (!isStaticAsset) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const cachedCopy = response.clone();
            void caches
              .open(RUNTIME_CACHE)
              .then((cache) => cache.put(request, cachedCopy))
              .catch(() => undefined);
          }
          return response;
        })
        .catch(() => cached || Response.error());

      return cached || network;
    }),
  );
});


self.addEventListener("push", (event) => {
  let payload = {
    title: "Goat Bar",
    body: "Você recebeu uma nova notificação.",
    url: "/gia",
    tag: "goatbar",
    icon: "/icons/goatbar-192.png?v=4",
  };

  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch {
    if (event.data) {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || "/icons/goatbar-192.png?v=4",
      badge: "/icons/goatbar-192.png?v=4",
      tag: payload.tag || "goatbar",
      data: { url: payload.url || "/gia" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const relativeUrl = event.notification.data?.url || "/gia";
  const targetUrl = new URL(relativeUrl, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        for (const client of clients) {
          if (new URL(client.url).origin !== self.location.origin) continue;
          if ("navigate" in client && client.url !== targetUrl) {
            await client.navigate(targetUrl);
          }
          return client.focus();
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
