// Sanity test pro „Jarní mulčování trvalek a dřevin".
// springMulching.js importuje RecommendedTasks.jsx (React/JSX) → nejde načíst v čistém node,
// proto REPLIKUJEME pure logiku (stejně jako test-pinching / test-strawberry-renewal).
// Replika je věrná springMulching.js a je now-aware (deterministické testy).
// Matchování SPRING_MULCH_CATEGORIES / SPRING_MULCH_GENERA_EXCLUDE /
// SPRING_MULCH_SPECIES_EXCLUDE běží proti REÁLNÉ plantDatabase načtené dynamickým importem
// → ověří, že kurátorské EXCLUSIONS sedí na skutečná data a mimo-gate kategorie jsou vyřazené.
// dateForMonth/getConditionShiftDays = věrná replika; getZoneOffsetDays importujeme
// z reálného climateZones.js (jeden zdroj pravdy pro posun klim. zóny).
// Spuštění: node scripts/test-spring-mulching.cjs
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

// ---------- replika pure logiky (springMulching.js) ----------
const SPRING_MULCH_HORIZON_DAYS = 60;
const SPRING_MULCH_EMOJI = '🌿';
const SPRING_MULCH_TYPES = {
  perennial: { month: 4 },
  woody: { month: 5 },
};
const SPRING_MULCH_CATEGORIES = new Set([
  'trvalky', 'letnicky', 'kere', 'stromy', 'ovoce', 'popinave',
]);
const CATEGORY_TYPE = {
  trvalky: 'perennial',
  letnicky: 'perennial',
  kere: 'woody',
  stromy: 'woody',
  ovoce: 'woody',
  popinave: 'woody',
};
const SPRING_MULCH_GENERA_EXCLUDE = new Set([
  'Helleborus', 'Lavandula', 'Thymus', 'Origanum', 'Fragaria',
]);
const SPRING_MULCH_SPECIES_EXCLUDE = new Set([
  'Iris germanica', 'Salvia officinalis', 'Salvia rosmarinus',
]);

function categoryKey(plant) {
  const c = plant && plant.category;
  if (!c) return null;
  return typeof c === 'string' ? c : c.key || null;
}
function genusOf(plant) {
  const lat = String((plant && plant.nameLat) || '').trim();
  return lat ? lat.split(/\s+/)[0] || null : null;
}
function matchesSpecies(plant, set) {
  const lat = String((plant && plant.nameLat) || '').trim();
  if (!lat) return false;
  for (const sp of set) {
    if (lat === sp || lat.startsWith(`${sp} `)) return true;
  }
  return false;
}
function springMulchingRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (!cat || !SPRING_MULCH_CATEGORIES.has(cat)) return null;
  if (matchesSpecies(plant, SPRING_MULCH_SPECIES_EXCLUDE)) return null;
  const genus = genusOf(plant);
  if (genus && SPRING_MULCH_GENERA_EXCLUDE.has(genus)) return null;
  const type = CATEGORY_TYPE[cat];
  return type ? { type } : null;
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
function hasSpringMulchingInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    const title = (e.title || '').trim();
    if (/mulč|mulch|kůr|štěpk/i.test(title)) return true;
  }
  return false;
}

