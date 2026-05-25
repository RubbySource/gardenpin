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

- [x] **Cleanup z auditu — bugy + duplikace + dead code** — hotovo 2026-05-25. Všech 5 kroků doporučení z auditu před per-screen redesignem. **Bugy:** opravena osiřelá navigace — mrtvý `/premium` link míří na `/nastaveni` (kde Premium badge reálně žije), `/tyden` (WeekOverviewPage) dostala vstupní bod „Týden →" na Home. **Taxonomie:** nový `frontend/src/data/taskTypes.js` = jeden zdroj pravdy (id/label/emoji/SVG ikona/iCal kategorie); refaktorovány utils.js, TasksPage (smazán rozbitý lokální `TASK_TYPE_ICON` s klíči zaliti/rez/vysadba → správné ikony na /ukoly), GardenDetailPage (ICAL_CATEGORIES), sezónní úkony dostávají reálný task_type přes `taskTypeFromEmoji`. **Onboarding:** 2 komponenty → 1 (smazán OnboardingTour s „85 druhů", OnboardingFlow obohacen o bullety, jednotný klíč `gp_onboarded`). **Dead code:** smazán TaskItem.jsx, API wrappery addHistory/listHarvests, endpoint `GET /api/pins/:id/photo`. **Doc:** CLAUDE.md aktualizován (321 rostlin, PM2, Tailscale, recent features). 6 commitů.

### Fáze 1 — iOS Design System (před redesignem)

- [x] **Design system + iOS mockupy hlavních obrazovek** — hotovo 2026-05-25. `docs/design-system.md` = kompletní systém: sage paleta (#7BA889 brand + #4A6E57 akce) + cream (#FAF7F2) + iOS system colors, SF Pro typografie (large title 34 → caption 12), 8pt spacing, radius 8–24, vícevrstvé stíny, spring motion (cubic-bezier(0.22,1,0.36,1)), light+dark přes CSS proměnné, komponenty a do/don't. `docs/mockups/*.html` = 6 self-contained náhledů (home, gardens, garden-detail, pin-detail, tasks, settings) + `index.html` rozcestník; každý má light/dark přepínač, Tailwind CDN, tokeny v hlavičce připravené pro `tailwind.config.js`.

- [x] **Tailwind design tokens implementace** — hotovo 2026-05-25. Aplikace dosud běžela na čistém CSS (žádný Tailwind), proto **přidán Tailwind v3.4 toolchain** (`tailwindcss`+`postcss`+`autoprefixer` jako devDeps) bez rozbití ~6.7 k řádků ručního CSS: `corePlugins.preflight=false` (žádný reset), `darkMode:['selector','[data-theme="dark"]']` (respektuje existující ThemeToggle, ne `.dark`). **`tailwind.config.js`** = `theme.extend` přesně dle design systemu: `colors` (sage 50–800 škála + sémantické `var()` názvy brand/surface/label/separator/fill + `ios-*` akcenty), `fontFamily.sans`, `borderRadius` (ios-sm…ios-xl), `boxShadow` (ios-sm/card/md/lg + ios-brand glow), `transitionTimingFunction` (spring/bounce), `spacing` (safe-t/safe-b insety; default scale = 8pt grid). **CSS proměnné** (`:root` light + `html[data-theme="dark"]`) přepsány do **sage/cream palety** v `styles.css` — nový token layer (sage škála, ios akcenty, --brand/--brand-strong/--brand-action, --cream/--surface/--surface-2, --label*, radius/shadow/motion). **Sjednocen dark mode**: legacy aliasy (--forest, --bg, --card, --sand, --green-*, --primary…) **routovány přes nové tokeny** v obou souborech (styles.css + ios-redesign.css) → celá variable-driven UI přešla z forest #2d5a27 + iOS-šedé #f2f2f7 na sage + cream #FAF7F2 bez přepisu tisíců pravidel. Zbylé natvrdo zadané forest hexy/rgba v gradientech, CTA stínech a companion-pillech převedeny na sage. `--brand-action` (#4A6E57 light / #5F8C6E dark) drží čitelnost bílého textu na tlačítkách. Build + `node --check` OK. `postcss.config.js`, `src/tailwind.css` (3 direktivy, import last v main.jsx).

### Fáze 2 — Per-screen redesign (postupně, 1 obrazovka per run)

> Pořadí dle doporučení z auditu: od nejméně provázané (Settings) po nejzávislejší (Home). Při průchodu lze sjednocovat / mazat zbytečné věci.

- [x] **Settings redesign + obsah audit** — hotovo 2026-05-25. Před implementací **`docs/SETTINGS_CONTENT.md`** = obsahový audit (10 karet → co zůstává/mizí/se přesouvá) + návrh struktury + chování destruktivních akcí. **Implementace** `SettingsPage.jsx` přepsán z kupy `.card` bloků na **iOS grouped list**: account hero (avatar + jméno + Premium pill) → sekce ÚČET / VZHLED / NOTIFIKACE / KALENDÁŘ / DATA & ZÁLOHY / NEBEZPEČNÁ ZÓNA (červená) + patička. Section headery (uppercase caption) + footnoty, řádky ≥50px, **hairline odsazená o ikonu** (`.settings-sep` ml-58), 30×30 barevné SVG ikony (stroke 1.8–2, žádné emoji jako UI ikona). **Gap z auditu opraven:** pole „Tvoje jméno" → `localStorage['gardenpin.userName']` (HomePage už klíč čte, pozdrav „Patriku" je teď jen fallback). **Konsolidace:** 2 notifikační karty (in-app permission + Web Push) sloučeny do jedné NOTIFIKACE sekce (push toggle s fallbackem na lokální oprávnění, „upozornit předem" chipy, email digest toggle + adresa + test); statistiky z auditu vyhozeny (duplikát Home/Statistik); PremiumBadge logika přesunuta inline (účet row + checkout-návrat efekt) a `PremiumBadge.jsx` smazán. **Toggly** sjednoceny na `on = ios-green` dle design systemu. **Destruktivní zóna:** „Resetovat aplikaci" (vyčistí lokální nastavení + reload) a „Smazat všechna data" (2-krokové potvrzení confirm→text „SMAZAT", nový endpoint `DELETE /api/all-data` smaže všechny zahrady → FK CASCADE + úklid souborů uploads/pins). CSS grouped-list layer v `ios-redesign.css`. Endpoint ověřen na izolovaném portu+DB (POST→DELETE→prázdný list, produkční PM2 nedotčen). Build + `node --check` OK.

