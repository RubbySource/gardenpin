// Sanity test pro „Množení řízkováním — kdy nařezat a zakořenit řízky keřů a trvalek".
// cuttingTasks.js importuje RecommendedTasks.jsx (React/JSX) → nejde načíst v čistém node,
// proto REPLIKUJEME pure logiku (stejně jako test-bulb-planting / test-sowing-tasks /
// test-division-tasks / test-winter-prep). Replika je věrná cuttingTasks.js a je now-aware
// (deterministické testy). Matchování CUTTING_WOODY/SEMIWOODY/SPECIES běží proti REÁLNÉ
// plantDatabase načtené dynamickým importem → ověří, že kurátorská mapa sedí na skutečná
// data (žádné mrtvé klíče) a rody množené jinak (Magnolia/Rhododendron) / mimo gate
// (stromy/ovoce/zelenina) jsou vyřazené.
// dateForMonth/getConditionShiftDays = věrná replika; getZoneOffsetDays importujeme
// z reálného climateZones.js (jeden zdroj pravdy pro posun klim. zóny).
// Spuštění: node scripts/test-cutting-tasks.cjs
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

// ---------- replika pure logiky (cuttingTasks.js) ----------
const CUTTING_HORIZON_DAYS = 90;
const CUTTING_EMOJI = '✂️';
const CUTTING_TYPES = {
  softwood: { month: 6 },
  semiripe: { month: 8 },
  hardwood: { month: 11 },
};
const CUTTING_WOODY = {
  Buddleja: 'softwood', Hydrangea: 'softwood', Philadelphus: 'softwood', Deutzia: 'softwood',
  Weigela: 'softwood', Spiraea: 'softwood', Perovskia: 'softwood', Kolkwitzia: 'softwood',
  Potentilla: 'softwood',
  Buxus: 'semiripe', Berberis: 'semiripe', Cotoneaster: 'semiripe', Cotinus: 'semiripe',
  Euonymus: 'semiripe', Lonicera: 'semiripe', Photinia: 'semiripe', Pieris: 'semiripe',
  Skimmia: 'semiripe', Viburnum: 'semiripe', Osmanthus: 'semiripe', Mahonia: 'semiripe',
  Aucuba: 'semiripe', Ilex: 'semiripe', Clematis: 'semiripe', Hedera: 'semiripe',
  Campsis: 'semiripe',
  Cornus: 'hardwood', Forsythia: 'hardwood', Sambucus: 'hardwood', Ligustrum: 'hardwood',
  Symphoricarpos: 'hardwood', Physocarpus: 'hardwood', Parthenocissus: 'hardwood',
};
const CUTTING_SEMIWOODY = { Lavandula: 'semiripe', Pelargonium: 'softwood', Fuchsia: 'softwood' };
const CUTTING_SPECIES = { 'Salvia officinalis': 'semiripe', 'Salvia rosmarinus': 'semiripe' };

