# GardenPin — iOS Design System

> Vizuální jazyk pro mobilní zahradnickou aplikaci GardenPin (CZ → střední Evropa).
> Cíl: **moderní iOS 17/18 vibe** jako Apple Notes / Reminders / Wallet — clean, vzdušný, čitelný.
> Brand = **sage zelená** + **cream** podklad. NE neon, NE gradient overlays přes text, NE skeuomorphism.

Tento dokument je zdroj pravdy pro Fázi 2 (per-screen redesign) a pro implementaci
Tailwind tokenů (`tailwind.config.js`). Tokeny jsou definované jako CSS proměnné, takže
light/dark se přepíná jedinou třídou.

---

## 1. Princip

| Princip | Co to znamená v praxi |
|---|---|
| **Obsah > chrome** | Cream pozadí, bílé karty, žádné těžké rámečky. Oddělujeme prostorem a jemným stínem, ne čarami. |
| **Sage = identita, ne dekorace** | Sage používáme cíleně: aktivní stav, primární akce, brand prvky. Ne všude. |
| **8pt grid** | Každý rozměr je násobek 4. Vertikální rytmus drží stránku klidnou. |
| **Velká písmena nahoře** | iOS large title (34px) na vstupu obrazovky, sticky blur header při scrollu. |
| **Hloubka tlačí palec** | Akce dole (FAB, tab bar, primary CTA). Horní oblast je pro orientaci, ne pro doteky. |
| **Pohyb potvrzuje** | Spring animace na press / swipe / sheet. Krátké (200–400 ms), nikdy ozdobné. |

---

## 2. Barvy

Definováno jako CSS proměnné v `:root` (light) a `.dark` (dark mode). Tailwind je mapuje
na sémantické názvy (`bg-surface`, `text-label-2`, `text-brand-strong`, …).

