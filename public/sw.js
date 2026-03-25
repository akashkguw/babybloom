// Legacy service worker — self-unregisters so VitePWA's Workbox SW takes over.
// Existing users who cached this file will get this version, which clears the
// old broken cache and hands control to the Workbox-generated SW.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => self.registration.unregister())
     .then(() => self.clients.matchAll())
     .then((clients) => {
       clients.forEach((c) => c.navigate(c.url));
     })
  );
});
