// Sanity test pro „Ochranné sítě na dozrávající ovoce — zakrytí před ptáky".
// fruitNetting.js importuje RecommendedTasks.jsx (React/JSX) → nejde načíst v čistém node,
// proto REPLIKUJEME pure logiku (stejně jako test-fruit-thinning / test-hedge-trim /
// test-grafting-tasks). Replika je věrná fruitNetting.js a je now-aware (deterministické testy).
// Matchování NETTING_GENERA/SPECIES běží proti REÁLNÉ plantDatabase načtené dynamickým importem
// → ověří, že kurátorská mapa sedí na skutečná data (žádné mrtvé klíče) a že jádroviny /
// okrasné Prunus / zelenina / okrasné jsou vyřazené.
// dateForMonth/getConditionShiftDays = věrná replika; getZoneOffsetDays importujeme
// z reálného climateZones.js (jeden zdroj pravdy pro posun klim. zóny).
// Spuštění: node scripts/test-fruit-netting.cjs
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

// ---------- replika pure logiky (fruitNetting.js) ----------
const FRUIT_NETTING_HORIZON_DAYS = 50;
const FRUIT_NETTING_EMOJI = '🕸️';
const NETTING_GENERA = {
  Ribes: { month: 6 },
  Rubus: { month: 7 },
  Vaccinium: { month: 7 },
  Fragaria: { month: 6 },
};
const NETTING_SPECIES = {
  'Prunus avium': { month: 6 },
};
const NETTING_CATEGORIES = new Set(['ovoce', 'stromy', 'popinave']);

