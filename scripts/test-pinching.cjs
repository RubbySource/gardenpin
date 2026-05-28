// Sanity test pro „Pinčování letniček + Chelsea chop strukturních trvalek".
// pinching.js importuje RecommendedTasks.jsx (React/JSX) → nejde načíst v čistém node,
// proto REPLIKUJEME pure logiku (stejně jako test-strawberry-renewal / test-fruit-netting).
// Replika je věrná pinching.js a je now-aware (deterministické testy).
// Matchování PINCHING_GENERA / PINCHING_SPECIES běží proti REÁLNÉ plantDatabase načtené
// dynamickým importem → ověří, že kurátorská mapa sedí na skutečná data (žádné mrtvé klíče)
// a že kolize rodů (Sedum, Tagetes, Salvia) i mimo-gate kategorie jsou vyřazené.
// dateForMonth/getConditionShiftDays = věrná replika; getZoneOffsetDays importujeme
// z reálného climateZones.js (jeden zdroj pravdy pro posun klim. zóny).
// Spuštění: node scripts/test-pinching.cjs
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

// ---------- replika pure logiky (pinching.js) ----------
const PINCHING_HORIZON_DAYS = 60;
const PINCHING_EMOJI = '✂️';
const PINCHING_TYPES = {
  chelseaChop: { month: 5 },
  annualPinch: { month: 6 },
};
const PINCHING_CATEGORIES = new Set(['letnicky', 'trvalky', 'bylinky']);
const PINCHING_GENERA = {
  Phlox: 'chelseaChop',
  Rudbeckia: 'chelseaChop',
  Echinacea: 'chelseaChop',
  Petunia: 'annualPinch',
  Zinnia: 'annualPinch',
  Ocimum: 'annualPinch',
};
const PINCHING_SPECIES = {
  'Sedum spectabile': 'chelseaChop',
  'Tagetes erecta': 'annualPinch',
};

function categoryKey(plant) {
  const c = plant && plant.category;
  if (!c) return null;
  return typeof c === 'string' ? c : c.key || null;
}
function genusOf(plant) {
  const lat = String((plant && plant.nameLat) || '').trim();
  return lat ? lat.split(/\s+/)[0] || null : null;
}
function pinchingRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (!cat || !PINCHING_CATEGORIES.has(cat)) return null;
  const lat = String((plant && plant.nameLat) || '').trim();
  for (const sp in PINCHING_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return { type: PINCHING_SPECIES[sp] };
  }
  const genus = genusOf(plant);
  if (genus && PINCHING_GENERA[genus]) return { type: PINCHING_GENERA[genus] };
  return null;
}
function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}
function daysFromToday(dateStr, now) {
  if (!dateStr) return null;
  const today = new Date(now.getTime());
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}
function hasPinchingInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    const title = (e.title || '').trim();
    if (/pinč|vyštíp|zaštíp|Chelsea/i.test(title)) return true;
  }
  return false;
}

