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

- [~] Fotky rostlin — upload + galerie u záznamu rostliny
  Scope:
  - Backend: nový endpoint `POST /api/pins/:id/photos` (multer multipart), uložit do `backend/uploads/pins/:id/`, vrátit URL. `GET /api/pins/:id/photos` vrátí seznam. `DELETE /api/pins/:id/photos/:photoId`. Vytvořit SQLite tabulku `pin_photos` (id, pin_id, filename, uploaded_at, caption).
  - Frontend: v `PinDetail` přidat sekci "Fotky" se thumbnail gridem, file input s `capture="environment"` pro mobil, lightbox při kliknutí (jednoduchý modal). Před uploadem client-side resize na max 1600px (canvas) pro úsporu místa.
  - Express servuje `/uploads/pins/...` jako static. Commit + push.

- [~] Sezónní kalendář — co dělat tento měsíc
  Scope:
  - Nová stránka `/kalendar` (route v App.jsx). Pro každý měsíc seznam typických prací (sázení, řez, hnojení, sklizeň) podle ČR klimatické zóny. Data jako statický JSON `frontend/src/data/seasonal.json` (12 měsíců × 4-8 úkolů, česky).
  - U každého úkolu volitelně tagy rostlin → kliknutí filtruje příslušné Piny.
  - Aktuální měsíc se zvýrazní, scroll na něj při načtení. iOS-style karty (rounded-2xl, soft shadow).
  - Build + push.

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

- [x] iOS-style redesign Home + List — hotovo 2026-05-20
  - HomePage: nová sekce "Tento týden — sklizeň" (horizontální karty s tap-to-complete) + grid "Poslední fotky" (4 nejnovější fotky napříč všemi piny, tap → otevře zahradu)
  - Backend: `GET /api/photos/recent?limit=N` (JOIN pin_photos × pins × gardens)
  - GardensPage: sticky search bar s `backdrop-filter: blur(16px)`, swipe-to-delete na kartách, pull-to-refresh s rotující listovou ikonou, SVG search ikona namísto emoji
  - CSS: rounded-2xl (18px) karty, font-weight 600 nadpisy, cream backdrop, soft shadows
  - Fix: odstraněn pre-existující orphaned JSX v SeasonalCalendar.jsx a PinDetail.jsx, který blokoval build
- [x] Merge PR #19 — Claude Design redesign PinDetail — mergeno 2026-05-15

## Hotovo

- [x] Fotky rostlin — upload + galerie — hotovo 2026-05-16
  - Backend: tabulka `pin_photos`, endpointy POST/GET/DELETE `/api/pins/:id/photos`, multer per-pin storage, static serve `/uploads/pins/...`
  - Frontend: tab "Fotky" v PinDetail, multi-upload, client-side resize na 1600px JPEG 0.85, thumbnail grid, lightbox modal s capture="environment"

- [x] Sezónní kalendář — typické úkoly per měsíc — hotovo 2026-05-16
  - `frontend/src/data/seasonal.json` — 12 měsíců × 5-6 typických úkolů (ČR klimatické pásmo)
  - `SeasonalCalendar` rozšířen o sekci typických úkolů, plantTags filter na piny, scroll na aktuální měsíc, badge "Tento měsíc"
