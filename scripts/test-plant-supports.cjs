// Sanity test pro „Jarní opory pro vzrostlé trvalky a popínavé — postav podpěry před vzrůstem".
// plantSupports.js importuje RecommendedTasks.jsx (React/JSX) → nejde načíst v čistém node,
// proto REPLIKUJEME pure logiku (stejně jako test-grafting-tasks / test-cutting-tasks).
// Replika je věrná plantSupports.js a je now-aware (deterministické testy).
// Matchování STAKING_GENERA běží proti REÁLNÉ plantDatabase načtené dynamickým importem →
// ověří, že kurátorská mapa sedí na skutečná data (žádné mrtvé klíče) a že nízké kompaktní
// trvalky / trávy / dřeviny / zelenina jsou vyřazené.
// dateForMonth/getConditionShiftDays = věrná replika; getZoneOffsetDays importujeme
// z reálného climateZones.js (jeden zdroj pravdy pro posun klim. zóny).
// Spuštění: node scripts/test-plant-supports.cjs
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

// ---------- replika pure logiky (plantSupports.js) ----------
const STAKING_HORIZON_DAYS = 75;
const STAKING_EMOJI = '🪜';
const STAKING_TYPES = {
  ring: { month: 4 },
  stake: { month: 5 },
  trellis: { month: 4 },
};
const STAKING_CATEGORIES = new Set([
  'trvalky', 'popinave', 'okrasne', 'letnicky', 'cibuloviny',
]);
const STAKING_GENERA = {
  Paeonia: 'ring', Phlox: 'ring', Lupinus: 'ring',
  Delphinium: 'stake', Lilium: 'stake', Dahlia: 'stake', Gladiolus: 'stake', Helianthus: 'stake',
  Clematis: 'trellis', Rosa: 'trellis', Wisteria: 'trellis', Humulus: 'trellis', Lonicera: 'trellis',
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
function stakingRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (!cat || !STAKING_CATEGORIES.has(cat)) return null;
  const genus = genusOf(plant);
  if (genus && STAKING_GENERA[genus]) return { type: STAKING_GENERA[genus] };
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
function hasSupportInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    const title = (e.title || '').trim();
    if (/opor|vyváz|podpěr/i.test(title)) return true;
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
  function plantSupportForPin(pin, plant, conditions, now) {
    if (!pin || !plant) return [];
    const rule = stakingRuleForPlant(plant);
    if (!rule) return [];
    const typeDef = STAKING_TYPES[rule.type];
    if (!typeDef) return [];
    const suggested = dateForMonth(typeDef.month, conditions, now);
    const due = daysFromToday(suggested, now);
    if (due === null || due < 0 || due > STAKING_HORIZON_DAYS) return [];
    const m = monthFromIso(suggested);
    if (hasSupportInMonth(pin.tasks || [], m, now.getFullYear())) return [];
    return [{
      kind: 'support', type: rule.type, month: m, suggested, due,
      taskType: 'jine', emoji: STAKING_EMOJI,
    }];
  }

  // ---------- (1) Matchování mapy proti REÁLNÉ DB ----------
  const db = await imp('frontend/src/plantDatabase.js');
  const enriched = db.PLANT_DATABASE.map(db.enrichPlant);
  const byCz = (name) => enriched.find((p) => p.nameCz === name);
  const ruleCz = (name) => stakingRuleForPlant(byCz(name));
  const typeCz = (name) => { const r = ruleCz(name); return r && r.type; };

  // spec výslovně chce, ať tohle RESOLVE:
  ok(typeCz('Pivoňka čínská') === 'ring', 'pivoňka (Paeonia, trvalky) → ring');
  ok(typeCz('Ostrožka vyvýšená') === 'stake', 'ostrožka (Delphinium, trvalky) → stake');
  ok(typeCz('Dahlia (Jiřina)') === 'stake', 'jiřina (Dahlia, OKRASNE) → stake — gate rozšířen dle reality');
  ok(typeCz('Plamének Jackmanii') === 'trellis', 'plamének (Clematis, popinave) → trellis');
  ok(typeCz('Růže popínavá Rambler') === 'trellis', 'pnoucí růže (Rosa, popinave) → trellis');

  // další očekávané rody (no dead keys — všechny existují v gate)
  ok(typeCz('Lilie') === 'stake', 'lilie (Lilium, cibuloviny) → stake');
  ok(typeCz('Gladiola') === 'stake', 'gladiola (Gladiolus, cibuloviny) → stake');
  ok(typeCz('Slunečnice') === 'stake', 'slunečnice (Helianthus, okrasne) → stake');
  ok(typeCz('Lupina mnoholistá') === 'ring', 'lupina (Lupinus, trvalky) → ring');
  ok(typeCz('Flox latnatý') === 'ring', 'flox (Phlox, trvalky) → ring');
  ok(typeCz('Vistárie čínská') === 'trellis', 'vistárie (Wisteria, popinave) → trellis');
  ok(typeCz('Chmel otáčivý') === 'trellis', 'chmel (Humulus, popinave) → trellis');
  ok(typeCz('Zimolez kozí list') === 'trellis', 'pnoucí zimolez (Lonicera, popinave) → trellis');

  // KOLIZE RODŮ — gate musí vyřadit nevhodné členy téhož rodu:
  ok(ruleCz('Růže zahradní') === null, 'keřová růže (Rosa, bylinky) → null (mimo gate)');
  ok(ruleCz('Topinambur') === null, 'topinambur (Helianthus tuberosus, zelenina) → null (mimo gate)');
  ok(ruleCz('Zimolez nitida') === null, 'keřový zimolez (Lonicera, kere) → null (mimo gate)');

  // nízké kompaktní trvalky / dřeviny / trávy / zelenina → null
  ok(ruleCz('Hosta') === null, 'bohyška (Hosta, trvalky, nízká) → null (rod mimo mapu)');
  ok(ruleCz('Bergénie srdčitá') === null, 'bergénie (Bergenia, trvalky, nízká) → null');
  ok(ruleCz('Dlužicha Palace Purple') === null, 'dlužicha (Heuchera, trvalky, nízká) → null');
  ok(stakingRuleForPlant({ category: { key: 'travy' }, nameLat: 'Miscanthus sinensis' }) === null,
    'okrasná tráva (travy) → null (mimo gate)');
  ok(stakingRuleForPlant({ category: { key: 'kere' }, nameLat: 'Forsythia intermedia' }) === null,
    'dřevina (kere) → null (mimo gate)');
  ok(stakingRuleForPlant({ category: { key: 'stromy' }, nameLat: 'Malus domestica' }) === null,
    'strom (stromy) → null (mimo gate)');
  ok(stakingRuleForPlant({ category: { key: 'zelenina' }, nameLat: 'Solanum lycopersicum' }) === null,
    'rajče (zelenina) → null (mimo gate)');
  ok(stakingRuleForPlant(null) === null, 'bez rostliny → null');
  // holý string kategorie (před enrichPlant) funguje:
  ok(stakingRuleForPlant({ category: 'popinave', nameLat: 'Clematis viticella' }) &&
     stakingRuleForPlant({ category: 'popinave', nameLat: 'Clematis viticella' }).type === 'trellis',
    'holý string category=popinave funguje (Clematis → trellis)');

  // integrita: žádný mrtvý klíč mapy — každý rod existuje v reálné DB v gate kategorii
  const generaInGate = new Set(
    enriched.filter((p) => STAKING_CATEGORIES.has(p.category.key)).map(genusOf),
  );
  for (const g of Object.keys(STAKING_GENERA)) {
    ok(generaInGate.has(g), `STAKING_GENERA: rod ${g} je v DB v gate kategorii — žádný mrtvý klíč`);
  }

  // ---------- (2) Logika plantSupportForPin (now-aware) ----------
  const pin = (tasks) => ({ id: 1, tasks: tasks || [] });
  const ring = { category: { key: 'trvalky' }, nameLat: 'Paeonia lactiflora' };   // ring (month 4)
  const stake = { category: { key: 'okrasne' }, nameLat: 'Dahlia pinnata' };      // stake (month 5)
  const trellis = { category: { key: 'popinave' }, nameLat: 'Clematis viticella' }; // trellis (month 4)

  {
    const r = plantSupportForPin(pin(), ring, null, new Date(2030, 1, 10)); // únor → duben (~64 dní)
    ok(r.length === 1 && r[0].kind === 'support', 'únor: pivoňka → návrh kruhové opory');
    ok(r[0].type === 'ring' && r[0].month === 4, 'ring → měsíc 4');
    ok(r[0].taskType === 'jine' && r[0].emoji === '🪜', 'task_type jine, emoji 🪜');
    ok(r[0].due >= 0 && r[0].due <= STAKING_HORIZON_DAYS, 'okno v budoucnu a v horizontu');
  }
  {
    const r = plantSupportForPin(pin(), stake, null, new Date(2030, 2, 20)); // březen → květen (~56 dní)
    ok(r.length === 1 && r[0].type === 'stake' && r[0].month === 5, 'březen: jiřina → opěrná tyč v květnu');
  }
  {
    const r = plantSupportForPin(pin(), trellis, null, new Date(2030, 1, 10)); // únor → duben
    ok(r.length === 1 && r[0].type === 'trellis' && r[0].month === 4, 'únor: plamének → treláž v dubnu');
  }

  // mimo horizont / po okně → skryto
  ok(plantSupportForPin(pin(), ring, null, new Date(2030, 0, 5)).length === 0,
    'začátek ledna: dubnové okno >75 dní → skryto');
  ok(plantSupportForPin(pin(), stake, null, new Date(2029, 11, 15)).length === 0,
    'prosinec: květnové okno >75 dní → skryto');
  ok(plantSupportForPin(pin(), ring, null, new Date(2030, 4, 10)).length === 0,
    'květen: dubnové okno minulo → příští rok >75 dní → skryto (nikdy do minulosti)');
  ok(plantSupportForPin(pin(), trellis, null, new Date(2030, 7, 1)).length === 0,
    'srpen: dubnové okno příští rok >75 dní → skryto');

  // ---------- (3) Posun klim. zóny / expozice ----------
  {
    const base = plantSupportForPin(pin(), stake, null, new Date(2030, 2, 20))[0];
    const north = plantSupportForPin(pin(), stake, { exposure: 'N' }, new Date(2030, 2, 20))[0];
    ok(north.suggested > base.suggested, 'severní expozice → pozdější opora');
    ok(getZoneOffsetDays('JHC') !== 0, 'climateZones: JHC má nenulový posun (kotva pro zónu)');
    const jhc = plantSupportForPin(pin(), stake, { climate_zone: 'JHC' }, new Date(2030, 2, 20))[0];
    ok(jhc.suggested > base.suggested, 'klim. zóna JHC (chladnější) → pozdější opora');
  }

  // ---------- (4) Dedup proti existující opoře v měsíci (jen dle TITULKU) ----------
  {
    const now = new Date(2030, 1, 10); // dubnové okno (ring/trellis)
    const y = now.getFullYear();
    const opor = [{ title: '🪜 Postavit oporu pivoňky', task_type: 'jine', specific_date: `${y}-04-12` }];
    ok(plantSupportForPin(pin(opor), ring, null, now).length === 0, 'dedup: titulek „opor" v dubnu → potlačeno (i vlastní titulek)');
    const vyvaz = [{ title: 'Vyvázat výhony', task_type: 'jine', specific_date: `${y}-04-08` }];
    ok(plantSupportForPin(pin(vyvaz), ring, null, now).length === 0, 'dedup: titulek „vyváz" v dubnu → potlačeno');
    const podper = [{ title: 'Postavit podpěru', task_type: 'jine', specific_date: `${y}-04-05` }];
    ok(plantSupportForPin(pin(podper), ring, null, now).length === 0, 'dedup: titulek „podpěr" v dubnu → potlačeno');
    // jiný „jine" úkol bez markeru v dubnu NEPOTLAČÍ (task_type jine je obecný)
    const jine = [{ title: 'Přihnojit', task_type: 'jine', specific_date: `${y}-04-10` }];
    ok(plantSupportForPin(pin(jine), ring, null, now).length === 1, 'jiný „jine" úkol bez markeru NEpotlačí (dedup jen dle titulku)');
    // opora v JINÉM měsíci nevadí
    const other = [{ title: '🪜 Postavit oporu', task_type: 'jine', specific_date: `${y}-06-10` }];
    ok(plantSupportForPin(pin(other), ring, null, now).length === 1, 'opora v JINÉM měsíci nevadí → návrh svítí');
    // loňská opora nevadí
    const last = [{ title: '🪜 Postavit oporu', task_type: 'jine', specific_date: `${y - 1}-04-10` }];
    ok(plantSupportForPin(pin(last), ring, null, now).length === 1, 'loňská opora (jiný rok) → návrh svítí');
    // opakovaný (frequency_days) úkol s markerem v dubnu potlačí i bez shody roku
    const recur = [{ title: '🪜 opora', task_type: 'jine', specific_date: `2000-04-10`, frequency_days: 365 }];
    ok(plantSupportForPin(pin(recur), ring, null, now).length === 0, 'opakovaný úkol s markerem v dubnu → potlačeno');
  }

  // ---------- (5) Chybějící vstup ----------
  ok(plantSupportForPin(null, ring, null, new Date(2030, 1, 10)).length === 0, 'bez pinu → []');
  ok(plantSupportForPin(pin(), null, null, new Date(2030, 1, 10)).length === 0, 'bez rostliny → []');

  console.log(`\n✅ All ${passed} plant-supports assertions passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
