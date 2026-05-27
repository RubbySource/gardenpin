// Sanity test pro „Probírka násady ovoce — červnová protrhávka mladých plůdků".
// fruitThinning.js importuje RecommendedTasks.jsx (React/JSX) → nejde načíst v čistém node,
// proto REPLIKUJEME pure logiku (stejně jako test-grafting-tasks / test-cutting-tasks /
// test-trunk-whitewash). Replika je věrná fruitThinning.js a je now-aware (deterministické testy).
// Matchování FRUIT_THINNING_GENERA/SPECIES běží proti REÁLNÉ plantDatabase načtené dynamickým
// importem → ověří, že kurátorská mapa sedí na skutečná data (žádné mrtvé klíče) a že drobné
// ovoce / třešeň / okrasné Prunus / zelenina / trvalky jsou vyřazené.
// dateForMonth/getConditionShiftDays = věrná replika; getZoneOffsetDays importujeme
// z reálného climateZones.js (jeden zdroj pravdy pro posun klim. zóny).
// Spuštění: node scripts/test-fruit-thinning.cjs
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

// ---------- replika pure logiky (fruitThinning.js) ----------
const FRUIT_THINNING_HORIZON_DAYS = 60;
const FRUIT_THINNING_EMOJI = '🍎';
const FRUIT_THINNING_TYPES = {
  pome: { month: 6 },
  stone: { month: 6 },
};
const FRUIT_THINNING_GENERA = {
  Malus: 'pome', Pyrus: 'pome',
};
const FRUIT_THINNING_SPECIES = {
  'Prunus persica': 'stone', 'Prunus armeniaca': 'stone', 'Prunus domestica': 'stone',
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
function fruitThinningRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (cat !== 'ovoce' && cat !== 'stromy') return null;
  const lat = String(plant.nameLat || '').trim();
  for (const sp in FRUIT_THINNING_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return { type: FRUIT_THINNING_SPECIES[sp] };
  }
  const genus = genusOf(plant);
  if (genus && FRUIT_THINNING_GENERA[genus]) return { type: FRUIT_THINNING_GENERA[genus] };
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
function hasThinningInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    const title = (e.title || '').trim();
    if (/probr|probír|protrh/i.test(title)) return true;
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
  function fruitThinningForPin(pin, plant, conditions, now) {
    if (!pin || !plant) return [];
    const rule = fruitThinningRuleForPlant(plant);
    if (!rule) return [];
    const typeDef = FRUIT_THINNING_TYPES[rule.type];
    if (!typeDef) return [];
    const suggested = dateForMonth(typeDef.month, conditions, now);
    const due = daysFromToday(suggested, now);
    if (due === null || due < 0 || due > FRUIT_THINNING_HORIZON_DAYS) return [];
    const m = monthFromIso(suggested);
    if (hasThinningInMonth(pin.tasks || [], m, now.getFullYear())) return [];
    return [{
      kind: 'fruitThinning', type: rule.type, month: m, suggested, due,
      taskType: 'jine', emoji: FRUIT_THINNING_EMOJI,
    }];
  }

  // ---------- (1) Matchování map proti REÁLNÉ DB ----------
  const db = await imp('frontend/src/plantDatabase.js');
  const enriched = db.PLANT_DATABASE.map(db.enrichPlant);
  const byCz = (name) => enriched.find((p) => p.nameCz === name);
  const ruleCz = (name) => fruitThinningRuleForPlant(byCz(name));
  const typeCz = (name) => { const r = ruleCz(name); return r && r.type; };

  // jádroviny (stromy) → silná probírka (pome)
  ok(typeCz('Jabloň') === 'pome', 'jabloň (Malus domestica, stromy) → pome probírka');
  ok(typeCz('Hruška') === 'pome', 'hrušeň (Pyrus communis, stromy) → pome');
  ok(typeCz('Okrasná jabloň Royalty') === 'pome', 'okrasná jabloň (Malus cv., stromy) → pome (rod)');

  // velkoplodé peckoviny (DRUH) → mírnější probírka (stone)
  ok(typeCz('Broskvoň') === 'stone', 'broskvoň (Prunus persica, stromy) → stone');
  ok(typeCz('Meruňka') === 'stone', 'meruňka (Prunus armeniaca, stromy) → stone');
  ok(typeCz('Švestka') === 'stone', 'švestka (Prunus domestica, stromy) → stone');

  // DRUH má přednost — třešeň (Prunus avium, drobnoplodá) a okrasné Prunus → null (rod Prunus
  // záměrně NENÍ v GENERA)
  ok(ruleCz('Třešeň') === null, 'třešeň (Prunus avium, drobnoplodá) → null (neprobírá se)');
  ok(ruleCz('Sakura Kanzan') === null, 'okrasná sakura (Prunus serrulata) → null');
  ok(ruleCz('Slivoň Nigra') === null, 'okrasná slivoň (Prunus cerasifera) → null');

  // drobné ovoce (kategorie ovoce) — projde gate, ale není v mapě → null (neprobírá se)
  ok(ruleCz('Rybíz černý') === null, 'Ribes (ovoce) → null');
  ok(ruleCz('Maliník červený') === null, 'Rubus (ovoce) → null');
  ok(ruleCz('Borůvka zahradní') === null, 'Vaccinium (ovoce) → null');
  ok(ruleCz('Jahoda lesní') === null, 'Fragaria (ovoce) → null');

  // mimo gate → null
  ok(fruitThinningRuleForPlant({ category: { key: 'zelenina' }, nameLat: 'Solanum lycopersicum' }) === null,
    'rajče (zelenina) → null (mimo gate)');
  ok(fruitThinningRuleForPlant({ category: { key: 'trvalky' }, nameLat: 'Hosta sieboldiana' }) === null,
    'trvalka → null (mimo gate)');
  ok(fruitThinningRuleForPlant({ category: { key: 'kere' }, nameLat: 'Malus toringo' }) === null,
    'rod Malus mimo gate ovoce/stromy → null');
  ok(fruitThinningRuleForPlant(null) === null, 'bez rostliny → null');
  // gate akceptuje i holý string kategorie
  ok((fruitThinningRuleForPlant({ category: 'stromy', nameLat: 'Malus domestica' }) || {}).type === 'pome',
    'holý string category=stromy + Malus → pome');

  // integrita: žádný mrtvý klíč mapy (každý rod/druh existuje v reálné DB v gate ovoce/stromy)
  const inGate = (p) => p.category.key === 'ovoce' || p.category.key === 'stromy';
  const generaInGate = new Set(enriched.filter(inGate).map(genusOf));
  for (const g of Object.keys(FRUIT_THINNING_GENERA)) {
    ok(generaInGate.has(g), `FRUIT_THINNING_GENERA: rod ${g} je v DB (ovoce/stromy) — žádný mrtvý klíč`);
  }
  for (const sp of Object.keys(FRUIT_THINNING_SPECIES)) {
    ok(enriched.some((p) => {
      const l = String(p.nameLat || '');
      return inGate(p) && (l === sp || l.startsWith(`${sp} `));
    }), `FRUIT_THINNING_SPECIES: druh ${sp} je v DB (ovoce/stromy) — žádný mrtvý klíč`);
  }

  // ---------- (2) Logika fruitThinningForPin (now-aware) ----------
  const pin = (tasks) => ({ id: 1, tasks: tasks || [] });
  const pome = { category: { key: 'stromy' }, nameLat: 'Malus domestica' };  // pome (month 6)
  const stone = { category: { key: 'stromy' }, nameLat: 'Prunus persica' };  // stone (month 6)

  {
    const r = fruitThinningForPin(pin(), pome, null, new Date(2030, 4, 20)); // květen → červen (~26 dní)
    ok(r.length === 1 && r[0].kind === 'fruitThinning', 'květen: jabloň → návrh probírky');
    ok(r[0].type === 'pome' && r[0].month === 6, 'pome → měsíc 6');
    ok(r[0].taskType === 'jine' && r[0].emoji === '🍎', 'task_type jine, emoji 🍎');
    ok(r[0].due >= 0 && r[0].due <= FRUIT_THINNING_HORIZON_DAYS, 'okno v budoucnu a v horizontu');
  }
  {
    const r = fruitThinningForPin(pin(), stone, null, new Date(2030, 4, 20)); // květen → červen
    ok(r.length === 1 && r[0].type === 'stone' && r[0].month === 6, 'květen: broskvoň → stone probírka v červnu');
  }
  // brzy v červnu (před 15.) → svítí; nikdy do minulosti (po okně → [])
  ok(fruitThinningForPin(pin(), pome, null, new Date(2030, 5, 1)).length === 1,
    'začátek června: červnové okno → návrh svítí');
  ok(fruitThinningForPin(pin(), pome, null, new Date(2030, 5, 20)).length === 0,
    'pozdní červen: okno (15.) minulo → [] (nikdy do minulosti)');

  // mimo horizont → skryto
  ok(fruitThinningForPin(pin(), pome, null, new Date(2030, 1, 15)).length === 0,
    'únor: červnové okno >60 dní → skryto');
  ok(fruitThinningForPin(pin(), pome, null, new Date(2030, 3, 1)).length === 0,
    'duben: červnové okno >60 dní → skryto');
  ok(fruitThinningForPin(pin(), pome, null, new Date(2030, 7, 15)).length === 0,
    'srpen: červnové okno minulo → příští rok >60 dní → skryto');

  // ---------- (3) Posun klim. zóny / expozice ----------
  {
    const base = fruitThinningForPin(pin(), pome, null, new Date(2030, 4, 20))[0];
    const north = fruitThinningForPin(pin(), pome, { exposure: 'N' }, new Date(2030, 4, 20))[0];
    ok(north.suggested > base.suggested, 'severní expozice → pozdější probírka');
    ok(getZoneOffsetDays('JHC') !== 0, 'climateZones: JHC má nenulový posun (kotva pro zónu)');
    const jhc = fruitThinningForPin(pin(), pome, { climate_zone: 'JHC' }, new Date(2030, 4, 20))[0];
    ok(jhc.suggested > base.suggested, 'klim. zóna JHC (chladnější) → pozdější probírka');
  }

  // ---------- (4) Dedup proti existující probírce v měsíci ----------
  {
    const now = new Date(2030, 4, 20); // červnové okno
    const y = now.getFullYear();
    // slovesný titulek, který tahle vrstva sama vytvoří
    const probrat = [{ title: '🍎 Probrat násadu Jabloň', task_type: 'jine', specific_date: `${y}-06-12` }];
    ok(fruitThinningForPin(pin(probrat), pome, null, now).length === 0,
      'dedup: titulek „Probrat" (jine) v červnu → potlačeno');
    const probirka = [{ title: 'Červnová probírka', task_type: 'jine', specific_date: `${y}-06-10` }];
    ok(fruitThinningForPin(pin(probirka), pome, null, now).length === 0,
      'dedup: titulek „probírka" v červnu → potlačeno');
    const protrhavka = [{ title: 'Protrhávka plůdků', task_type: 'jine', specific_date: `${y}-06-05` }];
    ok(fruitThinningForPin(pin(protrhavka), pome, null, now).length === 0,
      'dedup: titulek „protrhávka" v červnu → potlačeno');
    // jiný „jine" úkol bez markeru v červnu NEpotlačí (task_type jine je příliš obecný)
    const otherJine = [{ title: '🌾 Mulčování', task_type: 'jine', specific_date: `${y}-06-10` }];
    ok(fruitThinningForPin(pin(otherJine), pome, null, now).length === 1,
      'dedup: jiný „jine" úkol bez markeru v červnu → návrh svítí (jine se nesleduje)');
    // probírka v JINÉM měsíci nevadí
    const otherMonth = [{ title: '🍎 Probrat násadu Jabloň', task_type: 'jine', specific_date: `${y}-08-10` }];
    ok(fruitThinningForPin(pin(otherMonth), pome, null, now).length === 1,
      'dedup: probírka v JINÉM měsíci nevadí → návrh svítí');
    // loňská probírka ve stejném měsíci nevadí (jednorázový úkol z minulého roku)
    const lastYear = [{ title: '🍎 Probrat násadu Jabloň', task_type: 'jine', specific_date: `${y - 1}-06-12` }];
    ok(fruitThinningForPin(pin(lastYear), pome, null, now).length === 1,
      'dedup: loňská probírka v červnu (jednorázová) → návrh svítí');
    // opakovaný úkol (frequency_days) ve stejném měsíci potlačí bez ohledu na rok
    const repeating = [{ title: 'Probrat plody', task_type: 'jine', next_due: `2099-06-01`, frequency_days: 365 }];
    ok(fruitThinningForPin(pin(repeating), pome, null, now).length === 0,
      'dedup: opakovaný úkol s markerem v červnu → potlačeno (bez ohledu na rok)');
  }

  // ---------- (5) Chybějící vstup ----------
  ok(fruitThinningForPin(null, pome, null, new Date(2030, 4, 20)).length === 0, 'bez pinu → []');
  ok(fruitThinningForPin(pin(), null, null, new Date(2030, 4, 20)).length === 0, 'bez rostliny → []');

  console.log(`\n✅ All ${passed} fruit-thinning assertions passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
