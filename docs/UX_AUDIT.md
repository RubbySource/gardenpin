# UX Audit GardenPin — z perspektivy uživatele

> Datum: 2026-05-28
> Auditor: manuální analýza kódu + Patrikovy zpětné vazby z testování
>
> Tento audit je o **logice aplikace** a **user flows**, ne o vizuálu (sage redesign už proběhl, mockup parity hotovo). Cíl: identifikovat broken patterns a navrhnout strategický fix plán.

---

## 1. Hlavní zjištění (TL;DR)

**3 kritické UX problémy:**

1. **Polygon editor** — funkce skryté za gestures bez UI hintů, žádný undo, není discoverable
2. **Pin vs Bed datový model** — `bed` (záhon) je čistě vizuální obdélník bez vztahu k rostlinám; `pin` = 1 rostlina. Uživatel chce "záhon zeleniny s 5 rajčaty a 3 paprikami" ale data model to neumožňuje
3. **Onboarding nepojmenovaný flow** — nový uživatel nepochopí "zahrada → pin → rostlina" hierarchii za 30 vteřin

**5 středně silných problémů** + **8 quick wins** — detaily níže.

---

## 2. Mapa flows (jak to user dělá)

### Flow A: Onboarding (první otevření)
1. User vidí `OnboardingFlow.jsx` (5 kroků: zóna → zahrada → rostlina → úkon)
2. ✅ Konsolidováno (dříve byly 2 onboardingy)
3. ⚠️ Demo data prázdná — user nevidí jak appka vypadá s reálnou zahradou
4. ⚠️ "Skip" tlačítko vede do prázdné Home — neví co dělat dál

### Flow B: Přidat zahradu
1. Tap "+" na GardensPage
2. Modal `NewGardenModal` — jméno, typ
3. Zahrada vytvořena, otevře GardenDetailPage
4. Volitelně: upload fotky → zobrazí mapa
5. ⚠️ **Polygon editor toggle** — uživatel musí vědět že "Ohraničit" tlačítko aktivuje editor
6. ❌ **Polygon UX** (viz detail níže)

### Flow C: Polygon editor (ohraničení zahrady)
1. User klikne "Ohraničit"
2. Zobrazí se 4 výchozí body (rohy obdélníku)
3. Drag bodu = přesun ✅
4. Klik na midpoint mezi body = přidá nový bod ⚠️ (discoverability — neexistuje hint)
5. **Double-click bodu = smazat** ❌ — nedovysvětleno, mobilní touch nemá DC
6. **Žádný undo** ❌
7. **Žádné UI tlačítka** pro "smazat bod", "reset", "undo" ❌
8. ⚠️ Min 3 body — pokud user smaže pod 3, ticho selže
9. ✅ SVG mask ztmavuje mimo polygon — dobrý vizuál

**Patrik zpětná vazba:** "Polygon je hrozný a nefunguje" — gestures jsou neviditelné, user neví jak smazat bod nebo přidat víc.

### Flow D: Vložit rostliny do zahrady
1. User otevře `GardenDetailPage` (zahrada existuje + má polygon)
2. **2 módy:**
   - **Pin mode** (default): klik na mapu uvnitř polygonu = vytvoří pin → modal pro výběr rostliny → 1 rostlina per pin
   - **Bed mode**: aktivuje "Záhon" toggle → drag obdélníku = vytvoří záhon (`{x, y, width, height}`)
3. ❌ **KRITICKÉ:** `bed` **nemá vztah k rostlinám**. Bed je jen vizuální box na mapě.
4. Pokud user chce "záhon s rajčaty a paprikami":
   - Vytvoří bed (vizuálně viděl obdélník)
   - Pak musí klikat dovnitř a vytvářet **separátní piny** pro každou rostlinu
   - **Beds a pins nesdílí žádný vztah** — user nevidí "5 rostlin v tomto záhonu"

**Patrik zpětná vazba:** "Záhon se zeleninou ale můžu tam dát jen 1 rostlinu" — výstižně.

### Flow E: PinDetail (1 rostlina = 1 pin)
1. Tap pin na mapě → otevře `PinDetail.jsx` (bottom sheet)
2. ✅ Hero, fotky, úkony, choroby & škůdci, doprovod
3. ✅ Sezónní úkony tabuly podle taxonomy z `data/taskTypes.js`
4. ❌ Pin **drží jen 1 rostlinu** — nelze přidat víc do stejné lokace