- [x] **Tasks redesign** — hotovo 2026-05-26. **iOS segmented control „Dnes / Týden / Vše"** s animovaným klouzajícím thumbem (spring) nahradil filtr-pills; vedle něj zelený **„Hotovo" toggle** s počtem pro historii péče. **Nová filtr logika:** Dnes = po termínu + dnes (`daysFromToday<=0`), Týden = příštích 7 dní (`<=7`), Vše = vše. **Grupování dle filtru:** Dnes/Týden → relativní denní buckety (Po termínu / Dnes / Zítra / název dne), Vše → měsíce, Hotovo → měsíce (historie); společný `.task-month-group` markup. **Nová komponenta `frontend/src/components/TaskRow.jsx`** (náhrada za smazaný `TaskItem.jsx`) = swipovatelný řádek: swipe vpravo = hotovo, vlevo = smazat, trailing tlačítko = odložit. **Snooze přepracován na iOS action-sheet** — `SnoozeButton` dostal `sheet` variantu (bottom sheet s grip handle, slide-up spring, scroll-lock + Esc); řeší ořezávání popoveru o swipe-overflow tím, že snooze vrstva (`.task-snooze-layer`) leží MIMO transformovaný/clipnutý řádek, takže `position:fixed` sheet není ořezaný ani posunutý. PinDetail/WeekOverview ponechány na popover variantě. iOS kruhové checkboxy + pull-to-refresh zachovány. Build + `node --check` OK.

- [x] **PinDetail redesign** — hotovo 2026-05-26. **Bottom-sheet prezentace:** `.pd-sheet` se vysouvá zdola (spring slide-up), zaoblený horní okraj 22px, max-height 94vh s peek backdropu, **grip handle s drag-to-dismiss** (tah za handle dolů >90px zavře, jinak spring snap-back); na desktopu (≥720px) centrovaná karta s pop animací. **Úkony jako iOS grouped list:** `UkonyTab` přepsán z jednotlivých `.pd-task-card` na jeden `.pd-task-list` card s řádky oddělenými hairline (odsazená o ikonu), kruhový check (splnit), 26px SVG ikona z **jednotné taxonomie** (`taskIconName` → Icon.jsx, nahradilo emoji `taskIcon`), badge stav/frekvence/typ, trailing snooze (popover) + edit + delete; overdue/today přes inset levý accent. **Choroby & škůdci** (`PlantWarnings`) přesunuty z Info tabu **pod hlavní úkony** v Úkony tabu. **Fotky horizontálně + pinch-zoom:** grid → `.pd-photo-strip` (scroll-snap horizontální pás 150px dlaždic); lightbox dostal novou komponentu **`PinchImage`** = dvouprstý pinch zoom (scale 1–4, nativní non-passive touch listenery), pan při přiblížení, double-tap/double-click toggle zoom, + prev/next navigace mezi fotkami a počítadlo X/Y. Build + `node --check` OK.

- [x] **GardenDetail redesign** — hotovo 2026-05-26. **iOS nav header** (`.gd-nav`, sticky pod globálním topbarem, blur): back chevron „‹ Zahrady" + vycentrovaný název zahrady + kruhové „•••" tlačítko otevírající **akční menu** (Upravit / Sdílet / Přidat do kalendáře / Sezónní plán PDF) — 4 staré inline action buttony nahrazeny jedním iOS context-menu (pop animace, klik-mimo + Esc zavírá). **Mapa vždy nahoře** (`.gd-map-card`) — existující `map-container` + drag&drop piny + PolygonEditor + záhony beze změny logiky; statický hint nahrazen **plovoucím overlay chipem** (`.gd-map-hint`, blur, `pointer-events:none`) dole na mapě, text dle režimu (přidat pin / kreslit záhon), skrytý v polygon režimu. **iOS segmented control „Mapa / Seznam / Statistiky"** (znovupoužitý `.ios-segmented` + klouzající thumb z Tasks redesignu): **Mapa** = nástroje mapy (rotace/mřížka/záhon/polygon/upscale) + seznam záhonů; **Seznam** = rostliny (PlantRow); **Statistiky** = 2×2 grid rychlých čísel (míst / rostlin / záhonů / s fotkou) + plocha zahrady z polygonu (pokud je měřítko) + `YearOverYear`. Přepnutí ze záložky Mapa vypne aktivní bed/polygon režim (`changeTab`). Polygon crop ovládání zůstává přilepené pod mapou. Build + `node --check` OK.

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
