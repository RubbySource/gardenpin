# GardenPin — BACKLOG

> Spravuje: PO Agent (autonomní)  
> Projekt: zahradni-tracker  
> Repo: `C:\Users\Dell 5090\Documents\Claude\Projects\Patrik The Gardener\zahradni-tracker`  
> Poslední sync: 2026-04-30

---

## [P1] PM2 autostart — backend při startu systému
- **Status:** done
- **Projekt:** zahradni-tracker
- **Repo:** `C:\Users\Dell 5090\Documents\Claude\Projects\Patrik The Gardener\zahradni-tracker`
- **Prompt:** V projektu `C:\Users\Dell 5090\Documents\Claude\Projects\Patrik The Gardener\zahradni-tracker` nastav PM2 pro autostart Express backendu (backend/server.js, port 3000) při startu WSL/Windows. Vytvoř `ecosystem.config.js` v kořeni repa, přidej npm skript `start:pm2` do backend/package.json, vytvoř `start-pm2.sh` skript pro spuštění. Ověř že PM2 je nainstalované globálně nebo ho nainstaluj. Zdokumentuj postup v STATUS.md.
- **Hotovo:** 2026-04-30 · commit 1df2e05 · PR na claude/reverent-kapitsa-bf04df

---

## [P1] Rozšíření plant databáze: 85 → 200+ rostlin
- **Status:** done
- **Projekt:** zahradni-tracker
- **Repo:** `C:\Users\Dell 5090\Documents\Claude\Projects\Patrik The Gardener\zahradni-tracker`
- **Prompt:** V projektu `C:\Users\Dell 5090\Documents\Claude\Projects\Patrik The Gardener\zahradni-tracker` rozšiř `frontend/src/plantDatabase.js` o 120+ nových středoevropských rostlin. Priorita: okrasné trávy (Miscanthus, Pennisetum, Festuca), trvalky (Hosta, Astilbe, Echinacea, Rudbeckia, Salvia, Nepeta, Phlox), keře (Spiraea, Weigela, Forsythia, Deutzia, Philadelphus), popínavé (Clematis, Lonicera, Wisteria), okrasné stromy (Prunus, Malus, Cornus), zelenina rozšíření. Každá rostlina musí mít: id, name (CZ), latinName, category, description (1-2 věty), careActions (min 2 sezónní akce). Celkový počet musí být ≥ 200. Ověř že frontend se buildí bez chyb (`npm run build` v frontend/).
- **Hotovo:** 2026-04-30 · commit cf128e4 · 206 rostlin celkem

---

## [P1] PLANT_META kompletace — careActions pro zbývajících 38 rostlin
- **Status:** done
- **Projekt:** zahradni-tracker
- **Repo:** `C:\Users\Dell 5090\Documents\Claude\Projects\Patrik The Gardener\zahradni-tracker`
- **Prompt:** V projektu `C:\Users\Dell 5090\Documents\Claude\Projects\Patrik The Gardener\zahradni-tracker` otevři `frontend/src/plantDatabase.js`. Najdi všechny rostliny kde `careActions` chybí nebo je prázdné pole (aktuálně 38 z 85). Doplň pro každou min. 2-3 sezónní akce ve formátu `{ month: 3, label: "Zastřihnout přemrzlé výhony", type: "pruning" }`. Typy: pruning, fertilizing, watering, mulching, protection, harvest. Ověř konzistenci formátu. Spusť `npm run build` v frontend/ a ověř 0 chyb.
- **Hotovo:** 2026-04-30 · commit 392c255 + f77f775 · všechny rostliny mají careActions

---

## [P2] Sezónní kalendář view — přehled akcí po měsících
- **Status:** done
- **Projekt:** zahradni-tracker
- **Repo:** `C:\Users\Dell 5090\Documents\Claude\Projects\Patrik The Gardener\zahradni-tracker`
- **Prompt:** V projektu `C:\Users\Dell 5090\Documents\Claude\Projects\Patrik The Gardener\zahradni-tracker` přidej nový React komponent `SeasonalCalendar.jsx` do `frontend/src/components/`. Zobrazí grid 12 měsíců, v každém měsíci seznam naplánovaných akcí z DB (z endpoint GET /api/tasks). Filtrovatelné podle zahrady. Styl: GardenPin design systém (forest green primary, sand background). Přidej tab "Kalendář" do bottom-nav. Zaregistruj endpoint pokud chybí. Build + ověř.
- **Hotovo:** —

---

## [P2] Cloud deploy — Railway nebo Fly.io
- **Status:** done
- **Projekt:** zahradni-tracker
- **Repo:** `C:\Users\Dell 5090\Documents\Claude\Projects\Patrik The Gardener\zahradni-tracker`
- **Prompt:** V projektu `C:\Users\Dell 5090\Documents\Claude\Projects\Patrik The Gardener\zahradni-tracker` připrav deploy konfigurace pro Railway.app. Vytvoř `railway.json` (nebo `railway.toml`) s build commandem `cd backend && npm install && npm run build-frontend` a start commandem `cd backend && node server.js`. Přidej `.env.example` s potřebnými env proměnnými (PORT, DATABASE_URL nebo SQLite path). Vytvoř `Procfile` jako fallback. Zdokumentuj deploy postup v README.md sekci "Deploy". NEPROVÁDĚT SKUTEČNÝ DEPLOY — jen připravit konfiguraci.
- **Hotovo:** —

---