### Flow F: Tasks page
1. Segmented Dnes / Týden / Vše
2. ✅ Swipe akce (complete / snooze / delete)
3. ✅ Snooze action sheet (iOS style)
4. ⚠️ Filtr po zahradě (pills) — pokud user má 5+ zahrad, pills se nevejdou na mobil

### Flow G: Sezónní kalendář
1. ✅ Měsíční přehled
2. ✅ Klimatické zóny ČR + EU (DE/AT/PL/SK)
3. ✅ Choroby & škůdci jako preventivní úkony

### Flow H: Settings
1. ✅ Po redesignu = iOS grouped list
2. ✅ Field pro jméno uživatele (před: pozdrav natvrdo "Patriku")
3. ✅ Dark mode toggle, push notif, email digest, jazyk (5 jazyků)
4. ⚠️ Destruktivní zóna ("Smazat data") na konci — dobrá iOS konvence, ale uživatel může omylem narazit

---

## 3. Identifikované broken patterns

### 3.1 Polygon editor — `PolygonEditor.jsx`

| Problem | Where | Severity |
|---|---|---|
| Double-click smazat = non-discoverable + nepoužitelné na mobilu | `PolygonEditor.jsx:78-83` | **HIGH** |
| Klik na midpoint = přidat — žádný visual hint | `PolygonEditor.jsx:86-93` | HIGH |
| Žádný **undo** button | celý komponent | HIGH |
| Žádný floating UI panel s akcemi (Smazat bod / Reset / Undo / Hotovo) | celý komponent | MEDIUM |
| Pod 3 body **ticho selže** — chyba se neukáže userovi | `PolygonEditor.jsx:80` (`if (points.length <= 3) return`) | MEDIUM |
| Reset na default 4 body chybí | celý komponent | LOW |
| Touch hit area pro body 18-24px = dobrá; midpoint je menší | CSS check | LOW |

### 3.2 Datový model `pin` vs `bed`

| Problem | Where | Severity |
|---|---|---|
| `bed` má jen `x, y, width, height` — žádný vztah k rostlinám | `GardenDetailPage.jsx:267-274` + `backend/server.js` schema | **CRITICAL** |
| User nemůže vytvořit "záhon zeleniny s 5 rajčaty" jako jednu entitu | celý model | **CRITICAL** |
| Pin = 1 plant rigidní — nelze přesazení/výměna sezónně | `pins` schema | MEDIUM |
| Beds a pins nemají vizuální vztah na mapě (užívátel je nevidí spolu) | UI | MEDIUM |

### 3.3 Onboarding & first-time experience

| Problem | Where | Severity |
|---|---|---|
| Demo data prázdná — user vidí "0 zahrad" po onboardingu | `OnboardingFlow.jsx` | MEDIUM |
| Skip = prázdná Home, žádný hint "co dál" | `HomePage.jsx` empty state | MEDIUM |
| Onboarding nemá preview reálné zahrady | `OnboardingFlow.jsx` | LOW |

### 3.4 Drobné UX (quick wins)

| Problem | Severity |
|---|---|
| Tasks page filtr po zahradě — pills nevejdou na mobil když 5+ zahrad | LOW |
| Polygon editor "Reset" k default 4 bodům chybí | LOW |
| PinDetail bottom sheet — žádný "Smazat pin" v menu (musí jít přes edit modal) | LOW |
| Sezónní úkony — pokud user splní úkol, nezobrazí se "co dělat dál" | LOW |
| Destruktivní zóna v Settings nemá "Are you sure?" pro Reset (jen pro Smazat data) | LOW |
| Empty state PlantCatalogPage při 0 výsledcích vyhledávání | LOW |
| Garden share read-only link — žádný náhled co odkaz ukazuje, je-li bezpečný | LOW |
| Streak resetuje na 0 i když user 1 den vynechá — žádná "frozen day" mechanika | LOW |

---

## 4. Doporučení — strategické fix položky

Seřazeno dle **impact × frequency × user pain** (highest first):

