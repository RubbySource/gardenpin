# GardenPin Backlog

Úkoly jsou seřazeny podle priority. Systém bere vždy 2-3 položky najednou.
Přidej nové položky na konec nebo je vlož na správné místo podle priority.
Hotové úkoly jsou přesunuty do sekce ## Hotovo.

## Vize
Mobilní garden tracker pro iOS/Android. Cíl: nejlepší zahradnická appka v ČR — přehledný iOS design, offline-first.
DŮLEŽITÉ: Tracker je o HLAVNÍCH zahradnických úkonech — "Zastřihni levanduli v srpnu", "Přesaď růže na podzim", "Nanes hnojivo na jahodník". NE o zalévání, počítání plodů nebo micro-taskech. Úkony jsou sezónní, vázané na konkrétní rostlinu a měsíc.
Stack: React 18 + Vite, Node.js Express + SQLite, PM2 WSL port 3000. Po změně: `cd frontend && npm run build`, pak `pm2 restart gardenpin`.

## Fronta

- [x] Počasí integrace — Open-Meteo API (3denní předpověď + mrazové varování) — hotovo 2026-05-22

- [x] Sdílení zahrady — read-only link pro rodinu/přátele — hotovo 2026-05-22

- [x] Mapa zahrady — vizuální layout záhonů, drag&drop pozice rostlin — hotovo 2026-05-22

- [x] PWA manifest + service worker — hotovo 2026-05-16

- [x] Fotky rostlin — upload + galerie u záznamu rostliny — hotovo 2026-05-16

- [x] Sezónní kalendář úkonů — přehled co dělat tento měsíc napříč všemi zahradami — hotovo 2026-05-22

- [ ] Připomínky hlavních úkonů — push notifikace v den úkonu
  Scope:
  - Web Push API + Service Worker subscription
  - Uložit push subscription do DB (tabulka `subscriptions`)
  - Backend job: každý den ráno v 7:00 zkontrolovat task_date = dnes, odeslat push přes web-push npm balíček
  - Notifikace: "🌿 GardenPin: Dnes zastřihni levanduli v Zahradě u domu"

- [x] Databáze úkonů dle rostliny — automatické návrhy hlavních úkonů — hotovo 2026-05-22

- [ ] Statistiky zahrady — přehled aktivity za sezónu
  Scope:
  - Sekce "Sezóna" na Dashboard nebo v detailu zahrady
  - Počet splněných úkonů tento měsíc / tento rok
  - Graf aktivity po měsících (bar chart)
  - Nejaktivnější zahrada, nejpečovanější rostlina

- [ ] Export zahrady — záloha dat jako JSON nebo CSV
  Scope:
  - Endpoint GET /api/export?format=json|csv
  - JSON: kompletní export všech zahrad, pinů, tasků, fotek (base64 nebo URL)
  - CSV: tabulka pinů s úkoly
  - Tlačítko "Exportovat data" v Settings