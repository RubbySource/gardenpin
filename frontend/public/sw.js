// Service worker: Web Push + offline cache (AS-3)
// Strategie:
// - Statika (HTML/JS/CSS/ikony/manifest): cache-first, network fallback, update na pozadí.
// - GET /api/*: network-first s timeoutem, fallback na cache (lepší offline UX než tvrdé selhání).
// - Vše ostatní (POST, /uploads, externí): bypass.

const CACHE_VERSION = 'v3-offline';
const STATIC_CACHE = `gardenpin-static-${CACHE_VERSION}`;
const API_CACHE = `gardenpin-api-${CACHE_VERSION}`;

const STATIC_PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/leaf.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((c) => c.addAll(STATIC_PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('gardenpin-') && k !== STATIC_CACHE && k !== API_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  if (url.origin !== self.location.origin) return false;
  const p = url.pathname;
  if (p === '/' || p === '/index.html' || p === '/manifest.json') return true;
  if (p.startsWith('/assets/')) return true;
  if (/\.(?:js|css|png|jpg|jpeg|svg|ico|webp|woff2?|ttf)$/i.test(p)) return true;
  return false;
}

function isApiGet(url) {
  return url.origin === self.location.origin && url.pathname.startsWith('/api/');
}

async function staticHandler(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    // Background revalidate (stale-while-revalidate)
    fetch(request)
      .then((res) => {
        if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
      })
      .catch(() => {});
    return cached;
  }
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
    return res;
  } catch (e) {
    // Navigation fallback: pokud klient chce HTML, vrať shell.
    if (request.mode === 'navigate') {
      const shell = await cache.match('/index.html');
      if (shell) return shell;
    }
    throw e;
  }
}

async function apiGetHandler(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const network = await Promise.race([
      fetch(request),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000)),
    ]);
    if (network && network.ok) cache.put(request, network.clone()).catch(() => {});
    return network;
  } catch (e) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw e;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/uploads/')) return; // uživatelské fotky neházet do cache
  if (isApiGet(url)) {
    event.respondWith(apiGetHandler(req));
    return;
  }
  if (isStaticAsset(url) || req.mode === 'navigate') {
    event.respondWith(staticHandler(req));
    return;
  }
});

self.addEventListener('push', (event) => {
  let data = { title: '🌿 GardenPin', body: 'Máte úkoly v zahradě', url: '/' };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'gardenpin-daily',
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
