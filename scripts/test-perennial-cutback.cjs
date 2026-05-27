// Sanity test pro „Sestřižení trvalek a okrasných trav — sezónní seříznutí nadzemní části".
// perennialCutback.js importuje RecommendedTasks.jsx (React/JSX) → nejde načíst v čistém node,
// proto REPLIKUJEME pure logiku (stejně jako test-fruit-thinning / test-grafting-tasks /
// test-division-tasks). Replika je věrná perennialCutback.js a je now-aware (deterministické testy).
// Gate + sezónní diskriminátor (SPRING_CUTBACK_GENERA) běží proti REÁLNÉ plantDatabase načtené
// dynamickým importem → ověří, že trvalky/trávy se klasifikují správně a dřeviny/cibuloviny/
// zelenina jsou vyřazené. dateForMonth/getConditionShiftDays = věrná replika; getZoneOffsetDays
// importujeme z reálného climateZones.js (jeden zdroj pravdy pro posun klim. zóny).
// Spuštění: node scripts/test-perennial-cutback.cjs
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

// ---------- replika pure logiky (perennialCutback.js) ----------
const CUTBACK_HORIZON_DAYS = 120;
const CUTBACK_EMOJI = '✂️';
const SPRING_MONTH = 3;
const AUTUMN_MONTH = 10;
const CUTBACK_CATEGORIES = new Set(['trvalky', 'travy']);
const SPRING_CUTBACK_GENERA = new Set([
  'Aster', 'Symphyotrichum', 'Sedum', 'Hylotelephium', 'Rudbeckia', 'Echinacea',
  'Solidago', 'Helenium', 'Helianthus', 'Chrysanthemum', 'Dendranthema', 'Anemone',
  'Miscanthus', 'Calamagrostis', 'Pennisetum', 'Panicum', 'Molinia', 'Stipa',
  'Deschampsia', 'Festuca', 'Carex', 'Helictotrichon', 'Juncus',
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
function cutbackSeasonForPlant(plant) {
  const cat = categoryKey(plant);
  if (cat === 'travy') return 'spring';
  if (cat === 'trvalky') {
    const genus = genusOf(plant);
    return genus && SPRING_CUTBACK_GENERA.has(genus) ? 'spring' : 'autumn';
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
function hasCutbackInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type === 'strihani') return true;
    const title = (e.title || '').trim();
    if (/sestřih|seříz/i.test(title)) return true;
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
  function perennialCutbackForPin(pin, plant, conditions, now) {
    if (!pin || !plant) return [];
    if (!CUTBACK_CATEGORIES.has(categoryKey(plant))) return [];
    const season = cutbackSeasonForPlant(plant);
    if (!season) return [];
    const month = season === 'spring' ? SPRING_MONTH : AUTUMN_MONTH;
    const suggested = dateForMonth(month, conditions, now);
    const due = daysFromToday(suggested, now);
    if (due === null || due < 0 || due > CUTBACK_HORIZON_DAYS) return [];
    const m = monthFromIso(suggested);
    if (hasCutbackInMonth(pin.tasks || [], m, now.getFullYear())) return [];
    return [{ kind: 'cutback', season, month: m, suggested, due, taskType: 'strihani', emoji: CUTBACK_EMOJI }];
  }

  // ---------- (1) Klasifikace sezóny proti REÁLNÉ DB ----------
  const db = await imp('frontend/src/plantDatabase.js');
  const enriched = db.PLANT_DATABASE.map(db.enrichPlant);
  const byCz = (name) => enriched.find((p) => p.nameCz === name);
  const seasonCz = (name) => cutbackSeasonForPlant(byCz(name));

  // měkké trvalky bez zimní hodnoty → podzim
  ok(seasonCz('Bohyška Halcyon') === 'autumn', 'bohyška (Hosta, trvalky) → podzim (měkká, zatáhne)');
  ok(seasonCz('Kakost Rozanne') === 'autumn', 'kakost (Geranium, trvalky) → podzim');
  ok(seasonCz('Čechrava Fanal') === 'autumn', 'čechrava (Astilbe, trvalky) → podzim');
  ok(seasonCz('Bergénie srdčitá') === 'autumn', 'bergénie (Bergenia, trvalky) → podzim');

  // strukturní pozdně/podzimně kvetoucí trvalky se zimní hodnotou → zjara
  ok(seasonCz('Rozchodník nádherný') === 'spring', 'rozchodník (Sedum, trvalky) → zjara (zimní silueta)');
  ok(seasonCz('Třapatka nachová') === 'spring', 'třapatka nachová (Echinacea, trvalky) → zjara');
  ok(seasonCz('Třapatka Goldsturm') === 'spring', 'třapatka (Rudbeckia, trvalky) → zjara');

  // okrasné trávy → VŽDY zjara (rašící trsy, zimní silueta, ochrana báze)
  ok(seasonCz('Ozdobnice čínská Gracillimus') === 'spring', 'ozdobnice (Miscanthus, travy) → zjara');
  ok(seasonCz('Kostřava sivá') === 'spring', 'kostřava (Festuca, travy) → zjara');
  ok(seasonCz('Ostřice Morrowova') === 'spring', 'ostřice (Carex, travy) → zjara');
  ok(seasonCz('Třtina Karl Foerster') === 'spring', 'třtina (Calamagrostis, travy) → zjara');

  // mimo gate → null
  ok(seasonCz('Jabloň') === null, 'jabloň (stromy/dřevina) → null (řez řeší ageTasks)');
  ok(cutbackSeasonForPlant({ category: { key: 'kere' }, nameLat: 'Buxus sempervirens' }) === null, 'keř → null');
  ok(cutbackSeasonForPlant({ category: { key: 'popinave' }, nameLat: 'Clematis vitalba' }) === null, 'popínavá → null');
  ok(cutbackSeasonForPlant({ category: { key: 'cibuloviny' }, nameLat: 'Tulipa gesneriana' }) === null, 'cibulovina → null');
  ok(cutbackSeasonForPlant({ category: { key: 'zelenina' }, nameLat: 'Solanum lycopersicum' }) === null, 'zelenina → null');
  ok(cutbackSeasonForPlant(null) === null, 'bez rostliny → null');
  // gate akceptuje i holý string kategorie
  ok(cutbackSeasonForPlant({ category: 'travy', nameLat: 'Festuca glauca' }) === 'spring', 'holý string category=travy → zjara');
  // forward-looking rod (Aster) ještě není v DB trvalky, ale diskriminátor ho klasifikuje zjara
  ok(cutbackSeasonForPlant({ category: { key: 'trvalky' }, nameLat: 'Aster novi-belgii' }) === 'spring',
    'Aster (forward-looking, trvalky) → zjara');

  // ---------- (2) Logika perennialCutbackForPin (now-aware) ----------
  const pin = (tasks) => ({ id: 1, tasks: tasks || [] });
  const hosta = { category: { key: 'trvalky' }, nameLat: "Hosta 'Halcyon'" };  // autumn (month 10)
  const sedum = { category: { key: 'trvalky' }, nameLat: 'Sedum spectabile' };  // spring (month 3)
  const grass = { category: { key: 'travy' }, nameLat: 'Miscanthus sinensis' }; // spring (month 3)

  {
    // srpen → říjen (autumn) ~75 dní → v horizontu
    const r = perennialCutbackForPin(pin(), hosta, null, new Date(2030, 7, 1));
    ok(r.length === 1 && r[0].kind === 'cutback', 'srpen: bohyška → návrh sestřihu');
    ok(r[0].season === 'autumn' && r[0].month === 10, 'měkká trvalka → podzim (měsíc 10)');
    ok(r[0].taskType === 'strihani' && r[0].emoji === '✂️', 'task_type strihani, emoji ✂️');
    ok(r[0].due >= 0 && r[0].due <= CUTBACK_HORIZON_DAYS, 'okno v budoucnu a v horizontu');
  }
  {
    // leden → březen (spring) ~64 dní → v horizontu
    const r = perennialCutbackForPin(pin(), sedum, null, new Date(2030, 0, 10));
    ok(r.length === 1 && r[0].season === 'spring' && r[0].month === 3, 'leden: rozchodník → zjara (měsíc 3)');
    const g = perennialCutbackForPin(pin(), grass, null, new Date(2030, 0, 10))[0];
    ok(g && g.season === 'spring' && g.month === 3, 'leden: okrasná tráva → zjara (měsíc 3)');
  }
  // nikdy do minulosti — pozdní březen (po 15.) → jarní okno minulo → []
  ok(perennialCutbackForPin(pin(), sedum, null, new Date(2030, 2, 25)).length === 0,
    'pozdní březen: jarní okno (15.) minulo → [] (nikdy do minulosti)');
  // mimo horizont → skryto
  ok(perennialCutbackForPin(pin(), hosta, null, new Date(2030, 0, 10)).length === 0,
    'leden: říjnové okno >120 dní → skryto');
  ok(perennialCutbackForPin(pin(), sedum, null, new Date(2030, 7, 1)).length === 0,
    'srpen: březnové okno příští rok >120 dní → skryto');
  // konec května (dnešní reálná sezóna) — žádné okno není v horizontu → karta nic neukáže
  ok(perennialCutbackForPin(pin(), hosta, null, new Date(2026, 4, 28)).length === 0,
    'konec května: říjnové okno >120 dní → skryto (žádné falešné svícení)');

  // ---------- (3) Posun klim. zóny / expozice (reálný getZoneOffsetDays) ----------
  {
    const base = perennialCutbackForPin(pin(), hosta, null, new Date(2030, 7, 1))[0];
    const north = perennialCutbackForPin(pin(), hosta, { exposure: 'N' }, new Date(2030, 7, 1))[0];
    ok(north.suggested > base.suggested, 'severní expozice → pozdější sestřih');
    ok(getZoneOffsetDays('JHC') !== 0, 'climateZones: JHC má nenulový posun (kotva pro zónu)');
    const jhc = perennialCutbackForPin(pin(), hosta, { climate_zone: 'JHC' }, new Date(2030, 7, 1))[0];
    ok(jhc.suggested > base.suggested, 'klim. zóna JHC (chladnější) → pozdější sestřih');
  }

  // ---------- (4) Dedup proti existujícímu řezu/sestřihu v měsíci ----------
  {
    const now = new Date(2030, 7, 1); // říjnové (autumn) okno pro Hosta
    const y = now.getFullYear();
    // task_type strihani v cílovém měsíci → potlačeno (širší dedup)
    const sameStrihani = [{ title: 'Řez', task_type: 'strihani', specific_date: `${y}-10-12` }];
    ok(perennialCutbackForPin(pin(sameStrihani), hosta, null, now).length === 0,
      'dedup: task_type strihani v říjnu → potlačeno');
    // vlastní slovesný titulek („Sestřihnout" → marker „sestřih") v cílovém měsíci → potlačeno
    const sestrihnout = [{ title: '✂️ Sestřihnout Bohyška', task_type: 'jine', specific_date: `${y}-10-10` }];
    ok(perennialCutbackForPin(pin(sestrihnout), hosta, null, now).length === 0,
      'dedup: titulek „Sestřihnout" v říjnu → potlačeno');
    const seriznuti = [{ title: 'Seříznout trvalku', task_type: 'jine', specific_date: `${y}-10-05` }];
    ok(perennialCutbackForPin(pin(seriznuti), hosta, null, now).length === 0,
      'dedup: titulek „Seříznout" v říjnu → potlačeno');
    // jiný úkon bez markeru a bez strihani v říjnu NEpotlačí
    const otherJine = [{ title: '🌾 Mulčování', task_type: 'jine', specific_date: `${y}-10-10` }];
    ok(perennialCutbackForPin(pin(otherJine), hosta, null, now).length === 1,
      'dedup: jiný úkon (jine, bez markeru) v říjnu → návrh svítí');
    // řez (strihani) v JINÉM měsíci nevadí
    const otherMonth = [{ title: 'Řez', task_type: 'strihani', specific_date: `${y}-06-10` }];
    ok(perennialCutbackForPin(pin(otherMonth), hosta, null, now).length === 1,
      'dedup: řez v JINÉM měsíci nevadí → návrh svítí');
    // loňský sestřih ve stejném měsíci nevadí (jednorázový z minulého roku)
    const lastYear = [{ title: 'Sestřih', task_type: 'strihani', specific_date: `${y - 1}-10-12` }];
    ok(perennialCutbackForPin(pin(lastYear), hosta, null, now).length === 1,
      'dedup: loňský sestřih v říjnu (jednorázový) → návrh svítí');
    // opakovaný úkon (frequency_days) s task_type strihani v cílovém měsíci potlačí bez ohledu na rok
    const repeating = [{ title: 'Pravidelný řez', task_type: 'strihani', next_due: '2099-10-01', frequency_days: 365 }];
    ok(perennialCutbackForPin(pin(repeating), hosta, null, now).length === 0,
      'dedup: opakovaný strihani v říjnu → potlačeno (bez ohledu na rok)');
  }

  // ---------- (5) Chybějící vstup ----------
  ok(perennialCutbackForPin(null, hosta, null, new Date(2030, 7, 1)).length === 0, 'bez pinu → []');
  ok(perennialCutbackForPin(pin(), null, null, new Date(2030, 7, 1)).length === 0, 'bez rostliny → []');

  console.log(`\n✅ All ${passed} perennial-cutback assertions passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
