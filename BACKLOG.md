# GardenPin Backlog

Úkoly jsou seřazeny podle priority. PO Runner bere TOP 1 `[ ]` per run.
Přidej nové položky na správné místo podle priority. Hotové úkoly značíme `[x]` s datem.

## Vize
**Mobilní garden tracker pro střední Evropu** (CZ, SK, DE, AT, PL) — nejlepší zahradnická appka v regionu. iOS-first design, offline-first, multi-jazyk.

**Plán:** PWA → Capacitor → iOS App Store (později Android Play Store).

**Klíčové pravidlo:** Tracker je o HLAVNÍCH sezónních úkonech — "Zastřihni levanduli v srpnu", "Přesaď růže na podzim", "Nanes hnojivo na jahodník". NE o zalévání, počítání plodů nebo micro-taskech. Úkony jsou sezónní, vázané na konkrétní rostlinu a měsíc.

**Stack:** React 18 + Vite, Node.js Express + node:sqlite, PM2 WSL port 3000. Po změně: `cd frontend && npm run build`, pak `pm2 restart gardenpin`. Live URL: https://gardenpin.tailcec1ab.ts.net/.

---

## Fronta

### Fáze 0 — Funkční audit aplikace (PRVNÍ, foundation)

- [x] **Funkční audit aplikace** — hotovo 2026-05-25. `docs/FUNCTIONAL_AUDIT.md` — kompletní mapa 9 stránek + 22 komponent + ~60 endpointů, IA, problémy, doporučení. **Identifikováno ~18 problémů** (5 bugů, 5 duplikací, 3 mrtvý kód, 4 gaps). **Top 3 doporučení:** (1) opravit osiřelou navigaci — `/tyden` nemá vstupní bod, `/premium` je mrtvý odkaz z home; (2) sjednotit fragmentovanou task-type taxonomii (3 různé slovníky + sezónní úkony natvrdo `'jine'`) → opraví špatné ikony na /ukoly i křehký iCal filtr; (3) konsolidovat 2 onboardingy + 4 překrývající se task povrchy před redesignem. Detaily s file:line v auditu.

### Fáze 0.5 — Cleanup z auditu (PŘED redesignem, foundation #2)

- [~] **Cleanup z auditu — bugy + duplikace + dead code** — Implementace top doporučení z `docs/FUNCTIONAL_AUDIT.md` než začne per-screen redesign. Konkrétně: (1) **Opravit osiřelou navigaci** — odstranit mrtvý `/premium` link z `HomePage.jsx:319` nebo přidat placeholder stránku; zpřístupnit `/tyden` (WeekOverviewPage) nějakým vstupním bodem nebo smazat. (2) **Sjednotit task-type taxonomii** — 3 různé slovníky (sezónní úkony, manuální tasks, iCal filtr) → jeden zdroj pravdy v např. `data/taskTypes.js` s `{ id, label, icon }`. Opraví špatné ikony na `/ukoly` a křehký iCal filtr. (3) **Konsolidovat 2 onboardingy** — `OnboardingFlow.jsx` + `OnboardingTour.jsx` → jeden komponent, jeden storage klíč, odstranit stale "85 druhů". (4) **Smazat dead code** — `TaskItem.jsx` (nepoužitý), unused API wrappery v `api.js`, `GET /api/pins/:id/photo` endpoint. (5) **Doc drift** — update `CLAUDE.md` aby reflektoval aktuální stav (321 rostlin, ne 85, atd.). Detaily viz audit. Time budget ~60-90 min. Commit + push.

### Fáze 1 — iOS Design System (před redesignem)

