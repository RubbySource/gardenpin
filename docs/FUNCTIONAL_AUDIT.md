# Funkční audit aplikace GardenPin

> Stav: 2026-05-25 · větev `main` (HEAD `0dfd698`)
> Autor: Claude (senior frontend audit) · Cílová skupina: Patrik + budoucí dev session
> Účel: zmapovat reálný stav PŘED per-screen redesignem (Fáze 2), aby se nepřekreslovaly funkční chyby.

Audit je čistě dokumentační — žádný runtime kód nebyl měněn.

---

## 1. Mapa funkcí — co tam je

### 1.1 Stránky (`frontend/src/pages/`)

| Stránka | Route | Co dělá | Data z API | Naviguje na |
|---|---|---|---|---|
| **HomePage** | `/` | Dashboard: pozdrav, hero statistiky (zahrady/rostliny/po termínu/týden), karty zahrad, „Dnes a po termínu", „Nadcházející", nedávné fotky, sezónní statistiky, FAB nová zahrada | `todayTasks`, `weekTasks`, `stats`, `listGardens`, `recentPhotos`, **+ `listPins` per zahrada** | `/zahrada/:id`, `/zahrady`, `/ukoly`, `/premium` (⚠ neexistuje) |
| **GardensPage** | `/zahrady` | Seznam zahrad jako karty (`garden-card-v3`), hero souhrn, vytvoření z prázdné/šablony, smazání | `listGardens`, `deleteGarden` | `/zahrada/:id` |
| **GardenDetailPage** | `/zahrada/:id` | Interaktivní mapa: piny (drag&drop), záhony (kreslení), polygon ohraničení + crop, rotace/mřížka/upscale, sdílení, iCal odběr, PDF plán, editace podmínek | `listGardens`*, `listPins`, `listBeds`, `updatePin/Garden`, `createBed`, share/ical tokeny, přímý fetch `upscale`/`crop-polygon`/`season-plan` | otevírá `PinDetail`, modály (Edit/Share/Calendar/Bed) |
| **PinDetail** | (modal, ne route) | iOS sheet s taby `#ukony / #pece / #fotky / #info`: úkony (CRUD, snooze, complete), info o péči, galerie fotek, choroby&škůdci, sezónní doporučení, sklizeň, historie | `getPin`, `completeTask`, `deleteTask`, `listPinPhotos`, `listPinHarvests` … | — (modal) |
| **TasksPage** | `/ukoly` | Všechny úkoly: filtry `Tento měsíc / Vše / Dokončené`, filtr zahrady, fulltext, swipe complete/delete, grupování po měsících | `listTasks`, `listHistory`, `listGardens`, `completeTask`, `deleteTask` | otevírá `PinDetail` |
| **WeekOverviewPage** | `/tyden` | Souhrn po naléhavosti (po termínu / dnes / tento týden / příští týden) + „podle zahrady" | `overviewTasks(14)`, `listGardens` | `/zahrada/:id`, otevírá `PinDetail` — **⚠ stránka nemá žádný vstupní bod v UI** |
| **PlantCatalogPage** | `/katalog` | Katalog 321 rostlin: search (debounce 200 ms), pill filtr kategorií, expand karta se sezónním přehledem, „+ přidat do zahrady" | `listGardens`, `createPin`, `createTask`; data z `plantDatabase.js` | přidá pin přes `GardenPickerSheet` |
| **SettingsPage** | `/nastaveni` | Téma, notifikace (browser + push), email digest, živý iCal kalendář (vše), jednorázový export (JSON/CSV/iCal), statistiky, restart onboardingu, Premium badge | `stats`, `globalIcalToken`, `getEmailSettings`, push API | spouští `OnboardingTour` |
| **SharedGardenPage** | `/share/:token` | Veřejný read-only pohled (bez topbar/nav): mapa, rostliny, nadcházející úkony po měsících | `getSharedGarden(token)` | `/` |

\* GardenDetailPage načítá zahradu přes `listGardens().find(...)` — tahá celý seznam a filtruje klientsky, ač existuje `getPin` analogie by se hodil `getGarden` (neexistuje).