### Brand — sage zelená
Plná škála pro tinty, stavy a ilustrace. `sage-500` (#7BA889) je **brand identity** barva
(logo, hero gradienty, aktivní tab). Pro **text a tlačítka** používáme tmavší `sage-600/700`,
aby bílý text splnil kontrast WCAG AA.

| Token | Hex | Použití |
|---|---|---|
| `sage-50`  | `#F2F6F0` | nejjemnější tint, hover fill |
| `sage-100` | `#E5EDE3` | brand tint pozadí (chip, badge) |
| `sage-200` | `#CBDBC7` | hero gradient light konec |
| `sage-300` | `#A9C3A4` | placeholder mapy/fotek |
| `sage-400` | `#8DB089` | hero gradient |
| `sage-500` | `#7BA889` | **brand** — logo, hero, aktivní stav |
| `sage-600` | `#5F8C6E` | hover akce |
| `sage-700` | `#4A6E57` | **primary tlačítka, odkazy, aktivní text** (`--brand-strong`) |
| `sage-800` | `#38543F` | text na sage tintu |

### Plochy & text (cream + iOS system grays)

| Token (CSS var) | Light | Dark | Použití |
|---|---|---|---|
| `--cream` (`bg-cream`) | `#FAF7F2` | `#16181A` | pozadí aplikace |
| `--surface` (`bg-surface`) | `#FFFFFF` | `#1F2123` | karty, sheety, grouped list |
| `--surface-2` (`bg-surface-2`) | `#F4F0E9` | `#2A2D30` | vnořené plochy, inputy |
| `--label` (`text-label`) | `#1C1C1E` | `#F5F3EF` | primární text |
| `--label-2` (`text-label-2`) | `rgba(60,60,67,.60)` | `rgba(235,235,245,.62)` | sekundární text |
| `--label-3` (`text-label-3`) | `rgba(60,60,67,.32)` | `rgba(235,235,245,.34)` | placeholder, chevron |
| `--separator` (`bg-separator`) | `rgba(60,60,67,.10)` | `rgba(235,235,245,.12)` | hairline oddělovač (0.5px) |
| `--fill` (`bg-fill`) | `rgba(120,120,128,.12)` | `rgba(120,120,128,.24)` | segmented, search, neutrální chip |

### iOS systémové akcenty (sémantika stavů)

| Token | Hex | Význam |
|---|---|---|
| `ios-blue`   | `#0A84FF` | odkazy, neutrální akce (Sdílet, Upravit) |
| `ios-green`  | `#34C759` | hotovo / úspěch / „Bez mrazu" |
| `ios-orange` | `#FF9500` | dnes / odložit / varování |
| `ios-red`    | `#FF3B30` | po termínu / smazat / destruktivní |
| `ios-yellow` | `#FFCC00` | premium akcent |

> **Pravidlo barvy stavu:** každý task má právě jednu stavovou barvu (oranžová „dnes",
> červená „po termínu", neutrální jinak) — nese ji levý 4px proužek karty + chip.

---

## 3. Typografie

**Font stack** (SF Pro na Apple, Inter/system fallback jinde):

```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", system-ui, sans-serif;
```

Váhy: **400** (body), **500** (medium / meta), **600** (semibold / nadpisy karet), **700** (bold / large title).
Globální `letter-spacing: -0.01em`, na velkých nadpisech `-0.02em` až `-0.03em` (optická korekce iOS).

| Styl | Velikost / line-height | Váha | Tracking | Použití |
|---|---|---|---|---|
| Large Title | 34 / 40 | 700 | -0.02em | vstupní nadpis obrazovky |
| Title | 28 / 34 | 700 | -0.02em | nadpis sekce, hero |
| Title 2 | 22 / 28 | 700 | -0.02em | nadpis karty / sheetu |
| Title 3 | 20 / 25 | 600 | -0.02em | „Dnes", „Moje zahrady" |
| Headline | 17 / 22 | 600 | -0.01em | název položky, řádek listu |
| Body | 15 / 20 | 400 | 0 | běžný text, popisy |
| Subhead | 14 / 19 | 500 | 0 | meta řádek pod položkou |
| Footnote | 13 / 18 | 400 | 0 | sekundární info |
| Caption | 12 / 16 | 600 | +0.04em (uppercase) | section header, chip |

---

## 4. Spacing — 8pt grid

```
4 · 8 · 12 · 16 · 20 · 24 · 32 · 48
```

| Hodnota | Typické použití |
|---|---|
| 4 | mezera ikona–text v chipu |
| 8 | mezera mezi chipy, gap v gridu statistik |
| 12 | gap mezi kartami, padding řádku listu (vertikálně) |
| 16 | **standardní okraj obrazovky**, padding karty |
| 20 | padding velké karty / hero |
| 24 | mezera mezi sekcemi |
| 32 | velká mezera nad patičkou |
| 48 | prázdné stavy, dolní bezpečná zóna |

---

## 5. Radius

iOS karty jsou typicky 16–20. Menší prvky 8–12, velké sheety/hero 24+.

| Token | px | Použití |
|---|---|---|
| `rounded-ios-sm` | 8 | chip, malé tlačítko, segmented thumb |
| `rounded-ios` | 12 | input, search bar, segmented kontejner |
| `rounded-ios-md` | 16 | menší karta, stat dlaždice, fotka |
| `rounded-ios-lg` | 20 | **standardní karta / grouped list** |
| `rounded-ios-xl` | 24 | hero, garden card, bottom sheet (28 na horních rozích) |
| `rounded-full` | 999 | badge, chip, switch, avatar, FAB |

---

## 6. Stíny — jemné, vícevrstvé

Nikdy ne jeden tvrdý stín. Skládáme blízký kontaktní stín + měkký ambient.

```css
--ios-shadow-sm:   0 1px 2px rgba(0,0,0,.04), 0 1px 1px rgba(0,0,0,.02);  /* stat dlaždice */
--ios-shadow-card: 0 1px 2px rgba(0,0,0,.04), 0 4px 12px rgba(0,0,0,.06); /* karta, list */
--ios-shadow-md:   0 2px 8px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.08); /* hover / zvednutí */
--ios-shadow-lg:   0 10px 40px rgba(0,0,0,.12);                            /* sheet, modal */
```

Barevný stín jen pro brand CTA / FAB: `0 10px 30px rgba(74,110,87,.45)`.
V dark mode stíny ztlumit (kontrast nese plocha, ne stín).

---

## 7. Motion — iOS spring

```css
--ease-spring: cubic-bezier(0.22, 1, 0.36, 1);   /* standardní: sheet, fade-up, segmented */
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1); /* mírný overshoot: press, FAB, ikona tabu */
```

| Interakce | Trvání | Křivka |
|---|---|---|
| Press feedback (`active:scale-95`) | 100 ms | bounce |
| Tab / segmented přepnutí | 250 ms | spring |
| Karta zvednutí (hover) | 200 ms | spring |
| Fade-up vstup obsahu | 400–500 ms (stagger +40 ms) | spring |
| Bottom sheet nahoru | 450 ms | spring |
| Swipe akce reveal | sleduje prst, dokončení 300 ms | spring |

Respektuj `prefers-reduced-motion`: animace nahraď okamžitým stavem.

---

## 8. Komponenty

### Tlačítka
- **Primary** — `bg-[--brand-strong]` (sage-700), bílý text, `rounded-ios`, výška 46–50, `font-semibold`. `active:scale-95`.
- **Secondary** — `bg-fill`, text `--brand-strong`. Bez rámečku.
- **Ghost / link** — transparent, text `ios-blue`, `font-medium`.
- **Destructive** — text nebo fill `ios-red`.
- **FAB** — 56×56 kruh, `bg-[--brand-strong]`, barevný stín, vpravo dole nad tab barem.

### Karta
`bg-surface rounded-ios-lg shadow-ios-card`, padding 16. Bez borderu. Klikací karta má `active:scale-[0.98]` + spring.

### Grouped list (iOS table view)
Kontejner `bg-surface rounded-ios-lg shadow-ios-card overflow-hidden`. Řádky výšky ≥ 48,
oddělené hairline `bg-separator` **odsazenou o šířku ikony** (`ml-[58px]`). Sekce má
UPPERCASE caption header nad sebou a volitelnou footnote pod sebou (`text-label-2`, 12–13px).
Levá ikona v zaobleném čtverci 30×30 s barvou kategorie.

### List item / task row
Kruhový checkbox 24–26 (`border-label-3`, splněný = `bg-ios-green` + bílá fajfka),
headline název, subhead meta, volitelné chipy stavu. Levý 4px proužek nese stavovou barvu.

### Segmented control
`bg-fill rounded-ios p-[2px]`, položky `font-semibold` 13–14px. Aktivní = `bg-surface`
+ jemný stín + `text-label`. Přechod 250 ms spring. (Mapa/Seznam/Statistiky, Dnes/Týden/Vše, Úkony/Péče/Fotky/Info.)

### Toggle switch
51×31, knob 27 s tieňom, `off = bg-fill`, `on = bg-ios-green`, knob `translateX(20px)` 250 ms spring.

### Chip / badge
`rounded-full`, 11–13px `font-bold`. Stavové varianty s tintovaným pozadím + sytým textem:
- dnes → `bg rgba(255,149,0,.16)` / text `#b45a00`
- po termínu → `bg rgba(255,59,48,.14)` / text `ios-red`
- hotovo → `bg ios-green` / bílá
- neutrál → `bg-fill` / `text-label-2`

### Bottom sheet (modal)
Vyjede zdola nad ztmavený backdrop (`bg-black/40`). Horní rohy 28px, grabber 36×5 nahoře,
`shadow-ios-lg`. Obsah scrolluje uvnitř. Zavření swipe dolů / tap mimo / tlačítko ✕.

### Bary
- **Sticky header** — `blur-bar` (cream 72–80% + `backdrop-blur saturate(180%)`), hairline dole. Back button = `ios-blue` chevron + label.
- **Tab bar** — `blur-bar`, hairline nahoře, 5 položek, aktivní `text-[--brand-strong]` + plná ikona, neaktivní `text-label-3` stroke ikona. Bezpečná zóna dole 18px.
- **Status bar / Dynamic Island** — součást rámu pro mockup.

> **Ikony:** stroke 1.8 (neaktivní) / 2.0 (aktivní), zaoblené konce, `currentColor`. SF-Symbols-like.
> Emoji se používá jen jako obsahový marker rostliny/kategorie, ne jako UI ikona.

---

## 9. Do & Don't

| ✅ Do | ❌ Don't |
|---|---|
| Cream pozadí + bílé karty | Šedé na šedém bez hierarchie |
| Hairline `separator` odsazená o ikonu | Plné čáry přes celou šířku karty |
| Sage cíleně (akce, aktivní stav) | Sage „protože je to brand" na všem |
| Jedna stavová barva na task | Tři barvy chipů na jednom řádku |
| Jemný vícevrstvý stín | Jeden tvrdý `box-shadow: 0 0 10px black` |
| Bílý text na sage-700 | Bílý text na sage-500 (neprojde kontrastem) |
| Spring 200–400 ms | Lineární 600 ms+ „ozdobné" animace |
| Large title + blur header | Centrovaný malý nadpis jako na webu |
| Min. tap target 44×44 | Drobné 24px ikony jako jediný tap cíl |
| Gradient jen na hero/brand kartách | Gradient overlay přes čitelný text |
| ≤ 5 tabů (HIG) | 6+ tabů — Kalendář schovat do Úkolů/Přehledu |

---

## 10. Mockupy

6 self-contained HTML náhledů (Tailwind CDN, light/dark přepínač uvnitř) v `docs/mockups/`.
Otevři `docs/mockups/index.html` jako rozcestník, nebo jednotlivě:

| Soubor | Obrazovka | Co demonstruje |
|---|---|---|
| [`home.html`](mockups/home.html) | Přehled | large title + greeting, „Dnes" widget, týdenní statistiky, modulární karty (streak/počasí/fotky), karty zahrad, FAB |
| [`gardens.html`](mockups/gardens.html) | Zahrady | velké hero karty, status chipy, **swipe-to-action** (Sdílet/Upravit/Smazat) |
| [`garden-detail.html`](mockups/garden-detail.html) | Detail zahrady | iOS header s back buttonem, mapa s piny, **segmented** Mapa/Seznam/Statistiky |
| [`pin-detail.html`](mockups/pin-detail.html) | Detail rostliny | **bottom sheet** s grabberem, horizontální fotky, úkony jako grouped list, sekce Choroby & škůdci |
| [`tasks.html`](mockups/tasks.html) | Úkoly | **segmented** Dnes/Týden/Vše, iOS checkboxy, vizualizace **swipe akcí** |
| [`settings.html`](mockups/settings.html) | Nastavení | iOS **grouped list**, section header + footnote, **toggle switche**, destruktivní červená sekce |

Každý mockup má vpravo nahoře přepínač **☀️ / 🌙** (a Nastavení i toggle „Tmavý režim"),
který reálně přepne celý náhled mezi light a dark.

---

## 11. Implementace → Tailwind tokeny (Fáze 1 navazující úkol)

`tailwind.config.js` přebírá z hlavičky mockupů (`theme.extend`): `colors` (sage škála + sémantické
var() barvy + `ios-*`), `fontFamily.sans`, `borderRadius` (`ios-sm…ios-xl`),
`boxShadow` (`ios-sm/card/md/lg`), `transitionTimingFunction` (`spring`, `bounce`).
CSS proměnné light/dark patří do `styles.css` (`:root` + `.dark`), čímž se sjednotí stávající
dark mode (dnes definovaný v `ios-redesign.css`) do nové sage/cream palety.

> **Pozn. k posunu palety:** stávající `ios-redesign.css` používá forest `#2d5a27` jako akcent.
> Nový systém posouvá brand na sage `#7BA889` (identita) + `#4A6E57` (akce/text) a pozadí z iOS
> šedé `#f2f2f7` na teplý cream `#FAF7F2`. Refaktor proběhne v úkolu „Tailwind design tokens".
