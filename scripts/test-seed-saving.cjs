// Sanity test pro „Sběr semen z odkvetlých rostlin — podzimní samosběr".
// seedSaving.js importuje RecommendedTasks.jsx (React/JSX) → nejde načíst v čistém node,
// proto REPLIKUJEME pure logiku (stejně jako test-pinching / test-strawberry-renewal).
// Replika je věrná seedSaving.js a je now-aware (deterministické testy).
// Matchování SEED_SAVING_GENERA / SEED_SAVING_SPECIES běží proti REÁLNÉ plantDatabase
// načtené dynamickým importem → ověří, že kurátorská mapa sedí na skutečná data (žádné
// mrtvé klíče) a že kolize rodu Helianthus (annuus vs. tuberosus) i mimo-gate kategorie
// jsou vyřazené.
// dateForMonth/getConditionShiftDays = věrná replika; getZoneOffsetDays importujeme
// z reálného climateZones.js (jeden zdroj pravdy pro posun klim. zóny).
// Spuštění: node scripts/test-seed-saving.cjs
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

// ---------- replika pure logiky (seedSaving.js) ----------
const SEED_SAVING_HORIZON_DAYS = 75;
const SEED_SAVING_EMOJI = '🌾';
const SEED_SAVING_TYPES = {
  earlyAutumn: { month: 8 },
  midAutumn: { month: 9 },
  lateAutumn: { month: 10 },
};
const SEED_SAVING_CATEGORIES = new Set(['letnicky', 'bylinky', 'trvalky', 'zelenina', 'okrasne']);
const SEED_SAVING_GENERA = {
  Coriandrum: 'earlyAutumn',
  Anethum: 'earlyAutumn',
  Calendula: 'earlyAutumn',
  Zinnia: 'midAutumn',
  Tagetes: 'midAutumn',
  Aquilegia: 'lateAutumn',
};
const SEED_SAVING_SPECIES = {
  'Helianthus annuus': 'midAutumn',
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
function seedSavingRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (!cat || !SEED_SAVING_CATEGORIES.has(cat)) return null;
  const lat = String((plant && plant.nameLat) || '').trim();
  for (const sp in SEED_SAVING_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return { type: SEED_SAVING_SPECIES[sp] };
  }
  const genus = genusOf(plant);
  if (genus && SEED_SAVING_GENERA[genus]) return { type: SEED_SAVING_GENERA[genus] };
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
function hasSeedSavingInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    const title = (e.title || '').trim();
    if (/semen|nažk|semeník|nasbír/i.test(title)) return true;
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
  function seedSavingForPin(pin, plant, conditions, now) {
    if (!pin || !plant) return [];
    const rule = seedSavingRuleForPlant(plant);
    if (!rule) return [];
    const typeDef = SEED_SAVING_TYPES[rule.type];
    if (!typeDef) return [];
    const suggested = dateForMonth(typeDef.month, conditions, now);
    const due = daysFromToday(suggested, now);
    if (due === null || due < 0 || due > SEED_SAVING_HORIZON_DAYS) return [];
    const m = monthFromIso(suggested);
    if (hasSeedSavingInMonth(pin.tasks || [], m, now.getFullYear())) return [];
    return [{
      kind: 'seedSaving', type: rule.type, month: m, suggested, due,
      taskType: 'jine', emoji: SEED_SAVING_EMOJI,
    }];
  }

  // ---------- (1) Matchování map proti REÁLNÉ DB ----------
  const db = await imp('frontend/src/plantDatabase.js');
  const enriched = db.PLANT_DATABASE.map(db.enrichPlant);
  const byCz = (name) => enriched.find((p) => p.nameCz === name);
  const byLat = (lat) => enriched.filter((p) => p.nameLat === lat);
  const ruleCz = (name) => seedSavingRuleForPlant(byCz(name));
  const typeCz = (name) => { const r = ruleCz(name); return r && r.type; };

  // --- earlyAutumn (8) přes ROD: bylinky + Calendula ---
  ok(typeCz('Koriandr') === 'earlyAutumn', 'Coriandrum sativum (bylinky) → earlyAutumn');
  ok(typeCz('Kopr vonný') === 'earlyAutumn', 'Anethum graveolens (bylinky) → earlyAutumn');
  // Měsíček je v DB v kategorii `okrasne` (legacy), proto je `okrasne` v gate.
  ok(typeCz('Měsíček lékařský') === 'earlyAutumn',
    'Calendula officinalis (okrasne) → earlyAutumn (gate okrasne)');

  // --- midAutumn (9) přes ROD ---
  ok(typeCz('Zinia') === 'midAutumn', 'Zinnia elegans (letnicky) → midAutumn');
  ok(typeCz('Aksamitník vzpřímený') === 'midAutumn',
    'Tagetes erecta (letnicky) → midAutumn (genus-level Tagetes)');

  // --- midAutumn (9) přes SPECIES precedence (rod Helianthus NENÍ v GENERA) ---
  // Helianthus annuus má v DB DVĚ entry — id 47 (okrasne) i další (letnicky); obě validní pro sběr semen.
  const heliannuus = byLat('Helianthus annuus');
  ok(heliannuus.length >= 2, 'Helianthus annuus má v DB ≥2 entry (okrasne + letnicky)');
  for (const e of heliannuus) {
    const cat = e.category.key || e.category;
    const r = seedSavingRuleForPlant(e);
    ok(r && r.type === 'midAutumn',
      `Helianthus annuus (${cat}) → midAutumn přes species precedence`);
  }
  // Helianthus tuberosus (topinambur, zelenina) — rod Helianthus v GENERA NENÍ, species nesedí → null
  ok(ruleCz('Topinambur') === null,
    'Helianthus tuberosus (topinambur, zelenina) → null (rod Helianthus mimo GENERA, množí se hlízami)');

  // --- lateAutumn (10) přes ROD ---
  ok(typeCz('Orlíček obecný') === 'lateAutumn', 'Aquilegia vulgaris (trvalky) → lateAutumn');

  // --- Vyřazené kategorie / rody ---
  ok(ruleCz('Jabloň') === null, 'jabloň (stromy) → null (mimo gate)');
  ok(ruleCz('Třešeň') === null, 'třešeň (Prunus avium, stromy) → null (mimo gate)');
  ok(ruleCz('Sakura') === null || ruleCz('Sakura') === undefined,
    'sakura okrasná (Prunus serrulata, stromy/okrasne) → null (rod Prunus mimo mapu)');
  ok(ruleCz('Tulipán') === null, 'tulipán (cibuloviny) → null (mimo gate)');
  ok(ruleCz('Rajče') === null, 'rajče (zelenina) → null (rod Solanum mimo mapu)');
  ok(ruleCz('Jahodník') === null || ruleCz('Jahodník') === undefined,
    'jahodník (Fragaria, ovoce) → null (mimo gate, množí se odnožemi)');
  ok(ruleCz('Bohyška Halcyon') === null,
    "Hosta 'Halcyon' (trvalky) → null (rod Hosta mimo mapu)");
  ok(ruleCz('Šanta Faassenova') === null,
    'Nepeta x faassenii (trvalky) → null (rod Nepeta mimo mapu)');
  ok(ruleCz('Bazalka') === null, 'Ocimum basilicum (bylinky) → null (rod Ocimum mimo mapu)');
  ok(ruleCz('Levandule') === null || ruleCz('Levandule') === undefined,
    'Lavandula angustifolia (bylinky) → null (rod Lavandula mimo mapu)');

  // synthetic — mimo gate kategorie přímo
  ok(seedSavingRuleForPlant({ category: { key: 'kere' }, nameLat: 'Calendula officinalis' }) === null,
    'Calendula v keřích → null (mimo gate)');
  ok(seedSavingRuleForPlant({ category: { key: 'cibuloviny' }, nameLat: 'Tagetes erecta' }) === null,
    'Tagetes v cibulovinách → null (mimo gate)');
  ok(seedSavingRuleForPlant({ category: { key: 'ovoce' }, nameLat: 'Helianthus annuus' }) === null,
    'Helianthus annuus v ovoce (umělý) → null (mimo gate)');
  ok(seedSavingRuleForPlant({ category: { key: 'popinave' }, nameLat: 'Aquilegia vulgaris' }) === null,
    'Aquilegia v popínavých → null (mimo gate)');
  ok(seedSavingRuleForPlant({ category: { key: 'sukulenty' }, nameLat: 'Zinnia elegans' }) === null,
    'Zinnia v sukulentech (umělý) → null (mimo gate)');
  ok(seedSavingRuleForPlant(null) === null, 'bez rostliny → null');
  ok(seedSavingRuleForPlant({ category: null, nameLat: 'Zinnia elegans' }) === null,
    'bez kategorie → null');
  ok(seedSavingRuleForPlant({ category: { key: 'letnicky' }, nameLat: '' }) === null,
    'prázdný nameLat → null (rod neurčen)');

  // gate akceptuje i holý string kategorie
  ok((seedSavingRuleForPlant({ category: 'letnicky', nameLat: 'Zinnia elegans' }) || {}).type === 'midAutumn',
    'holý string category=letnicky + Zinnia → midAutumn');
  ok((seedSavingRuleForPlant({ category: 'bylinky', nameLat: 'Coriandrum sativum' }) || {}).type === 'earlyAutumn',
    'holý string category=bylinky + Coriandrum → earlyAutumn');
  ok((seedSavingRuleForPlant({ category: 'trvalky', nameLat: 'Aquilegia vulgaris' }) || {}).type === 'lateAutumn',
    'holý string category=trvalky + Aquilegia → lateAutumn');
  ok((seedSavingRuleForPlant({ category: 'okrasne', nameLat: 'Calendula officinalis' }) || {}).type === 'earlyAutumn',
    'holý string category=okrasne + Calendula → earlyAutumn');

  // forward-looking druhy přes ROD (kdyby v DB přibyl Tagetes patula → annualPinch by se přes GENERA chytil)
  ok((seedSavingRuleForPlant({ category: 'letnicky', nameLat: 'Tagetes patula' }) || {}).type === 'midAutumn',
    'forward-looking Tagetes patula přes rod → midAutumn');
  ok((seedSavingRuleForPlant({ category: 'trvalky', nameLat: 'Aquilegia caerulea' }) || {}).type === 'lateAutumn',
    'forward-looking Aquilegia caerulea přes rod → lateAutumn');

  // forward-looking SPECIES Helianthus annuus 'Russian Mammoth' — match přes startsWith
  ok((seedSavingRuleForPlant({ category: 'letnicky', nameLat: "Helianthus annuus 'Russian Mammoth'" }) || {}).type === 'midAutumn',
    "forward-looking Helianthus annuus 'Russian Mammoth' přes species (startsWith)");

  // integrita: žádný mrtvý klíč mapy
  //   - každý ROD v SEED_SAVING_GENERA musí v DB v gate odpovídat ≥1 rostlině
  //   - každý DRUH v SEED_SAVING_SPECIES musí v DB v gate odpovídat ≥1 rostlině
  const inGate = (p) => SEED_SAVING_CATEGORIES.has(p.category.key);
  const generaInGate = new Set(enriched.filter(inGate).map(genusOf));
  for (const g of Object.keys(SEED_SAVING_GENERA)) {
    ok(generaInGate.has(g),
      `SEED_SAVING_GENERA: rod ${g} je v DB v gate (letnicky/bylinky/trvalky/zelenina/okrasne) — žádný mrtvý klíč`);
  }
  for (const sp of Object.keys(SEED_SAVING_SPECIES)) {
    const found = enriched.filter(inGate).some((p) => {
      const lat = String(p.nameLat || '').trim();
      return lat === sp || lat.startsWith(`${sp} `);
    });
    ok(found, `SEED_SAVING_SPECIES: druh ${sp} je v DB v gate — žádný mrtvý klíč`);
  }

  // ---------- (2) Logika seedSavingForPin (now-aware) ----------
  const pin = (tasks) => ({ id: 1, tasks: tasks || [] });
  const koriandr = { category: { key: 'bylinky' }, nameLat: 'Coriandrum sativum' };     // earlyAutumn, měsíc 8
  const zinia = { category: { key: 'letnicky' }, nameLat: 'Zinnia elegans' };          // midAutumn, měsíc 9
  const orlicek = { category: { key: 'trvalky' }, nameLat: 'Aquilegia vulgaris' };     // lateAutumn, měsíc 10
  const slunecnice = { category: { key: 'letnicky' }, nameLat: 'Helianthus annuus' };  // midAutumn, měsíc 9 (přes species)

  // earlyAutumn (8) — konec června → srpen v horizontu (60 dní)
  {
    const r = seedSavingForPin(pin(), koriandr, null, new Date(2030, 5, 25)); // konec června
    ok(r.length === 1 && r[0].kind === 'seedSaving', 'konec června: Koriandr → návrh earlyAutumn');
    ok(r[0].type === 'earlyAutumn' && r[0].month === 8, 'earlyAutumn měsíc 8');
    ok(r[0].taskType === 'jine' && r[0].emoji === '🌾', 'task_type jine, emoji 🌾');
    ok(r[0].due >= 0 && r[0].due <= SEED_SAVING_HORIZON_DAYS, 'okno v budoucnu a v horizontu');
  }
  {
    const r = seedSavingForPin(pin(), koriandr, null, new Date(2030, 7, 1)); // začátek srpna
    ok(r.length === 1 && r[0].month === 8, 'začátek srpna: Koriandr → návrh svítí');
  }
  ok(seedSavingForPin(pin(), koriandr, null, new Date(2030, 7, 20)).length === 0,
    'pozdní srpen (po 15.): Koriandr okno minulo → [] (nikdy do minulosti)');

  // midAutumn (9)
  {
    const r = seedSavingForPin(pin(), zinia, null, new Date(2030, 6, 20)); // konec července → září
    ok(r.length === 1 && r[0].type === 'midAutumn' && r[0].month === 9,
      'konec července: Zinia → návrh midAutumn (září)');
  }
  {
    // species precedence pro Helianthus annuus
    const r = seedSavingForPin(pin(), slunecnice, null, new Date(2030, 7, 1));
    ok(r.length === 1 && r[0].type === 'midAutumn' && r[0].month === 9,
      'srpen: Helianthus annuus (species) → návrh midAutumn');
  }
  ok(seedSavingForPin(pin(), zinia, null, new Date(2030, 8, 20)).length === 0,
    'pozdní září: Zinia okno minulo → [] (nikdy do minulosti)');

  // lateAutumn (10)
  {
    const r = seedSavingForPin(pin(), orlicek, null, new Date(2030, 7, 25)); // konec srpna → říjen
    ok(r.length === 1 && r[0].type === 'lateAutumn' && r[0].month === 10,
      'konec srpna: Orlíček → návrh lateAutumn (říjen)');
  }
  ok(seedSavingForPin(pin(), orlicek, null, new Date(2030, 9, 25)).length === 0,
    'pozdní říjen: Orlíček okno minulo → [] (nikdy do minulosti)');

  // mimo horizont → skryto
  ok(seedSavingForPin(pin(), koriandr, null, new Date(2030, 0, 15)).length === 0,
    'leden: srpnové okno >75 dní → skryto');
  ok(seedSavingForPin(pin(), koriandr, null, new Date(2030, 2, 1)).length === 0,
    'březen: srpnové okno >75 dní → skryto');
  ok(seedSavingForPin(pin(), orlicek, null, new Date(2030, 10, 1)).length === 0,
    'listopad: říjnové okno minulo → příští rok >75 dní → skryto');
  ok(seedSavingForPin(pin(), zinia, null, new Date(2030, 0, 1)).length === 0,
    'leden: zářijové okno >75 dní → skryto');

  // ---------- (3) Posun klim. zóny / expozice ----------
  {
    const base = seedSavingForPin(pin(), koriandr, null, new Date(2030, 5, 25))[0];
    const north = seedSavingForPin(pin(), koriandr, { exposure: 'N' }, new Date(2030, 5, 25))[0];
    ok(north.suggested > base.suggested, 'severní expozice → pozdější sběr');
    ok(getZoneOffsetDays('JHC') !== 0, 'climateZones: JHC má nenulový posun (kotva pro zónu)');
    const jhc = seedSavingForPin(pin(), koriandr, { climate_zone: 'JHC' }, new Date(2030, 5, 25))[0];
    ok(jhc.suggested > base.suggested, 'klim. zóna JHC (chladnější) → pozdější sběr');
    const south = seedSavingForPin(pin(), koriandr, { exposure: 'S' }, new Date(2030, 5, 25))[0];
    ok(south.suggested < base.suggested, 'jižní expozice → dřívější sběr');
  }

  // ---------- (4) Dedup proti existujícímu sběru v měsíci ----------
  {
    const now = new Date(2030, 6, 25); // konec července → srpnové okno (earlyAutumn)
    const y = now.getFullYear();
    // slovesný titulek, který vrstva sama vytvoří — obsahuje „semen" a „Nasbírat"
    const own = [{ title: '🌾 Nasbírat semena Koriandr', task_type: 'jine', specific_date: `${y}-08-12` }];
    ok(seedSavingForPin(pin(own), koriandr, null, now).length === 0,
      'dedup: vlastní titulek „Nasbírat semena" v srpnu → potlačeno (zachytí „semen" i „nasbír")');
    const podstatne = [{ title: 'Sběr semen', task_type: 'jine', specific_date: `${y}-08-10` }];
    ok(seedSavingForPin(pin(podstatne), koriandr, null, now).length === 0,
      'dedup: titulek „semen" v srpnu → potlačeno');
    const nazky = [{ title: 'Posbírat nažky', task_type: 'jine', specific_date: `${y}-08-08` }];
    ok(seedSavingForPin(pin(nazky), koriandr, null, now).length === 0,
      'dedup: titulek „nažk" v srpnu → potlačeno (botanický termín)');
    const tobolka = [{ title: 'Otevřít semeník', task_type: 'jine', specific_date: `${y}-08-08` }];
    ok(seedSavingForPin(pin(tobolka), koriandr, null, now).length === 0,
      'dedup: titulek „semeník" v srpnu → potlačeno');
    // jiný „jine" úkol bez markeru NEpotlačí
    const otherJine = [{ title: '🌾 Mulčování', task_type: 'jine', specific_date: `${y}-08-10` }];
    ok(seedSavingForPin(pin(otherJine), koriandr, null, now).length === 1,
      'dedup: jiný „jine" úkol bez markeru v srpnu → návrh svítí');
    // task_type strihani v cílovém měsíci bez markeru titulku NEpotlačí
    const otherStrihani = [{ title: 'Sestřih trvalek', task_type: 'strihani', specific_date: `${y}-08-08` }];
    ok(seedSavingForPin(pin(otherStrihani), koriandr, null, now).length === 1,
      'dedup: strihani v srpnu bez markeru titulku → návrh svítí');
    // sběr v jiném měsíci nevadí
    const otherMonth = [{ title: 'Nasbírat semena', task_type: 'jine', specific_date: `${y}-05-10` }];
    ok(seedSavingForPin(pin(otherMonth), koriandr, null, now).length === 1,
      'dedup: sběr v JINÉM měsíci (květen) nevadí → návrh svítí');
    // loňský sběr (jednorázový) ve stejném měsíci nevadí
    const lastYear = [{ title: 'Nasbírat semena', task_type: 'jine', specific_date: `${y - 1}-08-12` }];
    ok(seedSavingForPin(pin(lastYear), koriandr, null, now).length === 1,
      'dedup: loňský sběr v srpnu (jednorázový) → návrh svítí');
    // opakovaný úkol (frequency_days) ve stejném měsíci potlačí bez ohledu na rok
    const repeating = [{ title: 'Sběr semen', task_type: 'jine', next_due: `2099-08-01`, frequency_days: 365 }];
    ok(seedSavingForPin(pin(repeating), koriandr, null, now).length === 0,
      'dedup: opakovaný úkol s markerem v srpnu → potlačeno (bez ohledu na rok)');
  }

  // ---------- (5) Chybějící vstup ----------
  ok(seedSavingForPin(null, koriandr, null, new Date(2030, 5, 25)).length === 0, 'bez pinu → []');
  ok(seedSavingForPin(pin(), null, null, new Date(2030, 5, 25)).length === 0, 'bez rostliny → []');

  console.log(`\n✅ All ${passed} seed-saving assertions passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