(async () => {
  const cz = await imp('frontend/src/data/climateZones.js');
  const { getZoneOffsetDays } = cz;

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
  function springMulchingForPin(pin, plant, conditions, now) {
    if (!pin || !plant) return [];
    const rule = springMulchingRuleForPlant(plant);
    if (!rule) return [];
    const typeDef = SPRING_MULCH_TYPES[rule.type];
    if (!typeDef) return [];
    const suggested = dateForMonth(typeDef.month, conditions, now);
    const due = daysFromToday(suggested, now);
    if (due === null || due < 0 || due > SPRING_MULCH_HORIZON_DAYS) return [];
    const m = monthFromIso(suggested);
    if (hasSpringMulchingInMonth(pin.tasks || [], m, now.getFullYear())) return [];
    return [{
      kind: 'springMulching', type: rule.type, month: m, suggested, due,
      taskType: 'jine', emoji: SPRING_MULCH_EMOJI,
    }];
  }

  // ---------- (1) Matchování gate + exclusions proti REÁLNÉ DB ----------
  const db = await imp('frontend/src/plantDatabase.js');
  const enriched = db.PLANT_DATABASE.map(db.enrichPlant);
  const byCz = (name) => enriched.find((p) => p.nameCz === name);
  const ruleCz = (name) => springMulchingRuleForPlant(byCz(name));
  const typeCz = (name) => { const r = ruleCz(name); return r && r.type; };

  // --- V gate (návrh svítí) ---
  ok(typeCz('Jabloň') === 'woody', 'jabloň (stromy) → woody');
  ok(typeCz('Třešeň') === 'woody', 'třešeň (stromy) → woody');
  ok(typeCz('Bohyška Halcyon') === 'perennial', "Hosta 'Halcyon' (trvalky) → perennial");
  ok(typeCz('Šanta Faassenova') === 'perennial', 'Nepeta x faassenii (trvalky) → perennial');
  ok(typeCz('Flox latnatý') === 'perennial', 'Phlox paniculata (trvalky) → perennial');
  ok(typeCz('Třapatka Goldsturm') === 'perennial', "Rudbeckia 'Goldsturm' (trvalky) → perennial");
  ok(ruleCz('Jahodník') === null, 'jahodník Fragaria (ovoce) → null přes rod exclusion (řeší specifická vrstva strawberryStrawing.js — sláma, ne kůra)');
  ok(typeCz('Plamének Jackmanii') === 'woody', "Clematis 'Jackmanii' (popinave) → woody");
  ok(typeCz('Zimolez kozí list') === 'woody', 'Lonicera periclymenum (popinave) → woody');
  ok(typeCz('Šalvěj hajní') === 'perennial', 'Salvia nemorosa (trvalky, NE „officinalis"/„rosmarinus") → perennial');

  // --- EXCLUSIONS přes ROD ---
  ok(ruleCz('Čemeřice (Helleborus)') === null, 'Helleborus (trvalky) → null přes rod exclusion (kořenový krček hnije)');

  // --- EXCLUSIONS přes SPECIES (přednost před rodem) ---
  ok(ruleCz('Kosatec německý') === null, 'Iris germanica (trvalky/ornamental) → null přes species exclusion (oddenek musí být na slunci)');
  ok(ruleCz('Kosatec (Iris)') === null, 'Iris germanica (id 77, trvalky range) → null přes species exclusion');
  // Iris sibirica jako ROD Iris NENÍ v exclusions → projde
  ok(typeCz('Kosatec sibiřský') === 'perennial', 'Iris sibirica (trvalky/ornamental) → perennial (ROD Iris NENÍ v exclusions, jen SPECIES germanica)');

  // --- Mimo gate (různé kategorie) ---
  ok(ruleCz('Rajče') === null, 'rajče (zelenina) → null (mimo gate — zelenina má vlastní mulč scope)');
  ok(ruleCz('Tulipán') === null, 'tulipán (cibuloviny) → null (mulč by zarazil jarní cibuloviny)');
  ok(ruleCz('Bazalka') === null, 'bazalka Ocimum (bylinky) → null (mimo gate; aromatické bylinky se nemulčují)');
  ok(ruleCz('Levandule') === null, 'Lavandula (bylinky) → null mimo gate (i kdyby přestoupila do trvalky/kere, exclusion zafunguje)');
  ok(ruleCz('Tymián') === null, 'Thymus (bylinky) → null mimo gate');
  ok(ruleCz('Šalvěj lékařská') === null, 'Salvia officinalis (bylinky) → null mimo gate (i SPECIES forward-looking)');
  ok(ruleCz('Rozmarýn') === null, 'Salvia rosmarinus (bylinky) → null mimo gate (i SPECIES forward-looking)');
  ok(ruleCz('Netřesk střešní') === null, 'Sempervivum (sukulenty) → null (mulč suchomilné hnije)');
  ok(ruleCz('Rozchodník bílý') === null, 'Sedum album (sukulenty) → null (mimo gate)');
  ok(ruleCz('Kostřava sivá') === null, 'Festuca glauca (travy) → null (mimo gate; trávy nemulčujeme)');
  ok(ruleCz('Kavyl něžný') === null, 'Stipa tenuissima (travy) → null (mimo gate)');
  ok(ruleCz('Kosatec žlutý') === null, 'Iris pseudacorus (vodni) → null (mimo gate)');

  // --- synthetic — mimo gate kategorie přímo + hraniční vstupy ---
  ok(springMulchingRuleForPlant({ category: { key: 'zelenina' }, nameLat: 'Hosta' }) === null,
    'Hosta v zelenině → null (mimo gate)');
  ok(springMulchingRuleForPlant({ category: { key: 'sukulenty' }, nameLat: 'Rosa canina' }) === null,
    'Rosa v sukulenty → null (mimo gate)');
  ok(springMulchingRuleForPlant(null) === null, 'bez rostliny → null');
  ok(springMulchingRuleForPlant({ category: null, nameLat: 'Rosa' }) === null, 'bez kategorie → null');
  // Prázdný nameLat + category v gate → návrh přes kategorii (žádný rod/druh k exclude),
  // mulčování je generická akce → bezpečně proběhne. Odlišení od pinching, kde se vyžaduje rod.
  ok((springMulchingRuleForPlant({ category: { key: 'trvalky' }, nameLat: '' }) || {}).type === 'perennial',
    'prázdný nameLat + category trvalky → perennial (generická akce, gate stačí)');

  // gate akceptuje i holý string kategorie
  ok((springMulchingRuleForPlant({ category: 'trvalky', nameLat: 'Hosta sieboldiana' }) || {}).type === 'perennial',
    'holý string category=trvalky + Hosta → perennial');
  ok((springMulchingRuleForPlant({ category: 'kere', nameLat: 'Rhododendron' }) || {}).type === 'woody',
    'holý string category=kere + Rhododendron → woody');
  ok((springMulchingRuleForPlant({ category: 'stromy', nameLat: 'Malus domestica' }) || {}).type === 'woody',
    'holý string category=stromy + jabloň → woody');
  ok(springMulchingRuleForPlant({ category: 'ovoce', nameLat: 'Fragaria vesca' }) === null,
    'holý string category=ovoce + jahodník → null přes rod exclusion (řeší strawberryStrawing.js)');
  ok((springMulchingRuleForPlant({ category: 'ovoce', nameLat: 'Malus sylvestris' }) || {}).type === 'woody',
    'holý string category=ovoce + jabloň lesní (rod Malus, NE Fragaria) → woody (gate kategorie)');
  ok((springMulchingRuleForPlant({ category: 'popinave', nameLat: 'Clematis viticella' }) || {}).type === 'woody',
    'holý string category=popinave + Clematis → woody');
  ok((springMulchingRuleForPlant({ category: 'letnicky', nameLat: 'Petunia hybrida' }) || {}).type === 'perennial',
    'holý string category=letnicky + Petunia → perennial');

  // forward-looking druh přes ROD (kdyby Lavandula přibyla do trvalek, exclusion zafunguje)
  ok(springMulchingRuleForPlant({ category: 'trvalky', nameLat: 'Lavandula angustifolia' }) === null,
    'forward-looking: Lavandula v trvalkách → null přes rod exclusion');
  ok(springMulchingRuleForPlant({ category: 'kere', nameLat: 'Lavandula stoechas' }) === null,
    'forward-looking: Lavandula v keřích → null přes rod exclusion');
  ok(springMulchingRuleForPlant({ category: 'trvalky', nameLat: 'Thymus serpyllum' }) === null,
    'forward-looking: Thymus v trvalkách → null přes rod exclusion');
  ok(springMulchingRuleForPlant({ category: 'trvalky', nameLat: 'Origanum vulgare' }) === null,
    'forward-looking: Origanum v trvalkách → null přes rod exclusion');
  ok(springMulchingRuleForPlant({ category: 'trvalky', nameLat: 'Salvia officinalis' }) === null,
    'forward-looking: Salvia officinalis v trvalkách → null přes species exclusion');
  ok(springMulchingRuleForPlant({ category: 'kere', nameLat: 'Salvia rosmarinus' }) === null,
    'forward-looking: Salvia rosmarinus v keřích → null přes species exclusion');
  // ALE Salvia nemorosa (jiný druh) v trvalkách → projde (rod Salvia NENÍ v rod exclusions, jen SPECIES)
  ok((springMulchingRuleForPlant({ category: 'trvalky', nameLat: 'Salvia nemorosa Caradonna' }) || {}).type === 'perennial',
    'Salvia nemorosa (trvalka) → perennial (rod Salvia NENÍ v exclusions, jen druhy officinalis/rosmarinus)');

  // integrita: žádný mrtvý klíč mapy
  //   - každý ROD v SPRING_MULCH_GENERA_EXCLUDE musí v DB odpovídat ≥1 rostlině (kdekoli, ne nutně v gate;
  //     exclusions jsou často forward-looking pro budoucí migraci kategorie)
  //   - každý DRUH v SPRING_MULCH_SPECIES_EXCLUDE musí v DB odpovídat ≥1 rostlině (kdekoli)
  const allGenera = new Set(enriched.map(genusOf));
  for (const g of SPRING_MULCH_GENERA_EXCLUDE) {
    ok(allGenera.has(g), `SPRING_MULCH_GENERA_EXCLUDE: rod ${g} je v DB (žádný mrtvý klíč; forward-looking přijatelné)`);
  }
  for (const sp of SPRING_MULCH_SPECIES_EXCLUDE) {
    const found = enriched.some((p) => {
      const lat = String(p.nameLat || '').trim();
      return lat === sp || lat.startsWith(`${sp} `);
    });
    ok(found, `SPRING_MULCH_SPECIES_EXCLUDE: druh ${sp} je v DB (žádný mrtvý klíč; forward-looking přijatelné)`);
  }

  // ---------- (2) Logika springMulchingForPin (now-aware) ----------
  const pin = (tasks) => ({ id: 1, tasks: tasks || [] });
  const hosta = { category: { key: 'trvalky' }, nameLat: 'Hosta sieboldiana' };     // perennial, měsíc 4
  const apple = { category: { key: 'stromy' }, nameLat: 'Malus domestica' };        // woody, měsíc 5
  const helleborus = { category: { key: 'trvalky' }, nameLat: 'Helleborus' };       // null (exclusion)
  const irisG = { category: { key: 'trvalky' }, nameLat: 'Iris germanica' };        // null (species exclusion)
  const irisS = { category: { key: 'trvalky' }, nameLat: 'Iris sibirica' };         // perennial

  // perennial (4)
  {
    const r = springMulchingForPin(pin(), hosta, null, new Date(2030, 2, 20)); // konec března → duben
    ok(r.length === 1 && r[0].kind === 'springMulching', 'konec března: Hosta → návrh perennial');
    ok(r[0].type === 'perennial' && r[0].month === 4, 'perennial měsíc 4');
    ok(r[0].taskType === 'jine' && r[0].emoji === '🌿', 'task_type jine, emoji 🌿');
    ok(r[0].due >= 0 && r[0].due <= SPRING_MULCH_HORIZON_DAYS, 'okno v budoucnu a v horizontu');
  }
  {
    const r = springMulchingForPin(pin(), hosta, null, new Date(2030, 3, 1)); // začátek dubna → svítí
    ok(r.length === 1 && r[0].month === 4, 'začátek dubna: Hosta → návrh svítí');
  }
  // pozdní duben (po 15.) → [] (nikdy do minulosti)
  ok(springMulchingForPin(pin(), hosta, null, new Date(2030, 3, 20)).length === 0,
    'pozdní duben: Hosta okno (15.) minulo → [] (nikdy do minulosti)');

  // woody (5)
  {
    const r = springMulchingForPin(pin(), apple, null, new Date(2030, 3, 1)); // začátek dubna → květen
    ok(r.length === 1 && r[0].type === 'woody' && r[0].month === 5,
      'začátek dubna: jabloň → návrh woody (květen)');
  }
  ok(springMulchingForPin(pin(), apple, null, new Date(2030, 4, 20)).length === 0,
    'pozdní květen: jabloň okno (15.) minulo → [] (nikdy do minulosti)');

  // Iris sibirica (trvalka, NENÍ v exclusions) → návrh svítí
  {
    const r = springMulchingForPin(pin(), irisS, null, new Date(2030, 2, 20));
    ok(r.length === 1 && r[0].type === 'perennial',
      'Iris sibirica (NENÍ v exclusions) → návrh perennial');
  }

  // Exclusions → []
  ok(springMulchingForPin(pin(), helleborus, null, new Date(2030, 2, 20)).length === 0,
    'Helleborus → [] (rod exclusion)');
  ok(springMulchingForPin(pin(), irisG, null, new Date(2030, 2, 20)).length === 0,
    'Iris germanica → [] (species exclusion)');

  // mimo horizont → skryto
  ok(springMulchingForPin(pin(), hosta, null, new Date(2030, 0, 15)).length === 0,
    'leden: dubnové okno >60 dní → skryto');
  ok(springMulchingForPin(pin(), apple, null, new Date(2030, 6, 15)).length === 0,
    'červenec: květnové okno minulo → příští rok >60 dní → skryto');
  ok(springMulchingForPin(pin(), hosta, null, new Date(2030, 9, 1)).length === 0,
    'říjen: příští rok duben >60 dní → skryto');

  // ---------- (3) Posun klim. zóny / expozice ----------
  {
    const base = springMulchingForPin(pin(), hosta, null, new Date(2030, 2, 20))[0];
    const north = springMulchingForPin(pin(), hosta, { exposure: 'N' }, new Date(2030, 2, 20))[0];
    ok(north.suggested > base.suggested, 'severní expozice → pozdější mulčování');
    ok(getZoneOffsetDays('JHC') !== 0, 'climateZones: JHC má nenulový posun (kotva pro zónu)');
    const jhc = springMulchingForPin(pin(), hosta, { climate_zone: 'JHC' }, new Date(2030, 2, 20))[0];
    ok(jhc.suggested > base.suggested, 'klim. zóna JHC (chladnější) → pozdější mulčování');
    const south = springMulchingForPin(pin(), hosta, { exposure: 'S' }, new Date(2030, 2, 20))[0];
    ok(south.suggested < base.suggested, 'jižní expozice → dřívější mulčování');
  }

  // ---------- (4) Dedup proti existujícímu mulčování v měsíci ----------
  {
    const now = new Date(2030, 2, 20); // dubnové okno (perennial)
    const y = now.getFullYear();
    // slovesný titulek, který vrstva sama vytvoří — obsahuje „Mulčovat" → marker „mulč"
    const ownTitle = [{ title: '🌿 Mulčovat Hosta', task_type: 'jine', specific_date: `${y}-04-12` }];
    ok(springMulchingForPin(pin(ownTitle), hosta, null, now).length === 0,
      'dedup: titulek „Mulčovat" v dubnu → potlačeno (zachytí „mulč")');
    const en = [{ title: 'Apply mulch', task_type: 'jine', specific_date: `${y}-04-10` }];
    ok(springMulchingForPin(pin(en), hosta, null, now).length === 0,
      'dedup: anglické „mulch" v dubnu → potlačeno (jazyková pojistka pro EN/DE/PL/SK)');
    const kura = [{ title: 'Nasypat kůru', task_type: 'jine', specific_date: `${y}-04-08` }];
    ok(springMulchingForPin(pin(kura), hosta, null, now).length === 0,
      'dedup: titulek „kůr" v dubnu → potlačeno (materiál)');
    const stepka = [{ title: 'Štěpka k růžím', task_type: 'jine', specific_date: `${y}-04-08` }];
    ok(springMulchingForPin(pin(stepka), hosta, null, now).length === 0,
      'dedup: titulek „štěpk" v dubnu → potlačeno (materiál)');
    // jiný „jine" úkol bez markeru NEpotlačí
    const otherJine = [{ title: 'Pinčování', task_type: 'jine', specific_date: `${y}-04-10` }];
    ok(springMulchingForPin(pin(otherJine), hosta, null, now).length === 1,
      'dedup: jiný „jine" úkol bez markeru v dubnu → návrh svítí');
    // task_type strihani v cílovém měsíci bez markeru titulku NEpotlačí
    const otherStrihani = [{ title: 'Sestřih trvalek', task_type: 'strihani', specific_date: `${y}-04-08` }];
    ok(springMulchingForPin(pin(otherStrihani), hosta, null, now).length === 1,
      'dedup: strihani v dubnu bez markeru titulku → návrh svítí');
    // mulč v jiném měsíci nevadí
    const otherMonth = [{ title: 'Mulčování', task_type: 'jine', specific_date: `${y}-08-10` }];
    ok(springMulchingForPin(pin(otherMonth), hosta, null, now).length === 1,
      'dedup: mulčování v JINÉM měsíci nevadí → návrh svítí');
    // loňské mulčování (jednorázové) ve stejném měsíci nevadí
    const lastYear = [{ title: 'Mulčování', task_type: 'jine', specific_date: `${y - 1}-04-12` }];
    ok(springMulchingForPin(pin(lastYear), hosta, null, now).length === 1,
      'dedup: loňské mulčování v dubnu (jednorázové) → návrh svítí');
    // opakovaný úkol (frequency_days) ve stejném měsíci potlačí bez ohledu na rok
    const repeating = [{ title: 'Mulčování', task_type: 'jine', next_due: `2099-04-01`, frequency_days: 365 }];
    ok(springMulchingForPin(pin(repeating), hosta, null, now).length === 0,
      'dedup: opakovaný úkol s markerem v dubnu → potlačeno (bez ohledu na rok)');
  }

  // ---------- (5) Chybějící vstup ----------
  ok(springMulchingForPin(null, hosta, null, new Date(2030, 2, 20)).length === 0, 'bez pinu → []');
  ok(springMulchingForPin(pin(), null, null, new Date(2030, 2, 20)).length === 0, 'bez rostliny → []');

  console.log(`\n✅ All ${passed} spring-mulching assertions passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
