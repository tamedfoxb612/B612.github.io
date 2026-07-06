/**
 * sw.js - LovePager ❤️ Service Worker
 * Handles background push notifications and asset caching for offline PWA capabilities.
 */

const CACHE_NAME = 'b612-v3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css?v=3',
  './app.js?v=3',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Install Event - Cache assets for offline and instant slow 4G load (using reload to bypass browser disk cache)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('Service Worker: Caching App Shell for instant load and offline capability');
      for (const asset of ASSETS_TO_CACHE) {
        try {
          const req = new Request(asset, { cache: 'reload' });
          const res = await fetch(req);
          if (res && (res.status === 200 || res.status === 0)) {
            await cache.put(asset, res);
          }
        } catch (err) {
          console.warn('Failed to cache asset on install:', asset, err);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Stale-While-Revalidate Strategy with Supabase Bypass
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Rule 1: Bypass the database - Any network requests going to supabase.co bypass cache completely
  if (url.includes('supabase.co') || url.includes('supabase.in')) {
    return;
  }

  // Network-First Strategy for HTML, JS, and CSS so user code updates take effect immediately
  if (event.request.mode === 'navigate' || url.endsWith('.html') || url.includes('.js') || url.includes('.css')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request, { ignoreSearch: true }).then((cached) => {
            if (cached) return cached;
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html', { ignoreSearch: true });
            }
          });
        })
    );
    return;
  }

  // Stale-While-Revalidate Strategy for images and other static media
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {});

      if (cachedResponse) {
        return cachedResponse;
      }

      return fetchPromise;
    })
  );
});

// Push Event - Display Native Background Push Notifications
self.addEventListener('push', (event) => {
  let data = { title: '❤️ New B612 Alert!', body: 'Your partner sent you a message or heart!' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || 'Open B612 to view your room!',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">❤️</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">❤️</text></svg>',
    vibrate: [200, 100, 200, 100, 400],
    data: {
      url: self.registration.scope
    },
    actions: [
      { action: 'open', title: 'Open Pager 💌' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'B612 ❤️', options)
  );
});

// Notification Click Event - Open PWA window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes('lovepager') || client.url.includes(self.registration.scope)) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./index.html');
      }
    })
  );
});
