// Sanity test pro „Roubování a očkování ovocných stromů — jarní roubování + letní očkování".
// graftingTasks.js importuje RecommendedTasks.jsx (React/JSX) → nejde načíst v čistém node,
// proto REPLIKUJEME pure logiku (stejně jako test-cutting-tasks / test-bulb-planting /
// test-sowing-tasks). Replika je věrná graftingTasks.js a je now-aware (deterministické testy).
// Matchování GRAFTING_GENERA/SPECIES běží proti REÁLNÉ plantDatabase načtené dynamickým
// importem → ověří, že kurátorská mapa sedí na skutečná data (žádné mrtvé klíče) a že
// drobné ovoce / zelenina / trvalky / keře mimo gate jsou vyřazené.
// dateForMonth/getConditionShiftDays = věrná replika; getZoneOffsetDays importujeme
// z reálného climateZones.js (jeden zdroj pravdy pro posun klim. zóny).
// Spuštění: node scripts/test-grafting-tasks.cjs
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

// ---------- replika pure logiky (graftingTasks.js) ----------
const GRAFTING_HORIZON_DAYS = 90;
const GRAFTING_EMOJI = '🌳';
const GRAFTING_TYPES = {
  spring: { month: 4 },
  summer: { month: 8 },
};
const GRAFTING_GENERA = {
  Malus: 'spring', Pyrus: 'spring', Cydonia: 'spring', Sorbus: 'spring',
  Prunus: 'summer', Juglans: 'summer',
};
const GRAFTING_SPECIES = { 'Cornus mas': 'summer' };