function categoryKey(plant) {
  const c = plant && plant.category;
  if (!c) return null;
  return typeof c === 'string' ? c : c.key || null;
}
function genusOf(plant) {
  const lat = String((plant && plant.nameLat) || '').trim();
  return lat ? lat.split(/\s+/)[0] || null : null;
}
function fruitNettingRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (!cat || !NETTING_CATEGORIES.has(cat)) return null;
  const lat = String(plant.nameLat || '').trim();
  for (const sp in NETTING_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return { month: NETTING_SPECIES[sp].month };
  }
  const genus = genusOf(plant);
  if (genus && NETTING_GENERA[genus]) return { month: NETTING_GENERA[genus].month };
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
function hasNettingInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    const title = (e.title || '').trim();
    if (/síť|zasíťov|zakry/i.test(title)) return true;
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
  function fruitNettingForPin(pin, plant, conditions, now) {
    if (!pin || !plant) return [];
    const rule = fruitNettingRuleForPlant(plant);
    if (!rule) return [];
    const suggested = dateForMonth(rule.month, conditions, now);
    const due = daysFromToday(suggested, now);
    if (due === null || due < 0 || due > FRUIT_NETTING_HORIZON_DAYS) return [];
    const m = monthFromIso(suggested);
    if (hasNettingInMonth(pin.tasks || [], m, now.getFullYear())) return [];
    return [{
      kind: 'fruitNetting', month: m, suggested, due,
      taskType: 'jine', emoji: FRUIT_NETTING_EMOJI,
    }];
  }

  // ---------- (1) Matchování map proti REÁLNÉ DB ----------
  const db = await imp('frontend/src/plantDatabase.js');
  const enriched = db.PLANT_DATABASE.map(db.enrichPlant);
  const byCz = (name) => enriched.find((p) => p.nameCz === name);
  const ruleCz = (name) => fruitNettingRuleForPlant(byCz(name));
  const monthCz = (name) => { const r = ruleCz(name); return r && r.month; };

  // drobné ovoce (kategorie ovoce) — rody v mapě → návrh
  ok(monthCz('Rybíz černý') === 6, 'rybíz černý (Ribes nigrum, ovoce) → červen');
  ok(monthCz('Rybíz červený') === 6, 'rybíz červený (Ribes rubrum, ovoce) → červen');
  ok(monthCz('Angrešt') === 6, 'angrešt (Ribes uva-crispa, ovoce) → červen');
  ok(monthCz('Maliník červený') === 7, 'maliník (Rubus idaeus, ovoce) → červenec');
  ok(monthCz('Ostružiník křovitý') === 7, 'ostružiník (Rubus fruticosus, ovoce) → červenec');
  ok(monthCz('Borůvka zahradní') === 7, 'borůvka (Vaccinium corymbosum, ovoce) → červenec');
  ok(monthCz('Jahoda lesní') === 6, 'jahodník (Fragaria vesca, ovoce) → červen');

  // peckoviny (DRUH) — třešeň → návrh
  ok(monthCz('Třešeň') === 6, 'třešeň (Prunus avium, stromy) → červen přes SPECIES precedence');

  // DRUH má přednost — okrasné sakury/slivoně (rod Prunus mimo GENERA) → null
  ok(ruleCz('Sakura Kanzan') === null, 'okrasná sakura (Prunus serrulata) → null (rod Prunus mimo GENERA)');
  ok(ruleCz('Slivoň Nigra') === null, 'okrasná slivoň (Prunus cerasifera) → null');

  // velkoplodé peckoviny (rod Prunus, ale druh mimo NETTING_SPECIES) → null
  ok(ruleCz('Broskvoň') === null, 'broskvoň (Prunus persica) → null (nesíťuje se — velkoplodá, vysoko ve stromě)');
  ok(ruleCz('Meruňka') === null, 'meruňka (Prunus armeniaca) → null');
  ok(ruleCz('Švestka') === null, 'švestka (Prunus domestica) → null');

  // jádroviny (stromy, ale rod Malus/Pyrus mimo NETTING_GENERA) → null
  ok(ruleCz('Jabloň') === null, 'jabloň (Malus domestica, stromy) → null (nesíťuje se)');
  ok(ruleCz('Hruška') === null, 'hrušeň (Pyrus communis, stromy) → null');
  ok(ruleCz('Okrasná jabloň Royalty') === null, 'okrasná jabloň → null');

  // mimo gate → null
  ok(fruitNettingRuleForPlant({ category: { key: 'zelenina' }, nameLat: 'Solanum lycopersicum' }) === null,
    'rajče (zelenina) → null (mimo gate)');
  ok(fruitNettingRuleForPlant({ category: { key: 'trvalky' }, nameLat: 'Ribes alpinum' }) === null,
    'rod Ribes v trvalkách → null (mimo gate)');
  ok(fruitNettingRuleForPlant({ category: { key: 'kere' }, nameLat: 'Rubus odoratus' }) === null,
    'rod Rubus v kere → null (mimo gate ovoce/stromy/popinave)');
  ok(fruitNettingRuleForPlant({ category: { key: 'okrasne' }, nameLat: 'Fragaria vesca' }) === null,
    'rod Fragaria v okrasne → null (mimo gate)');
  ok(fruitNettingRuleForPlant(null) === null, 'bez rostliny → null');
  ok(fruitNettingRuleForPlant({ category: null, nameLat: 'Ribes nigrum' }) === null,
    'bez kategorie → null');

  // gate akceptuje i holý string kategorie
  ok((fruitNettingRuleForPlant({ category: 'ovoce', nameLat: 'Ribes nigrum' }) || {}).month === 6,
    'holý string category=ovoce + Ribes → červen');
  ok((fruitNettingRuleForPlant({ category: 'popinave', nameLat: 'Fragaria virginiana' }) || {}).month === 6,
    'holý string category=popinave + Fragaria (forward-looking) → červen');

  // integrita: žádný mrtvý klíč mapy (každý rod/druh existuje v reálné DB v gate)
  const inGate = (p) => NETTING_CATEGORIES.has(p.category.key);
  const generaInGate = new Set(enriched.filter(inGate).map(genusOf));
  for (const g of Object.keys(NETTING_GENERA)) {
    ok(generaInGate.has(g), `NETTING_GENERA: rod ${g} je v DB (ovoce/stromy/popinave) — žádný mrtvý klíč`);
  }
  for (const sp of Object.keys(NETTING_SPECIES)) {
    ok(enriched.some((p) => {
      const l = String(p.nameLat || '');
      return inGate(p) && (l === sp || l.startsWith(`${sp} `));
    }), `NETTING_SPECIES: druh ${sp} je v DB (ovoce/stromy/popinave) — žádný mrtvý klíč`);
  }

  // ---------- (2) Logika fruitNettingForPin (now-aware) ----------
  const pin = (tasks) => ({ id: 1, tasks: tasks || [] });
  const ribes = { category: { key: 'ovoce' }, nameLat: 'Ribes nigrum' }; // červen (6)
  const rubus = { category: { key: 'ovoce' }, nameLat: 'Rubus idaeus' }; // červenec (7)
  const cherry = { category: { key: 'stromy' }, nameLat: 'Prunus avium' }; // červen (6) přes SPECIES

  {
    const r = fruitNettingForPin(pin(), ribes, null, new Date(2030, 4, 20)); // květen → červen
    ok(r.length === 1 && r[0].kind === 'fruitNetting', 'květen: rybíz → návrh sítě');
    ok(r[0].month === 6 && r[0].taskType === 'jine' && r[0].emoji === '🕸️', 'měsíc 6, task_type jine, emoji 🕸️');
    ok(r[0].due >= 0 && r[0].due <= FRUIT_NETTING_HORIZON_DAYS, 'okno v budoucnu a v horizontu');
  }
  {
    const r = fruitNettingForPin(pin(), rubus, null, new Date(2030, 5, 1)); // začátek června → červenec
    ok(r.length === 1 && r[0].month === 7, 'začátek června: maliník → návrh v červenci');
  }
  {
    const r = fruitNettingForPin(pin(), cherry, null, new Date(2030, 4, 25)); // konec května → červen
    ok(r.length === 1 && r[0].month === 6, 'konec května: třešeň → návrh v červnu');
  }

  // brzy v cílovém měsíci (před 15.) → svítí; po okně (15.+) → [] (nikdy do minulosti)
  ok(fruitNettingForPin(pin(), ribes, null, new Date(2030, 5, 1)).length === 1,
    'začátek června: červnové okno → návrh svítí');
  ok(fruitNettingForPin(pin(), ribes, null, new Date(2030, 5, 20)).length === 0,
    'pozdní červen: okno (15.) minulo → [] (nikdy do minulosti)');

  // mimo horizont → skryto
  ok(fruitNettingForPin(pin(), ribes, null, new Date(2030, 1, 15)).length === 0,
    'únor: červnové okno >50 dní → skryto');
  ok(fruitNettingForPin(pin(), ribes, null, new Date(2030, 3, 1)).length === 0,
    'duben: červnové okno >50 dní → skryto');
  ok(fruitNettingForPin(pin(), ribes, null, new Date(2030, 7, 15)).length === 0,
    'srpen: červnové okno minulo → příští rok >50 dní → skryto');
  ok(fruitNettingForPin(pin(), rubus, null, new Date(2030, 2, 1)).length === 0,
    'březen: červencové okno >50 dní → skryto');

  // ---------- (3) Posun klim. zóny / expozice ----------
  {
    const base = fruitNettingForPin(pin(), ribes, null, new Date(2030, 4, 20))[0];
    const north = fruitNettingForPin(pin(), ribes, { exposure: 'N' }, new Date(2030, 4, 20))[0];
    ok(north.suggested > base.suggested, 'severní expozice → pozdější síť (zraje později)');
    ok(getZoneOffsetDays('JHC') !== 0, 'climateZones: JHC má nenulový posun (kotva pro zónu)');
    const jhc = fruitNettingForPin(pin(), ribes, { climate_zone: 'JHC' }, new Date(2030, 4, 20))[0];
    ok(jhc.suggested > base.suggested, 'klim. zóna JHC (chladnější) → pozdější síť');
  }

  // ---------- (4) Dedup proti existující síti v měsíci ----------
  {
    const now = new Date(2030, 4, 20); // červnové okno
    const y = now.getFullYear();
    // slovesný titulek, který tahle vrstva sama vytvoří (obsahuje „síť" jako podřetězec
    // titulku „Zasíťovat" → match marker „síť" je v něm jako součást „zasíť")
    const zasitovat = [{ title: '🕸️ Zasíťovat Rybíz černý', task_type: 'jine', specific_date: `${y}-06-12` }];
    ok(fruitNettingForPin(pin(zasitovat), ribes, null, now).length === 0,
      'dedup: titulek „Zasíťovat" v červnu → potlačeno (zachytí „síť" i „zasíťov")');
    const sit = [{ title: 'Natáhnout síť proti ptákům', task_type: 'jine', specific_date: `${y}-06-10` }];
    ok(fruitNettingForPin(pin(sit), ribes, null, now).length === 0,
      'dedup: titulek „síť" v červnu → potlačeno');
    const zakryti = [{ title: 'Zakrytí keřů sítí', task_type: 'jine', specific_date: `${y}-06-05` }];
    ok(fruitNettingForPin(pin(zakryti), ribes, null, now).length === 0,
      'dedup: titulek „Zakry" v červnu → potlačeno');
    // jiný „jine" úkol bez markeru v červnu NEpotlačí (task_type jine je příliš obecný)
    const otherJine = [{ title: '🌾 Mulčování', task_type: 'jine', specific_date: `${y}-06-10` }];
    ok(fruitNettingForPin(pin(otherJine), ribes, null, now).length === 1,
      'dedup: jiný „jine" úkol bez markeru v červnu → návrh svítí (jine se nesleduje)');
    // síť v JINÉM měsíci nevadí
    const otherMonth = [{ title: '🕸️ Zasíťovat Rybíz', task_type: 'jine', specific_date: `${y}-08-10` }];
    ok(fruitNettingForPin(pin(otherMonth), ribes, null, now).length === 1,
      'dedup: síť v JINÉM měsíci nevadí → návrh svítí');
    // loňská síť ve stejném měsíci nevadí (jednorázový úkol z minulého roku)
    const lastYear = [{ title: '🕸️ Zasíťovat Rybíz', task_type: 'jine', specific_date: `${y - 1}-06-12` }];
    ok(fruitNettingForPin(pin(lastYear), ribes, null, now).length === 1,
      'dedup: loňská síť v červnu (jednorázová) → návrh svítí');
    // opakovaný úkol (frequency_days) ve stejném měsíci potlačí bez ohledu na rok
    const repeating = [{ title: 'Natáhnout síť', task_type: 'jine', next_due: `2099-06-01`, frequency_days: 365 }];
    ok(fruitNettingForPin(pin(repeating), ribes, null, now).length === 0,
      'dedup: opakovaný úkol s markerem v červnu → potlačeno (bez ohledu na rok)');
  }

  // ---------- (5) Chybějící vstup ----------
  ok(fruitNettingForPin(null, ribes, null, new Date(2030, 4, 20)).length === 0, 'bez pinu → []');
  ok(fruitNettingForPin(pin(), null, null, new Date(2030, 4, 20)).length === 0, 'bez rostliny → []');

  console.log(`\n✅ All ${passed} fruit-netting assertions passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
