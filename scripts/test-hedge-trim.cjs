// Sanity test pro „Stříhání živých plotů — letní tvarovací řez formálních plotů".
// hedgeTrim.js importuje RecommendedTasks.jsx (React/JSX) → nejde načíst v čistém node, proto
// REPLIKUJEME pure logiku (stejně jako test-perennial-cutback / test-plant-supports / test-
// fruit-thinning). Replika je věrná hedgeTrim.js a je now-aware (deterministické testy).
// Gate + selektor (HEDGE_GENERA/HEDGE_SPECIES) běží proti REÁLNÉ plantDatabase načtené dynamickým
// importem → ověří, že plotové dřeviny resolvují, kolize (pnoucí zimolez, lípa, borovice/smrk
// jako stromy/jehličnany mimo mapu) → null, a že mapa nemá MRTVÝ KLÍČ. dateForMonth/
// getConditionShiftDays = věrná replika; getZoneOffsetDays z reálného climateZones.js.
// Spuštění: node scripts/test-hedge-trim.cjs
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

// ---------- replika pure logiky (hedgeTrim.js) ----------
const HEDGE_TRIM_HORIZON_DAYS = 75;
const HEDGE_TRIM_EMOJI = '✂️';
const HEDGE_TRIM_WINDOWS = { summer1: { month: 7 }, summer2: { month: 9 } };
const HEDGE_CATEGORIES = new Set(['kere', 'stromy', 'jehlicnany']);
const HEDGE_GENERA = new Set(['Buxus', 'Ligustrum', 'Carpinus', 'Taxus', 'Thuja', 'Berberis', 'Photinia']);
const HEDGE_SPECIES = new Set(['Lonicera nitida']);