- [x] **Design system + iOS mockupy hlavních obrazovek** — hotovo 2026-05-25. `docs/design-system.md` = kompletní systém: sage paleta (#7BA889 brand + #4A6E57 akce) + cream (#FAF7F2) + iOS system colors, SF Pro typografie (large title 34 → caption 12), 8pt spacing, radius 8–24, vícevrstvé stíny, spring motion (cubic-bezier(0.22,1,0.36,1)), light+dark přes CSS proměnné, komponenty a do/don't. `docs/mockups/*.html` = 6 self-contained náhledů (home, gardens, garden-detail, pin-detail, tasks, settings) + `index.html` rozcestník; každý má light/dark přepínač, Tailwind CDN, tokeny v hlavičce připravené pro `tailwind.config.js`.

- [ ] **Tailwind design tokens implementace** — Přepsat `tailwind.config.js` podle nového design systemu (theme.extend.colors, fontFamily, spacing, borderRadius, boxShadow). Sjednotit existující dark mode (CSS variables) do nové palety. Refaktor `styles.css` aby používal nové tokeny místo ad-hoc hodnot.

### Fáze 2 — Per-screen redesign (postupně, 1 obrazovka per run)

> Pořadí dle doporučení z auditu: od nejméně provázané (Settings) po nejzávislejší (Home). Při průchodu lze sjednocovat / mazat zbytečné věci.

- [ ] **Settings redesign + obsah audit** — Nejdřív projít všechny současné Settings sekce a navrhnout co tam zůstává / mizí / se přesouvá (např. exporty by mohly mít vlastní sekci, dark mode toggle do hlavičky). Cíl: minimalistický iOS grouped list. Pak implementace: section headers (Účet / Zahrada / Notifikace / Data / Téma), native-style toggle switches, destruktivní akce (Reset, Smazat účet) na konci v červené sekci. Plus oprava gap z auditu: **přidat pole pro jméno uživatele** (dnes je pozdrav natvrdo "Patriku"). `SettingsPage.jsx`. Před implementací výstup `docs/SETTINGS_CONTENT.md` s navrženou strukturou.

- [ ] **Tasks redesign** — Segmented control "Dnes / Týden / Vše", iOS-style čísla v checkbox, swipe actions (complete/snooze/delete), pull-to-refresh (existující hook). `TasksPage.jsx`. Nahradit unused `TaskItem.jsx` (smazaný v Cleanup) jednou novou komponentou.

- [ ] **PinDetail redesign** — Bottom sheet style (modal), fotky scroll horizontálně s pinch-zoom, úkony jako iOS grouped list (sjednocená task-type taxonomie z Cleanup), sekce "Choroby & škůdci" pod hlavními úkony. `PinDetail.jsx`.

- [ ] **GardenDetail redesign** — Mapa zahrady nahoře (existující PolygonEditor + drag&drop piny), segmented control sekce (Mapa / Seznam / Statistiky), iOS-style header s back button. `GardenDetailPage.jsx`.

- [ ] **Gardens list redesign** — Velké cards s hero fotkou zahrady, status indikátory (počet úkolů, ks rostlin), iOS swipe actions (delete/share/edit). `GardensPage.jsx`.

- [ ] **Home screen redesign** (POSLEDNÍ — nejvíc závislý) — iOS large title nahoře, "Today" widget (úkoly na dnes), "This Week" stats, modulární cards pro Posledních fotek/Streak/Počasí, sticky search bar s blur backdrop. Mockup z Fáze 1 → implementace v `HomePage.jsx`. Před implementací oprava N+1 dotazů (gap z auditu).

### Onboarding (po redesignu)

- [ ] **Onboarding pro nové uživatele** — průvodce při prvním otevření v nové vizuální identitě: vítací screen → vyber země/klimatická zóna → přidej zahradu → vlož první rostlinu → ukázka prvního úkonu. iOS-style stepy s progress dots, lze přeskočit. Nahradit existující `OnboardingFlow.jsx` / `OnboardingTour.jsx` jednotnou novou komponentou.

### Fáze 3 — Capacitor + native iOS

- [ ] **Capacitor setup + iOS shell** — `npx cap init`, `npx cap add ios`, app icon set (vygenerovat ze SVG/PNG 1024x1024 přes `cordova-res` nebo manuálně všechny iOS sizes), splash screen, status bar config, safe-area-inset CSS pro notch/home indicator, `Info.plist` s permissions (camera, photo library, notifications).

- [ ] **Native API migration** — Nahradit web API za Capacitor pluginy kde dává smysl: `@capacitor/camera` (místo `<input type="file" capture>`), `@capacitor/haptics` (vibrace na úspěch/swipe), `@capacitor/push-notifications` (místo Web Push API), `@capacitor/share` (native share sheet). Conditional: použij Capacitor plugin když je `Capacitor.isNativePlatform()`, jinak web fallback.

- [ ] **TestFlight beta build** ⚠️ MANUÁLNÍ — vyžaduje Apple Developer účet ($99/rok), certifikáty (development + distribution), provisioning profile, App Store Connect setup. Claude může připravit dokumentaci `docs/IOS_BUILD.md` se step-by-step návodem, ale samotný build + upload do TestFlight musí udělat Patrik na Mac (nebo přes cloud build service jako Codemagic/Bitrise).

### Filtr katalogu (drobnost, kdykoliv)

- [ ] **Filtr a vyhledávání v katalogu rostlin** ⚠️ MOŽNÁ HOTOVO — audit zjistil že `PlantCatalogPage.jsx` už má search s debounce + pill filtr kategorií. Prvním krokem ověřit aktuální stav, pokud je hotové → označit `[x] hotovo` a pokračovat dál. Pokud chybí (např. nějaká kategorie) → doplnit.

### Fáze 4 — Internacionalizace (CZ → střední Evropa)

- [ ] **i18n setup (react-i18next)** — Instalace `react-i18next` + `i18next-browser-languagedetector`. Vytvořit `frontend/src/locales/{cs,en,de,pl,sk}.json`. Extrakce všech českých textů z komponent do `cs.json` jako klíče (např. `home.greeting`, `tasks.today`). Refaktor komponent na `useTranslation()`. Detection: localStorage > browser language > cs default.

- [ ] **Překlady EN + DE + PL + SK** — Claude přeloží `cs.json` do 4 jazyků pomocí kontextu (zahrada/rostliny terminologie). Výstup: `en.json`, `de.json`, `pl.json`, `sk.json`. Profi review později. Hint: `de.json` musí používat formální Sie pro UI textů.

- [ ] **Klimatické zóny DE/AT/PL/SK** — Rozšířit `frontend/src/data/climateZones.js` o německé Bundesländer (16), rakouské Bundesländer (9), polské województwa (16), slovenské kraje (8) s jejich klimatickými charakteristikami (USDA hardiness zone, průměrná teplota, frost dates). Pro DE/AT/PL/SK uživatele by se měly nabízet v Pěstebních podmínkách.

- [ ] **App Store screenshots + popis v 5 jazycích** — 6.5" iPhone screenshots (1290x2796) pro 5 hlavních obrazovek po redesignu, App Store popis (cs/en/de/pl/sk), klíčová slova, kategorie (Lifestyle nebo Productivity), screenshoty s i18n textem.

### Spolupráce (velká feature, naposledy)

- [ ] **Spolupráce na zahradě** — Pozvánka člena rodiny s edit právy (dnes je sdílení jen read-only). Backend: tabulka `garden_members` (garden_id, user_id, role: owner/editor/viewer, invited_at, accepted_at). Frontend: nová sekce v Settings zahrady "Členové" s iOS-style add button, email pozvánka přes existující email infra, úkony lze přiřadit konkrétní osobě (`tasks.assigned_to`), kdo splnil úkol se zaznamená, společný streak. Pro Capacitor: email pozvánka via mailto: link.

---

## Hotovo (chronologicky, nejnovější dole)

- [x] Dark mode — přepínač světlý/tmavý v Nastavení, uložení do localStorage, iOS-style toggle. Všechny barvy přes CSS variables. — hotovo 2026-05-23

- [x] Streak a gamifikace — počítadlo "dní v řadě" kdy jsi splnil aspoň 1 úkol, badge "Zahradník týdne/měsíce", animace konfety při splnění úkolu. Motivační prvky pro pravidelné používání. — hotovo 2026-05-23

- [x] Email připomínky — týdenní digest každé pondělí ráno: co tě čeká tento týden v zahradě. Nastavení emailu v Settings, odesílání přes vlastní SMTP nebo Nodemailer + Gmail. Opt-in, ne default. — hotovo 2026-05-23

- [x] Počasí integrace — Open-Meteo API (3denní předpověď + mrazové varování) — hotovo 2026-05-22

- [x] Sdílení zahrady — read-only link pro rodinu/přátele — hotovo 2026-05-22

- [x] iOS-style redesign Home + List (předběžný, plný redesign teprve dle nového design systemu Fáze 1+2) — hotovo 2026-05-22

- [x] Mapa zahrady — vizuální layout záhonů, drag&drop pozice rostlin — hotovo 2026-05-22

- [x] PWA manifest + service worker — hotovo 2026-05-16

- [x] Fotky rostlin — upload + galerie u záznamu rostliny — hotovo 2026-05-16

- [x] Sezónní kalendář úkonů — přehled co dělat tento měsíc napříč všemi zahradami — hotovo 2026-05-22

- [x] Připomínky hlavních úkonů — push notifikace v den úkonu — hotovo 2026-05-22

- [x] Databáze úkonů dle rostliny — automatické návrhy hlavních úkonů — hotovo 2026-05-22

- [x] Statistiky zahrady — přehled aktivity za sezónu — hotovo 2026-05-23

- [x] Export zahrady — záloha dat jako JSON nebo CSV — hotovo 2026-05-23

- [x] Export sezónního plánu jako PDF — tisk co dělat tento rok měsíc po měsíci — hotovo 2026-05-23

- [x] Pěstební podmínky zahrady — typ půdy, expozice, nadmořská výška — hotovo 2026-05-23

- [x] Záznam sklizně a výnosů — co sklidil, kolik, datum — hotovo 2026-05-23

- [x] Souhrnný přehled přes všechny zahrady — "co dělat tento týden" — hotovo 2026-05-23

- [x] Globální vyhledávání — najdi rostlinu, zahradu nebo pin napříč všemi zahradami — hotovo 2026-05-23

- [x] Databáze rostlin — 321 druhů pokrývající středoevropské zahrady (zelenina, ovoce, byliny, keře, trvalky, letničky, vodní, sukulenty, trávy, stromy) — hotovo 2026-05-24

- [x] Polygon editor mapy zahrady — ohraničení nepravidelného tvaru zahrady na fotce, oříznutí na serveru, tlačítko pro otevření satelitní mapy dle adresy — hotovo 2026-05-24