function categoryKey(plant) {
  const c = plant && plant.category;
  if (!c) return null;
  return typeof c === 'string' ? c : c.key || null;
}
function genusOf(plant) {
  const lat = String((plant && plant.nameLat) || '').trim();
  return lat ? lat.split(/\s+/)[0] || null : null;
}
function cuttingRuleForPlant(plant) {
  if (!plant) return null;
  const lat = String(plant.nameLat || '').trim();
  for (const sp in CUTTING_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return { type: CUTTING_SPECIES[sp] };
  }
  const genus = genusOf(plant);
  if (!genus) return null;
  if (CUTTING_SEMIWOODY[genus]) return { type: CUTTING_SEMIWOODY[genus] };
  const cat = categoryKey(plant);
  if ((cat === 'kere' || cat === 'popinave') && CUTTING_WOODY[genus]) {
    return { type: CUTTING_WOODY[genus] };
  }
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
function hasCuttingInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type === 'presazeni') return true;
    const title = (e.title || '').trim();
    if (/říz(k|n)|množ/i.test(title)) return true;
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
  function cuttingTaskForPin(pin, plant, conditions, now) {
    if (!pin || !plant) return [];
    const rule = cuttingRuleForPlant(plant);
    if (!rule) return [];
    const typeDef = CUTTING_TYPES[rule.type];
    if (!typeDef) return [];
    const suggested = dateForMonth(typeDef.month, conditions, now);
    const due = daysFromToday(suggested, now);
    if (due === null || due < 0 || due > CUTTING_HORIZON_DAYS) return [];
    const m = monthFromIso(suggested);
    if (hasCuttingInMonth(pin.tasks || [], m, now.getFullYear())) return [];
    return [{
      kind: 'cutting', type: rule.type, month: m, suggested, due,
      taskType: 'presazeni', emoji: CUTTING_EMOJI,
    }];
  }

  // ---------- (1) Matchování map proti REÁLNÉ DB ----------
  const db = await imp('frontend/src/plantDatabase.js');
  const enriched = db.PLANT_DATABASE.map(db.enrichPlant);
  const byCz = (name) => enriched.find((p) => p.nameCz === name);
  const ruleCz = (name) => cuttingRuleForPlant(byCz(name));
  const typeCz = (name) => { const r = ruleCz(name); return r && r.type; };

  // dřeviny (kere/popinave) → resolvují s očekávaným typem řízku
  ok(typeCz('Komule Black Knight') === 'softwood', 'komule (Buddleja, kere) → softwood');
  ok(typeCz('Hortenzie Annabelle') === 'softwood', 'hortenzie (Hydrangea, kere) → softwood');
  ok(typeCz('Hortenzie velkokvětá') === 'softwood', 'Hydrangea macrophylla (kere) → softwood');
  ok(typeCz('Svída bílá Sibirica') === 'hardwood', 'svída (Cornus alba, kere) → hardwood');
  ok(typeCz('Zlatice Lynwood') === 'hardwood', 'zlatice (Forsythia, kere) → hardwood');
  ok(typeCz('Buxus zimostráz') === 'semiripe', 'zimostráz (Buxus, kere) → semiripe');
  ok(typeCz('Plamének Jackmanii') === 'semiripe', 'plamének (Clematis, popinave) → semiripe');

  // polodřevité trvalky/byliny mimo kere/popinave → cross-category match
  ok(typeCz('Levandule') === 'semiripe', 'levandule (Lavandula, bylinky) → semiripe (cross-category)');
  ok(typeCz('Fuchsie') === 'softwood', 'fuchsie (Fuchsia, okrasné) → softwood (cross-category)');
  ok(typeCz('Pelargónie (Muškát)') === 'softwood', 'pelargonie (Pelargonium, okrasné) → softwood (cross-category)');

  // DRUH má přednost — Salvia officinalis/rosmarinus řízkovat, S. nemorosa NE (dělí se)
  ok(typeCz('Šalvěj lékařská') === 'semiripe', 'Salvia officinalis (bylinky) → semiripe (species)');
  ok(typeCz('Rozmarýn') === 'semiripe', 'Salvia rosmarinus / rozmarýn (bylinky) → semiripe (species)');
  ok(ruleCz('Šalvěj hajní') === null, 'Salvia nemorosa (trvalka, bylinný trs) → null (dělí se, ne řízkuje)');

  // mimo gate / rody množené jinak → null
  ok(ruleCz('Svída japonská') === null, 'Cornus kousa (strom) → null (gate kere/popinave)');
  ok(cuttingRuleForPlant({ category: { key: 'kere' }, nameLat: 'Magnolia soulangeana' }) === null,
    'Magnolia (kere, ale roubuje/hříží se) → null (mimo kurátorskou mapu)');
  ok(cuttingRuleForPlant({ category: { key: 'kere' }, nameLat: 'Rhododendron catawbiense' }) === null,
    'Rhododendron (kere, hříží se) → null');
  ok(cuttingRuleForPlant({ category: { key: 'kere' }, nameLat: 'Syringa vulgaris' }) === null,
    'Syringa (kere, odkopky/roubování) → null');
  ok(cuttingRuleForPlant({ category: { key: 'ovoce' }, nameLat: 'Ribes rubrum' }) === null,
    'Ribes (ovoce) → null (mimo gate kere/popinave)');
  ok(cuttingRuleForPlant({ category: { key: 'zelenina' }, nameLat: 'Solanum lycopersicum' }) === null,
    'rajče (zelenina) → null (mimo gate)');
  ok(cuttingRuleForPlant(null) === null, 'bez rostliny → null');

  // integrita: žádný mrtvý klíč mapy (každý rod/druh existuje v reálné DB)
  const woodyInGate = new Set(
    enriched.filter((p) => p.category.key === 'kere' || p.category.key === 'popinave').map(genusOf),
  );
  for (const g of Object.keys(CUTTING_WOODY)) {
    ok(woodyInGate.has(g), `CUTTING_WOODY: rod ${g} je v DB (kere/popinave) — žádný mrtvý klíč`);
  }
  const allGenera = new Set(enriched.map(genusOf));
  for (const g of Object.keys(CUTTING_SEMIWOODY)) {
    ok(allGenera.has(g), `CUTTING_SEMIWOODY: rod ${g} je v DB — žádný mrtvý klíč`);
  }
  for (const sp of Object.keys(CUTTING_SPECIES)) {
    ok(enriched.some((p) => { const l = String(p.nameLat || ''); return l === sp || l.startsWith(`${sp} `); }),
      `CUTTING_SPECIES: druh ${sp} je v DB — žádný mrtvý klíč`);
  }

  // ---------- (2) Logika cuttingTaskForPin (now-aware) ----------
  const pin = (tasks) => ({ id: 1, tasks: tasks || [] });
  const softwood = { category: { key: 'okrasne' }, nameLat: 'Fuchsia' };           // softwood (cross-cat)
  const semiripe = { category: { key: 'kere' }, nameLat: 'Buxus sempervirens' };   // semiripe
  const hardwood = { category: { key: 'kere' }, nameLat: 'Cornus alba' };          // hardwood

  {
    const r = cuttingTaskForPin(pin(), softwood, null, new Date(2030, 3, 10)); // duben → červen (~66 dní)
    ok(r.length === 1 && r[0].kind === 'cutting', 'duben: fuchsie → návrh bylinného řízku');
    ok(r[0].type === 'softwood' && r[0].month === 6, 'softwood → měsíc 6');
    ok(r[0].taskType === 'presazeni' && r[0].emoji === '✂️', 'task_type presazeni, emoji ✂️');
    ok(r[0].due >= 0 && r[0].due <= CUTTING_HORIZON_DAYS, 'okno v budoucnu a v horizontu');
  }
  {
    const r = cuttingTaskForPin(pin(), semiripe, null, new Date(2030, 5, 20)); // červen → srpen (~56 dní)
    ok(r.length === 1 && r[0].type === 'semiripe' && r[0].month === 8, 'červen: zimostráz → polovyzrálý řízek v srpnu');
  }
  {
    const r = cuttingTaskForPin(pin(), hardwood, null, new Date(2030, 8, 10)); // září → listopad (~66 dní)
    ok(r.length === 1 && r[0].type === 'hardwood' && r[0].month === 11, 'září: svída → dřevitý řízek v listopadu');
  }

  // mimo horizont / po okně → skryto
  ok(cuttingTaskForPin(pin(), semiripe, null, new Date(2030, 2, 15)).length === 0,
    'březen: srpnové okno >90 dní → skryto');
  ok(cuttingTaskForPin(pin(), hardwood, null, new Date(2030, 4, 20)).length === 0,
    'květen: listopadové okno >90 dní → skryto');
  ok(cuttingTaskForPin(pin(), softwood, null, new Date(2030, 6, 10)).length === 0,
    'červenec: červnové okno minulo → příští rok >90 dní → skryto');

  // ---------- (3) Posun klim. zóny / expozice ----------
  {
    const base = cuttingTaskForPin(pin(), semiripe, null, new Date(2030, 5, 20))[0];
    const north = cuttingTaskForPin(pin(), semiripe, { exposure: 'N' }, new Date(2030, 5, 20))[0];
    ok(north.suggested > base.suggested, 'severní expozice → pozdější řízkování');
    ok(getZoneOffsetDays('JHC') !== 0, 'climateZones: JHC má nenulový posun (kotva pro zónu)');
    const jhc = cuttingTaskForPin(pin(), semiripe, { climate_zone: 'JHC' }, new Date(2030, 5, 20))[0];
    ok(jhc.suggested > base.suggested, 'klim. zóna JHC (chladnější) → pozdější řízkování');
  }

  // ---------- (4) Dedup proti existujícímu množení v měsíci ----------
  {
    const now = new Date(2030, 5, 20); // srpnové okno (semiripe)
    const y = now.getFullYear();
    const presaz = [{ title: 'X', task_type: 'presazeni', specific_date: `${y}-08-12` }];
    ok(cuttingTaskForPin(pin(presaz), semiripe, null, now).length === 0, 'dedup: presazeni v srpnu → potlačeno');
    const rizk = [{ title: '✂️ Nařezat řízky zimostrázu', task_type: 'jine', specific_date: `${y}-08-10` }];
    ok(cuttingTaskForPin(pin(rizk), semiripe, null, now).length === 0, 'dedup: titulek „řízk" (jine) v srpnu → potlačeno');
    const mnoz = [{ title: 'Množení zimostrázu', task_type: 'jine', specific_date: `${y}-08-05` }];
    ok(cuttingTaskForPin(pin(mnoz), semiripe, null, now).length === 0, 'dedup: titulek „množ" v srpnu → potlačeno');
    // řez (strihani, ✂️ emoji) v cílovém měsíci NESMÍ potlačit řízkový nudge
    const rez = [{ title: '✂️ Letní řez zimostrázu', task_type: 'strihani', specific_date: `${y}-08-08` }];
    ok(cuttingTaskForPin(pin(rez), semiripe, null, now).length === 1, 'dedup: ✂️ řez (strihani) v srpnu → NEpotlačí (jiný úkon)');
    const other = [{ title: '✂️ Nařezat řízky', task_type: 'presazeni', specific_date: `${y}-06-10` }];
    ok(cuttingTaskForPin(pin(other), semiripe, null, now).length === 1, 'dedup: množení v JINÉM měsíci nevadí → návrh svítí');
  }

  // ---------- (5) Chybějící vstup ----------
  ok(cuttingTaskForPin(null, softwood, null, new Date(2030, 3, 10)).length === 0, 'bez pinu → []');
  ok(cuttingTaskForPin(pin(), null, null, new Date(2030, 3, 10)).length === 0, 'bez rostliny → []');

  console.log(`\n✅ All ${passed} cutting-tasks assertions passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
