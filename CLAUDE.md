# Zahradní tracker

## Stack
- Frontend: React 18 + Vite
- Backend: Node.js Express + node:sqlite, servuje zkompilovaný frontend na localhost:3000
- Start: spustit "Spustit Zahradní tracker.bat" ve složce projektu

## Struktura
- `frontend/src/` — React komponenty a stránky
- `frontend/src/plantDatabase.js` — 85 rostlin (zelenina, ovoce, byliny, okrasné, cibuloviny)
- `frontend/src/pages/` — GardenDetailPage, SettingsPage, atd.
- `backend/server.js` — Express API + SQLite databáze
- `backend/public/` — zkompilovaný frontend (výstup z npm run build)

## Klíčová API endpoints
- GET/POST `/api/gardens` — zahrady
- GET/POST/PUT/DELETE `/api/tasks` — úkoly
- GET `/api/export/ical` — iCal export pro iOS kalendář
- POST `/api/gardens/:id/upscale` — 4× upscale mapy (Sharp)

## Workflow
- Po změně frontendu: `cd frontend && npm run build`
- Commituj změny po dokončení každé featury
