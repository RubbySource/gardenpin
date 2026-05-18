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

- [ ] iOS-style redesign Home + List
  Scope:
  - Home: velký pozdrav "Dobrý den 🌿", sekce "Dnes" (úkoly na dnešek z reminders), "Tento týden" (sklizeň), grid posledních 4 fotek.
  - List: SF Symbols-inspired ikonky (lucide-react), sticky search bar nahoře s blur backdrop, swipe-to-delete na řádku (framer-motion), pull-to-refresh.
  - Tailwind: rounded-2xl karty, font-weight 600 nadpisy, neutral-900 text na cream pozadí, soft shadows. Build + push.


## Hotovo

- [x] Merge PR #19 — Claude Design redesign PinDetail — mergeno 2026-05-15

## Hotovo

- [x] Fotky rostlin — upload + galerie — hotovo 2026-05-16
  - Backend: tabulka `pin_photos`, endpointy POST/GET/DELETE `/api/pins/:id/photos`, multer per-pin storage, static serve `/uploads/pins/...`
  - Frontend: tab "Fotky" v PinDetail, multi-upload, client-side resize na 1600px JPEG 0.85, thumbnail grid, lightbox modal s capture="environment"

- [x] Sezónní kalendář — typické úkoly per měsíc — hotovo 2026-05-16
  - `frontend/src/data/seasonal.json` — 12 měsíců × 5-6 typických úkolů (ČR klimatické pásmo)
  - `SeasonalCalendar` rozšířen o sekci typických úkolů, plantTags filter na piny, scroll na aktuální měsíc, badge "Tento měsíc"

- [x] Počasí integrace — Open-Meteo API — hotovo 2026-05-18
  - Backend `/api/weather` proxy rozšířená o 7denní daily + 24h hourly precipitation_probability
  - `WeatherWidget` — toggle 7denní předpověď (ikona, max/min °C, šance srážek %)
  - Varování pro zahradníka: déšť ≥ 60 % do 24 h → "zálivka možná nebude potřeba"; mráz ≤ 2 °C do 3 dnů → "chraňte citlivé rostliny"

- [x] Sdílení zahrady — read-only link — hotovo 2026-05-18
  - Backend: tabulka `garden_shares` (UNIQUE token + view_count), endpointy `POST/GET/DELETE /api/gardens/:id/share`, veřejný `GET /api/share/:token`
  - Frontend: tlačítko "🔗 Sdílet" v `GardenDetailPage` → modal s URL + copy + view_count + revoke
  - Veřejná routa `/sdileni/:token` (`SharedGardenPage`) mimo App shell — read-only mapa s piny, modal s detailem rostliny, footer "Sdíleno přes 🌿 GardenPin"
