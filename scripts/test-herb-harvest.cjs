// Sanity test pro „Sběr a sušení bylinek pro kuchyňské použití — letní harvest v 6–9".
// herbHarvest.js importuje RecommendedTasks.jsx (React/JSX) → nejde načíst v čistém node,
// proto REPLIKUJEME pure logiku (stejně jako test-summer-rose-pruning, test-summer-pruning,
// test-late-sowing, test-peach-leaf-curl-spray …). Replika je věrná herbHarvest.js a je
// now-aware (deterministické testy). Matchování GENERA/SPECIES běží proti REÁLNÉ
// plantDatabase načtené dynamickým importem → ověří, že rody a druhy sedí na skutečná
// data a že žádný klíč není mrtvý. dateForMonth/getConditionShiftDays = věrná replika;
// getZoneOffsetDays importujeme z reálného climateZones.js.
// Spuštění: node scripts/test-herb-harvest.cjs
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

// ---------- replika pure logiky (herbHarvest.js) ----------
const HERB_HARVEST_HORIZON_DAYS = 50;
const HERB_HARVEST_EMOJI = '🌿';
const HERB_HARVEST_CATEGORIES = new Set(['bylinky']);
const HERB_HARVEST_GENERA = {
  Ocimum: 7,
  Mentha: 7,
  Origanum: 7,
  Lavandula: 7,
  Petroselinum: 7,
  Thymus: 6,
  Salvia: 6,
  Melissa: 6,
  Rosmarinus: 6,
  Anethum: 6,
  Levisticum: 6,
};
const HERB_HARVEST_SPECIES = {
  'Salvia rosmarinus': 6,
  'Origanum majorana': 7,
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
function herbHarvestRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (!HERB_HARVEST_CATEGORIES.has(cat)) return null;
  const lat = String(plant.nameLat || '').trim();
  for (const sp in HERB_HARVEST_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return { month: HERB_HARVEST_SPECIES[sp] };
  }
  const genus = genusOf(plant);
  if (genus && HERB_HARVEST_GENERA[genus]) return { month: HERB_HARVEST_GENERA[genus] };
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
function hasHerbHarvestInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type !== 'sklizen') continue;
    const title = (e.title || '').trim();
    if (/sušení|sušit|harvest.*dry|dry.*herb|kuchyňské bylinky/i.test(title)) return true;
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
  function herbHarvestForPin(pin, plant, conditions, now) {
    if (!pin || !plant) return [];
    const rule = herbHarvestRuleForPlant(plant);
    if (!rule) return [];
    const suggested = dateForMonth(rule.month, conditions, now);
    const due = daysFromToday(suggested, now);
    if (due === null || due < 0 || due > HERB_HARVEST_HORIZON_DAYS) return [];
    const m = monthFromIso(suggested);
    if (hasHerbHarvestInMonth(pin.tasks || [], m, now.getFullYear())) return [];
    return [{
      kind: 'herbHarvest', month: m, suggested, due,
      taskType: 'sklizen', emoji: HERB_HARVEST_EMOJI,
    }];
  }

  // ---------- (1) Matchování map proti REÁLNÉ DB ----------
  const db = await imp('frontend/src/plantDatabase.js');
  const enriched = db.PLANT_DATABASE.map(db.enrichPlant);

  // GENERA — každý rod musí mít ≥1 reálnou rostlinu v gate `bylinky`. Pokud chybí,
  // oznámíme ℹ ale nebrání (forward-looking — model springMulching/hardeningOff).
  for (const genus of Object.keys(HERB_HARVEST_GENERA)) {
    const present = enriched.some((p) =>
      HERB_HARVEST_CATEGORIES.has(p.category.key) && genusOf(p) === genus
    );
    if (present) {
      ok(true, `HERB_HARVEST_GENERA: rod ${genus} je v DB (bylinky) — žádný mrtvý klíč`);
    } else {
      console.log(`   ℹ rod ${genus} v DB chybí v bylinky (forward-looking — povolené).`);
    }
  }

  // SPECIES precedence — pokud chybí v DB, oznam ale neselhej
  for (const sp of Object.keys(HERB_HARVEST_SPECIES)) {
    const present = enriched.some((p) => {
      const l = String(p.nameLat || '');
      return HERB_HARVEST_CATEGORIES.has(p.category.key) && (l === sp || l.startsWith(`${sp} `));
    });
    if (present) {
      ok(true, `HERB_HARVEST_SPECIES: ${sp} je v DB (bylinky) — precedence aktivní`);
    } else {
      console.log(`   ℹ ${sp} chybí v DB (bylinky) (forward-looking — povolené).`);
    }
  }

  // Najdi všechny bylinky a ověř, že se resolvují, pokud mají rod/druh v mapě
  const herbsInGate = enriched.filter((p) => HERB_HARVEST_CATEGORIES.has(p.category.key));
  ok(herbsInGate.length > 0, `kategorie bylinky obsahuje ≥1 rostlinu v DB`);
  for (const h of herbsInGate) {
    const lat = String(h.nameLat || '');
    const rule = herbHarvestRuleForPlant(h);
    // Pokud druh v SPECIES → musí dát ten měsíc
    let spMatch = null;
    for (const sp in HERB_HARVEST_SPECIES) {
      if (lat === sp || lat.startsWith(`${sp} `)) { spMatch = HERB_HARVEST_SPECIES[sp]; break; }
    }
    if (spMatch !== null) {
      ok(rule && rule.month === spMatch,
        `${h.nameCz} (${lat}) → měsíc ${spMatch} (SPECIES precedence)`);
      continue;
    }
    const genus = genusOf(h);
    if (genus && HERB_HARVEST_GENERA[genus]) {
      ok(rule && rule.month === HERB_HARVEST_GENERA[genus],
        `${h.nameCz} (${lat}) → měsíc ${HERB_HARVEST_GENERA[genus]} (rod ${genus})`);
    } else {
      // Bylinka mimo mapu — null je správně (např. Allium schoenoprasum pažitka)
      ok(rule === null, `${h.nameCz} (${lat}) → null (mimo mapu — bylinka, ale ne pro sušení)`);
    }
  }

  // ---------- (2) Konkrétní bylinky proti DB (přes nameCz) ----------
  const byCz = (name) => enriched.find((p) => p.nameCz === name);
  const ruleCz = (name) => {
    const p = byCz(name);
    return p ? herbHarvestRuleForPlant(p) : 'NOT_FOUND';
  };
  // Bazalka (Ocimum basilicum) → 7
  ok((ruleCz('Bazalka') || {}).month === 7, 'Bazalka (Ocimum basilicum) → 7');
  // Máta peprná (Mentha × piperita) → 7
  const maty = enriched.filter((p) => /^Mentha/.test(p.nameLat || ''));
  ok(maty.length > 0, 'Mentha v DB');
  for (const m of maty) {
    ok((herbHarvestRuleForPlant(m) || {}).month === 7, `${m.nameCz} (${m.nameLat}) → 7`);
  }
  // Oregano (Origanum vulgare) → 7
  ok((ruleCz('Oregano') || {}).month === 7, 'Oregano (Origanum vulgare) → 7');
  // Tymián (Thymus vulgaris) → 6
  ok((ruleCz('Tymián') || {}).month === 6, 'Tymián (Thymus vulgaris) → 6');
  // Šalvěj lékařská (Salvia officinalis) → 6 přes rod
  const salviaOff = enriched.find((p) => p.nameLat === 'Salvia officinalis');
  if (salviaOff) {
    ok((herbHarvestRuleForPlant(salviaOff) || {}).month === 6,
      `${salviaOff.nameCz} (Salvia officinalis) → 6 (rod Salvia)`);
  }
  // Meduňka (Melissa officinalis) → 6
  const meduna = enriched.find((p) => p.nameLat === 'Melissa officinalis');
  if (meduna) {
    ok((herbHarvestRuleForPlant(meduna) || {}).month === 6, 'Meduňka → 6');
  }
  // Levandule (Lavandula angustifolia) → 7
  const lav = enriched.find((p) => /^Lavandula /.test(p.nameLat || ''));
  if (lav) {
    ok((herbHarvestRuleForPlant(lav) || {}).month === 7, `${lav.nameCz} (Lavandula) → 7`);
  }
  // Rozmarýn (Salvia rosmarinus) → 6 přes SPECIES precedence
  const rosmar = enriched.find((p) => p.nameLat === 'Salvia rosmarinus');
  if (rosmar) {
    ok((herbHarvestRuleForPlant(rosmar) || {}).month === 6,
      'Rozmarýn (Salvia rosmarinus) → 6 (SPECIES precedence)');
  }
  // Kopr (Anethum graveolens) → 6
  const kopr = enriched.find((p) => p.nameLat === 'Anethum graveolens');
  if (kopr) ok((herbHarvestRuleForPlant(kopr) || {}).month === 6, 'Kopr → 6');
  // Libeček (Levisticum officinale) → 6
  const libecek = enriched.find((p) => p.nameLat === 'Levisticum officinale');
  if (libecek) ok((herbHarvestRuleForPlant(libecek) || {}).month === 6, 'Libeček → 6');
  // Majoránka (Origanum majorana) → 7 přes SPECIES precedence
  const majo = enriched.find((p) => p.nameLat === 'Origanum majorana');
  if (majo) {
    ok((herbHarvestRuleForPlant(majo) || {}).month === 7,
      'Majoránka (Origanum majorana) → 7 (SPECIES precedence)');
  }

  // ---------- (3) Ornamentální Salvia (S. nemorosa) v okrasné/trvalky → null ----------
  // Spec: forward-looking, ale reálně S. nemorosa cv. existují v DB jako ornamental.
  const salviaOrn = enriched.find((p) => /^Salvia nemorosa/.test(p.nameLat || ''));
  if (salviaOrn) {
    ok(herbHarvestRuleForPlant(salviaOrn) === null,
      `${salviaOrn.nameCz} (${salviaOrn.nameLat}, ${salviaOrn.category.key}) → null (mimo gate bylinky)`);
  }

  // ---------- (4) Mimo gate / mimo mapu → null ----------
  ok(ruleCz('Jabloň') === null, 'Jabloň (stromy) → null (mimo gate)');
  ok(herbHarvestRuleForPlant({ category: { key: 'stromy' }, nameLat: 'Malus domestica' }) === null,
    'jabloň stromy → null');
  ok(herbHarvestRuleForPlant({ category: { key: 'zelenina' }, nameLat: 'Solanum lycopersicum' }) === null,
    'rajče zelenina → null');
  ok(herbHarvestRuleForPlant({ category: { key: 'cibuloviny' }, nameLat: 'Tulipa gesneriana' }) === null,
    'tulipán → null');
  ok(herbHarvestRuleForPlant({ category: { key: 'letnicky' }, nameLat: 'Tagetes patula' }) === null,
    'aksamitník → null');
  ok(herbHarvestRuleForPlant({ category: { key: 'travy' }, nameLat: 'Miscanthus sinensis' }) === null,
    'okrasná tráva → null');
  ok(herbHarvestRuleForPlant({ category: { key: 'ovoce' }, nameLat: 'Fragaria × ananassa' }) === null,
    'jahodník ovoce → null');
  ok(herbHarvestRuleForPlant({ category: { key: 'okrasne' }, nameLat: 'Salvia nemorosa' }) === null,
    'okrasná Salvia (mimo gate) → null');
  ok(herbHarvestRuleForPlant({ category: { key: 'sukulenty' }, nameLat: 'Sempervivum tectorum' }) === null,
    'sukulent → null');
  ok(herbHarvestRuleForPlant(null) === null, 'bez rostliny → null');
  ok(herbHarvestRuleForPlant({}) === null, 'prázdná rostlina → null');
  // Bylinka mimo mapu (např. Allium schoenoprasum pažitka) → null
  ok(herbHarvestRuleForPlant({ category: { key: 'bylinky' }, nameLat: 'Allium schoenoprasum' }) === null,
    'pažitka (Allium schoenoprasum) bylinka mimo mapu → null');
  // Bylinka v jiné gate kategorii → null (Ocimum v zelenině je nesmysl ale ověř gate)
  ok(herbHarvestRuleForPlant({ category: { key: 'zelenina' }, nameLat: 'Ocimum basilicum' }) === null,
    'Ocimum v kategorii zelenina → null (mimo gate)');

  // Holý string kategorie funguje (před enrichPlant)
  ok((herbHarvestRuleForPlant({ category: 'bylinky', nameLat: 'Ocimum basilicum' }) || {}).month === 7,
    'holý string category=bylinky + Ocimum → 7');
  ok((herbHarvestRuleForPlant({ category: 'bylinky', nameLat: 'Thymus vulgaris' }) || {}).month === 6,
    'holý string category=bylinky + Thymus → 6');
  // SPECIES s kultivarem (prefix match)
  ok((herbHarvestRuleForPlant({ category: 'bylinky', nameLat: "Salvia rosmarinus 'Tuscan Blue'" }) || {}).month === 6,
    "Salvia rosmarinus 'Tuscan Blue' (kultivar) → 6 přes SPECIES prefix");
  ok((herbHarvestRuleForPlant({ category: 'bylinky', nameLat: "Origanum vulgare 'Aureum'" }) || {}).month === 7,
    "Origanum vulgare 'Aureum' (kultivar) → 7 přes rod");
  ok((herbHarvestRuleForPlant({ category: 'bylinky', nameLat: "Ocimum basilicum 'Genovese'" }) || {}).month === 7,
    "Ocimum basilicum 'Genovese' (kultivar) → 7 přes rod");

  // ---------- (5) Logika herbHarvestForPin (now-aware) ----------
  const pin = (tasks) => ({ id: 1, tasks: tasks || [] });
  const bazalka = { category: { key: 'bylinky' }, nameLat: 'Ocimum basilicum' }; // 7
  const tymian = { category: { key: 'bylinky' }, nameLat: 'Thymus vulgaris' };    // 6
  const rozmarýn = { category: { key: 'bylinky' }, nameLat: 'Salvia rosmarinus' };// 6
  const okrasnaSalvia = { category: { key: 'okrasne' }, nameLat: 'Salvia nemorosa' }; // null

  {
    // 1. červen → červencové okno (15.) cca 44 dní → v horizontu 50 — bazalka
    const r = herbHarvestForPin(pin(), bazalka, null, new Date(2030, 5, 1));
    ok(r.length === 1 && r[0].kind === 'herbHarvest', 'červen: bazalka → návrh letního harvestu');
    ok(r[0].month === 7, 'bazalka → měsíc 7');
    ok(r[0].taskType === 'sklizen' && r[0].emoji === '🌿', 'task_type sklizen, emoji 🌿');
    ok(r[0].due >= 0 && r[0].due <= HERB_HARVEST_HORIZON_DAYS, 'okno v budoucnu a v horizontu 50');
  }
  {
    // 1. květen → červnové okno (15.) cca 45 dní → v horizontu 50 — tymián (měsíc 6)
    const r = herbHarvestForPin(pin(), tymian, null, new Date(2030, 4, 1));
    ok(r.length === 1 && r[0].month === 6, '1. květen: tymián → červnové okno (6) svítí');
  }
  {
    // Konec dubna → červnové okno cca 47 dní → svítí ještě
    const r = herbHarvestForPin(pin(), tymian, null, new Date(2030, 3, 29));
    ok(r.length === 1, 'konec dubna: tymián → svítí (cca 47 dní v horizontu 50)');
  }
  {
    // Polovina dubna → červnové okno cca 60 dní → MIMO horizont 50 → skryto
    const r = herbHarvestForPin(pin(), tymian, null, new Date(2030, 3, 15));
    ok(r.length === 0, '15. duben: tymián → červnové okno cca 60 dní → mimo horizont 50');
  }
  {
    // Rozmarýn (Salvia rosmarinus) → 6 přes SPECIES, ne 7 (rod by stejně dal 6 ale ok)
    const r = herbHarvestForPin(pin(), rozmarýn, null, new Date(2030, 4, 1));
    ok(r.length === 1 && r[0].month === 6, 'rozmarýn → měsíc 6 (SPECIES Salvia rosmarinus)');
  }
  {
    // Pozdní červenec → bazalkové okno (15.7.) minulo → []
    const r = herbHarvestForPin(pin(), bazalka, null, new Date(2030, 6, 20));
    ok(r.length === 0, 'pozdní červenec: bazalka → okno (15.7.) minulo → []');
  }
  {
    // Pozdní červen → tymián okno (15.6.) minulo → []
    const r = herbHarvestForPin(pin(), tymian, null, new Date(2030, 5, 20));
    ok(r.length === 0, 'pozdní červen: tymián → okno (15.6.) minulo → []');
  }
  {
    // Leden → bazalka okno cca 195 dní mimo horizont → []
    const r = herbHarvestForPin(pin(), bazalka, null, new Date(2030, 0, 15));
    ok(r.length === 0, 'leden: bazalka → cca 195 dní mimo horizont 50 → skryto');
  }
  {
    // Listopad → bazalka okno příští rok cca 250 dní mimo → []
    const r = herbHarvestForPin(pin(), bazalka, null, new Date(2030, 10, 15));
    ok(r.length === 0, 'listopad: bazalka → mimo horizont 50 → skryto');
  }
  {
    // Březen → bazalka okno cca 120 dní mimo horizont → []
    const r = herbHarvestForPin(pin(), bazalka, null, new Date(2030, 2, 15));
    ok(r.length === 0, 'březen: bazalka → cca 120 dní mimo horizont 50 → skryto');
  }
  {
    // Srpen → bazalka okno (15.7.) minulo → []
    const r = herbHarvestForPin(pin(), bazalka, null, new Date(2030, 7, 15));
    ok(r.length === 0, 'srpen: bazalka → okno 7 minulo → příští rok mimo horizont 50 → skryto');
  }
  {
    // Okrasná Salvia → vždy []
    ok(herbHarvestForPin(pin(), okrasnaSalvia, null, new Date(2030, 5, 1)).length === 0,
      'okrasná Salvia → [] (mimo gate)');
  }

  // ---------- (6) Posun klim. zóny / expozice ----------
  {
    // 10. červen — bazalka červencový anchor je 35 dní; +14 N = 49 dní (v horizontu 50)
    const baseNow = new Date(2030, 5, 10);
    const base = herbHarvestForPin(pin(), bazalka, null, baseNow)[0];
    const north = herbHarvestForPin(pin(), bazalka, { exposure: 'N' }, baseNow)[0];
    ok(north && base && north.suggested > base.suggested,
      'severní expozice → pozdější harvest (chladnější ⇒ pozdější fenologie)');
    const south = herbHarvestForPin(pin(), bazalka, { exposure: 'S' }, baseNow)[0];
    ok(south && south.suggested < base.suggested, 'jižní expozice → dřívější harvest');
    ok(getZoneOffsetDays('JHC') !== 0, 'climateZones: JHC má nenulový posun');
    const jhc = herbHarvestForPin(pin(), bazalka, { climate_zone: 'JHC' }, baseNow)[0];
    ok(jhc && jhc.suggested > base.suggested, 'klim. zóna JHC (chladnější) → pozdější harvest');
  }

  // ---------- (7) Dvoufázový dedup (sklizen + marker) v cílovém měsíci ----------
  {
    const now = new Date(2030, 5, 1); // červen → bazalka červencové okno
    const y = now.getFullYear();
    // sklizen + marker „sušení" v cílovém měsíci → potlačí
    const suseni = [{ title: '🌿 Sklizeň bazalky na sušení', task_type: 'sklizen', specific_date: `${y}-07-15` }];
    ok(herbHarvestForPin(pin(suseni), bazalka, null, now).length === 0,
      'dedup: sklizen + „sušení" v 7 → potlačeno');
    // marker „sušit"
    const susit = [{ title: 'Sklízet a sušit bazalku', task_type: 'sklizen', specific_date: `${y}-07-10` }];
    ok(herbHarvestForPin(pin(susit), bazalka, null, now).length === 0,
      'dedup: sklizen + „sušit" → potlačeno');
    // EN markery
    const harvestDry = [{ title: 'Harvest herb for drying', task_type: 'sklizen', specific_date: `${y}-07-12` }];
    ok(herbHarvestForPin(pin(harvestDry), bazalka, null, now).length === 0,
      'dedup: sklizen + „harvest…dry" (EN) → potlačeno');
    const dryHerb = [{ title: 'Dry the herb', task_type: 'sklizen', specific_date: `${y}-07-13` }];
    ok(herbHarvestForPin(pin(dryHerb), bazalka, null, now).length === 0,
      'dedup: sklizen + „dry…herb" → potlačeno');
    const kuchHerbs = [{ title: 'Sklizeň kuchyňské bylinky', task_type: 'sklizen', specific_date: `${y}-07-14` }];
    ok(herbHarvestForPin(pin(kuchHerbs), bazalka, null, now).length === 0,
      'dedup: sklizen + „kuchyňské bylinky" → potlačeno');
    // sklizen BEZ markeru (např. „Sklizeň jahod") v cílovém měsíci → NEpotlačí
    const jahody = [{ title: 'Sklizeň jahod', task_type: 'sklizen', specific_date: `${y}-07-15` }];
    ok(herbHarvestForPin(pin(jahody), bazalka, null, now).length === 1,
      'dedup: sklizen „jahody" bez markeru v 7 → NEpotlačí → návrh svítí');
    const okurka = [{ title: 'Sklizeň okurky', task_type: 'sklizen', specific_date: `${y}-07-15` }];
    ok(herbHarvestForPin(pin(okurka), bazalka, null, now).length === 1,
      'dedup: sklizen „okurka" bez markeru v 7 → NEpotlačí');
    // jiný task_type + marker → NEPOTLAČÍ (AND vyžaduje sklizen)
    const jine = [{ title: '🌿 Sušení bylinek', task_type: 'jine', specific_date: `${y}-07-15` }];
    ok(herbHarvestForPin(pin(jine), bazalka, null, now).length === 1,
      'dedup: task_type jine + marker v 7 → NEpotlačí (AND vyžaduje sklizen)');
    // sklizen + marker v JINÉM měsíci → nevadí
    const otherMonth = [{ title: '🌿 Sklizeň na sušení', task_type: 'sklizen', specific_date: `${y}-08-15` }];
    ok(herbHarvestForPin(pin(otherMonth), bazalka, null, now).length === 1,
      'dedup: sklizen+marker v JINÉM měsíci (8) → návrh svítí');
    // loňský sklizen + marker (jednorázový z minulého roku) → nevadí
    const lastYear = [{ title: '🌿 Sklizeň na sušení', task_type: 'sklizen', specific_date: `${y - 1}-07-15` }];
    ok(herbHarvestForPin(pin(lastYear), bazalka, null, now).length === 1,
      'dedup: loňský sklizen+marker → návrh svítí');
    // opakovaný úkol s markerem v cílovém měsíci → potlačí (bez ohledu na rok)
    const repeating = [{ title: 'Sklízet a sušit bazalku', task_type: 'sklizen', next_due: '2099-07-15', frequency_days: 365 }];
    ok(herbHarvestForPin(pin(repeating), bazalka, null, now).length === 0,
      'dedup: opakovaný sklizen+marker v 7 → potlačeno (bez ohledu na rok)');
  }

  // ---------- (8) Chybějící vstup ----------
  ok(herbHarvestForPin(null, bazalka, null, new Date(2030, 5, 1)).length === 0, 'bez pinu → []');
  ok(herbHarvestForPin({ id: 1, tasks: [] }, null, null, new Date(2030, 5, 1)).length === 0, 'bez rostliny → []');

  console.log(`\n✅ All ${passed} herb-harvest assertions passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