function categoryKey(plant) {
  const c = plant && plant.category;
  if (!c) return null;
  return typeof c === 'string' ? c : c.key || null;
}
function genusOf(plant) {
  const lat = String((plant && plant.nameLat) || '').trim();
  return lat ? lat.split(/\s+/)[0] || null : null;
}
function graftingRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (cat !== 'ovoce' && cat !== 'stromy') return null;
  const lat = String(plant.nameLat || '').trim();
  for (const sp in GRAFTING_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return { type: GRAFTING_SPECIES[sp] };
  }
  const genus = genusOf(plant);
  if (genus && GRAFTING_GENERA[genus]) return { type: GRAFTING_GENERA[genus] };
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
function hasGraftingInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type === 'presazeni') return true;
    const title = (e.title || '').trim();
    if (/roub|očk|štěp/i.test(title)) return true;
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
  function graftingTaskForPin(pin, plant, conditions, now) {
    if (!pin || !plant) return [];
    const rule = graftingRuleForPlant(plant);
    if (!rule) return [];
    const typeDef = GRAFTING_TYPES[rule.type];
    if (!typeDef) return [];
    const suggested = dateForMonth(typeDef.month, conditions, now);
    const due = daysFromToday(suggested, now);
    if (due === null || due < 0 || due > GRAFTING_HORIZON_DAYS) return [];
    const m = monthFromIso(suggested);
    if (hasGraftingInMonth(pin.tasks || [], m, now.getFullYear())) return [];
    return [{
      kind: 'grafting', type: rule.type, month: m, suggested, due,
      taskType: 'presazeni', emoji: GRAFTING_EMOJI,
    }];
  }

  // ---------- (1) Matchování map proti REÁLNÉ DB ----------
  const db = await imp('frontend/src/plantDatabase.js');
  const enriched = db.PLANT_DATABASE.map(db.enrichPlant);
  const byCz = (name) => enriched.find((p) => p.nameCz === name);
  const ruleCz = (name) => graftingRuleForPlant(byCz(name));
  const typeCz = (name) => { const r = ruleCz(name); return r && r.type; };

  // jádroviny (stromy/ovoce) → jarní roubování (spring)
  ok(typeCz('Jabloň') === 'spring', 'jabloň (Malus domestica, stromy) → spring roubování');
  ok(typeCz('Hruška') === 'spring', 'hrušeň (Pyrus communis, stromy) → spring');
  ok(typeCz('Kdouloň') === 'spring', 'kdouloň (Cydonia oblonga, stromy) → spring');
  ok(typeCz('Jeřáb obecný') === 'spring', 'jeřáb (Sorbus aucuparia, ovoce) → spring');
  ok(typeCz('Jeřáb oskeruše') === 'spring', 'oskeruše (Sorbus domestica, ovoce) → spring');
  ok(typeCz('Okrasná jabloň Royalty') === 'spring', 'okrasná jabloň (Malus cv., stromy) → spring');

  // peckoviny + ořešák → letní očkování (summer)
  ok(typeCz('Třešeň') === 'summer', 'třešeň (Prunus avium, stromy) → summer očkování');
  ok(typeCz('Švestka') === 'summer', 'švestka (Prunus domestica, stromy) → summer');
  ok(typeCz('Broskvoň') === 'summer', 'broskvoň (Prunus persica, stromy) → summer');
  ok(typeCz('Meruňka') === 'summer', 'meruňka (Prunus armeniaca, stromy) → summer');
  ok(typeCz('Ořešák královský') === 'summer', 'ořešák (Juglans regia, stromy) → summer');
  ok(typeCz('Sakura Kanzan') === 'summer', 'okrasná sakura (Prunus serrulata, stromy) → summer (rod)');

  // DRUH má přednost — Cornus mas (dřín, stromy) očkuje se; Cornus kousa/florida (rod Cornus
  // není v GENERA) → null
  ok(typeCz('Dřín obecný') === 'summer', 'Cornus mas / dřín (stromy) → summer (species precedence)');
  ok(ruleCz('Svída japonská') === null, 'Cornus kousa (stromy, rod není v GENERA) → null');
  ok(ruleCz('Svída květnatá') === null, 'Cornus florida (stromy, rod není v GENERA) → null');

  // mimo gate / množí se jinak → null
  ok(ruleCz('Rybíz černý') === null, 'Ribes (ovoce, řízkuje se) → null');
  ok(ruleCz('Borůvka zahradní') === null, 'Vaccinium (ovoce, řízkuje se) → null');
  ok(ruleCz('Maliník červený') === null, 'Rubus (ovoce, odnože) → null');
  ok(ruleCz('Jahoda lesní') === null, 'Fragaria (ovoce, šlahouny) → null');
  ok(ruleCz('Bříza bělokorá') === null, 'Betula (stromy, generativně) → null');
  ok(ruleCz('Javor dlanitolistý') === null, 'Acer palmatum (stromy, není v mapě) → null');
  ok(ruleCz('Bobkovišeň lékařská') === null,
    'Bobkovišeň / Prunus laurocerasus (kere, mimo gate) → null i přes rod Prunus');
  ok(graftingRuleForPlant({ category: { key: 'kere' }, nameLat: 'Prunus laurocerasus' }) === null,
    'Prunus laurocerasus (kere) → null (gate ovoce/stromy vyřadí, i když rod Prunus)');
  ok(graftingRuleForPlant({ category: { key: 'zelenina' }, nameLat: 'Solanum lycopersicum' }) === null,
    'rajče (zelenina) → null (mimo gate)');
  ok(graftingRuleForPlant({ category: { key: 'trvalky' }, nameLat: 'Hosta sieboldiana' }) === null,
    'trvalka → null (mimo gate)');
  ok(graftingRuleForPlant(null) === null, 'bez rostliny → null');

  // integrita: žádný mrtvý klíč mapy (každý rod/druh existuje v reálné DB v gate ovoce/stromy)
  const generaInGate = new Set(
    enriched.filter((p) => p.category.key === 'ovoce' || p.category.key === 'stromy').map(genusOf),
  );
  for (const g of Object.keys(GRAFTING_GENERA)) {
    ok(generaInGate.has(g), `GRAFTING_GENERA: rod ${g} je v DB (ovoce/stromy) — žádný mrtvý klíč`);
  }
  for (const sp of Object.keys(GRAFTING_SPECIES)) {
    ok(enriched.some((p) => {
      const inGate = p.category.key === 'ovoce' || p.category.key === 'stromy';
      const l = String(p.nameLat || '');
      return inGate && (l === sp || l.startsWith(`${sp} `));
    }), `GRAFTING_SPECIES: druh ${sp} je v DB (ovoce/stromy) — žádný mrtvý klíč`);
  }

  // ---------- (2) Logika graftingTaskForPin (now-aware) ----------
  const pin = (tasks) => ({ id: 1, tasks: tasks || [] });
  const spring = { category: { key: 'stromy' }, nameLat: 'Malus domestica' }; // spring (month 4)
  const summer = { category: { key: 'stromy' }, nameLat: 'Prunus avium' };    // summer (month 8)

  {
    const r = graftingTaskForPin(pin(), spring, null, new Date(2030, 1, 10)); // únor → duben (~64 dní)
    ok(r.length === 1 && r[0].kind === 'grafting', 'únor: jabloň → návrh jarního roubování');
    ok(r[0].type === 'spring' && r[0].month === 4, 'spring → měsíc 4');
    ok(r[0].taskType === 'presazeni' && r[0].emoji === '🌳', 'task_type presazeni, emoji 🌳');
    ok(r[0].due >= 0 && r[0].due <= GRAFTING_HORIZON_DAYS, 'okno v budoucnu a v horizontu');
  }
  {
    const r = graftingTaskForPin(pin(), summer, null, new Date(2030, 5, 20)); // červen → srpen (~56 dní)
    ok(r.length === 1 && r[0].type === 'summer' && r[0].month === 8, 'červen: třešeň → letní očkování v srpnu');
  }

  // mimo horizont / po okně → skryto
  ok(graftingTaskForPin(pin(), spring, null, new Date(2029, 11, 15)).length === 0,
    'prosinec: dubnové okno >90 dní → skryto');
  ok(graftingTaskForPin(pin(), summer, null, new Date(2030, 2, 15)).length === 0,
    'březen: srpnové okno >90 dní → skryto');
  ok(graftingTaskForPin(pin(), spring, null, new Date(2030, 4, 10)).length === 0,
    'květen: dubnové okno minulo → příští rok >90 dní → skryto');

  // ---------- (3) Posun klim. zóny / expozice ----------
  {
    const base = graftingTaskForPin(pin(), summer, null, new Date(2030, 5, 20))[0];
    const north = graftingTaskForPin(pin(), summer, { exposure: 'N' }, new Date(2030, 5, 20))[0];
    ok(north.suggested > base.suggested, 'severní expozice → pozdější roubování');
    ok(getZoneOffsetDays('JHC') !== 0, 'climateZones: JHC má nenulový posun (kotva pro zónu)');
    const jhc = graftingTaskForPin(pin(), summer, { climate_zone: 'JHC' }, new Date(2030, 5, 20))[0];
    ok(jhc.suggested > base.suggested, 'klim. zóna JHC (chladnější) → pozdější roubování');
  }

  // ---------- (4) Dedup proti existujícímu roubování v měsíci ----------
  {
    const now = new Date(2030, 5, 20); // srpnové okno (summer)
    const y = now.getFullYear();
    const presaz = [{ title: 'X', task_type: 'presazeni', specific_date: `${y}-08-12` }];
    ok(graftingTaskForPin(pin(presaz), summer, null, now).length === 0, 'dedup: presazeni v srpnu → potlačeno');
    const roub = [{ title: '🌳 Naroubovat třešeň', task_type: 'jine', specific_date: `${y}-08-10` }];
    ok(graftingTaskForPin(pin(roub), summer, null, now).length === 0, 'dedup: titulek „roub" (jine) v srpnu → potlačeno');
    const ocko = [{ title: 'Letní očkování třešně', task_type: 'jine', specific_date: `${y}-08-05` }];
    ok(graftingTaskForPin(pin(ocko), summer, null, now).length === 0, 'dedup: titulek „očk" v srpnu → potlačeno');
    const step = [{ title: 'Přeštěpování', task_type: 'jine', specific_date: `${y}-08-08` }];
    ok(graftingTaskForPin(pin(step), summer, null, now).length === 0, 'dedup: titulek „štěp" v srpnu → potlačeno');
    const other = [{ title: '🌳 Naroubovat', task_type: 'presazeni', specific_date: `${y}-04-10` }];
    ok(graftingTaskForPin(pin(other), summer, null, now).length === 1, 'dedup: roubování v JINÉM měsíci nevadí → návrh svítí');
  }

  // ---------- (5) Chybějící vstup ----------
  ok(graftingTaskForPin(null, spring, null, new Date(2030, 1, 10)).length === 0, 'bez pinu → []');
  ok(graftingTaskForPin(pin(), null, null, new Date(2030, 1, 10)).length === 0, 'bez rostliny → []');

  console.log(`\n✅ All ${passed} grafting-tasks assertions passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
