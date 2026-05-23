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

- [x] Připomínky hlavních úkonů — push notifikace v den úkonu — hotovo 2026-05-22

- [x] Databáze úkonů dle rostliny — automatické návrhy hlavních úkonů — hotovo 2026-05-22

- [x] Statistiky zahrady — přehled aktivity za sezónu — hotovo 2026-05-23

- [x] Export zahrady — záloha dat jako JSON nebo CSV — hotovo 2026-05-23

- [x] Export sezónního plánu jako PDF — tisk co dělat tento rok měsíc po měsíci — hotovo 2026-05-23

- [~] Pěstební podmínky zahrady — typ půdy, expozice, nadmořská výška
  Scope:
  - Pole v tabulce gardens: soil_type (TEXT), exposure (N/S/E/W/mixed), altitude_m (INT)
  - Editovatelné v nastavení zahrady
  - Ovlivňuje doporučené termíny úkonů (posunutí o ±2 týdny podle expozice/nadmořšky)
  - Zobrazení podmínek na přehledové stránce zahrady

- [ ] Záznam sklizně a výnosů — co sklidil, kolik, datum
  Scope:
  - Nová tabulka harvests: garden_id, plant_id, date, amount, unit (kg/ks/litr), note
  - Formulář pro přidání sklizně u každé rostliny
  - Stránka /statistics rozšířena o sekci Sklizeň: celkem za sezónu, trend rok-od-roku
  - Export sklizní v JSON záloze

- [ ] Souhrnný přehled přes všechny zahrady — "co dělat tento týden"
  Scope:
  - Nová stránka /overview nebo widget na hlavní stránce
  - Agreguje úkony ze všech zahrad pro aktuální týden a příští týden
  - Seřazeno podle naléhavosti (datum úkonu)
  - Přístupné bez přepínání mezi zahradami