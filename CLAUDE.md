# Zahradní tracker (GardenPin)

## Stack
- Frontend: React 18 + Vite
- Backend: Node.js Express + node:sqlite, servuje zkompilovaný frontend na localhost:3000
- Produkce: PM2 ve WSL (proces `gardenpin`, port 3000), veřejná URL přes Tailscale Funnel:
  https://gardenpin.tailcec1ab.ts.net/
- Lokální start: spustit "Spustit Zahradní tracker.bat" ve složce projektu

## Struktura
- `frontend/src/` — React komponenty a stránky
- `frontend/src/plantDatabase.js` — 321 rostlin (zelenina, ovoce, byliny, okrasné, keře,
  trvalky, letničky, vodní, sukulenty, trávy, stromy)
- `frontend/src/data/taskTypes.js` — jednotná taxonomie typů úkonů (zdroj pravdy:
  id/label/emoji/SVG ikona/iCal kategorie)
- `frontend/src/pages/` — HomePage, GardensPage, GardenDetailPage, PinDetail, TasksPage,
  WeekOverviewPage, PlantCatalogPage, SettingsPage, SharedGardenPage
- `backend/server.js` — Express API + SQLite databáze
- `backend/public/` — zkompilovaný frontend (Vite outDir; výstup z `npm run build`)

## Klíčové funkce
- Interaktivní mapa zahrady: piny (drag&drop), záhony, polygon ohraničení + crop, rotace/mřížka/upscale
- Sezónní úkony vázané na rostlinu (auto-generace z databáze + výběr care chips)
- Choroby & škůdci, sezónní doporučení, sklizeň, historie péče (PinDetail)
- iCal export/odběr (živý webcal + jednorázový download), sdílení zahrady (read-only)
- Statistiky, streak/gamifikace, počasí (Open-Meteo), email digest, push notifikace

## Klíčová API endpoints
- GET/POST `/api/gardens` — zahrady
- GET/POST/PUT/DELETE `/api/tasks` — úkoly
- GET `/api/export/ical`, `/api/calendar.ics`, `/api/gardens/:id/calendar.ics` — iCal
- POST `/api/gardens/:id/upscale` — 4× upscale mapy (Sharp)
- POST `/api/gardens/:id/crop-polygon` — oříznutí fotky na tvar zahrady

## Workflow
- Po změně frontendu: `cd frontend && npm run build` (zapisuje rovnou do `backend/public/`)
- Deploy na produkci: rsync do WSL + `pm2 restart gardenpin` (viz `deploy.sh`)
- Commituj změny po dokončení každé featury