### P0 — Datový model `Záhon` (KRITICKÉ)

- **Záhon: redesign pin → záhon model (1-N rostlin)** [XL, ~4-6h]
  - Backend: nová tabulka `garden_beds` (id, garden_id FK, name, x, y, width, height, polygon_points nullable, type). Existující `beds` tabulka rozšířená.
  - Vztah `bed_plants` (bed_id FK, plant_id FK, count INT, planted_at DATE, notes) — many-to-many.
  - Migrace: existující pins → vytvořit "single-plant beds" automaticky aby data nezmizela. Alternativně: pin zůstane jako "marker" pro jednorostliny, bed jako container pro skupiny.
  - Frontend: `BedDetailModal` (nová komponenta) — vidí seznam rostlin v bedu, můžeš přidat / odebrat / změnit počet. Migrace: existující PinDetail beze změny pro single-plant cases.
  - Sezónní úkony per rostlina v bedu (každá rostlina má vlastní timeline).
  - Compatibility: pokud user má pin = 1 rostlina (currently), zachovat. Bed je nová superpost ition.

### P1 — Polygon editor UX overhaul (HIGH)

- **Polygon editor: floating UI panel + undo + delete button** [L, ~2-3h]
  - Floating panel nad/pod mapou (mobile-first) s tlačítky: **+** (přidá bod do středu), **−** (smaže vybraný), **↺** (undo), **⟲** (reset na 4 body), **✓** (hotovo).
  - **Selected point** state — tap = vybere bod (highlight ring), button-bar pak ovládá vybraný.
  - Undo stack (max 10 kroků) — každá změna se uloží jako snapshot.
  - Visual hint pro midpoint handle — tečka s ikonou ➕ při hover/tap-and-hold.
  - "Min 3 body" — pokud user zkusí smazat čtvrtý → toast "Polygon musí mít alespoň 3 rohy", ne ticho.
  - Touch hit area: 32×32px pro body, 24×24px pro midpoint.

### P2 — Onboarding s reálnou demo zahradou (MEDIUM)

- **Onboarding: demo zahrada s 3 rostlinami** [M, ~1-2h]
  - "Skip" + "Vytvořit demo zahradu" — vytvoří "Moje testovací zahrada" s 3 ukázkovými piny (rajče, salát, mátka) + sezónní úkony.
  - User vidí jak appka vypadá s daty, může odstranit demo až bude mít vlastní zahradu.
  - Hint banner na Home: "Toto je demo. Klikni '+' pro tvoji první zahradu."

### P3 — PinDetail enhancements (MEDIUM)

- **PinDetail: smazat pin + výměna rostliny** [S, ~30-45min]
  - Bottom menu (3 dots): "Změnit rostlinu", "Smazat pin", "Sdílet"
  - Změna rostliny = výběr z `PlantCatalogPage` modal — zachová historii péče (jako "sezonní rotation")
  - Smazat = confirm modal "Opravdu smazat? Historie zůstane v archivu."

### P4 — Tasks filtr po zahradě = dropdown na mobilu (LOW)

- **Tasks: dropdown selector místo pills když 4+ zahrad** [S, ~30min]
  - Detekce počet zahrad → pills jen do 3, jinak iOS native `<select>` styling.

### P5 — Quick wins bundle (LOW)

- **UX polish balíček** [M, ~1h]
  - Empty state PlantCatalogPage při 0 výsledcích ("Žádné rostliny pro filtr X. [Reset]")
  - Confirm dialog pro "Reset aplikace" v Settings (zatím jen "Smazat data" má)
  - "Frozen day" v streaku — user může jednou týdně vynechat den bez resetu streaku
  - Tooltipy / hint banners pro skryté gestures (PolygonEditor double-click, swipe na tasks)

---

## 5. Quick wins (1-2h každý, hned implementovatelné)

V pořadí podle ROI:

1. **Polygon editor button bar** (P1 pod-položka, 1h) — i jen floating panel s "Hotovo" + "Reset" + "Smazat poslední bod" dramaticky zlepší UX.
2. **Onboarding demo data** (P2, 1-2h) — empty Home je nejhorší pocit.
3. **PinDetail kebab menu** (P3, 30min) — "Smazat pin" je nečekaně skryté.
4. **Tasks filtr dropdown** (P4, 30min) — drobnost ale frekvence vysoká.

