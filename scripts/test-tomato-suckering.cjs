// Sanity test pro „Pasínkování rajčat (vylamování zálistků) — letní průběžný úkon 6–9".
// tomatoSuckering.js importuje RecommendedTasks.jsx (React/JSX) → nejde načíst v čistém
// node, proto REPLIKUJEME pure logiku (stejně jako test-herb-harvest, test-summer-rose-
// pruning, test-summer-pruning …). Replika je věrná tomatoSuckering.js a je now-aware
// (deterministické testy). Matchování SPECIES běží proti REÁLNÉ plantDatabase načtené
// dynamickým importem → ověří, že druh sedí na skutečná data a že žádný klíč není mrtvý.
// dateForMonth/getConditionShiftDays = věrná replika; getZoneOffsetDays importujeme
// z reálného climateZones.js.
// Spuštění: node scripts/test-tomato-suckering.cjs
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

// ---------- replika pure logiky (tomatoSuckering.js) ----------
const TOMATO_SUCKERING_HORIZON_DAYS = 50;
const TOMATO_SUCKERING_EMOJI = '🍅';
const TOMATO_SUCKERING_CATEGORIES = new Set(['zelenina']);
const TOMATO_SUCKERING_SPECIES = {
  'Solanum lycopersicum': { primary: 6, apical: 8 },
};

function categoryKey(plant) {
  const c = plant && plant.category;
  if (!c) return null;
  return typeof c === 'string' ? c : c.key || null;
}
function tomatoSuckeringRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (!TOMATO_SUCKERING_CATEGORIES.has(cat)) return null;
  const lat = String(plant.nameLat || '').trim();
  for (const sp in TOMATO_SUCKERING_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return { ...TOMATO_SUCKERING_SPECIES[sp] };
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
function hasTomatoSuckeringInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type !== 'strihani') continue;
    const title = (e.title || '').trim();
    if (/pasínkování|zálistk|sucker|tomato.*pinch|vrchol.*rajč/i.test(title)) return true;
  }
  return false;
}

