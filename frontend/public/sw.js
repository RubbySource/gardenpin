// GardenPin service worker — Web Push + offline cache
// Cache strategy:
//   - GET /api/*       — network-first, fallback to cached response
//   - Static assets    — cache-first with background revalidate (stale-while-revalidate)
//   - Navigation /     — network-first, offline fallback to /offline.html

const VERSION = 'gardenpin-v2';
const STATIC_CACHE = `${VERSION}-static`;
const API_CACHE = `${VERSION}-api`;

const PRECACHE_URLS = ['/', '/offline.html'];

// ---------- Install: precache shell ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ---------- Activate: cleanup old versions ----------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ---------- Helpers ----------
function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isCacheableApi(url) {
  // Only safe GETs for cache fallback — gardens, pins, tasks, week, today, history, stats
  return /^\/api\/(gardens|pins|tasks|history|stats)/.test(url.pathname);
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/uploads/') ||
    /\.(?:js|css|png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(url.pathname)
  );
}

// ---------- Fetch: route by request type ----------
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Cross-origin (CDN, Stripe, etc) — let browser handle
  if (url.origin !== self.location.origin) return;

  // 1. API GETs — network-first with cache fallback
  if (isApiRequest(url)) {
    if (!isCacheableApi(url)) return; // don't intercept non-cacheable APIs
    event.respondWith(networkFirst(req, API_CACHE));
    return;
  }

  // 2. Static assets — stale-while-revalidate
  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(req, STATIC_CACHE));
    return;
  }

  // 3. Navigation requests — network with offline fallback
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(navigationHandler(req));
    return;
  }
});

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone()).catch(() => {});
    return fresh;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    // No fallback — return JSON error so frontend can show "offline" toast
    return new Response(
      JSON.stringify({ error: 'Offline — žádná uložená data', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((fresh) => {
      if (fresh && fresh.ok) cache.put(req, fresh.clone()).catch(() => {});
      return fresh;
    })
    .catch(() => null);
  return cached || (await fetchPromise) || new Response('', { status: 504 });
}

async function navigationHandler(req) {
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(STATIC_CACHE);
    cache.put('/', fresh.clone()).catch(() => {});
    return fresh;
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    const offline = await cache.match('/offline.html');
    if (offline) return offline;
    const home = await cache.match('/');
    if (home) return home;
    return new Response('<h1>Offline</h1>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      status: 503,
    });
  }
}

// ---------- Web Push (zachováno z původní verze) ----------
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
      icon: '/leaf.png',
      badge: '/leaf.png',
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

// ---------- Background Sync — replay offline mutations ----------
self.addEventListener('sync', (event) => {
  if (event.tag === 'gardenpin-replay') {
    event.waitUntil(replayQueuedMutations());
  }
});

// Queue is stored in IndexedDB by the frontend (see queue.js).
// SW only invokes a fetch for each pending request.
async function replayQueuedMutations() {
  try {
    const allClients = await self.clients.matchAll();
    if (allClients.length > 0) {
      // Frontend is open — let it replay (it has full request context)
      allClients[0].postMessage({ type: 'sw-replay-requested' });
    }
  } catch {}
}