---

## 6. Datový model — návrh migrace Pin → Bed

### Současný stav
```sql
CREATE TABLE pins (
  id INTEGER PRIMARY KEY,
  garden_id INTEGER NOT NULL,
  plant_id INTEGER NOT NULL,  -- 1:1 s rostlinou
  x REAL, y REAL,             -- pozice na mapě (%)
  name TEXT,
  ...
);

CREATE TABLE beds (
  id INTEGER PRIMARY KEY,
  garden_id INTEGER NOT NULL,
  name TEXT,
  x REAL, y REAL, width REAL, height REAL,  -- vizuální obdélník
  ...
);
-- Žádný vztah bed ↔ pins/plants
```

### Navrhovaný stav (zachovává backward compat)
```sql
-- Pins zůstanou pro single-plant markers (default cas use)
-- (žádná schema změna pro pins)

-- Beds rozšíříme o vztah k rostlinám
ALTER TABLE beds ADD COLUMN type TEXT DEFAULT 'vegetable';  -- vegetable / flower / herb / mixed

-- Nová tabulka: rostliny v záhonu (M:N s počty)
CREATE TABLE bed_plants (
  id INTEGER PRIMARY KEY,
  bed_id INTEGER NOT NULL,
  plant_id INTEGER NOT NULL,
  count INTEGER DEFAULT 1,           -- "5 rajčat"
  planted_at DATE,
  removed_at DATE NULL,              -- soft delete pro historii
  notes TEXT,
  FOREIGN KEY (bed_id) REFERENCES beds(id) ON DELETE CASCADE,
  FOREIGN KEY (plant_id) REFERENCES plants(id)
);

CREATE INDEX idx_bed_plants_bed ON bed_plants(bed_id);
```

### Frontend dopad

- **Pin = "marker"** zůstane jak je. Default mód.
- **Bed = "container"** — nová `BedDetailModal` s listem rostlin uvnitř (`bed_plants` join).
- Sezónní úkony fungují per rostlina v bedu (každý `bed_plants` záznam má vlastní task pipeline).
- Migrace: existující data **beze změny**. Bed bez plants = original behavior (vizuální obdélník). Nový bed s plants = nová funkcionalita.

### Migrace existujících uživatelů

- Žádná data migration nutná. Stávající beds + pins zůstávají platné.
- "Upgrade prompt" v UI: pokud user má bed s 3+ piny uvnitř (geometricky), nabídnout "Sloučit do záhonu?" CTA.

---

## 7. Akční plán

**Doporučené pořadí pro PO Runner / Patrika:**

1. **P1 Polygon editor button bar** — 1-2h, dramatic improvement, low risk
2. **P0 Záhon datový model** — 4-6h, KRITICKÉ ale velký scope, vyžaduje schema migrace
3. **P2 Onboarding demo data** — 1-2h, viditelný impact pro nové uživatele
4. **P3-P5 quick wins** — postupně, kdykoliv

**Co NEMĚL claude dělat sám:**
- Polygon editor 3× už opravoval (commits 2387d77, 67f9760, 56f4ec6) bez UX overhaul. Pouhé "oddálit fotku" a "stats mimo mapu" neřeší root cause = chybí UI panel s akcemi.
- Sezónní featury bohatě obohacují backlog, ale **strategické UX problémy** se nezpracovaly. Backlog reactive, ne strategický.

---

## 8. Závěr

GardenPin má **silnou implementaci sezónních úkonů** (30+ featur za týden), **dobrý design system** (sage paleta po mockup parity audit), **iOS-style polish**. Co chybí: **datový model pro skupinové entity (záhon)** a **UI affordances v polygon editoru**.

Tyto 2 fixy (P0 + P1) zvednou subjektivní user experience o ~50 % bez nutnosti přepisovat features. Doporučuji **udělat P1 jako první** (rychlý win, nízký risk), pak **P0** (větší práce ale uvolní strategickou roadmap).

Po dokončení P0+P1: Patrik může reálně testovat plný flow "zahrada → polygon → bed se zeleninou (5 rajčat) → sezónní úkony per rostlina" a appka bude vypadat **kompletní**.