(async () => {
  const cz = await imp('frontend/src/data/climateZones.js');
  const { getZoneOffsetDays } = cz;

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
  function tomatoSuckeringForPin(pin, plant, conditions, now) {
    if (!pin || !plant) return [];
    const rule = tomatoSuckeringRuleForPlant(plant);
    if (!rule) return [];
    const tasks = pin.tasks || [];
    const curYear = now.getFullYear();
    const out = [];
    for (const kind of ['primary', 'apical']) {
      const month = rule[kind];
      if (!month) continue;
      const suggested = dateForMonth(month, conditions, now);
      const due = daysFromToday(suggested, now);
      if (due === null || due < 0 || due > TOMATO_SUCKERING_HORIZON_DAYS) continue;
      const m = monthFromIso(suggested);
      if (hasTomatoSuckeringInMonth(tasks, m, curYear)) continue;
      out.push({ kind, month: m, suggested, due, taskType: 'strihani', emoji: TOMATO_SUCKERING_EMOJI });
    }
    return out;
  }

  // ---------- (1) Matchování SPECIES proti REÁLNÉ DB ----------
  const db = await imp('frontend/src/plantDatabase.js');
  const enriched = db.PLANT_DATABASE.map(db.enrichPlant);

  // SPECIES precedence — každý druh musí mít ≥1 reálnou rostlinu v gate `zelenina`.
  for (const sp of Object.keys(TOMATO_SUCKERING_SPECIES)) {
    const present = enriched.some((p) => {
      const l = String(p.nameLat || '');
      return TOMATO_SUCKERING_CATEGORIES.has(p.category.key) && (l === sp || l.startsWith(`${sp} `));
    });
    ok(present, `TOMATO_SUCKERING_SPECIES: ${sp} je v DB (zelenina) — žádný mrtvý klíč`);
  }

  // Všechny Solanum lycopersicum (id 12 base + cultivary 181–185) v DB resolvují
  const tomatoes = enriched.filter((p) => {
    const l = String(p.nameLat || '');
    return TOMATO_SUCKERING_CATEGORIES.has(p.category.key) && (l === 'Solanum lycopersicum' || l.startsWith('Solanum lycopersicum '));
  });
  ok(tomatoes.length >= 5, `DB obsahuje ≥5 Solanum lycopersicum (kultivary 181–185 + base id 12), nalezeno ${tomatoes.length}`);
  for (const t of tomatoes) {
    const rule = tomatoSuckeringRuleForPlant(t);
    ok(rule && rule.primary === 6 && rule.apical === 8,
      `${t.nameCz} (${t.nameLat}) → primary 6 + apical 8 (SPECIES precedence)`);
  }

  // Kultivary 181–185 jmenovitě
  const cultivars = ['Rajče San Marzano', 'Rajče Černý princ', 'Rajče Tigerella', 'Rajče cherry Sweet Million', 'Rajče Brandywine'];
  for (const cz of cultivars) {
    const p = enriched.find((x) => x.nameCz === cz);
    ok(p, `kultivar ${cz} je v DB`);
    if (p) {
      const r = tomatoSuckeringRuleForPlant(p);
      ok(r && r.primary === 6 && r.apical === 8, `${cz} → primary 6 + apical 8`);
    }
  }

  // Base „Rajče" (id 12) je v DB
  const base = enriched.find((p) => p.nameLat === 'Solanum lycopersicum');
  ok(base, 'base Solanum lycopersicum (id 12) je v DB');

  // ---------- (2) Mimo gate / mimo species → null ----------
  // Brambor (Solanum tuberosum) — stejný ROD, ale species precedence ho vyloučí
  ok(tomatoSuckeringRuleForPlant({ category: { key: 'zelenina' }, nameLat: 'Solanum tuberosum' }) === null,
    'brambor (Solanum tuberosum) → null (stejný rod ale jiný druh)');
  // Lilek (Solanum melongena) — stejný ROD ale jiný druh → null
  ok(tomatoSuckeringRuleForPlant({ category: { key: 'zelenina' }, nameLat: 'Solanum melongena' }) === null,
    'lilek (Solanum melongena) → null (stejný rod ale jiný druh)');
  // Paprika Capsicum annuum — jiný rod
  ok(tomatoSuckeringRuleForPlant({ category: { key: 'zelenina' }, nameLat: 'Capsicum annuum' }) === null,
    'paprika (Capsicum annuum) → null (jiný rod, nepasínkuje se)');
  ok(tomatoSuckeringRuleForPlant({ category: { key: 'zelenina' }, nameLat: "Capsicum annuum 'Jalapeño'" }) === null,
    'paprika Jalapeño (kultivar Capsicum) → null');
  // Okurka, dýně — Cucurbitaceae
  ok(tomatoSuckeringRuleForPlant({ category: { key: 'zelenina' }, nameLat: "Cucumis sativus" }) === null,
    'okurka (Cucumis sativus) → null');
  ok(tomatoSuckeringRuleForPlant({ category: { key: 'zelenina' }, nameLat: "Cucurbita pepo" }) === null,
    'dýně (Cucurbita pepo) → null');

  // Mimo gate (jiná kategorie) → null i kdyby species seděl
  ok(tomatoSuckeringRuleForPlant({ category: { key: 'ovoce' }, nameLat: 'Solanum lycopersicum' }) === null,
    'rajče v kategorii ovoce → null (mimo gate)');
  ok(tomatoSuckeringRuleForPlant({ category: { key: 'bylinky' }, nameLat: 'Solanum lycopersicum' }) === null,
    'rajče v kategorii bylinky → null (mimo gate)');
  ok(tomatoSuckeringRuleForPlant({ category: { key: 'stromy' }, nameLat: 'Malus domestica' }) === null,
    'jabloň (stromy) → null');
  ok(tomatoSuckeringRuleForPlant({ category: { key: 'ovoce' }, nameLat: 'Fragaria × ananassa' }) === null,
    'jahodník → null');
  ok(tomatoSuckeringRuleForPlant({ category: { key: 'okrasne' }, nameLat: 'Salvia nemorosa' }) === null,
    'okrasná Salvia → null');
  ok(tomatoSuckeringRuleForPlant(null) === null, 'bez rostliny → null');
  ok(tomatoSuckeringRuleForPlant({}) === null, 'prázdná rostlina → null');

  // Holý string kategorie funguje (před enrichPlant)
  ok((tomatoSuckeringRuleForPlant({ category: 'zelenina', nameLat: 'Solanum lycopersicum' }) || {}).primary === 6,
    'holý string category=zelenina + S. lycopersicum → primary 6');
  // SPECIES s kultivarem (prefix match)
  const cult = tomatoSuckeringRuleForPlant({ category: 'zelenina', nameLat: "Solanum lycopersicum 'San Marzano'" });
  ok(cult && cult.primary === 6 && cult.apical === 8,
    "S. lycopersicum 'San Marzano' (kultivar) → primary 6 + apical 8 přes SPECIES prefix");

  // ---------- (3) Logika tomatoSuckeringForPin (now-aware) ----------
  const pin = (tasks) => ({ id: 1, tasks: tasks || [] });
  const rajce = { category: { key: 'zelenina' }, nameLat: 'Solanum lycopersicum' };
  const paprika = { category: { key: 'zelenina' }, nameLat: 'Capsicum annuum' };

  {
    // 1. květen → červnové primary okno (15.) cca 45 dní → svítí; srpnové apical
    // okno (15.8.) cca 106 dní → MIMO horizont 50.
    const r = tomatoSuckeringForPin(pin(), rajce, null, new Date(2030, 4, 1));
    ok(r.length === 1, '1. květen: rajče → jen primary svítí, apical mimo horizont');
    ok(r[0].kind === 'primary' && r[0].month === 6, '1. květen: kind=primary, měsíc 6');
    ok(r[0].taskType === 'strihani' && r[0].emoji === '🍅', 'task_type strihani, emoji 🍅');
    ok(r[0].due >= 0 && r[0].due <= TOMATO_SUCKERING_HORIZON_DAYS, 'primary v horizontu 50');
  }
  {
    // Konec června → primary (15.6.) už minulo; apical (15.8.) cca 47 dní → svítí.
    const r = tomatoSuckeringForPin(pin(), rajce, null, new Date(2030, 5, 28));
    ok(r.length === 1, 'konec června: rajče → jen apical svítí');
    ok(r[0].kind === 'apical' && r[0].month === 8, 'kind=apical, měsíc 8');
  }
  {
    // 1. července → primary (15.6.) minulo; apical (15.8.) cca 45 dní → svítí.
    const r = tomatoSuckeringForPin(pin(), rajce, null, new Date(2030, 6, 1));
    ok(r.length === 1 && r[0].kind === 'apical', '1. červenec: rajče → jen apical svítí');
  }
  {
    // Polovina dubna → primary cca 60 dní MIMO horizont; apical mnohem dál → []
    const r = tomatoSuckeringForPin(pin(), rajce, null, new Date(2030, 3, 15));
    ok(r.length === 0, '15. duben: rajče → primary cca 60 dní mimo horizont 50 → skryto');
  }
  {
    // Pozdní srpen → apical (15.8.) minulo → []
    const r = tomatoSuckeringForPin(pin(), rajce, null, new Date(2030, 7, 20));
    ok(r.length === 0, 'pozdní srpen: rajče → apical minulo → []');
  }
  {
    // Leden → daleko → []
    const r = tomatoSuckeringForPin(pin(), rajce, null, new Date(2030, 0, 15));
    ok(r.length === 0, 'leden: rajče → mimo horizont 50 → []');
  }
  {
    // Listopad → daleko → []
    const r = tomatoSuckeringForPin(pin(), rajce, null, new Date(2030, 10, 15));
    ok(r.length === 0, 'listopad: rajče → mimo horizont 50 → []');
  }
  {
    // Paprika → vždy []
    ok(tomatoSuckeringForPin(pin(), paprika, null, new Date(2030, 4, 1)).length === 0,
      'paprika → [] (jiný rod)');
  }

  // ---------- (4) Posun klim. zóny / expozice ----------
  {
    // 10. květen — primary anchor 15.6. = 36 dní; +14 N = 50 dní (na hranici horizontu)
    const baseNow = new Date(2030, 4, 10);
    const base = tomatoSuckeringForPin(pin(), rajce, null, baseNow);
    const north = tomatoSuckeringForPin(pin(), rajce, { exposure: 'N' }, baseNow);
    ok(base.length > 0 && north.length > 0, 'base i sever vrátí ≥1 hint');
    const bp = base.find((h) => h.kind === 'primary');
    const np = north.find((h) => h.kind === 'primary');
    ok(bp && np && np.suggested > bp.suggested,
      'severní expozice → pozdější pasínkování (chladnější ⇒ pozdější fenologie)');
    const south = tomatoSuckeringForPin(pin(), rajce, { exposure: 'S' }, baseNow);
    const sp = south.find((h) => h.kind === 'primary');
    ok(sp && sp.suggested < bp.suggested, 'jižní expozice → dřívější pasínkování');
    ok(getZoneOffsetDays('JHC') !== 0, 'climateZones: JHC má nenulový posun');
    const jhc = tomatoSuckeringForPin(pin(), rajce, { climate_zone: 'JHC' }, baseNow);
    const jhcp = jhc.find((h) => h.kind === 'primary');
    ok(jhcp && jhcp.suggested > bp.suggested, 'klim. zóna JHC (chladnější) → pozdější pasínkování');
  }

  // ---------- (5) Dvoufázový dedup (strihani + marker) v cílovém měsíci ----------
  {
    const now = new Date(2030, 4, 10); // 10. květen → primary okno 15.6.
    const y = now.getFullYear();
    // strihani + marker „pasínkování" v 6 → potlačí primary
    const pasink = [{ title: '🍅 Pasínkování rajčete San Marzano', task_type: 'strihani', specific_date: `${y}-06-15` }];
    const r1 = tomatoSuckeringForPin(pin(pasink), rajce, null, now);
    ok(!r1.some((h) => h.kind === 'primary'), 'dedup: strihani + „pasínkování" v 6 → primary potlačeno');
    // strihani + marker „zálistk"
    const zalistky = [{ title: 'Vylom zálistky', task_type: 'strihani', specific_date: `${y}-06-10` }];
    ok(!tomatoSuckeringForPin(pin(zalistky), rajce, null, now).some((h) => h.kind === 'primary'),
      'dedup: strihani + „zálistk" → primary potlačeno');
    // EN markery
    const sucker = [{ title: 'Sucker the tomato', task_type: 'strihani', specific_date: `${y}-06-12` }];
    ok(!tomatoSuckeringForPin(pin(sucker), rajce, null, now).some((h) => h.kind === 'primary'),
      'dedup: strihani + „sucker" (EN) → primary potlačeno');
    const tomatoPinch = [{ title: 'Tomato apical pinch', task_type: 'strihani', specific_date: `${y}-08-15` }];
    const r2 = tomatoSuckeringForPin(pin(tomatoPinch), rajce, null, new Date(2030, 6, 1));
    ok(!r2.some((h) => h.kind === 'apical'), 'dedup: strihani + „tomato…pinch" v 8 → apical potlačeno');
    const vrcholRajc = [{ title: 'Vyštípnout vrchol rajčete', task_type: 'strihani', specific_date: `${y}-08-15` }];
    const r3 = tomatoSuckeringForPin(pin(vrcholRajc), rajce, null, new Date(2030, 6, 1));
    ok(!r3.some((h) => h.kind === 'apical'), 'dedup: strihani + „vrchol…rajč" v 8 → apical potlačeno');

    // strihani BEZ markeru v 6 → NEpotlačí primary (např. summer-pruning jabloně)
    const summerPrune = [{ title: 'Letní řez jabloně', task_type: 'strihani', specific_date: `${y}-06-15` }];
    ok(tomatoSuckeringForPin(pin(summerPrune), rajce, null, now).some((h) => h.kind === 'primary'),
      'dedup: strihani bez markeru („letní řez jabloně") v 6 → NEpotlačí primary');
    const hedge = [{ title: 'Sestřih živého plotu', task_type: 'strihani', specific_date: `${y}-06-20` }];
    ok(tomatoSuckeringForPin(pin(hedge), rajce, null, now).some((h) => h.kind === 'primary'),
      'dedup: strihani „sestřih plotu" → NEpotlačí primary');

    // jiný task_type + marker → NEPOTLAČÍ (AND vyžaduje strihani)
    const jine = [{ title: '🍅 Pasínkování rajčete', task_type: 'jine', specific_date: `${y}-06-15` }];
    ok(tomatoSuckeringForPin(pin(jine), rajce, null, now).some((h) => h.kind === 'primary'),
      'dedup: task_type jine + marker v 6 → NEpotlačí (AND vyžaduje strihani)');

    // strihani + marker v JINÉM měsíci → nevadí (primary v 6 svítí)
    const otherMonth = [{ title: '🍅 Pasínkování', task_type: 'strihani', specific_date: `${y}-07-15` }];
    ok(tomatoSuckeringForPin(pin(otherMonth), rajce, null, now).some((h) => h.kind === 'primary'),
      'dedup: strihani+marker v JINÉM měsíci (7) → primary v 6 svítí');

    // loňský strihani + marker (jednorázový z minulého roku) → nevadí
    const lastYear = [{ title: '🍅 Pasínkování', task_type: 'strihani', specific_date: `${y - 1}-06-15` }];
    ok(tomatoSuckeringForPin(pin(lastYear), rajce, null, now).some((h) => h.kind === 'primary'),
      'dedup: loňský strihani+marker → primary svítí');

    // opakovaný úkol s markerem v cílovém měsíci → potlačí (bez ohledu na rok)
    const repeating = [{ title: 'Týdenní pasínkování rajčat', task_type: 'strihani', next_due: '2099-06-15', frequency_days: 7 }];
    ok(!tomatoSuckeringForPin(pin(repeating), rajce, null, now).some((h) => h.kind === 'primary'),
      'dedup: opakovaný strihani+marker v 6 → primary potlačeno (bez ohledu na rok)');
  }

  // ---------- (6) Chybějící vstup ----------
  ok(tomatoSuckeringForPin(null, rajce, null, new Date(2030, 4, 10)).length === 0, 'bez pinu → []');
  ok(tomatoSuckeringForPin({ id: 1, tasks: [] }, null, null, new Date(2030, 4, 10)).length === 0, 'bez rostliny → []');

  console.log(`\n✅ All ${passed} tomato-suckering assertions passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
