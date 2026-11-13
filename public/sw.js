// Minimal PWA service worker for installability
// Explicit policy: NO offline data caching of client data or API responses.
self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Network pass-through: strictly no caching of client, financial, or company records
    event.respondWith(fetch(event.request));
});
