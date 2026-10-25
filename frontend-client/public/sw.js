// Service Worker для офлайн-работы PWA с гарантией мгновенного обновления версий
const CACHE_NAME = 'ttk-map-cache-v4';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  // Немедленно активируем новый Service Worker без ожидания закрытия вкладок
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Игнорируем не-GET, сторонние домены и API запросы (API всегда через сеть!)
  if (
    event.request.method !== 'GET' ||
    !event.request.url.startsWith(self.location.origin) ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // 1. Для HTML и навигации: Network-First (всегда свежая версия с сервера, fallback в кэш только при офлайне)
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.startsWith('/m/')) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          // Если сеть недоступна (офлайн) — берем из кэша
          return caches.match(event.request).then(cached => cached || caches.match('/index.html'));
        })
    );
    return;
  }

  // 2. Для остальных ресурсов (JS, CSS, картинки): Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
