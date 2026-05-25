# Settings — obsahový audit + návrh struktury

> Podklad pro redesign `SettingsPage.jsx` (Fáze 2, první obrazovka). Cíl: minimalistický
> iOS **grouped list** dle `docs/design-system.md` + `docs/mockups/settings.html`.

## 1. Současný stav (před redesignem)

Settings je dlouhý sloupec samostatných `.card` bloků (každá funkce = vlastní karta s `<h3>`):

| # | Karta | Co dělá | Verdikt |
|---|-------|---------|---------|
| 1 | `PremiumBadge` | Stav Premium / upgrade CTA (Stripe) | **Zůstává** → splývá do účtu |
| 2 | `ThemeToggle` | Light/dark přepínač | **Zůstává** → sekce Vzhled |
| 3 | 🔔 Notifikace | In-app Notification permission + „upozornit předem" chipy | **Sloučit** s push (uživatel nerozliší dvě „notifikace") |
| 4 | 📲 Push notifikace | Web Push subscribe + test | **Sloučit** do jedné sekce Notifikace |
| 5 | 📧 Email připomínky | Adresa + toggle digestu + test | **Zůstává** → sekce Notifikace |
| 6 | 📅 Živý kalendář | webcal / Google odběr (token) | **Zůstává** → vlastní sekce Kalendář |
| 7 | 📤 Export dat | JSON / CSV / iCal download | **Zůstává** → sekce Data |
| 8 | 📊 Statistiky | total / dueToday / overdue | **Mizí** — duplikát Home + Statistik (gap z auditu: roztříštěné povrchy) |
| 9 | 🌻 Onboarding | Spustit průvodce znovu | **Zůstává** → sekce Data (akce) |
| 10 | About | Logo + claim | **Zůstává** → patička |

### Problémy
- **Dvě „notifikace"** (in-app permission vs. Web Push) zmátnou — uživatel chce jeden přepínač „upozorni mě".
- **Statistiky** se opakují na Home, ve Statistikách i tady → šum.
- **Žádné pole pro jméno** — pozdrav na Home je natvrdo `'Patriku'` (`HomePage.jsx:33`). Gap z auditu.
- **Žádná destruktivní zóna** — nelze appku resetovat ani smazat data.
- Vizuálně: karty s `<h3>` nadpisy = „web", ne iOS grouped list se section headery + footnotami.

## 2. Navržená struktura (po redesignu)

iOS grouped list: UPPERCASE caption header nad sekcí, footnote pod ní, řádky ≥48px,
hairline odsazená o ikonu (`ml-[58px]`), levá ikona 30×30 v barevném čtverci.

```
┌ Account card (avatar 🌿 + jméno + Premium pill)        ← bez headeru, hero

ÚČET
  • Tvoje jméno            [ input → localStorage ]       ← NOVÉ (opraví pozdrav)
  • Premium                Aktivní ✓  /  Upgrade ›        ← z PremiumBadge

VZHLED
  • Tmavý režim            [ switch ]                     ← ThemeToggle jako řádek
  footnote: Sleduje světlý/tmavý motiv. Uloží se v zařízení.

NOTIFIKACE
  • Push notifikace        [ switch ]   (+ Test push když ON)
  • Upozornit předem       Jen dnes · 1 / 2 / 3 dny ›     ← chip group v řádku
  • Týdenní email digest   [ switch ]
  • Email adresa           [ input ]    (+ Test email)
  footnote: Souhrn úkolů. Push i bez otevřené appky, email pondělí 8:00.

KALENDÁŘ
  • Přidat do iOS Kalendáře (webcal)
  • Stáhnout .ics
  • URL pro Google Kalendář [ readonly input ]
  footnote: Živý odběr sezónních úkonů ze všech zahrad (refresh 1×/den).

DATA & ZÁLOHY
  • Export dat             JSON · CSV · iCal ›
  • Spustit průvodce znovu ›

NEBEZPEČNÁ ZÓNA  (červený header)
  • Resetovat aplikaci     ← vyčistí lokální nastavení (téma, jméno, onboarding) + reload
  • Smazat všechna data    ← nevratně smaže zahrady/rostliny/úkoly na serveru
  footnote: Smazání je nevratné. Nejdřív si zazálohuj přes Export.

📍 GardenPin · Správa zahrady v kapse · verze 1.0
```

### Mapování na požadované sekce z backlogu (Účet / Zahrada / Notifikace / Data / Téma)
- **Účet** → ÚČET (jméno + Premium)
- **Téma** → VZHLED
- **Notifikace** → NOTIFIKACE (sloučené push + in-app + email)
- **Data** → DATA & ZÁLOHY + NEBEZPEČNÁ ZÓNA
- **Zahrada** → vědomě vynecháno z globálního Settings: per-zahrada nastavení (půda,
  expozice, sdílení) žije v GardenDetail; jediné „přes všechny zahrady" je živý kalendář →
  povýšen na vlastní sekci KALENDÁŘ.

## 3. Destruktivní akce — chování

| Akce | Rozsah | Bezpečnostní pojistka | Backend |
|------|--------|------------------------|---------|
| **Resetovat aplikaci** | jen lokální `localStorage` klíče (`gardenpin.theme`, `gardenpin.userName`, `gp_onboarded`, `notifReminderDays`) | 1× `confirm()` | žádný (client-side) + `location.reload()` |
| **Smazat všechna data** | všechny zahrady → kaskáda na piny / úkoly / historii / fotky / záhony / sklizně + soubory na disku | 2 kroky: `confirm()` → text-confirm „SMAZAT" | `DELETE /api/all-data` |

`DELETE /api/all-data` smaže všechny řádky `gardens` (FK `ON DELETE CASCADE` pokryje
zbytek) a uklidí soubory: `gardens.image_path`, `pins.photo_path`, celý `uploads/pins/`.
Nemaže účet/Premium ani push subscription (to není „zahradní data").

## 4. Změny mimo SettingsPage
- `HomePage.jsx` — pozdrav už čte `localStorage['gardenpin.userName']` (klíč `USER_NAME_KEY`
  existuje), takže stačí dát uživateli pole pro zápis. Beze změny v Home.
- `backend/server.js` — nový endpoint `DELETE /api/all-data`.
- `api.js` — wrapper `deleteAllData()`.
- `PremiumBadge.jsx` — logika přesunuta inline do Settings (účet + checkout návrat), soubor smazán.