function categoryKey(plant) {
  const c = plant && plant.category;
  if (!c) return null;
  return typeof c === 'string' ? c : c.key || null;
}
function genusOf(plant) {
  const lat = String((plant && plant.nameLat) || '').trim();
  return lat ? lat.split(/\s+/)[0] || null : null;
}
function isHedgePlant(plant) {
  if (!plant) return false;
  const cat = categoryKey(plant);
  if (!cat || !HEDGE_CATEGORIES.has(cat)) return false;
  const lat = String(plant.nameLat || '').trim();
  for (const sp of HEDGE_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return true;
  }
  const genus = genusOf(plant);
  return !!(genus && HEDGE_GENERA.has(genus));
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
function hasHedgeTrimInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type === 'strihani') return true;
    const title = (e.title || '').trim();
    if (/plot|sestřih|tvarov/i.test(title)) return true;
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
  function hedgeTrimForPin(pin, plant, conditions, now) {
    if (!pin || !plant) return [];
    if (!isHedgePlant(plant)) return [];
    const curYear = now.getFullYear();
    let best = null;
    for (const window of Object.keys(HEDGE_TRIM_WINDOWS)) {
      const suggested = dateForMonth(HEDGE_TRIM_WINDOWS[window].month, conditions, now);
      const due = daysFromToday(suggested, now);
      if (due === null || due < 0 || due > HEDGE_TRIM_HORIZON_DAYS) continue;
      const m = monthFromIso(suggested);
      if (hasHedgeTrimInMonth(pin.tasks || [], m, curYear)) continue;
      if (!best || due < best.due) best = { window, month: m, suggested, due };
    }
    if (!best) return [];
    return [{ kind: 'hedgeTrim', window: best.window, month: best.month, suggested: best.suggested, due: best.due, taskType: 'strihani', emoji: HEDGE_TRIM_EMOJI }];
  }

  // ---------- (1) Gate + selektor proti REÁLNÉ DB ----------
  const db = await imp('frontend/src/plantDatabase.js');
  const enriched = db.PLANT_DATABASE.map(db.enrichPlant);
  const byCz = (name) => enriched.find((p) => p.nameCz === name);
  const hedge = (name) => isHedgePlant(byCz(name));

  // plotové dřeviny → true
  ok(hedge('Buxus (zimostráz)') === true, 'zimostráz (Buxus, kere) → plot');
  ok(hedge('Ptačí zob obecný') === true, 'ptačí zob (Ligustrum, kere) → plot');
  ok(hedge('Habr obecný') === true, 'habr (Carpinus, stromy) → plot');
  ok(hedge('Tis červený') === true, 'tis (Taxus, kere) → plot');
  ok(hedge('Túje západní Smaragd') === true, 'zerav/túje (Thuja, jehlicnany) → plot');
  ok(hedge('Dřišťál') === true, 'dřišťál (Berberis, kere) → plot');
  ok(hedge('Fotinie Red Robin') === true, 'fotinie (Photinia, kere) → plot');
  ok(hedge('Zimolez nitida') === true, 'zimolez kečíkový (Lonicera nitida, kere) → plot (přes SPECIES)');

  // KOLIZE rodu Lonicera — pnoucí zimolez je popinave → mimo gate → false
  ok(hedge('Zimolez kozí list') === false, 'pnoucí zimolez (Lonicera periclymenum, popinave) → null (mimo gate)');
  ok(hedge('Zimolez Heckrottův') === false, 'pnoucí zimolez (Lonicera × heckrottii, popinave) → null');
  // růže — bylinky/popinave, v mapě není → false
  ok(hedge('Růže zahradní') === false, 'keřová růže (Rosa, bylinky) → null');
  ok(hedge('Růže popínavá Rambler') === false, 'pnoucí růže (Rosa, popinave) → null');
  // gate PROJDE (stromy/jehličnany), ale mapa ODMÍTNE → null
  ok(hedge('Lípa srdčitá') === false, 'lípa (Tilia, stromy) → null (gate projde, mapa odmítne)');
  ok(hedge('Borovice kleč') === false, 'borovice (Pinus, jehlicnany) → null (gate projde, mapa odmítne)');
  ok(hedge('Smrk Nidiformis') === false, 'smrk (Picea, jehlicnany) → null (gate projde, mapa odmítne)');
  // ostatní mimo → false
  ok(hedge('Jabloň') === false, 'jabloň (Malus, stromy) → null');
  ok(isHedgePlant({ category: { key: 'trvalky' }, nameLat: 'Hosta sieboldiana' }) === false, 'trvalka → null');
  ok(isHedgePlant({ category: { key: 'zelenina' }, nameLat: 'Solanum lycopersicum' }) === false, 'zelenina → null');
  ok(isHedgePlant({ category: { key: 'ovoce' }, nameLat: 'Ribes rubrum' }) === false, 'drobné ovoce → null');
  ok(isHedgePlant(null) === false, 'bez rostliny → false');
  // gate akceptuje i holý string kategorie
  ok(isHedgePlant({ category: 'kere', nameLat: 'Buxus sempervirens' }) === true, 'holý string category=kere + Buxus → plot');

  // ---------- (1b) Žádný mrtvý klíč mapy (každý rod/druh resolvuje ≥1 reálnou rostlinu v gate) ----------
  for (const g of HEDGE_GENERA) {
    ok(enriched.some((p) => genusOf(p) === g && HEDGE_CATEGORIES.has(categoryKey(p))),
      `HEDGE_GENERA: rod ${g} resolvuje ≥1 reálnou rostlinu v gate (žádný mrtvý klíč)`);
  }
  for (const sp of HEDGE_SPECIES) {
    ok(enriched.some((p) => {
      const lat = String(p.nameLat || '').trim();
      return (lat === sp || lat.startsWith(`${sp} `)) && HEDGE_CATEGORIES.has(categoryKey(p));
    }), `HEDGE_SPECIES: druh ${sp} resolvuje ≥1 reálnou rostlinu v gate (žádný mrtvý klíč)`);
  }
  // Fagus ZÁMĚRNĚ není v mapě (není v DB → byl by mrtvý klíč)
  ok(!HEDGE_GENERA.has('Fagus'), 'Fagus záměrně mimo HEDGE_GENERA (není v DB — jinak mrtvý klíč)');

  // ---------- (2) Logika hedgeTrimForPin (now-aware) ----------
  const pin = (tasks) => ({ id: 1, tasks: tasks || [] });
  const buxus = { category: { key: 'kere' }, nameLat: 'Buxus sempervirens' };

  {
    // konec května (reálná dnešní sezóna) → summer1 (červenec, ~48 dní) v horizontu, summer2 mimo
    const r = hedgeTrimForPin(pin(), buxus, null, new Date(2026, 4, 28));
    ok(r.length === 1 && r[0].kind === 'hedgeTrim', 'konec května: zimostráz → návrh sestřihu plotu');
    ok(r[0].window === 'summer1' && r[0].month === 7, 'nejbližší okno = summer1 (červenec)');
    ok(r[0].taskType === 'strihani' && r[0].emoji === '✂️', 'task_type strihani, emoji ✂️');
    ok(r[0].due >= 0 && r[0].due <= HEDGE_TRIM_HORIZON_DAYS, 'okno v budoucnu a v horizontu');
  }
  {
    // začátek července → OBĚ okna v horizontu (červenec ~10 dní, září ~72) → nejbližší = summer1
    const r = hedgeTrimForPin(pin(), buxus, null, new Date(2026, 6, 5));
    ok(r.length === 1 && r[0].window === 'summer1' && r[0].month === 7,
      'začátek července: obě okna v horizontu → nejbližší = summer1 (červenec)');
  }
  {
    // konec července → summer1 minul (due<0) → summer2 (září, ~52 dní) v horizontu
    const r = hedgeTrimForPin(pin(), buxus, null, new Date(2026, 6, 25));
    ok(r.length === 1 && r[0].window === 'summer2' && r[0].month === 9,
      'konec července: summer1 minul → summer2 (září)');
  }
  // mimo sezónu → []
  ok(hedgeTrimForPin(pin(), buxus, null, new Date(2026, 9, 1)).length === 0,
    'říjen: obě okna příští rok >75 dní → [] (mimo sezónu)');
  ok(hedgeTrimForPin(pin(), buxus, null, new Date(2026, 2, 1)).length === 0,
    'březen: letní okna >75 dní → [] (mimo sezónu)');
  // nikdy do minulosti — pozdní září (po 15.) → obě okna letos minula, příští rok mimo horizont → []
  ok(hedgeTrimForPin(pin(), buxus, null, new Date(2026, 8, 25)).length === 0,
    'pozdní září: obě okna minula, příští rok mimo horizont → [] (nikdy do minulosti)');

  // ---------- (3) Posun klim. zóny / expozice (reálný getZoneOffsetDays) ----------
  {
    const base = hedgeTrimForPin(pin(), buxus, null, new Date(2026, 6, 5))[0];
    const north = hedgeTrimForPin(pin(), buxus, { exposure: 'N' }, new Date(2026, 6, 5))[0];
    ok(north.suggested > base.suggested, 'severní expozice → pozdější sestřih');
    ok(getZoneOffsetDays('JHC') !== 0, 'climateZones: JHC má nenulový posun (kotva pro zónu)');
    const jhc = hedgeTrimForPin(pin(), buxus, { climate_zone: 'JHC' }, new Date(2026, 6, 5))[0];
    ok(jhc.suggested > base.suggested, 'klim. zóna JHC (chladnější) → pozdější sestřih');
  }

  // ---------- (4) Dedup proti existujícímu řezu v měsíci ----------
  {
    const now = new Date(2026, 4, 28); // summer1 (červenec) je nejbližší okno
    const y = now.getFullYear();
    // task_type strihani v cílovém měsíci → potlačeno (a summer2 je mimo horizont) → []
    const sameStrihani = [{ title: 'Řez', task_type: 'strihani', specific_date: `${y}-07-12` }];
    ok(hedgeTrimForPin(pin(sameStrihani), buxus, null, now).length === 0,
      'dedup: task_type strihani v červenci → potlačeno');
    // vlastní slovesný titulek („Sestřihnout plot" → marker „plot"/„sestřih") → potlačeno
    const ownTitle = [{ title: '✂️ Sestřihnout plot Buxus', task_type: 'jine', specific_date: `${y}-07-10` }];
    ok(hedgeTrimForPin(pin(ownTitle), buxus, null, now).length === 0,
      'dedup: titulek „Sestřihnout plot" v červenci → potlačeno');
    const tvarov = [{ title: 'Tvarovací řez', task_type: 'jine', specific_date: `${y}-07-05` }];
    ok(hedgeTrimForPin(pin(tvarov), buxus, null, now).length === 0,
      'dedup: titulek „Tvarovací" v červenci → potlačeno');
    // jiný úkon bez markeru a bez strihani v červenci NEpotlačí
    const otherJine = [{ title: '🌾 Mulčování', task_type: 'jine', specific_date: `${y}-07-10` }];
    ok(hedgeTrimForPin(pin(otherJine), buxus, null, now).length === 1,
      'dedup: jiný úkon (jine, bez markeru) v červenci → návrh svítí');
    // loňský sestřih ve stejném měsíci nevadí (jednorázový z minulého roku)
    const lastYear = [{ title: 'Sestřih plotu', task_type: 'strihani', specific_date: `${y - 1}-07-12` }];
    ok(hedgeTrimForPin(pin(lastYear), buxus, null, now).length === 1,
      'dedup: loňský sestřih v červenci (jednorázový) → návrh svítí');
    // opakovaný úkon (frequency_days) se strihani v cílovém měsíci potlačí bez ohledu na rok
    const repeating = [{ title: 'Pravidelný řez', task_type: 'strihani', next_due: '2099-07-01', frequency_days: 365 }];
    ok(hedgeTrimForPin(pin(repeating), buxus, null, now).length === 0,
      'dedup: opakovaný strihani v červenci → potlačeno (bez ohledu na rok)');
  }
  {
    // dedup NEJBLIŽŠÍHO okna spadne na DRUHÉ okno: začátek července (obě v horizontu),
    // strihani v červenci → summer1 potlačeno → ukáže se summer2 (září)
    const now = new Date(2026, 6, 5);
    const y = now.getFullYear();
    const julyStrihani = [{ title: 'Řez', task_type: 'strihani', specific_date: `${y}-07-12` }];
    const r = hedgeTrimForPin(pin(julyStrihani), buxus, null, now);
    ok(r.length === 1 && r[0].window === 'summer2' && r[0].month === 9,
      'dedup: červencový řez potlačí summer1 → ukáže se summer2 (září)');
  }

  // ---------- (5) Chybějící vstup ----------
  ok(hedgeTrimForPin(null, buxus, null, new Date(2026, 4, 28)).length === 0, 'bez pinu → []');
  ok(hedgeTrimForPin(pin(), null, null, new Date(2026, 4, 28)).length === 0, 'bez rostliny → []');

  console.log(`\n✅ All ${passed} hedge-trim assertions passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