## [P2] Care chips → roční opakující se úkoly
- **Status:** done
- **Projekt:** zahradni-tracker
- **Repo:** `C:\Users\Dell 5090\Documents\Claude\Projects\Patrik The Gardener\zahradni-tracker`
- **Prompt:** V projektu `C:\Users\Dell 5090\Documents\Claude\Projects\Patrik The Gardener\zahradni-tracker` oprav logiku ukládání care chips. Aktuálně se ukládají jako jednorázové úkoly s `task_type: 'jine'` na 15. den měsíce. Změň: přidej field `recurring: true` a `recurrence_pattern: 'yearly'` do tasks tabulky (migration), uprav `buildSeasonalTaskPayloads()` helper v frontend, uprav backend endpoint POST /api/tasks aby ukládal recurrence. Zobraz recurring ikonu (🔄) u opakujících se úkolů v TasksPage. Build + ověř.
- **Hotovo:** —

---

## [P2] PWA manifest + ikony + offline fallback
- **Status:** done
- **Projekt:** zahradni-tracker
- **Repo:** `C:\Users\Dell 5090\Documents\Claude\Projects\Patrik The Gardener\zahradni-tracker`
- **Prompt:** V projektu `C:\Users\Dell 5090\Documents\Claude\Projects\Patrik The Gardener\zahradni-tracker` přidej PWA podporu do Vite frontendu. Nainstaluj `vite-plugin-pwa`, vytvoř `manifest.json` (name: GardenPin, short_name: GardenPin, theme_color: #2d5a27, background_color: #f5f0e8, display: standalone). Vygeneruj placeholder ikony (512x512, 192x192) ve formátu SVG/PNG s GardenPin motivem (zelený list). Přidej service worker pro offline fallback (cache-first pro statické assety). Ověř build a že manifest se správně injektuje do index.html.
- **Hotovo:** 2026-04-30 · manifest.json + sw.js + offline.html přidány

---

## [P3] HomePage redesign — GardenPin design systém
- **Status:** done
- **Projekt:** zahradni-tracker
- **Repo:** `C:\Users\Dell 5090\Documents\Claude\Projects\Patrik The Gardener\zahradni-tracker`
- **Prompt:** V projektu `C:\Users\Dell 5090\Documents\Claude\Projects\Patrik The Gardener\zahradni-tracker` přepiš `frontend/src/pages/HomePage.jsx` (nebo ekvivalentní soubor hlavní stránky). Aplikuj GardenPin design systém (CSS proměnné --primary: #2d5a27, --sand: #f5f0e8, --charcoal, border-radius: 16px). Zobraz: hero sekci se jménem uživatele + počtem zahrad, karty zahrad s thumbnail+statistikami (počet rostlin, nadcházející akce), FAB tlačítko pro přidání zahrady. Mobile-first layout. Zachovej všechnu funkcionalitu. Build + ověř.
- **Hotovo:** —

---

## [P3] GardensPage + TasksPage redesign
- **Status:** done
- **Projekt:** zahradni-tracker
- **Repo:** `C:\Users\Dell 5090\Documents\Claude\Projects\Patrik The Gardener\zahradni-tracker`
- **Prompt:** V projektu `C:\Users\Dell 5090\Documents\Claude\Projects\Patrik The Gardener\zahradni-tracker` přepiš `frontend/src/pages/GardensPage.jsx` a `frontend/src/pages/TasksPage.jsx`. Aplikuj GardenPin design systém (stejné CSS proměnné jako PlantAutocomplete redesign). GardensPage: grid karet zahrad s mapou/fotkou, počtem pinů, dalšími akcemi. TasksPage: grouped list úkolů po měsících, checkbox pro dokončení, filtry (tento měsíc / vše / dokončené). Build + ověř.
- **Hotovo:** —

---

## [P3] Weather widget — aktuální počasí pro zahradu
- **Status:** done
- **Projekt:** zahradni-tracker
- **Repo:** `C:\Users\Dell 5090\Documents\Claude\Projects\Patrik The Gardener\zahradni-tracker`
- **Prompt:** V projektu `C:\Users\Dell 5090\Documents\Claude\Projects\Patrik The Gardener\zahradni-tracker` přidej weather widget na HomePage. Použij Open-Meteo API (zdarma, no-key: https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true). Přidej endpoint GET /api/weather?lat=&lon= na backend (proxy kvůli CORS). Frontend komponent `WeatherWidget.jsx`: zobraz teplotu, ikonu počasí, vítr. Výchozí lokace: Praha (50.08, 14.44). Přidej tlačítko pro detekci polohy přes browser geolocation API. Build + ověř.
- **Hotovo:** —

---

## [P3] Push notifikace — Web Push API
- **Status:** done
- **Projekt:** zahradni-tracker
- **Repo:** `C:\Users\Dell 5090\Documents\Claude\Projects\Patrik The Gardener\zahradni-tracker`
- **Prompt:** V projektu `C:\Users\Dell 5090\Documents\Claude\Projects\Patrik The Gardener\zahradni-tracker` implementuj Web Push notifikace. Nainstaluj `web-push` na backend. Vygeneruj VAPID klíče (uložit do .env). Přidej endpointy: POST /api/push/subscribe, POST /api/push/send (admin). Vytvoř tabulku `push_subscriptions` v SQLite. Frontend: přidej tlačítko "Povolit notifikace" v Settings, zaregistruj service worker subscription. Cron job na backendu: každé ráno v 8:00 projde úkoly na dnes a zítra → pošle push. Build + ověř.
- **Hotovo:** 