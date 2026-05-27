// Sanity test pro „Bílení kmenů ovocných stromů na zimu — ochrana před mrazovými deskami".
// trunkWhitewash.js importuje RecommendedTasks.jsx (React/JSX) → nejde načíst v čistém node,
// proto REPLIKUJEME pure logiku (stejně jako test-grafting-tasks / test-cutting-tasks /
// test-bulb-planting). Replika je věrná trunkWhitewash.js a je now-aware (deterministické testy).
// Kategorie-gate běží proti REÁLNÉ plantDatabase načtené dynamickým importem → ověří, že
// ovocné stromy resolvují a zelenina/trvalka/cibulovina jsou vyřazené.
// dateForMonth/getConditionShiftDays = věrná replika; getZoneOffsetDays importujeme
// z reálného climateZones.js (jeden zdroj pravdy pro posun klim. zóny).
// Spuštění: node scripts/test-trunk-whitewash.cjs
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

// ---------- replika pure logiky (trunkWhitewash.js) ----------
const TRUNK_WHITEWASH_HORIZON_DAYS = 75;
const TRUNK_WHITEWASH_SEASON = [11, 12];
const TRUNK_WHITEWASH_IDEAL_MONTH = 11;
const TRUNK_WHITEWASH_EMOJI = '🪵';

