const CACHE = 'ecovibes-shell-v2';
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg'];
const ASSET_DESTINATIONS = new Set(['script', 'style', 'image', 'font']);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Never cache API responses. They can include authenticated account data.
  if (url.pathname.startsWith('/api/')) return;
  const isNavigation = event.request.mode === 'navigate';
  const isShellAsset = SHELL.includes(url.pathname) || ASSET_DESTINATIONS.has(event.request.destination);
  if (!isNavigation && !isShellAsset) return;
  event.respondWith((async () => {
    if (!isNavigation) {
      const cached = await caches.match(event.request);
      if (cached) return cached;
    }
    try {
      const response = await fetch(event.request);
      if (response.ok && !response.headers.get('content-type')?.includes('text/html')) {
        const copy = response.clone();
        void caches.open(CACHE).then(cache => cache.put(event.request, copy));
      }
      return response;
    } catch {
      return isNavigation ? ((await caches.match('/')) || Response.error()) : Response.error();
    }
  })());
});
