# GardenPin Backlog

Úkoly jsou seřazeny podle priority. Systém bere vždy 2-3 položky najednou.
Přidej nové položky na konec nebo je vlož na správné místo podle priority.
Hotové úkoly jsou přesunuty do sekce ## Hotovo.

## Vize
Mobilní garden tracker pro iOS/Android. Cíl: nejlepší zahradnická appka v ČR — přehledný iOS design, offline-first.
DŮLEŽITÉ: Tracker je o HLAVNÍCH zahradnických úkonech — "Zastřihni levanduli v srpnu", "Přesaď růže na podzim", "Nanes hnojivo na jahodník". NE o zalévání, počítání plodů nebo micro-taskech. Úkony jsou sezónní, vázané na konkrétní rostlinu a měsíc.
Stack: React 18 + Vite, Node.js Express + SQLite, PM2 WSL port 3000. Po změně: `cd frontend && npm run build`, pak `pm2 restart gardenpin`.

## Fronta

- [x] Dark mode — přepínač světlý/tmavý v Nastavení, uložení do localStorage, iOS-style toggle. Všechny barvy přes CSS variables. — hotovo 2026-05-23

- [x] Streak a gamifikace — počítadlo "dní v řadě" kdy jsi splnil aspoň 1 úkol, badge "Zahradník týdne/měsíce", animace konfety při splnění úkolu. Motivační prvky pro pravidelné používání. — hotovo 2026-05-23

- [x] Email připomínky — týdenní digest každé pondělí ráno: co tě čeká tento týden v zahradě. Nastavení emailu v Settings, odesílání přes vlastní SMTP nebo Nodemailer + Gmail. Opt-in, ne default. — hotovo 2026-05-23

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

- [x] Pěstební podmínky zahrady — typ půdy, expozice, nadmořská výška — hotovo 2026-05-23

- [x] Záznam sklizně a výnosů — co sklidil, kolik, datum — hotovo 2026-05-23

- [x] Souhrnný přehled přes všechny zahrady — "co dělat tento týden" — hotovo 2026-05-23

- [x] Globální vyhledávání — najdi rostlinu, zahradu nebo pin napříč všemi zahradami — hotovo 2026-05-23

- [x] Šablony zahrad — předpřipravené sady rostlin a sezónních úkonů podle typu zahrady (zeleninová / okrasná / ovocná / bylinková) — hotovo 2026-05-23

- [x] Meziroční srovnání — co jsem dělal loni touto dobou a co letos ještě chybí — hotovo 2026-05-23



- [x] Choroby a škůdci rostlin — databáze běžných chorob a škůdců vázaná na konkrétní rostlinu, se sezónním varováním („V červnu hlídej mšice na růžích"). Karta rostliny dostane sekci „Na co si dát pozor" s ikonou a měsíčním rozsahem rizika. Návrhy se objeví v sezónním kalendáři jako preventivní úkony. Vše offline, lokální datová sada. — hotovo 2026-05-24

- [x] Klimatické zóny ČR — posun termínů sezónních úkonů podle regionu a nadmořské výšky zahrady (jaro v horách přichází o 2-4 týdny později). V Pěstebních podmínkách se zvolí kraj/zóna, databáze úkonů automaticky posune doporučené měsíce. Vizuální indikace „upraveno pro tvou lokalitu". — hotovo 2026-05-24

- [ ] Spolupráce na zahradě — pozvánka člena rodiny s edit právy (dnes je sdílení jen read-only). Úkony lze přiřadit konkrétní osobě, kdo splnil úkol se zaznamená, společný streak. iOS-style správa členů v Nastavení zahrady.
