# Zahradní tracker — STATUS

## 2026-04-27 — GardenPin redesign aplikován na detail rostliny

### Co se změnilo

**Plant DB (`frontend/src/plantDatabase.js`)**
- Přidána funkce `getPlantCategory(id)` — mapuje ID rostliny na kategorii (zelenina / ovoce / bylinky / okrasné / cibuloviny / keře / trvalky) s ikonou a barvou.
- Přidán objekt `PLANT_META` s rozšířenými údaji (`zone`, `light`, `water`, `height`, `careActions`) pro 28 nejčastějších rostlin (rajče, paprika, okurka, salát, mrkev, jahodník, malina, borůvka, bazalka, tymián, rozmarýn, máta, levandule, růže, hortenzie, šeřík, pelargónie, slunečnice, tulipán, lilie, buxus, magnólie, bambus, hortenzie latnatá, flox, astilba, miscanthus, kosatec, echinacea).
- Pro plant ID, která meta nemají, se `light` a `water` odvodí ze stávajícího pole `sun`/`watering` (heuristika přes klíčová slova).
- `searchPlants()` a `findPlantByName()` nyní vrací rostliny obohacené o nová pole přes nový export `enrichPlant()`.
- Žádný plant entry není přepsán — meta žije v samostatném mapě, takže existující struktura zůstává netknutá.

**Komponenta `PlantAutocomplete.jsx` (přepsaná)**
- Nový design dropdown řádku: thumbnail s kategorickou ikonou, český název tučně, latinský name kurzívou, kategorie badge (forest green pill).
- `PlantInfoCard` přepsán dle GardenPin design specu:
  - Hero sekce 4:5 — fotka pinu pokud je, jinak placeholder s emoji a barvou kategorie.
  - Pillové badges nad názvem: kategorie (forest #2d5a27) + zóna (sand #f5f0e8).
  - Český název 22px/700 + latinský 14px/italic muted.
  - Statistický pruh na sand pozadí: Světlo / Zálivka / Výška, každá hodnota s ikonou + 10px uppercase labelem.
  - „Sezónní péče" sekce s interaktivními chips (checkbox + emoji + text + měsíc badge). Zaškrtnuté chips dostanou forest border + světle zelené pozadí.
  - Sticky CTA „+ Přidat do zahrady" — full width, forest, radius 12, badge `+N` ukazující součet pravidelných úkolů z DB + zaškrtnutých sezónních chips.
  - Nová sbalitelná sekce „Detaily pěstování" pro původní pole (půda, hnojení, řez, výsadba, poznámky) — méně dominantní, ale uchovává původní info.
- Při kliku na CTA se vytvoří POST `/api/tasks` jak pro pravidelné úkoly z `plant.tasks`, tak pro vybrané `careActions` (každá care action → jednorázový úkol s `specific_date` na 15. dne odpovídajícího měsíce, posunuto na příští rok pokud měsíc už uplynul).
- Existující kontrakt prop `pinId` + `onTasksCreated` zachován, takže `PinDetail.jsx` (volá kartu z `EditPinForm`) funguje bez změny.

**Globální téma (`frontend/src/styles.css`)**
- Nová tokenová sada doplněna ke stávající paletě: `--primary: #2d5a27`, `--sand: #f5f0e8`, `--sand-dark`, `--charcoal`, `--muted`.
- `--bg` změněno z `#f7f9f3` na čistou bílou.
- `--radius` zvětšen z 12 na 16 px (sjednocuje cards).
- `.btn` primární používá `var(--primary)` a radius 12; `.btn.secondary` přepnuto na sand pozadí.
- `.topbar` gradient lehce ztmaven (green-800 → green-700).
- `.bottom-nav a.active`, `.section-title`, `.stat-card .value`, `.task-complete-btn`, `.floating-fab` přepnuty na `var(--primary)`.
- `.tabs button.active` má teď solid forest pozadí + bílý text.
- `.badge` má větší typografii (uppercase, letter-spacing 0.5).
- `.task-item` a `.garden-card` zvětšen radius (14/16 px) + box-shadow.

### Build
- `npm run build` prošlo: 48 modulů, 11.82 kB CSS, 276 kB JS, 1.42 s.
- Build artefakty uloženy v `backend/public/` (existující workflow).

### Co NENÍ změněno
- Backend (`backend/server.js`, schema DB, iCal export, upscale).
- Logika map a draggable pinů (`GardenDetailPage.jsx`).
- API kontrakt — používají se existující endpointy `/api/tasks`.

### Známé limity / další kroky
- Care chips se zatím ukládají jako jednorázové úkoly s `task_type: 'jine'` na 15. dne měsíce — ideálně by měly být roční opakování (`frequency_days: 365` se startem v daném měsíci), aby se připomínaly i následující rok. To by ale vyžadovalo úpravu serveru, kterou jsem zámerně neprováděl.
- Rozšířená meta je pouze pro 28 rostlin; zbývajících 57 dostává odvozené hodnoty z heuristik. Pokud chceš, doplním další.
- Ostatní stránky (HomePage, GardensPage, TasksPage) si stále drží stávající rendr — nový design se týká primárně detailu rostliny a celkového barevného laděnání.