function categoryKey(plant) {
  const c = plant && plant.category;
  if (!c) return null;
  return typeof c === 'string' ? c : c.key || null;
}
function trunkWhitewashAppliesTo(plant) {
  if (!plant) return false;
  const cat = categoryKey(plant);
  return cat === 'ovoce' || cat === 'stromy';
}
function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}
function isoToday(now) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function daysFromToday(dateStr, now) {
  if (!dateStr) return null;
  const today = new Date(now.getTime());
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}
function hasWhitewashInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    const title = (e.title || '').trim();
    if (/bíl|nátěr/i.test(title)) return true;
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
  function trunkWhitewashForPin(pin, plant, conditions, now) {
    if (!pin || !plant) return [];
    if (!trunkWhitewashAppliesTo(plant)) return [];
    const curMonth = now.getMonth() + 1;
    if (!TRUNK_WHITEWASH_SEASON.includes(curMonth)) return [];
    const anchorMonth = Math.max(TRUNK_WHITEWASH_IDEAL_MONTH, curMonth);
    let suggested = dateForMonth(anchorMonth, conditions, now);
    let due = daysFromToday(suggested, now);
    if (due === null) return [];
    if (due < 0) { suggested = isoToday(now); due = 0; }
    if (due > TRUNK_WHITEWASH_HORIZON_DAYS) return [];
    const m = monthFromIso(suggested);
    if (hasWhitewashInMonth(pin.tasks || [], m, now.getFullYear())) return [];
    return [{
      kind: 'trunkWhitewash', month: m, suggested, due,
      taskType: 'jine', emoji: TRUNK_WHITEWASH_EMOJI,
    }];
  }

  // ---------- (1) Kategorie-gate proti REÁLNÉ DB ----------
  const db = await imp('frontend/src/plantDatabase.js');
  const enriched = db.PLANT_DATABASE.map(db.enrichPlant);
  const byCz = (name) => enriched.find((p) => p.nameCz === name);
  const appliesCz = (name) => trunkWhitewashAppliesTo(byCz(name));

  ok(appliesCz('Jabloň') === true, 'jabloň (Malus, stromy) → bílení se týká');
  ok(appliesCz('Hruška') === true, 'hrušeň (Pyrus, stromy) → bílení se týká');
  ok(appliesCz('Třešeň') === true, 'třešeň (Prunus, stromy) → bílení se týká');
  ok(appliesCz('Švestka') === true, 'švestka (Prunus, stromy) → bílení se týká');
  ok(appliesCz('Meruňka') === true, 'meruňka (Prunus, stromy) → bílení se týká');
  ok(byCz('Jabloň').category.key === 'stromy' || byCz('Jabloň').category.key === 'ovoce',
    'integrita: jabloň je v gate kategorii (ovoce/stromy)');

  // mimo gate → false
  ok(trunkWhitewashAppliesTo(byCz('Rajče')) === false, 'rajče (zelenina) → mimo gate');
  ok(trunkWhitewashAppliesTo(byCz('Mrkev')) === false, 'mrkev (zelenina) → mimo gate');
  ok(trunkWhitewashAppliesTo(byCz('Tulipán')) === false, 'tulipán (cibulovina) → mimo gate');
  ok(trunkWhitewashAppliesTo({ category: { key: 'trvalky' }, nameLat: 'Hosta sieboldiana' }) === false,
    'trvalka (Hosta) → mimo gate');
  ok(trunkWhitewashAppliesTo({ category: { key: 'kere' }, nameLat: 'Buddleja davidii' }) === false,
    'keř (kere) → mimo gate (mladý kmínek z dat nepoznáme)');
  ok(trunkWhitewashAppliesTo(null) === false, 'bez rostliny → false');
  // string kategorie (před enrichPlant) také funguje
  ok(trunkWhitewashAppliesTo({ category: 'stromy', nameLat: 'Quercus robur' }) === true,
    'holý string category=stromy → bílení se týká');

  // ---------- (2) Logika trunkWhitewashForPin (now-aware) ----------
  const pin = (tasks) => ({ id: 1, tasks: tasks || [] });
  const tree = { category: { key: 'stromy' }, nameLat: 'Malus domestica' };
  const veg = { category: { key: 'zelenina' }, nameLat: 'Solanum lycopersicum' };

  {
    const r = trunkWhitewashForPin(pin(), tree, null, new Date(2030, 10, 3)); // 3. listopadu
    ok(r.length === 1 && r[0].kind === 'trunkWhitewash', 'listopad: jabloň → návrh bílení');
    ok(r[0].month === 11, 'listopadové okno → měsíc 11');
    ok(r[0].taskType === 'jine' && r[0].emoji === '🪵', 'task_type jine, emoji 🪵');
    ok(r[0].due >= 0 && r[0].due <= TRUNK_WHITEWASH_HORIZON_DAYS, 'okno v budoucnu a v horizontu');
  }
  {
    // pozdní listopad — ideál 15. 11. už minul → clamp na dnešek, nikdy do minulosti
    const now = new Date(2030, 10, 25); // 25. listopadu
    const r = trunkWhitewashForPin(pin(), tree, null, now)[0];
    ok(r && r.due === 0 && r.suggested === isoToday(now), 'pozdní listopad: ideál minul → naplánuj na dnešek');
    ok(r.month === 11, 'pozdní listopad: měsíc stále 11');
  }
  {
    // prosinec — kotvíme na prosinec (jinak rollover na listopad příštího roku)
    const r = trunkWhitewashForPin(pin(), tree, null, new Date(2030, 11, 5))[0]; // 5. prosince
    ok(r && r.month === 12, 'prosinec: kotva 12 → měsíc 12 (žádný rollover na příští rok)');
    ok(r.due >= 0 && r.due <= TRUNK_WHITEWASH_HORIZON_DAYS, 'prosinec: v budoucnu a v horizontu');
  }
  {
    // pozdní prosinec — ideál 15. 12. minul → clamp na dnešek
    const now = new Date(2030, 11, 28); // 28. prosince
    const r = trunkWhitewashForPin(pin(), tree, null, now)[0];
    ok(r && r.due === 0 && r.month === 12, 'pozdní prosinec: ideál minul → dnešek, měsíc 12');
  }

  // mimo sezónu (11–12) → []
  ok(trunkWhitewashForPin(pin(), tree, null, new Date(2030, 9, 15)).length === 0, 'říjen → mimo sezónu → []');
  ok(trunkWhitewashForPin(pin(), tree, null, new Date(2030, 0, 15)).length === 0, 'leden → mimo sezónu → []');
  ok(trunkWhitewashForPin(pin(), tree, null, new Date(2030, 2, 15)).length === 0, 'březen → mimo sezónu → []');
  ok(trunkWhitewashForPin(pin(), tree, null, new Date(2030, 7, 15)).length === 0, 'srpen → mimo sezónu → []');

  // mimo gate v sezóně → []
  ok(trunkWhitewashForPin(pin(), veg, null, new Date(2030, 10, 3)).length === 0, 'listopad: rajče (zelenina) → []');

  // ---------- (3) Posun klim. zóny / expozice ----------
  {
    const now = new Date(2030, 10, 3); // 3. listopadu (ideál v budoucnu pro všechny varianty)
    const base = trunkWhitewashForPin(pin(), tree, null, now)[0];
    const north = trunkWhitewashForPin(pin(), tree, { exposure: 'N' }, now)[0];
    ok(north.suggested > base.suggested, 'severní expozice → pozdější bílení (sdílený dateForMonth)');
    ok(getZoneOffsetDays('JHC') !== 0, 'climateZones: JHC má nenulový posun (kotva pro zónu)');
    const jhc = trunkWhitewashForPin(pin(), tree, { climate_zone: 'JHC' }, now)[0];
    ok(jhc.suggested > base.suggested, 'klim. zóna JHC (chladnější) → pozdější bílení');
    ok(north.due <= TRUNK_WHITEWASH_HORIZON_DAYS && jhc.due <= TRUNK_WHITEWASH_HORIZON_DAYS,
      'posunuté termíny stále v horizontu');
  }

  // ---------- (4) Dedup proti existujícímu bílení v měsíci ----------
  {
    const now = new Date(2030, 10, 3); // listopadové okno (měsíc 11)
    const y = now.getFullYear();
    const bil = [{ title: '🪵 Nabílit kmen Jabloň', task_type: 'jine', specific_date: `${y}-11-10` }];
    ok(trunkWhitewashForPin(pin(bil), tree, null, now).length === 0, 'dedup: titulek „bíl" v listopadu → potlačeno');
    const nater = [{ title: 'Vápenný nátěr kmene', task_type: 'jine', specific_date: `${y}-11-12` }];
    ok(trunkWhitewashForPin(pin(nater), tree, null, now).length === 0, 'dedup: titulek „nátěr" v listopadu → potlačeno');
    // 'jine' bez markeru bílení → NEdedupovat (task_type je příliš obecný)
    const jine = [{ title: 'Úklid zahrady', task_type: 'jine', specific_date: `${y}-11-08` }];
    ok(trunkWhitewashForPin(pin(jine), tree, null, now).length === 1, 'dedup: jiný „jine" úkol bez markeru → návrh svítí');
    // bílení v JINÉM měsíci (prosinec) než cílový (listopad) → nevadí
    const other = [{ title: '🪵 Nabílit kmen Jabloň', task_type: 'jine', specific_date: `${y}-12-10` }];
    ok(trunkWhitewashForPin(pin(other), tree, null, now).length === 1, 'dedup: bílení v JINÉM měsíci nevadí → návrh svítí');
    // loňské bílení (jednorázové) v listopadu → nevadí (jiný rok)
    const lastYear = [{ title: '🪵 Nabílit kmen Jabloň', task_type: 'jine', specific_date: `${y - 1}-11-10` }];
    ok(trunkWhitewashForPin(pin(lastYear), tree, null, now).length === 1, 'dedup: loňské bílení (jiný rok) → návrh svítí');
  }

  // ---------- (5) Chybějící vstup ----------
  ok(trunkWhitewashForPin(null, tree, null, new Date(2030, 10, 3)).length === 0, 'bez pinu → []');
  ok(trunkWhitewashForPin(pin(), null, null, new Date(2030, 10, 3)).length === 0, 'bez rostliny → []');

  console.log(`\n✅ All ${passed} trunk-whitewash assertions passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
