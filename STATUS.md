# GardenPin — Status

## Poslední aktualizace
2026-04-27

---

## Nedávné změny

### 2026-04-27 — Polish fix mergován + push na gardenpin remote ✅
- Větev `claude/pedantic-solomon-5ee10d` (commit `438a961`) fast-forward mergována do `master`.
- Care chips nyní fakticky ukládají úkoly do DB při vytváření pinu (dříve toggle bez efektu — opravil submit handler v `NewPinModal` přes nový helper `buildSeasonalTaskPayloads()`, sdílený s CTA v `PlantInfoCard`).
- `careActions` doplněny pro dalších 19 rostlin (cibule, česnek, dýně, cuketa, fazole, hrášek, špenát, brokolice, kedlubna, zelí, ředkev, rybíz, angrešt, šalvěj, pažitka, levandule, růže, petúnie, tulipán) — celkem nyní 47/85.
- Build artefakty z pedantic-solomon worktree zkopírovány do `backend/public/` (`index.html` + `assets/index-sBk2U1dp.js` + `assets/index-BJ26TSBy.css`); stará `index-DaKG5c83.js` smazána.
- **První push `master` do remote `gardenpin`** (`github.com/RubbySource/gardenpin.git`) — předtím byl prázdný.

### 2026-04-27 — Plant card redesign mergován do master ✅
- Větev `claude/practical-greider-895d5f` (commit `ae0cabe`) fast-forward mergována do `master`.
- Push do remote vynechán — projekt nemá GitHub remote.
- Build artefakty (`backend/public/index.html`, `assets/index-BJ26TSBy.css`, `assets/index-DaKG5c83.js`) zkopírovány z worktree do hlavního repa, aby Express server na localhost:3000 servoval nový design. (`backend/public/` je gitignored, takže merge sám o sobě artefakty nepřinesl.)
- Server je Express servující skompilovaný frontend — NENÍ to Vite HMR. Pro projevení změn je nutné zastavit + spustit `Spustit Zahradní tracker.bat`.

#### Co redesign přinesl
- **`frontend/src/plantDatabase.js`**: `getPlantCategory(id)` + `PLANT_META` objekt s rozšířenou meta (zone/light/water/height/careActions) pro 28 nejčastějších rostlin. Heuristika dopočítává light/water pro zbylých 57.
- **`frontend/src/components/PlantAutocomplete.jsx`** přepsán: dropdown s thumbnail+kategorií, hero plant card 4:5, sand-pozadí stat pruh (světlo/zálivka/výška), interaktivní sezónní chips, sticky CTA „+ Přidat do zahrady" se součtem úkolů.
- **`frontend/src/styles.css`**: nová tokenová sada (`--primary: #2d5a27`, `--sand: #f5f0e8`, `--charcoal`, `--muted`), `--bg` na bílou, `--radius` 12→16, `.btn`/`.tabs`/`.bottom-nav` přepnuto na forest green primary.
- Build prošel již na větvi (48 modulů, 11.82 kB CSS, 276 kB JS).

#### Známé limity redesignu
- Care chips se ukládají jako jednorázové úkoly s `task_type: 'jine'` na 15. dne měsíce — ideálně by měly být roční opakování (vyžadovalo by úpravu serveru).
- Rozšířená `PLANT_META` jen pro 28 z 85 rostlin.
- Nový design zatím jen na detailu rostliny; HomePage / GardensPage / TasksPage zachovány v původním renderu.

---

## VIZE PRODUKTU (ultimátní cíl)

**GardenPin** je super moderní mobilní aplikace pro středoevropské zahrádkáře.

### Co to dělá
- Uživatel přidá rostlinu na mapu zahrady (pin na reálné fotce/plánu)
- Při přidání app navrhne sezónní akce specifické pro danou rostlinu
- Uživatel jen zaškrtne, které chce → exportuje do kalendáře (iCal/Apple Calendar/Google)
- Výsledek: chytré připomenutí velkých ročních akcí, ne otravné denní úkoly