(async () => {
  const cz = await imp('frontend/src/data/climateZones.js');
  const { getZoneOffsetDays } = cz;

  // getConditionShiftDays + dateForMonth — věrná replika RecommendedTasks.jsx (now-aware).
  function getConditionShiftDays(conditions) {
    if (!conditions) return 0;
    let shift = 0;
    shift += getZoneOffsetDays(conditions.climate_zone);
    if (conditions.exposure === 'N') shift += 14;
    if (conditions.exposure === 'S') shift -= 7;
    if (typeof conditions.altitude_m === 'number') {
      if (conditions.altitude_m >= 600) shift += 14;
      else if (conditions.altitude_m >= 400) shift += 7;
      else if (conditions.altitude_m <= 200) shift -= 7;
    }
    return Math.max(-21, Math.min(21, shift));
  }
  function dateForMonth(month, conditions, now) {
    const year = month >= now.getMonth() + 1 ? now.getFullYear() : now.getFullYear() + 1;
    const d = new Date(year, month - 1, 15);
    d.setDate(d.getDate() + getConditionShiftDays(conditions));
    return d.toISOString().slice(0, 10);
  }
  function pinchingForPin(pin, plant, conditions, now) {
    if (!pin || !plant) return [];
    const rule = pinchingRuleForPlant(plant);
    if (!rule) return [];
    const typeDef = PINCHING_TYPES[rule.type];
    if (!typeDef) return [];
    const suggested = dateForMonth(typeDef.month, conditions, now);
    const due = daysFromToday(suggested, now);
    if (due === null || due < 0 || due > PINCHING_HORIZON_DAYS) return [];
    const m = monthFromIso(suggested);
    if (hasPinchingInMonth(pin.tasks || [], m, now.getFullYear())) return [];
    return [{
      kind: 'pinching', type: rule.type, month: m, suggested, due,
      taskType: 'jine', emoji: PINCHING_EMOJI,
    }];
  }

  // ---------- (1) Matchování map proti REÁLNÉ DB ----------
  const db = await imp('frontend/src/plantDatabase.js');
  const enriched = db.PLANT_DATABASE.map(db.enrichPlant);
  const byCz = (name) => enriched.find((p) => p.nameCz === name);
  const byLat = (lat) => enriched.find((p) => p.nameLat === lat);
  const ruleCz = (name) => pinchingRuleForPlant(byCz(name));
  const typeCz = (name) => { const r = ruleCz(name); return r && r.type; };

  // --- chelseaChop přes ROD ---
  // Phlox — v DB jen Phlox paniculata a kultivary 'David'/'Bright Eyes' (všechny ornamental/trvalky)
  ok(typeCz('Flox latnatý') === 'chelseaChop', 'Phlox paniculata (trvalky) → chelseaChop');
  ok(typeCz('Plamenka David') === 'chelseaChop', "Phlox paniculata 'David' (trvalky) → chelseaChop přes rod");
  ok(typeCz('Plamenka Bright Eyes') === 'chelseaChop', "Phlox paniculata 'Bright Eyes' (trvalky) → chelseaChop přes rod");
  // Rudbeckia — 4 ks v DB (fulgida/hirta/'Cherry Brandy'/'Goldsturm')
  ok(typeCz('Třapatka Goldsturm') === 'chelseaChop', "Rudbeckia fulgida 'Goldsturm' (trvalky) → chelseaChop");
  ok(typeCz('Třapatka srstnatá') === 'chelseaChop', 'Rudbeckia hirta (trvalky) → chelseaChop');
  ok(typeCz('Třapatka Cherry Brandy') === 'chelseaChop', "Rudbeckia 'Cherry Brandy' (trvalky) → chelseaChop");
  ok(typeCz('Třapatka zářivá') === 'chelseaChop', 'Rudbeckia fulgida (trvalky) → chelseaChop');
  // Echinacea — 2 ks v DB (purpurea v id 84 i 253)
  ok(typeCz('Echinacea (třapatka)') === 'chelseaChop', 'Echinacea purpurea (id 84, trvalky) → chelseaChop');
  ok(typeCz('Třapatka nachová') === 'chelseaChop', 'Echinacea purpurea (id 253, trvalky) → chelseaChop');

  // --- chelseaChop přes SPECIES (Sedum spectabile) — rod Sedum NENÍ v GENERA ---
  ok(typeCz('Rozchodník nádherný') === 'chelseaChop', 'Sedum spectabile (trvalky) → chelseaChop přes species precedence');
  // Sedum 'Herbstfreude' (rod Sedum bez druhu) — species marker nesedí, rod Sedum v GENERA NENÍ → null
  ok(ruleCz('Rozchodník Herbstfreude') === null,
    "Sedum 'Herbstfreude' (trvalky, kultivar bez druhu) → null (rod Sedum mimo GENERA, species nesedí)");
  // Plazivé Sedum (sukulenty) — mimo gate trvalky/letnicky/bylinky → null
  ok(ruleCz('Rozchodník bílý') === null, 'Sedum album (sukulenty, plazivý) → null (mimo gate)');
  ok(ruleCz('Rozchodník španělský') === null, 'Sedum hispanicum (sukulenty, plazivý) → null (mimo gate)');

  // --- annualPinch přes ROD ---
  // Pozn.: Pole má dva záznamy „Petúnie" — id 50 (range fallback → 'okrasne', mimo gate → null)
  // i id 265 s `category: 'annuals'` (→ key 'letnicky', v gate → annualPinch). To je očekávané —
  // gate je striktní a id 50 jako legacy záznam v okrasné kategorii nepatří do téhle vrstvy.
  ok(byLat('Petunia x hybrida') !== undefined && pinchingRuleForPlant(byLat('Petunia x hybrida')).type === 'annualPinch',
    'Petunia x hybrida (id 265, letnicky) → annualPinch');
  ok(typeCz('Surfinie') === 'annualPinch', "Petunia 'Surfinia' (id 267, letnicky) → annualPinch přes rod");
  ok(typeCz('Zinia') === 'annualPinch', 'Zinnia elegans (letnicky) → annualPinch');
  ok(typeCz('Bazalka') === 'annualPinch', 'Ocimum basilicum (bylinky) → annualPinch (gate bylinky)');

  // --- annualPinch přes SPECIES (Tagetes erecta) — rod Tagetes NENÍ v GENERA ---
  ok(typeCz('Aksamitník vzpřímený') === 'annualPinch', 'Tagetes erecta (letnicky) → annualPinch přes species precedence');

  // --- Salvia: rod NENÍ v GENERA → null pro všechny (v DB jsou rosmarinus/officinalis/nemorosa) ---
  ok(ruleCz('Rozmarýn') === null, 'Salvia rosmarinus (bylinky, dřevitý keřík) → null (rod Salvia mimo GENERA)');
  ok(ruleCz('Šalvěj lékařská') === null, 'Salvia officinalis (bylinky) → null (rod Salvia mimo GENERA)');
  ok(ruleCz('Šalvěj hajní') === null, 'Salvia nemorosa (trvalky) → null (rod Salvia mimo GENERA — sestřih po odkvětu, ne pinč vrcholu)');
  ok(ruleCz('Šalvěj Caradonna') === null, "Salvia nemorosa 'Caradonna' (trvalky) → null (rod Salvia mimo GENERA)");
  ok(ruleCz('Šalvěj Mainacht') === null, "Salvia nemorosa 'Mainacht' (trvalky) → null (rod Salvia mimo GENERA)");

  // --- Vyřazené kategorie / rody ---
  ok(ruleCz('Jabloň') === null, 'jabloň (stromy) → null (mimo gate)');
  ok(ruleCz('Třešeň') === null, 'třešeň (Prunus avium, stromy) → null (mimo gate)');
  ok(ruleCz('Tulipán') === null, 'tulipán (cibuloviny) → null (mimo gate)');
  ok(ruleCz('Rajče') === null, 'rajče (zelenina) → null (mimo gate)');
  ok(ruleCz('Bohyška Halcyon') === null, "Hosta 'Halcyon' (trvalky) → null (rod Hosta mimo mapu — nepinčuje se)");
  ok(ruleCz('Šanta Faassenova') === null, 'Nepeta x faassenii (trvalky) → null (rod Nepeta mimo mapu)');
  ok(ruleCz('Slunečnice') === null, 'Helianthus annuus (letnicky, ID 47 → okrasné, ne letnicky-key) → null (rod Helianthus mimo GENERA)');
  ok(ruleCz('Topinambur') === null, 'Helianthus tuberosus (zelenina) → null (mimo gate)');

  // synthetic — mimo gate kategorie přímo
  ok(pinchingRuleForPlant({ category: { key: 'zelenina' }, nameLat: 'Petunia' }) === null,
    'Petunia v zelenině → null (mimo gate)');
  ok(pinchingRuleForPlant({ category: { key: 'kere' }, nameLat: 'Phlox paniculata' }) === null,
    'Phlox v keřích → null (mimo gate)');
  ok(pinchingRuleForPlant({ category: { key: 'okrasne' }, nameLat: 'Tagetes erecta' }) === null,
    'Tagetes erecta v okrasne → null (mimo gate — jen letnicky/trvalky/bylinky)');
  ok(pinchingRuleForPlant({ category: { key: 'sukulenty' }, nameLat: 'Sedum spectabile' }) === null,
    'Sedum spectabile v sukulenty (umělý — reálně je v trvalky) → null (mimo gate)');
  ok(pinchingRuleForPlant(null) === null, 'bez rostliny → null');
  ok(pinchingRuleForPlant({ category: null, nameLat: 'Petunia' }) === null, 'bez kategorie → null');
  ok(pinchingRuleForPlant({ category: { key: 'letnicky' }, nameLat: '' }) === null,
    'prázdný nameLat → null (rod neurčen)');

  // gate akceptuje i holý string kategorie
  ok((pinchingRuleForPlant({ category: 'letnicky', nameLat: 'Petunia hybrida' }) || {}).type === 'annualPinch',
    'holý string category=letnicky + Petunia → annualPinch');
  ok((pinchingRuleForPlant({ category: 'trvalky', nameLat: 'Phlox paniculata' }) || {}).type === 'chelseaChop',
    'holý string category=trvalky + Phlox → chelseaChop');
  ok((pinchingRuleForPlant({ category: 'bylinky', nameLat: 'Ocimum basilicum' }) || {}).type === 'annualPinch',
    'holý string category=bylinky + Ocimum → annualPinch');

  // forward-looking druhy přes ROD (Phlox subulata by chytil přes rod — ALE Phlox subulata v DB
  // není a my chceme jen typové ověření: kdyby plazivý Phlox subulata někdy přibyl, dostane
  // chelseaChop přes rod → over-suggestion, ale neškodná; zde stačí test, že rodový match funguje)
  ok((pinchingRuleForPlant({ category: 'trvalky', nameLat: 'Phlox paniculata Eva Cullum' }) || {}).type === 'chelseaChop',
    'forward-looking Phlox paniculata kultivar přes rod → chelseaChop');

  // integrita: žádný mrtvý klíč mapy
  //   - každý ROD v PINCHING_GENERA musí v DB v gate odpovídat ≥1 rostlině
  //   - každý DRUH v PINCHING_SPECIES musí v DB v gate odpovídat ≥1 rostlině
  const inGate = (p) => PINCHING_CATEGORIES.has(p.category.key);
  const generaInGate = new Set(enriched.filter(inGate).map(genusOf));
  for (const g of Object.keys(PINCHING_GENERA)) {
    ok(generaInGate.has(g), `PINCHING_GENERA: rod ${g} je v DB v gate (letnicky/trvalky/bylinky) — žádný mrtvý klíč`);
  }
  for (const sp of Object.keys(PINCHING_SPECIES)) {
    const found = enriched.filter(inGate).some((p) => {
      const lat = String(p.nameLat || '').trim();
      return lat === sp || lat.startsWith(`${sp} `);
    });
    ok(found, `PINCHING_SPECIES: druh ${sp} je v DB v gate — žádný mrtvý klíč`);
  }

  // ---------- (2) Logika pinchingForPin (now-aware) ----------
  const pin = (tasks) => ({ id: 1, tasks: tasks || [] });
  const petunia = { category: { key: 'letnicky' }, nameLat: 'Petunia hybrida' };   // annualPinch, měsíc 6
  const phlox = { category: { key: 'trvalky' }, nameLat: 'Phlox paniculata' };     // chelseaChop, měsíc 5

  // chelseaChop (5)
  {
    const r = pinchingForPin(pin(), phlox, null, new Date(2030, 3, 20)); // konec dubna → květen
    ok(r.length === 1 && r[0].kind === 'pinching', 'konec dubna: Phlox → návrh chelseaChop');
    ok(r[0].type === 'chelseaChop' && r[0].month === 5, 'chelseaChop měsíc 5');
    ok(r[0].taskType === 'jine' && r[0].emoji === '✂️', 'task_type jine, emoji ✂️');
    ok(r[0].due >= 0 && r[0].due <= PINCHING_HORIZON_DAYS, 'okno v budoucnu a v horizontu');
  }
  {
    const r = pinchingForPin(pin(), phlox, null, new Date(2030, 4, 1)); // začátek května → svítí
    ok(r.length === 1 && r[0].month === 5, 'začátek května: Phlox → návrh svítí');
  }
  // pozdní květen (po 15.) → [] (nikdy do minulosti)
  ok(pinchingForPin(pin(), phlox, null, new Date(2030, 4, 20)).length === 0,
    'pozdní květen: Phlox okno (15.) minulo → [] (nikdy do minulosti)');

  // annualPinch (6)
  {
    const r = pinchingForPin(pin(), petunia, null, new Date(2030, 4, 1)); // začátek května → červen
    ok(r.length === 1 && r[0].type === 'annualPinch' && r[0].month === 6,
      'začátek května: Petunia → návrh annualPinch (červen)');
  }
  ok(pinchingForPin(pin(), petunia, null, new Date(2030, 5, 20)).length === 0,
    'pozdní červen: Petunia okno (15.) minulo → [] (nikdy do minulosti)');

  // mimo horizont → skryto
  ok(pinchingForPin(pin(), phlox, null, new Date(2030, 0, 15)).length === 0,
    'leden: květnové okno >60 dní → skryto');
  ok(pinchingForPin(pin(), phlox, null, new Date(2030, 1, 1)).length === 0,
    'únor: květnové okno >60 dní → skryto');
  ok(pinchingForPin(pin(), phlox, null, new Date(2030, 6, 15)).length === 0,
    'červenec: květnové okno minulo → příští rok >60 dní → skryto');
  ok(pinchingForPin(pin(), petunia, null, new Date(2030, 9, 1)).length === 0,
    'říjen: příští rok červen >60 dní → skryto');

  // ---------- (3) Posun klim. zóny / expozice ----------
  {
    const base = pinchingForPin(pin(), phlox, null, new Date(2030, 3, 20))[0];
    const north = pinchingForPin(pin(), phlox, { exposure: 'N' }, new Date(2030, 3, 20))[0];
    ok(north.suggested > base.suggested, 'severní expozice → pozdější pinčování');
    ok(getZoneOffsetDays('JHC') !== 0, 'climateZones: JHC má nenulový posun (kotva pro zónu)');
    const jhc = pinchingForPin(pin(), phlox, { climate_zone: 'JHC' }, new Date(2030, 3, 20))[0];
    ok(jhc.suggested > base.suggested, 'klim. zóna JHC (chladnější) → pozdější pinčování');
    const south = pinchingForPin(pin(), phlox, { exposure: 'S' }, new Date(2030, 3, 20))[0];
    ok(south.suggested < base.suggested, 'jižní expozice → dřívější pinčování');
  }

  // ---------- (4) Dedup proti existujícímu pinčování v měsíci ----------
  {
    const now = new Date(2030, 3, 20); // květnové okno (chelseaChop)
    const y = now.getFullYear();
    // slovesný titulek, který vrstva sama vytvoří — obsahuje „Vyštíp" jako podřetězec
    const vysip = [{ title: '✂️ Vyštípnout vrchol Flox latnatý', task_type: 'jine', specific_date: `${y}-05-12` }];
    ok(pinchingForPin(pin(vysip), phlox, null, now).length === 0,
      'dedup: titulek „Vyštípnout" v květnu → potlačeno (zachytí „vyštíp")');
    const pinc = [{ title: 'Pinčování floxu', task_type: 'jine', specific_date: `${y}-05-10` }];
    ok(pinchingForPin(pin(pinc), phlox, null, now).length === 0,
      'dedup: titulek „pinč" v květnu → potlačeno');
    const chelsea = [{ title: 'Chelsea chop', task_type: 'jine', specific_date: `${y}-05-08` }];
    ok(pinchingForPin(pin(chelsea), phlox, null, now).length === 0,
      'dedup: titulek „Chelsea" v květnu → potlačeno (anglický termín, jazyková pojistka pro EN/DE/PL/SK)');
    const zastip = [{ title: 'Zaštípnutí vrcholu', task_type: 'jine', specific_date: `${y}-05-08` }];
    ok(pinchingForPin(pin(zastip), phlox, null, now).length === 0,
      'dedup: titulek „zaštíp" v květnu → potlačeno (alternativa)');
    // jiný „jine" úkol bez markeru NEpotlačí (jiný měsíc, jiný úkon)
    const otherJine = [{ title: '🌾 Mulčování', task_type: 'jine', specific_date: `${y}-05-10` }];
    ok(pinchingForPin(pin(otherJine), phlox, null, now).length === 1,
      'dedup: jiný „jine" úkol bez markeru v květnu → návrh svítí');
    // task_type strihani v cílovém měsíci bez markeru titulku NEpotlačí (task_type jine je obecný)
    const otherStrihani = [{ title: 'Sestřih trvalek', task_type: 'strihani', specific_date: `${y}-05-08` }];
    ok(pinchingForPin(pin(otherStrihani), phlox, null, now).length === 1,
      'dedup: strihani v květnu bez markeru titulku → návrh svítí (task_type jine se nepoužívá)');
    // pinč v jiném měsíci nevadí
    const otherMonth = [{ title: 'Pinčování', task_type: 'jine', specific_date: `${y}-08-10` }];
    ok(pinchingForPin(pin(otherMonth), phlox, null, now).length === 1,
      'dedup: pinčování v JINÉM měsíci nevadí → návrh svítí');
    // loňské pinčování (jednorázové) ve stejném měsíci nevadí
    const lastYear = [{ title: 'Pinčování', task_type: 'jine', specific_date: `${y - 1}-05-12` }];
    ok(pinchingForPin(pin(lastYear), phlox, null, now).length === 1,
      'dedup: loňské pinčování v květnu (jednorázové) → návrh svítí');
    // opakovaný úkol (frequency_days) ve stejném měsíci potlačí bez ohledu na rok
    const repeating = [{ title: 'Pinčování', task_type: 'jine', next_due: `2099-05-01`, frequency_days: 365 }];
    ok(pinchingForPin(pin(repeating), phlox, null, now).length === 0,
      'dedup: opakovaný úkol s markerem v květnu → potlačeno (bez ohledu na rok)');
  }

  // ---------- (5) Chybějící vstup ----------
  ok(pinchingForPin(null, phlox, null, new Date(2030, 3, 20)).length === 0, 'bez pinu → []');
  ok(pinchingForPin(pin(), null, null, new Date(2030, 3, 20)).length === 0, 'bez rostliny → []');

  console.log(`\n✅ All ${passed} pinching assertions passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