### 1.2 Komponenty (`frontend/src/components/`, 22 souborů)

**Aktivně používané:**
- `Toast`, `ReminderBanner`, `SearchOverlay`, `OnboardingFlow`, `SeasonalCalendar` — montuje `App.jsx`
- `Modal` — `GardensPage`, `PinDetail`, `GardenDetailPage`, `NewGardenModal`, `TemplateGardenModal`
- `NewGardenModal`, `TemplateGardenModal` — `GardensPage` (+ Home jen NewGarden)
- `WeatherWidget`, `StreakWidget`, `SeasonStats`, `YearOverYear`, `Icon` — `HomePage` (`YearOverYear` i `GardenDetailPage`)
- `PlantAutocomplete` (+ `PlantInfoCard`, `buildSeasonalTaskPayloads`) — `GardenDetailPage`, `PinDetail`, `PlantCatalogPage`, `TemplateGardenModal`
- `RecommendedTasks`, `PlantWarnings`, `SnoozeButton` — `PinDetail` (`PlantWarnings` i katalog; `SnoozeButton` i Tasks/Week/TaskItem)
- `PremiumBadge`, `OnboardingTour`, `ThemeToggle` — `SettingsPage`
- `PolygonEditor` — `GardenDetailPage`

**Mrtvý kód:**
- **`TaskItem.jsx`** — neimportuje ho žádný jiný soubor (jediný výskyt „TaskItem" je v něm samotném). Kandidát na smazání.

**Duplicitní dvojice:**
- **`OnboardingFlow.jsx` vs `OnboardingTour.jsx`** — dvě nezávislé implementace onboardingu (detail níže v §3).

### 1.3 Backend endpointy (`backend/server.js`, 2279 řádků)

Volané z frontendu (přímo nebo přes `api.js`):

| Skupina | Endpointy |
|---|---|
| Gardens | `GET/POST /api/gardens`, `PUT/DELETE /api/gardens/:id` |
| Sharing | `POST/DELETE /api/gardens/:id/share`, `GET /api/share/:token` |
| Pins | `GET /api/gardens/:id/pins`, `GET/POST/PUT/DELETE /api/pins/:id`, `PUT /api/pins/:id/photo` |
| Pin fotky | `GET/POST /api/pins/:id/photos`, `DELETE …/:photoId`, `GET /api/photos/recent` |
| Beds | `GET /api/gardens/:id/beds`, `POST /api/beds`, `PUT/DELETE /api/beds/:id` |
| Tasks | `GET /api/tasks`, `…/today`, `…/week`, `…/overview`, `POST /api/tasks`, `PUT/DELETE/:id`, `POST /:id/done`, `POST /:id/snooze` |
| History | `GET /api/history` |
| Harvests | `GET /api/pins/:id/harvests`, `POST /api/harvests`, `DELETE /:id` |
| Stats | `GET /api/stats`, `…/streak`, `…/season`, `…/harvests`, `…/yoy` |
| Mapa | `POST /api/gardens/:id/upscale`, `…/crop-polygon` |
| Push | `GET /api/push/vapid-public-key`, `POST /subscribe`, `/unsubscribe`, `/send` |
| Email | `GET/POST /api/email-settings`, `POST …/test` |
| Weather | `GET /api/weather`, `GET /api/pins/sensitive` |
| iCal | `GET /api/gardens/:id/ical-token`, `/api/ical-token`, `/api/gardens/:id/calendar.ics`, `/api/calendar.ics`, `/api/export/ical` |
| Export | `GET /api/gardens/:id/season-plan`, `GET /api/export` |
| Stripe | `GET /api/stripe/status`, `POST /api/stripe/create-checkout`, `POST /api/stripe/webhook` (`routes/stripeRoutes.js`) |

Endpointy **bez volání z frontendu** (live, ale unused z UI):
- `POST /api/history` (server.js:896) — `api.addHistory` wrapper existuje, nikdo nevolá. Historie vzniká jen jako vedlejší efekt `POST /tasks/:id/done`.
- `GET /api/harvests` (server.js:908) — globální výpis sklizní; UI používá jen per-pin `…/pins/:id/harvests`. `api.listHarvests` mrtvý wrapper.
- `POST /api/email-settings/send-digest` (server.js:1410) — `api.sendEmailDigest` wrapper bez volání; digest spouští cron/PM2 serverstranně (legitimní endpoint, mrtvý jen ve frontendu).
- `GET /api/pins/:id/photo` (server.js:511) — singular GET fotky; `api.js` má jen `PUT …/photo`. Žádný čtenář → kandidát na smazání endpointu.

---

## 2. Information architecture — jak je app strukturovaná

### 2.1 Navigace

- **Topbar** (`App.jsx:132`) — dynamický titulek dle route + tlačítko vyhledávání (Ctrl/Cmd+K → `SearchOverlay`) + datum.
- **Bottom nav** (`App.jsx:169`) — 6 položek: 🏠 Přehled `/` · 🗺️ Zahrady `/zahrady` · ✅ Úkoly `/ukoly` (s badge počtu naléhavých) · 📅 Kalendář `/kalendar` · 🌿 Katalog `/katalog` · ⚙️ Nastavení `/nastaveni`.
- **ReminderBanner** pod topbarem, stats se obnovují každých 30 min; notifikační check každou hodinu.
- Sdílený pohled `/share/:token` má vlastní layout bez navigace (`App.jsx:108`).

### 2.2 Hierarchie

```
Zahrada (garden)
  └─ Pin / místo (pin)  ── má rostlinu z katalogu, fotku, podmínky
       ├─ Úkony (tasks)        ── opakované (frequency_days) | jednorázové (specific_date)
       ├─ Fotky (pin_photos)
       ├─ Sklizeň (harvests)
       └─ Historie péče (history)
  └─ Záhony (beds)            ── obdélníky na mapě, volitelně rozměry v m
  └─ Polygon ohraničení       ── crop fotky na tvar zahrady
```

### 2.3 Klíčové flow

- **Vytvoření zahrady** → Home/Gardens FAB nebo šablona → `GardenDetailPage`. Funkční.
- **Přidání rostliny** → klik na mapu (`GardenDetailPage`) NEBO katalog „+ přidat do zahrady" → `NewPinModal`/`GardenPickerSheet`. Automaticky generuje úkony (pravidelné z DB + sezónní z výběru). Funkční, ale dvě různé vstupní cesty s odlišným UX.
- **Práce s úkoly** → 4 různé povrchy (viz §3). Funkční, ale roztříštěné.
- **Sdílení / kalendář** → modály v `GardenDetailPage` + globální v Settings. Funkční, dobře udělané (živý webcal + download).

---

## 3. Identifikované problémy

### A. Funkce co nedělají co mají / bugy

1. **`/premium` je mrtvý odkaz.** `HomePage.jsx:319` renderuje `<Link to="/premium">`, ale `App.jsx` žádnou route `/premium` nemá → spadne do `*` (`App.jsx:165`) → znovu HomePage. Premium teaser na home tedy „neudělá nic" (reload na home). Premium funguje jen jako karta `PremiumBadge` v Nastavení.

2. **`/tyden` (WeekOverviewPage) je osiřelá stránka.** Route existuje (`App.jsx:161`), komponenta je plně funkční, ale **nevede na ni žádný odkaz ani nav položka** (grep na `/tyden` = 0 výskytů kromě definice route). Uživatel se tam dostane jen ručním zadáním URL. Buď doplnit vstupní bod, nebo zrušit (její funkci z velké části supluje `/ukoly` a `/kalendar`).

3. **Špatné ikony úkonů na TasksPage.** `TasksPage.jsx:27-35` má lokální `TASK_TYPE_ICON` s klíči `zaliti / hnojeni / rez / sklizen / vysadba / prihnojit`. Kanonická taxonomie v `utils.js:41` je ale `zalivka / hnojeni / strihani / presazeni / plet / sklizen / kontrola / jine`. Shodují se jen `hnojeni` a `sklizen` → zálivka, stříhání a ostatní typy padají na generický `leaf`. Zbytek appky přitom používá `taskIcon()` z utils → nekonzistentní ikonografie napříč obrazovkami.

4. **iCal filtr typů stojí na emoji v titulku, ne na datech.** Sezónní úkony se ukládají vždy jako `task_type='jine'` (`PlantAutocomplete.jsx:59`), takže backend filtr (`server.js:1557-1576`) rozlišuje typ podle emoji v `title` (✂️→pruning, 🌱→fertilizing…). Důsledky: `protection` i `prevention` sdílí 🛡️, `sowing` má stejné emoji jako `planting`/`fertilizing` → filtrování v `CalendarSubscribeModal` je jen přibližné. Funguje to, ale je to křehké (změna emoji v titulu rozbije filtr).

5. **HomePage dělá N+1 dotazů na piny.** `HomePage.jsx:74-78` volá `listPins` zvlášť pro každou zahradu, ačkoliv `GET /api/gardens` už vrací `pin_count`/`task_count`/`urgent_count` (které `GardensPage.jsx:200-209` normálně používá). Při více zahradách zbytečné HTTP round-tripy při každém načtení home.

### B. Duplikace

6. **Dva onboardingy.** `OnboardingFlow.jsx` (klíč `gp_onboarded`, 4 slidy, auto-zobrazení přes `App.jsx:36`) vs `OnboardingTour.jsx` (klíč `gardenpin.onboardingDone`, 3 kroky, manuální spuštění ze Settings). Různé storage klíče → můžou se zobrazit oba. `OnboardingTour` má navíc zastaralý text „85 druhů" (`OnboardingTour.jsx:35`), zatímco `OnboardingFlow` říká „321 druhů". BACKLOG už počítá se sjednocením.

7. **Tři slovníky typů úkonů.** (a) `utils.TASK_TYPES` (cs: zalivka…), (b) `TasksPage.TASK_TYPE_ICON` (divergentní cs: zaliti/rez/…), (c) iCal anglické klíče (pruning/fertilizing…). K tomu sezónní úkony natvrdo `task_type='jine'`. Žádný jednotný zdroj pravdy.

8. **Čtyři překrývající se povrchy pro úkoly.** `HomePage` (Dnes/Nadcházející), `/ukoly` (TasksPage), `/tyden` (WeekOverview), `/kalendar` (SeasonalCalendar). `/ukoly` a `/tyden` se obsahově nejvíc překrývají (oba list úkolů přes zahrady, filtr zahrady, otevírání PinDetail).

9. **Tři „seasonal" povrchy.** `SeasonalCalendar` (/kalendar, 12 měsíců × zahrady + pest varování), `RecommendedTasks` (PinDetail Info tab — návrhy k přidání), sezónní přehled v `PlantCatalogPage`. Sdílí data (`plantDatabase` seasonalTasks), ale tři různé rendery.

10. **Tři styly karet.** `garden-card-v2` (HomePage), `garden-card-v3` (GardensPage), `garden-card` (PlantRow v detailu + SharedGarden). Stejný koncept, tři CSS implementace — sjednotit v redesignu.

### C. Mrtvý kód

11. `TaskItem.jsx` — komponenta bez importéra.
12. Mrtvé `api.js` wrappery: `addHistory`, `listHarvests`, `sendEmailDigest` (poslední legitimní serverstranně).
13. Endpoint `GET /api/pins/:id/photo` (server.js:511) bez frontend čtenáře.

### D. Gaps (chybí, co by user čekal)

14. **Nelze nastavit jméno uživatele.** Pozdrav na home čte `localStorage['gardenpin.userName']` s defaultem `'Patriku'` (`HomePage.jsx:32-33`), ale **nikde v UI není pole pro nastavení jména** → každému se zobrazuje „Patriku". Buď doplnit do Settings, nebo odstranit personalizaci.
15. **Premium nemá vlastní obrazovku** (souvisí s bodem 1) — jen badge v Settings; home teaser nikam nevede.
16. **Žádná destruktivní sekce v Settings** (reset / smazání všech dat / smazání účtu) — BACKLOG „Settings redesign" ji předpokládá.
17. **Doc drift:** `CLAUDE.md` uvádí „85 rostlin", reálně je v `plantDatabase.js` 321 (5768 řádků). Stejná zastaralá hodnota v `OnboardingTour`.

---

## 4. Doporučení

### Smazat
- `TaskItem.jsx` (mrtvá komponenta).
- Mrtvé `api.js` wrappery `addHistory`, `listHarvests` (a zvážit `sendEmailDigest` — nechat, je serverstranně volaný jinak; jen okomentovat).
- Endpoint `GET /api/pins/:id/photo`, pokud se opravdu nikde nepoužívá.

### Sjednotit (PŘED redesignem — jinak se chyby překreslí)
- **Taxonomii typů úkonů** → jeden zdroj pravdy v `utils.js`. Smazat lokální `TASK_TYPE_ICON` v `TasksPage` a používat `taskIcon()`. Sezónním úkonům přiřadit reálný `task_type` místo `'jine'` — opraví ikony (bod 3) i křehkost iCal filtru (bod 4) zároveň.
- **Onboarding** → ponechat jeden (BACKLOG už plánuje novou jednotnou komponentu po redesignu); do té doby alespoň sjednotit storage klíč a opravit „85 druhů".
- **Karty zahrad/rostlin** → jeden komponentový styl (řeší design tokens z Fáze 1).

### Dodělat / rozhodnout
- **`/tyden`**: buď přidat vstupní bod (nav/odkaz), nebo zrušit a její buckety integrovat do `/ukoly` (segmented control „Dnes / Týden / Vše" už BACKLOG plánuje — tím by `/tyden` přirozeně zanikla).
- **`/premium`**: buď vytvořit `/premium` stránku, nebo z home odkazu udělat scroll/route na Settings sekci.
- **Jméno uživatele**: doplnit pole do Settings (nebo do onboardingu), jinak personalizovaný pozdrav nemá smysl.
- **HomePage N+1**: použít `pin_count`/`upcoming` z `listGardens` místo per-garden `listPins`.
- Aktualizovat `CLAUDE.md` na 321 rostlin.

---

## 5. Příprava pro redesign

### Pořadí obrazovek (návrh)
BACKLOG má pořadí Home → Gardens → GardenDetail → PinDetail → Tasks → Settings. Doporučuji **začít Settings** jako „rozcvičku": je nejméně provázaná, nejvíc se hodí na zavedení iOS grouped-list patternu z design systemu, a dá se u ní rovnou dořešit gap se jménem uživatele a destruktivní sekcí. Pak Home (vlajková loď) s vyřešenými daty (N+1) a Tasks (kde se vyřeší segmented control + zánik `/tyden`).

### Na co si dát pozor při jednotlivých obrazovkách
- **Tasks redesign** — nejdřív sjednotit task-type taxonomii (§4), jinak nový design zdědí špatné ikony. Segmented control „Dnes/Týden/Vše" je příležitost pohřbít osiřelou `/tyden`.
- **Home redesign** — opravit N+1 a `/premium` link při téže příležitosti (mockup počítá s Premium teaserem).
- **GardenDetail** — nejsložitější obrazovka (1768 řádků, drag&drop piny, polygon editor, kreslení záhonů, rotace/grid/upscale, 5 vnořených modálů). Redesign jen vizuální vrstvy; logiku map/pointer-events nerozbít. Zvážit extrakci modálů (`EditGardenModal`, `ShareGardenModal`, `CalendarSubscribeModal`, `BedEditModal`, `NewPinModal`) do vlastních souborů.
- **PinDetail** — už je sheet-style s taby přes URL hash; redesign hlavně sladit s design tokeny, zachovat scroll-aware sticky header a FAB.
- **PlantCatalog** — filtr/search už hotové (Fáze „Filtr katalogu" v BACKLOG je vlastně z velké části splněná — ověřit, ať se needělá podruhé).
- **Globálně** — sjednotit `garden-card-*` styly a zavést design tokens (Fáze 1 „Tailwind tokens") jako úplně první krok, jinak každá obrazovka přinese vlastní ad-hoc hodnoty.