### Filosofie připomínek
- **POUZE velké roční akce**: střih stromů, zastřižení trav, hnojení keřů, zimní zábal
- **ŽÁDNÉ** každodenní akce (zalévání, přihnojování apod.) — to si člověk pohlídá sám
- Styl: "Do března zastřihni okrasné trávy" — informační, ne otravné
- Frekvence: 1–3x ročně na rostlinu, max

### Rostliny — zaměření
- **Primárně**: středoevropské venkovní trvalky, okrasné trávy, keře, keříky, stromy, popínavé rostliny
- Cultivary a variety (např. Hydrangea macrophylla 'Annabelle', Miscanthus sinensis 'Gracillimus')
- Sekundárně: ovocné stromy, zelenina, pokojové rostliny
- Databáze: minimum 200 rostlin, fotky, česká + latinská jména, stručný popis

### Onboarding flow při přidání rostliny
1. Uživatel vybere rostlinu z databáze
2. App navrhne: "Pro tuto rostlinu doporučujeme:"
   - ☑ Zastřihnout do konce března (roční)
   - ☑ Přihnojit na jaře — duben (roční)
   - ☐ Zimní zábal — říjen (volitelné)
3. Uživatel zaškrtne co chce
4. Uloží → přidá se pin na mapu + akce do exportní fronty
5. Kdykoliv může exportovat vše zaškrtnuté do iCal

### Design
- **Super moderní mobilní-first UI**: čistý, vzdušný, hodně bílé + zemité zelené tóny
- Plant cards: fotka rostliny, česky + latinsky, badge kategorie
- Mapa: foto zahrady s piny, plynulé zoom + drag
- Žádný retro/zahradní kýč — Apple-level design quality
- Dark mode ready (do budoucna)

### Distribuce (roadmapa)
1. Web app (PWA) — rodinné testování bez nákladů ✅ (cloudflare tunnel)
2. Backend cloud (Fly.io/Railway) — přístup bez tunnelu, sdílení
3. iOS (Capacitor.js + TestFlight) — beta s rodinou
4. App Store — případný komerční launch

---

## Co je hotovo
- Databáze 85 rostlin s fotkami, českými popisy (commit f89484d)
- Pinch-to-zoom na mapě
- Drag & drop pinů
- iCal export úkolů (základní, nutno přepracovat dle vize výše)
- PWA manifest, přejmenování na GardenPin (commit d27c323)
- Thumbnail v autocomplete dropdownu
- Mobile-first design, hero banner, stat karty
- **Plant card redesign dle GardenPin design systému** (commit ae0cabe, merged 2026-04-27)

## Co je rozjednáno / čeká
- **Přepracovat iCal logiku**: care chips → roční opakování (vyžaduje úpravu serveru: `frequency_days: 365` se startem v daném měsíci)
- **Rozšířit DB**: okrasné trávy, keře (šeřík, hortenzie, pámelník...), stromy (jabloň, třešeň, magnólie...) — min 200 rostlin, cultivary
- Doplnit `PLANT_META` pro zbývajících 57 z 85 rostlin
- Aplikovat redesign i na HomePage / GardensPage / TasksPage (zatím jen detail rostliny)
- Backend deploy na fly.io/Railway (nutný pro mobilní přístup bez tunnelu)
- iOS Capacitor.js integrace (po cloud backendu)
- Touch eventy pro drag & drop (mouse-only, iOS breaking)

## Priorita pro příští session
1. Backend deploy na fly.io — přístup bez tunnelu (základ pro vše)
2. Care chips → roční opakování (úprava serveru)
3. Aplikovat redesign na HomePage / GardensPage / TasksPage
4. Rozšířit databázi: středoevropské keře, stromy, okrasné trávy + cultivary
5. Doplnit `PLANT_META` pro zbývajících 57 rostlin
6. Přidat GardenPin do patrikprikryl.com/projects sekce
