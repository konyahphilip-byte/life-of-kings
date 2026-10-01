const CACHE = 'ecovibes-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok && event.request.destination !== 'document') {
        const copy = response.clone();
        void caches.open(CACHE).then(cache => cache.put(event.request, copy));
      }
      return response;
    } catch {
      return (await caches.match('/')) || Response.error();
    }
  })());
});
