# GardenPin Backlog

Úkoly jsou seřazeny podle priority. Systém bere vždy 2-3 položky najednou.
Přidej nové položky na konec nebo je vlož na správné místo podle priority.
Hotové úkoly jsou přesunuty do sekce ## Hotovo.

## Vize
Mobilní garden tracker pro iOS/Android. Cíl: nejlepší zahradnická appka v ČR — přehledný iOS design, offline-first, fotky rostlin, připomínky péče, sezónní kalendář.
Stack: React 18 + Vite, Node.js Express + SQLite, PM2 WSL port 3000. Po změně: `cd frontend && npm run build`, pak `pm2 restart gardenpin`.

## Fronta

- [~] PWA manifest + service worker
  Scope:
  - Vytvořit `frontend/public/manifest.webmanifest` s name="Zahradní tracker", short_name="Zahrada", start_url="/", display="standalone", theme_color="#2d5a27", background_color="#f5f1e8", icons (192×192 + 512×512 PNG, generovat zelený listový SVG → PNG přes Sharp v node skriptu nebo použít existující asset).
  - Uložit ikony do `frontend/public/icon-192.png` a `icon-512.png` + `leaf.png` (192×192) — sw.js je už referencuje.
  - V `frontend/index.html` přidat `<link rel="manifest" href="/manifest.webmanifest">` a `<link rel="apple-touch-icon" href="/icon-192.png">`.
  - V `frontend/src/main.jsx` přidat globální SW registraci na load: `if ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(console.error)); }`
  - Ověřit Lighthouse PWA audit ≥ 90, instalovatelnost na iOS Safari a Chrome Android.
  - Build (`cd frontend && npm run build`), `pm2 restart gardenpin`.

- [~] Připomínky péče — notifikace v PWA — dispatched 2026-05-16
  Scope:
  - Backend: SQLite tabulka `reminders` (id, pin_id, type [zaliti|hnojeni|rez|prihnojit], interval_days, last_done_at, next_due_at). Endpoint CRUD `/api/pins/:id/reminders`.
  - Cron worker (node-cron uvnitř Express, každou hodinu): kontroluje `next_due_at <= NOW()` a vytvoří záznam v `notifications`.
  - Frontend: Notification API (`Notification.requestPermission`), když je app otevřená → toast + zvuk. Endpoint `GET /api/notifications/unread` na home obrazovce v badge.
  - V `PinDetail` UI pro nastavení připomínek (typ + interval). Build + push.

- [~] Offline-first — IndexedDB cache + sync — dispatched 2026-05-16
  Scope:
  - Service worker: Workbox-style strategie — `NetworkFirst` pro API, `CacheFirst` pro static (JS/CSS/obrázky).
  - IndexedDB (idb-keyval): cache poslední `GET /api/pins`, fotky thumbs. Při offline UI čte z cache + ukazuje banner "Offline režim — změny se synchronizují".
  - Queue offline mutací: POST/PUT/DELETE se uloží do IDB `pending_mutations`, po `online` eventu se přehrají.
  - Build + push.

## Hotovo

- [x] iOS-style redesign Home + List — hotovo 2026-05-21
  - Inline SVG ikony (lucide-style) v novém `components/Icons.jsx` — Home, Map, CheckCircle, Calendar, Settings, Search, Plus, Trash, ChevronRight, Camera, Refresh, Leaf, X, Alert
  - Bottom-nav + topbar přešly z emoji na SVG ikony s konzistentním sizingem 22px a barvou currentColor
  - Home: grid posledních 4 fotek napříč všemi piny (nový endpoint `GET /api/photos/recent`)
  - List (Gardens + Tasks): sticky search bar s frosted glass blur backdropem, hledání podle jména zahrady / úkolu / rostliny
  - `usePullToRefresh` hook + `PullToRefresh` wrapper s rotujícím SVG indikátorem — aktivní na Home, Gardens a Tasks
  - CSS: nové třídy `.sticky-search`, `.search-field`, `.recent-photos-grid`, `.recent-photo-tile`, `.ptr-root/.ptr-indicator/.ptr-content`, `.btn-icon-pill`, `.title-icon` se sand pozadím a rounded-2xl
  - Cleanup: opravil korupci v `SeasonalCalendar.jsx` (270+ řádků mrtvého kódu) a `PinDetail.jsx` (duplicitní PhotoGallery + resizeImage + nevalidní JSX zbytky)

- [x] Merge PR #19 — Claude Design redesign PinDetail — mergeno 2026-05-15

- [x] Fotky rostlin — upload + galerie — hotovo 2026-05-16
  - Backend: tabulka `pin_photos`, endpointy POST/GET/DELETE `/api/pins/:id/photos`, multer per-pin storage, static serve `/uploads/pins/...`
  - Frontend: tab "Fotky" v PinDetail, multi-upload, client-side resize na 1600px JPEG 0.85, thumbnail grid, lightbox modal s capture="environment"

- [x] Sezónní kalendář — typické úkoly per měsíc — hotovo 2026-05-16
  - `frontend/src/data/seasonal.json` — 12 měsíců × 5-6 typických úkolů (ČR klimatické pásmo)
  - `SeasonalCalendar` rozšířen o sekci typických úkolů, plantTags filter na piny, scroll na aktuální měsíc, badge "Tento měsíc"
