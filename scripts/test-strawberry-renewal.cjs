// Sanity test pro „Sezónní obnova jahodníku po sklizni — sestřih listů + odběr odnoží".
// strawberryRenewal.js importuje RecommendedTasks.jsx (React/JSX) → nejde načíst v čistém node,
// proto REPLIKUJEME pure logiku (stejně jako test-fruit-netting / test-hedge-trim).
// Replika je věrná strawberryRenewal.js a je now-aware (deterministické testy).
// Matchování STRAWBERRY_GENERA běží proti REÁLNÉ plantDatabase načtené dynamickým importem
// → ověří, že kurátorská mapa sedí na skutečná data (žádné mrtvé klíče) a že ostatní drobné
// ovoce (rybíz/maliník/borůvka) i jádroviny / okrasné / zelenina jsou vyřazené.
// dateForMonth/getConditionShiftDays = věrná replika; getZoneOffsetDays importujeme
// z reálného climateZones.js (jeden zdroj pravdy pro posun klim. zóny).
// Spuštění: node scripts/test-strawberry-renewal.cjs
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

// ---------- replika pure logiky (strawberryRenewal.js) ----------
const STRAWBERRY_RENEWAL_HORIZON_DAYS = 60;
const STRAWBERRY_RENEWAL_EMOJI = '✂️';
const STRAWBERRY_GENERA = {
  Fragaria: { month: 7 },
};
const STRAWBERRY_RENEWAL_CATEGORIES = new Set(['ovoce']);

