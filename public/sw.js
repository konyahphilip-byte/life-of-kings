const CACHE = 'ecovibes-shell-v3';
const LEGACY_CACHE = 'ecovibes-shell-v2';
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  // Leave unrelated application caches and all account storage alone.
  event.waitUntil(caches.delete(LEGACY_CACHE).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || event.request.headers.has('authorization')) return;
  const isNavigation = event.request.mode === 'navigate';
  // Cache only public build assets; never user uploads or arbitrary same-origin files.
  const isShellAsset = !url.search && (SHELL.slice(1).includes(url.pathname) || url.pathname.startsWith('/assets/'));
  if (!isNavigation && !isShellAsset) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (!isNavigation) {
      const cached = await cache.match(event.request);
      if (cached) return cached;
    }
    try {
      const response = await fetch(event.request);
      if (response.ok && !response.redirected) {
        const html = response.headers.get('content-type')?.includes('text/html');
        // Only the canonical public root can update the fallback. Never persist callback URLs/documents.
        if (isNavigation && url.pathname === '/' && !url.search && html) {
          await cache.put('/', response.clone()).catch(() => undefined);
        } else if (!isNavigation && !html) {
          await cache.put(event.request, response.clone()).catch(() => undefined);
        }
      }
      return response;
    } catch {
      return isNavigation ? ((await cache.match('/')) || Response.error()) : Response.error();
    }
  })());
});
