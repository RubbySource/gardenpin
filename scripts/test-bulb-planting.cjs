// Sanity test pro „Podzimní výsadba jarních cibulovin — kdy zasadit tulipány, narcisy,
// krokusy". bulbPlanting.js importuje RecommendedTasks.jsx (React/JSX) → nejde načíst
// v čistém node, proto REPLIKUJEME pure logiku (stejně jako test-sowing-tasks /
// test-division-tasks / test-winter-prep). Replika je věrná bulbPlanting.js a je now-aware
// (deterministické testy). Matchování SPRING_BULB_GENERA běží proti REÁLNÉ plantDatabase
// načtené dynamickým importem → ověří, že kurátorská mapa sedí na skutečná data a letní/
// /podzimní cibule (Gladiolus/Lilium) jsou vyřazené.
// dateForMonth/getConditionShiftDays = věrná replika; getZoneOffsetDays importujeme
// z reálného climateZones.js (jeden zdroj pravdy pro posun klim. zóny).
// Spuštění: node scripts/test-bulb-planting.cjs
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

// ---------- replika pure logiky (bulbPlanting.js) ----------
const BULB_PLANTING_HORIZON_DAYS = 75;
const BULB_EMOJI = '🌷';
const BULB_CATEGORY = 'cibuloviny';
const SPRING_BULB_GENERA = {
  Tulipa:      { month: 10, depthCm: 15 },
  Narcissus:   { month: 9,  depthCm: 15 },
  Crocus:      { month: 9,  depthCm: 8 },
  Hyacinthus:  { month: 10, depthCm: 15 },
  Muscari:     { month: 9,  depthCm: 8 },
  Allium:      { month: 9,  depthCm: 15 },
  Fritillaria: { month: 9,  depthCm: 20 },
  Galanthus:   { month: 9,  depthCm: 8 },
  Scilla:      { month: 9,  depthCm: 8 },
  Chionodoxa:  { month: 9,  depthCm: 8 },
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
function bulbRuleForPlant(plant) {
  if (!plant) return null;
  if (categoryKey(plant) !== BULB_CATEGORY) return null;
  const genus = genusOf(plant);
  return genus && SPRING_BULB_GENERA[genus] ? SPRING_BULB_GENERA[genus] : null;
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
function hasBulbPlantingInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type === 'presazeni') return true;
    const title = (e.title || '').trim();
    if (title.startsWith(BULB_EMOJI) || /cibul/i.test(title)) return true;
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
  function bulbPlantingForPin(pin, plant, conditions, now) {
    if (!pin || !plant) return [];
    const rule = bulbRuleForPlant(plant);
    if (!rule) return [];
    const suggested = dateForMonth(rule.month, conditions, now);
    const due = daysFromToday(suggested, now);
    if (due === null || due < 0 || due > BULB_PLANTING_HORIZON_DAYS) return [];
    const m = monthFromIso(suggested);
    if (hasBulbPlantingInMonth(pin.tasks || [], m, now.getFullYear())) return [];
    return [{
      kind: 'bulbPlanting', month: m, depthCm: rule.depthCm,
      suggested, due, taskType: 'presazeni', emoji: BULB_EMOJI,
    }];
  }

  // ---------- (1) Matchování SPRING_BULB_GENERA proti REÁLNÉ DB ----------
  const db = await imp('frontend/src/plantDatabase.js');
  const enriched = db.PLANT_DATABASE.map(db.enrichPlant);
  const byCz = (name) => enriched.find((p) => p.nameCz === name);
  const rule = (name) => bulbRuleForPlant(byCz(name));

  // jarní cibuloviny v DB → resolvují s očekávaným měsícem/hloubkou
  ok(rule('Tulipán') && rule('Tulipán').month === 10 && rule('Tulipán').depthCm === 15, 'tulipán (Tulipa) → výsadba 10, hloubka 15 cm');
  ok(rule('Narcis') && rule('Narcis').month === 9, 'narcis (Narcissus) → výsadba 9');
  ok(rule('Hyacint') && rule('Hyacint').month === 10, 'hyacint (Hyacinthus) → výsadba 10');
  ok(rule('Sněženka podsněžník') && rule('Sněženka podsněžník').month === 9 && rule('Sněženka podsněžník').depthCm === 8,
    'sněženka (Galanthus) → výsadba 9, mělce 8 cm');
  ok(rule('Česnek okrasný') && rule('Česnek okrasný').month === 9 && rule('Česnek okrasný').depthCm === 15,
    'okrasný česnek (Allium giganteum) → výsadba 9, 15 cm');

  // letní / podzimní cibule + ne-cibule → VYŘAZENY (null)
  ok(rule('Gladiola') === null, 'gladiola (Gladiolus) → letní kvetení, sází se zjara → null (řeší winterPrep lift)');
  ok(rule('Lilie') === null, 'lilie (Lilium) → letní kvetení, sází se i zjara → null');
  ok(rule('Lobelka') === null, 'lobelka (Lobelia, legacy záznam) → není pravá cibule → null');
  ok(rule('Křivatec žlutý') === null, 'křivatec (Gagea, planý druh) → mimo kurátorskou mapu → null');

  // integrita: každá cibulovina v DB buď resolvuje, nebo je vědomá výjimka (žádný tichý gap)
  const bulbsInDb = enriched.filter((p) => p.category.key === BULB_CATEGORY);
  const KNOWN_EXCLUDED = new Set(['Gladiolus', 'Lilium', 'Lobelia', 'Gagea']);
  for (const p of bulbsInDb) {
    const g = genusOf(p);
    const matched = !!(g && SPRING_BULB_GENERA[g]);
    ok(matched || KNOWN_EXCLUDED.has(g), `cibulovina v DB pokryta: ${p.nameCz} (${g}) → ${matched ? 'match' : 'vědomá výjimka'}`);
  }

  // mapa záměrně OBSAHUJE i forward-looking rody (zatím mimo DB) — dokumentováno, ne mrtvý kód
  const inDbGenera = new Set(bulbsInDb.map(genusOf));
  ok(!inDbGenera.has('Crocus') && !!SPRING_BULB_GENERA.Crocus, 'Crocus = forward-looking klíč (v mapě, zatím mimo DB)');

  // ---------- (2) Kategorie gate ----------
  ok(bulbRuleForPlant({ category: { key: 'zelenina' }, nameLat: 'Allium cepa' }) === null,
    'kategorie gate: Allium cepa (cibule, zelenina) → null (jen cibuloviny matchují)');
  ok(bulbRuleForPlant({ category: { key: 'letnicky' }, nameLat: 'Tulipa gesneriana' }) === null,
    'kategorie gate: Tulipa mimo cibuloviny → null');
  ok(bulbRuleForPlant(db.findPlantByName('Hortenzie Annabelle')) === null, 'keř → null');
  ok(bulbRuleForPlant(null) === null, 'bez rostliny → null');

  // ---------- (3) Logika bulbPlantingForPin (now-aware) ----------
  const tulip = { category: { key: 'cibuloviny' }, nameLat: 'Tulipa' };
  const pin = (tasks) => ({ id: 1, tasks: tasks || [] });
  const NOW_AUG = new Date(2030, 7, 20);  // srpen → říjnová výsadba (~55 dní) v budoucnu & horizontu
  const NOW_MAY = new Date(2030, 4, 27);  // květen → říjnová výsadba >75 dní → mimo horizont
  const NOW_NOV = new Date(2030, 10, 20); // pozdní listopad → říjnové okno už za námi → příští rok → mimo horizont

  {
    const r = bulbPlantingForPin(pin(), tulip, null, NOW_AUG);
    ok(r.length === 1 && r[0].kind === 'bulbPlanting', 'srpen: tulipán → návrh výsadby');
    ok(r[0].taskType === 'presazeni' && r[0].emoji === '🌷', 'výsadba: task_type presazeni, emoji 🌷');
    ok(r[0].month === 10, 'výsadba tulipánů v říjnu');
    ok(r[0].depthCm === 15, 'hint nese hloubku 15 cm');
    ok(r[0].due >= 0 && r[0].due <= BULB_PLANTING_HORIZON_DAYS, 'výsadba v budoucnu a v horizontu');
  }
  ok(bulbPlantingForPin(pin(), tulip, null, NOW_MAY).length === 0, 'květen: výsadba až za >75 dní → skryto');
  ok(bulbPlantingForPin(pin(), tulip, null, NOW_NOV).length === 0, 'pozdní listopad: říjnové okno minulo → příští rok >75 dní → skryto');

  // sněženka (září) z pozdního července je v horizontu
  const snow = { category: { key: 'cibuloviny' }, nameLat: 'Galanthus nivalis' };
  {
    const r = bulbPlantingForPin(pin(), snow, null, new Date(2030, 6, 20)); // 20. července → ~15. září ≈ 57 dní
    ok(r.length === 1 && r[0].month === 9, 'červenec: sněženka → zářijová výsadba v horizontu');
  }

  // ---------- (4) Posun klim. zóny / expozice ----------
  {
    const base = bulbPlantingForPin(pin(), tulip, null, NOW_AUG)[0];
    const north = bulbPlantingForPin(pin(), tulip, { exposure: 'N' }, NOW_AUG)[0];
    ok(north.suggested > base.suggested, 'severní expozice → pozdější výsadba');
    ok(getZoneOffsetDays('JHC') !== 0, 'climateZones: JHC má nenulový posun (kotva pro zónu)');
    const jhc = bulbPlantingForPin(pin(), tulip, { climate_zone: 'JHC' }, NOW_AUG)[0];
    ok(jhc.suggested > base.suggested, 'klim. zóna JHC (+dny, chladnější) → pozdější výsadba');
  }

  // ---------- (5) Dedup proti existující výsadbě v měsíci ----------
  {
    const curYear = NOW_AUG.getFullYear();
    const presaz = [{ title: 'X', task_type: 'presazeni', specific_date: `${curYear}-10-15` }];
    ok(bulbPlantingForPin(pin(presaz), tulip, null, NOW_AUG).length === 0, 'dedup: presazeni v říjnu → potlačeno');
    const emoji = [{ title: '🌷 Zasadit cibule tulipán', task_type: 'jine', specific_date: `${curYear}-10-12` }];
    ok(bulbPlantingForPin(pin(emoji), tulip, null, NOW_AUG).length === 0, 'dedup: 🌷 titulek (jine) v říjnu → potlačeno');
    const cibul = [{ title: 'Výsadba cibulí', task_type: 'jine', specific_date: `${curYear}-10-05` }];
    ok(bulbPlantingForPin(pin(cibul), tulip, null, NOW_AUG).length === 0, 'dedup: titulek „cibul" v říjnu → potlačeno');
    const other = [{ title: '🌷 Zasadit cibule tulipán', task_type: 'presazeni', specific_date: `${curYear}-08-10` }];
    ok(bulbPlantingForPin(pin(other), tulip, null, NOW_AUG).length === 1, 'dedup: výsadba v JINÉM měsíci nevadí → návrh svítí');
  }

  // ---------- (6) Chybějící vstup ----------
  ok(bulbPlantingForPin(null, tulip, null, NOW_AUG).length === 0, 'bez pinu → []');
  ok(bulbPlantingForPin(pin(), null, null, NOW_AUG).length === 0, 'bez rostliny → []');

  console.log(`\n✅ All ${passed} bulb-planting assertions passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