function categoryKey(plant) {
  const c = plant && plant.category;
  if (!c) return null;
  return typeof c === 'string' ? c : c.key || null;
}
function genusOf(plant) {
  const lat = String((plant && plant.nameLat) || '').trim();
  return lat ? lat.split(/\s+/)[0] || null : null;
}
function strawberryRenewalRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (!cat || !STRAWBERRY_RENEWAL_CATEGORIES.has(cat)) return null;
  const genus = genusOf(plant);
  if (genus && STRAWBERRY_GENERA[genus]) return { month: STRAWBERRY_GENERA[genus].month };
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
function hasStrawberryRenewalInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    const title = (e.title || '').trim();
    if (e.task_type === 'strihani') return true;
    if (/jahodník|odnož|obnov/i.test(title)) return true;
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
  function strawberryRenewalForPin(pin, plant, conditions, now) {
    if (!pin || !plant) return [];
    const rule = strawberryRenewalRuleForPlant(plant);
    if (!rule) return [];
    const suggested = dateForMonth(rule.month, conditions, now);
    const due = daysFromToday(suggested, now);
    if (due === null || due < 0 || due > STRAWBERRY_RENEWAL_HORIZON_DAYS) return [];
    const m = monthFromIso(suggested);
    if (hasStrawberryRenewalInMonth(pin.tasks || [], m, now.getFullYear())) return [];
    return [{
      kind: 'strawberryRenewal', month: m, suggested, due,
      taskType: 'strihani', emoji: STRAWBERRY_RENEWAL_EMOJI,
    }];
  }

  // ---------- (1) Matchování map proti REÁLNÉ DB ----------
  const db = await imp('frontend/src/plantDatabase.js');
  const enriched = db.PLANT_DATABASE.map(db.enrichPlant);
  const byCz = (name) => enriched.find((p) => p.nameCz === name);
  const ruleCz = (name) => strawberryRenewalRuleForPlant(byCz(name));
  const monthCz = (name) => { const r = ruleCz(name); return r && r.month; };

  // jahodník — Fragaria v ovoce → návrh v červenci
  ok(monthCz('Jahoda lesní') === 7, 'jahoda lesní (Fragaria vesca, ovoce) → červenec');
  // ostatní drobné ovoce (rybíz/maliník/borůvka) — v ovoce, ale rod mimo mapu → null
  ok(ruleCz('Rybíz černý') === null, 'rybíz černý (Ribes nigrum, ovoce) → null (řeže se podle stáří, ne obnova)');
  ok(ruleCz('Rybíz červený') === null, 'rybíz červený (Ribes rubrum, ovoce) → null');
  ok(ruleCz('Angrešt') === null, 'angrešt (Ribes uva-crispa, ovoce) → null');
  ok(ruleCz('Maliník červený') === null, 'maliník (Rubus idaeus, ovoce) → null');
  ok(ruleCz('Ostružiník křovitý') === null, 'ostružiník (Rubus fruticosus, ovoce) → null');
  ok(ruleCz('Borůvka zahradní') === null, 'borůvka (Vaccinium corymbosum, ovoce) → null');

  // peckoviny (stromy) — Prunus mimo gate ovoce → null
  ok(ruleCz('Třešeň') === null, 'třešeň (Prunus avium, stromy) → null (mimo gate ovoce)');
  ok(ruleCz('Broskvoň') === null, 'broskvoň (Prunus persica, stromy) → null');
  // jádroviny — stromy, mimo gate
  ok(ruleCz('Jabloň') === null, 'jabloň (Malus domestica, stromy) → null (mimo gate ovoce)');
  ok(ruleCz('Hruška') === null, 'hrušeň (Pyrus communis, stromy) → null');

  // mimo gate kategorie → null
  ok(strawberryRenewalRuleForPlant({ category: { key: 'zelenina' }, nameLat: 'Fragaria virginiana' }) === null,
    'Fragaria v zelenině → null (mimo gate)');
  ok(strawberryRenewalRuleForPlant({ category: { key: 'trvalky' }, nameLat: 'Fragaria vesca' }) === null,
    'Fragaria v trvalkách → null (mimo gate)');
  ok(strawberryRenewalRuleForPlant({ category: { key: 'okrasne' }, nameLat: 'Fragaria virginiana' }) === null,
    'Fragaria v okrasne → null (mimo gate — jen ovoce)');
  ok(strawberryRenewalRuleForPlant({ category: { key: 'bylinky' }, nameLat: 'Fragaria vesca' }) === null,
    'Fragaria v bylinkách → null (mimo gate)');
  ok(strawberryRenewalRuleForPlant({ category: { key: 'stromy' }, nameLat: 'Fragaria vesca' }) === null,
    'Fragaria ve stromech → null (mimo gate)');
  ok(strawberryRenewalRuleForPlant({ category: { key: 'ovoce' }, nameLat: 'Solanum lycopersicum' }) === null,
    'rajče v ovoci (nereálné, ale gate projde) — rod mimo mapu → null');
  ok(strawberryRenewalRuleForPlant(null) === null, 'bez rostliny → null');
  ok(strawberryRenewalRuleForPlant({ category: null, nameLat: 'Fragaria vesca' }) === null,
    'bez kategorie → null');
  ok(strawberryRenewalRuleForPlant({ category: { key: 'ovoce' }, nameLat: '' }) === null,
    'prázdný nameLat → null (rod neurčen)');

  // gate akceptuje i holý string kategorie
  ok((strawberryRenewalRuleForPlant({ category: 'ovoce', nameLat: 'Fragaria vesca' }) || {}).month === 7,
    'holý string category=ovoce + Fragaria → červenec');
  // forward-looking druhy Fragaria (F. moschata, F. virginiana) přes ROD chytí stejně
  ok((strawberryRenewalRuleForPlant({ category: 'ovoce', nameLat: 'Fragaria moschata' }) || {}).month === 7,
    'forward-looking F. moschata v ovoci → červenec (rod Fragaria)');

  // integrita: žádný mrtvý klíč mapy (každý rod existuje v reálné DB v gate)
  const inGate = (p) => STRAWBERRY_RENEWAL_CATEGORIES.has(p.category.key);
  const generaInGate = new Set(enriched.filter(inGate).map(genusOf));
  for (const g of Object.keys(STRAWBERRY_GENERA)) {
    ok(generaInGate.has(g), `STRAWBERRY_GENERA: rod ${g} je v DB (ovoce) — žádný mrtvý klíč`);
  }

  // ---------- (2) Logika strawberryRenewalForPin (now-aware) ----------
  const pin = (tasks) => ({ id: 1, tasks: tasks || [] });
  const frag = { category: { key: 'ovoce' }, nameLat: 'Fragaria vesca' }; // červenec (7)

  {
    const r = strawberryRenewalForPin(pin(), frag, null, new Date(2030, 5, 20)); // konec června → červenec
    ok(r.length === 1 && r[0].kind === 'strawberryRenewal', 'konec června: jahodník → návrh obnovy');
    ok(r[0].month === 7 && r[0].taskType === 'strihani' && r[0].emoji === '✂️', 'měsíc 7, task_type strihani, emoji ✂️');
    ok(r[0].due >= 0 && r[0].due <= STRAWBERRY_RENEWAL_HORIZON_DAYS, 'okno v budoucnu a v horizontu');
  }
  {
    const r = strawberryRenewalForPin(pin(), frag, null, new Date(2030, 6, 1)); // začátek července → svítí
    ok(r.length === 1 && r[0].month === 7, 'začátek července: jahodník → návrh svítí');
  }

  // pozdně v cílovém měsíci (po 15.) → [] (nikdy do minulosti)
  ok(strawberryRenewalForPin(pin(), frag, null, new Date(2030, 6, 20)).length === 0,
    'pozdní červenec: okno (15.) minulo → [] (nikdy do minulosti)');

  // mimo horizont → skryto
  ok(strawberryRenewalForPin(pin(), frag, null, new Date(2030, 2, 15)).length === 0,
    'březen: červencové okno >60 dní → skryto');
  ok(strawberryRenewalForPin(pin(), frag, null, new Date(2030, 3, 1)).length === 0,
    'duben: červencové okno >60 dní → skryto');
  ok(strawberryRenewalForPin(pin(), frag, null, new Date(2030, 7, 15)).length === 0,
    'srpen: červencové okno minulo → příští rok >60 dní → skryto');
  ok(strawberryRenewalForPin(pin(), frag, null, new Date(2030, 10, 1)).length === 0,
    'listopad: příští rok červenec >60 dní → skryto');

  // ---------- (3) Posun klim. zóny / expozice ----------
  {
    const base = strawberryRenewalForPin(pin(), frag, null, new Date(2030, 5, 20))[0];
    const north = strawberryRenewalForPin(pin(), frag, { exposure: 'N' }, new Date(2030, 5, 20))[0];
    ok(north.suggested > base.suggested, 'severní expozice → pozdější obnova (zraje pozdě)');
    ok(getZoneOffsetDays('JHC') !== 0, 'climateZones: JHC má nenulový posun (kotva pro zónu)');
    const jhc = strawberryRenewalForPin(pin(), frag, { climate_zone: 'JHC' }, new Date(2030, 5, 20))[0];
    ok(jhc.suggested > base.suggested, 'klim. zóna JHC (chladnější) → pozdější obnova');
  }

  // ---------- (4) Dedup proti existující obnově / strihani v měsíci ----------
  {
    const now = new Date(2030, 5, 20); // červencové okno
    const y = now.getFullYear();
    // slovesný titulek, který tahle vrstva sama vytvoří (obsahuje „Obnov" jako podřetězec)
    const obnova = [{ title: '✂️ Obnova jahodníku Jahoda lesní', task_type: 'strihani', specific_date: `${y}-07-12` }];
    ok(strawberryRenewalForPin(pin(obnova), frag, null, now).length === 0,
      'dedup: titulek „Obnova jahodníku" v červenci → potlačeno (zachytí „jahodník", „obnov", task_type strihani)');
    // marker „odnož" zachytí variantu podstatného jména
    const odnoze = [{ title: 'Odebrat odnože jahodníku', task_type: 'jine', specific_date: `${y}-07-10` }];
    ok(strawberryRenewalForPin(pin(odnoze), frag, null, now).length === 0,
      'dedup: titulek „odnož" v červenci → potlačeno');
    // task_type strihani v cílovém měsíci bez markeru titulku NEZÁVISLE na jazyce potlačí
    // (jazyková pojistka pro EN/DE/PL/SK, kde lokalizovaný titulek marker nenese)
    const otherStrihani = [{ title: 'Hedge trim', task_type: 'strihani', specific_date: `${y}-07-08` }];
    ok(strawberryRenewalForPin(pin(otherStrihani), frag, null, now).length === 0,
      'dedup: task_type strihani v červenci (bez markeru titulku) → potlačeno (jazyková pojistka)');
    // jiný úkol (task_type `jine`) bez markeru v červenci NEpotlačí
    const otherJine = [{ title: '🌾 Mulčování', task_type: 'jine', specific_date: `${y}-07-10` }];
    ok(strawberryRenewalForPin(pin(otherJine), frag, null, now).length === 1,
      'dedup: jiný „jine" úkol bez markeru v červenci → návrh svítí');
    // obnova v JINÉM měsíci nevadí
    const otherMonth = [{ title: '✂️ Obnova jahodníku', task_type: 'strihani', specific_date: `${y}-09-10` }];
    ok(strawberryRenewalForPin(pin(otherMonth), frag, null, now).length === 1,
      'dedup: obnova v JINÉM měsíci nevadí → návrh svítí');
    // loňská obnova ve stejném měsíci nevadí (jednorázový úkol z minulého roku)
    const lastYear = [{ title: '✂️ Obnova jahodníku', task_type: 'strihani', specific_date: `${y - 1}-07-12` }];
    ok(strawberryRenewalForPin(pin(lastYear), frag, null, now).length === 1,
      'dedup: loňská obnova v červenci (jednorázová) → návrh svítí');
    // opakovaný úkol (frequency_days) ve stejném měsíci potlačí bez ohledu na rok
    const repeating = [{ title: 'Obnova jahodníku', task_type: 'strihani', next_due: `2099-07-01`, frequency_days: 365 }];
    ok(strawberryRenewalForPin(pin(repeating), frag, null, now).length === 0,
      'dedup: opakovaný úkol s markerem v červenci → potlačeno (bez ohledu na rok)');
  }

  // ---------- (5) Chybějící vstup ----------
  ok(strawberryRenewalForPin(null, frag, null, new Date(2030, 5, 20)).length === 0, 'bez pinu → []');
  ok(strawberryRenewalForPin(pin(), null, null, new Date(2030, 5, 20)).length === 0, 'bez rostliny → []');

  console.log(`\n✅ All ${passed} strawberry-renewal assertions passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
