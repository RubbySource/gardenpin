// Sanity test pro „Letní řez růží po prvním kvetení — deadheading + light cutback pro
// druhou vlnu v 7". summerRosePruning.js importuje RecommendedTasks.jsx (React/JSX) →
// nejde načíst v čistém node, proto REPLIKUJEME pure logiku (stejně jako test-summer-
// pruning, test-fruit-thinning, test-peach-leaf-curl-spray …). Replika je věrná
// summerRosePruning.js a je now-aware (deterministické testy). Matchování GENERA/SPECIES
// běží proti REÁLNÉ plantDatabase načtené dynamickým importem → ověří, že rod Rosa sedí
// na skutečná data a že historické jednou kvetoucí species exclusions (gallica/damascena/
// alba/centifolia/rugosa) jsou forward-looking — pokud v DB nejsou, test to oznámí ale
// nebrání (model springMulching/hardeningOff). dateForMonth/getConditionShiftDays =
// věrná replika; getZoneOffsetDays importujeme z reálného climateZones.js.
// Spuštění: node scripts/test-summer-rose-pruning.cjs
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

// ---------- replika pure logiky (summerRosePruning.js) ----------
const SUMMER_ROSE_HORIZON_DAYS = 50;
const SUMMER_ROSE_EMOJI = '✂️';
const SUMMER_ROSE_CATEGORIES = new Set([
  'kere', 'okrasne', 'popinave', 'bylinky', 'trvalky',
]);
const SUMMER_ROSE_GENERA = { Rosa: 7 };
const SUMMER_ROSE_SPECIES_EXCLUDE = {
  'Rosa gallica': null,
  'Rosa damascena': null,
  'Rosa alba': null,
  'Rosa centifolia': null,
  'Rosa rugosa': null,
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
function summerRosePruningRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (!SUMMER_ROSE_CATEGORIES.has(cat)) return null;
  const lat = String(plant.nameLat || '').trim();
  for (const sp in SUMMER_ROSE_SPECIES_EXCLUDE) {
    if (lat === sp || lat.startsWith(`${sp} `)) return null;
  }
  const genus = genusOf(plant);
  if (genus && SUMMER_ROSE_GENERA[genus]) return { month: SUMMER_ROSE_GENERA[genus] };
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
function hasSummerRosePruningInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type !== 'strihani') continue;
    const title = (e.title || '').trim();
    if (/růž|deadhead|odkvet|druhá vlna|zwei.*Flor/i.test(title)) return true;
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
  function summerRosePruningForPin(pin, plant, conditions, now) {
    if (!pin || !plant) return [];
    const rule = summerRosePruningRuleForPlant(plant);
    if (!rule) return [];
    const suggested = dateForMonth(rule.month, conditions, now);
    const due = daysFromToday(suggested, now);
    if (due === null || due < 0 || due > SUMMER_ROSE_HORIZON_DAYS) return [];
    const m = monthFromIso(suggested);
    if (hasSummerRosePruningInMonth(pin.tasks || [], m, now.getFullYear())) return [];
    return [{
      kind: 'summerRosePruning', month: m, suggested, due,
      taskType: 'strihani', emoji: SUMMER_ROSE_EMOJI,
    }];
  }

  // ---------- (1) Matchování map proti REÁLNÉ DB ----------
  const db = await imp('frontend/src/plantDatabase.js');
  const enriched = db.PLANT_DATABASE.map(db.enrichPlant);

  // Najdi všechny Rosa (rod = první slovo) v gate kategoriích
  const rosesInGate = enriched.filter((p) =>
    SUMMER_ROSE_CATEGORIES.has(p.category.key) && genusOf(p) === 'Rosa'
  );
  ok(rosesInGate.length > 0,
    `SUMMER_ROSE_GENERA: rod Rosa je v DB (kere/okrasne/popinave/bylinky/trvalky) — žádný mrtvý klíč`);
  for (const r of rosesInGate) {
    // Pokud není v exclusions, musí resolvovat na 7
    const lat = String(r.nameLat || '');
    const isExcluded = Object.keys(SUMMER_ROSE_SPECIES_EXCLUDE)
      .some((sp) => lat === sp || lat.startsWith(`${sp} `));
    if (isExcluded) {
      ok(summerRosePruningRuleForPlant(r) === null,
        `${r.nameCz} (${lat}, ${r.category.key}) → null (species exclude — historická jednou kvetoucí)`);
    } else {
      const rule = summerRosePruningRuleForPlant(r);
      ok(rule && rule.month === 7,
        `${r.nameCz} (${lat}, ${r.category.key}) → měsíc 7 (rod Rosa)`);
    }
  }

  // SPECIES EXCLUSIONS forward-looking — pokud chybí v DB, oznam ale neselhej
  for (const sp of Object.keys(SUMMER_ROSE_SPECIES_EXCLUDE)) {
    const present = enriched.some((p) => {
      const l = String(p.nameLat || '');
      return SUMMER_ROSE_CATEGORIES.has(p.category.key) && (l === sp || l.startsWith(`${sp} `));
    });
    if (!present) {
      console.log(`   ℹ ${sp} chybí v DB (forward-looking exclusion — povolené).`);
    } else {
      ok(true, `SUMMER_ROSE_SPECIES_EXCLUDE: ${sp} je v DB — vyloučení aktivní`);
    }
  }

  // Ostatní kere/okrasne/popinave NE-Rosa → null
  const byCz = (name) => enriched.find((p) => p.nameCz === name);
  const ruleCz = (name) => {
    const p = byCz(name);
    return p ? summerRosePruningRuleForPlant(p) : 'NOT_FOUND';
  };
  // Najdi Buxus/Ligustrum/Spiraea/Hydrangea/Forsythia (jakákoli)
  const buxus = enriched.find((p) => /^Buxus /.test(p.nameLat || ''));
  if (buxus) ok(summerRosePruningRuleForPlant(buxus) === null,
    `${buxus.nameCz} (Buxus, ${buxus.category.key}) → null (ne-Rosa)`);
  const ligustrum = enriched.find((p) => /^Ligustrum /.test(p.nameLat || ''));
  if (ligustrum) ok(summerRosePruningRuleForPlant(ligustrum) === null,
    `${ligustrum.nameCz} (Ligustrum, ${ligustrum.category.key}) → null (ne-Rosa)`);
  const spiraea = enriched.find((p) => /^Spiraea /.test(p.nameLat || ''));
  if (spiraea) ok(summerRosePruningRuleForPlant(spiraea) === null,
    `${spiraea.nameCz} (Spiraea, ${spiraea.category.key}) → null (ne-Rosa)`);
  const hydrangea = enriched.find((p) => /^Hydrangea/.test(p.nameLat || ''));
  if (hydrangea) ok(summerRosePruningRuleForPlant(hydrangea) === null,
    `${hydrangea.nameCz} (Hydrangea, ${hydrangea.category.key}) → null (ne-Rosa)`);
  const forsythia = enriched.find((p) => /^Forsythia/.test(p.nameLat || ''));
  if (forsythia) ok(summerRosePruningRuleForPlant(forsythia) === null,
    `${forsythia.nameCz} (Forsythia, ${forsythia.category.key}) → null (ne-Rosa)`);

  // Klematis (Clematis) v popinave NE-Rosa → null
  const clematis = enriched.find((p) => /^Clematis/.test(p.nameLat || ''));
  if (clematis) ok(summerRosePruningRuleForPlant(clematis) === null,
    `${clematis.nameCz} (Clematis, ${clematis.category.key}) → null (popinave ale ne Rosa)`);

  // Jabloň (stromy), trvalka, cibulovina, zelenina, letnička → null (mimo gate)
  ok(ruleCz('Jabloň') === null, 'jabloň (Malus, stromy) → null (mimo gate)');
  ok(summerRosePruningRuleForPlant({ category: { key: 'stromy' }, nameLat: 'Malus domestica' }) === null,
    'rostlina stromy → null (mimo gate)');
  ok(summerRosePruningRuleForPlant({ category: { key: 'zelenina' }, nameLat: 'Rosa odorata' }) === null,
    'Rosa v kategorii zelenina → null (mimo gate)');
  ok(summerRosePruningRuleForPlant({ category: { key: 'cibuloviny' }, nameLat: 'Tulipa gesneriana' }) === null,
    'cibulovina → null (mimo gate)');
  ok(summerRosePruningRuleForPlant({ category: { key: 'letnicky' }, nameLat: 'Tagetes patula' }) === null,
    'letnička (mimo Rosa) → null (mimo gate)');
  ok(summerRosePruningRuleForPlant({ category: { key: 'travy' }, nameLat: 'Miscanthus sinensis' }) === null,
    'tráva → null (mimo gate)');
  ok(summerRosePruningRuleForPlant({ category: { key: 'jehlicnany' }, nameLat: 'Pinus sylvestris' }) === null,
    'jehličnan → null (mimo gate)');
  ok(summerRosePruningRuleForPlant({ category: { key: 'sukulenty' }, nameLat: 'Sempervivum tectorum' }) === null,
    'sukulent → null (mimo gate)');
  ok(summerRosePruningRuleForPlant({ category: { key: 'vodni' }, nameLat: 'Iris pseudacorus' }) === null,
    'vodní → null (mimo gate)');
  ok(summerRosePruningRuleForPlant(null) === null, 'bez rostliny → null');
  ok(summerRosePruningRuleForPlant({}) === null, 'prázdná rostlina (bez category) → null');

  // Holý string kategorie (před enrichPlant) funguje
  ok((summerRosePruningRuleForPlant({ category: 'kere', nameLat: 'Rosa multiflora' }) || {}).month === 7,
    'holý string category=kere + Rosa → 7');
  ok((summerRosePruningRuleForPlant({ category: 'okrasne', nameLat: 'Rosa hybrida' }) || {}).month === 7,
    'holý string category=okrasne + Rosa → 7');
  ok((summerRosePruningRuleForPlant({ category: 'popinave', nameLat: 'Rosa multiflora rambler' }) || {}).month === 7,
    'holý string category=popinave + Rosa → 7');
  ok((summerRosePruningRuleForPlant({ category: 'bylinky', nameLat: 'Rosa' }) || {}).month === 7,
    'holý string category=bylinky + Rosa → 7 (pojistka pro id 40 fallback)');
  ok((summerRosePruningRuleForPlant({ category: 'trvalky', nameLat: 'Rosa hybrida' }) || {}).month === 7,
    'holý string category=trvalky + Rosa → 7 (pojistka)');

  // Species exclusions přes holý string (forward-looking)
  ok(summerRosePruningRuleForPlant({ category: 'kere', nameLat: 'Rosa gallica' }) === null,
    'Rosa gallica (historická) → null přes species exclude');
  ok(summerRosePruningRuleForPlant({ category: 'kere', nameLat: 'Rosa damascena' }) === null,
    'Rosa damascena → null');
  ok(summerRosePruningRuleForPlant({ category: 'kere', nameLat: 'Rosa alba' }) === null,
    'Rosa alba → null');
  ok(summerRosePruningRuleForPlant({ category: 'kere', nameLat: 'Rosa centifolia' }) === null,
    'Rosa centifolia → null');
  ok(summerRosePruningRuleForPlant({ category: 'kere', nameLat: 'Rosa rugosa' }) === null,
    'Rosa rugosa (šípky) → null');
  // species s kultivarem → null (prefix match)
  ok(summerRosePruningRuleForPlant({ category: 'kere', nameLat: "Rosa gallica 'Officinalis'" }) === null,
    "Rosa gallica 'Officinalis' (kultivar) → null přes species exclude prefix");

  // ---------- (2) Logika summerRosePruningForPin (now-aware) ----------
  const pin = (tasks) => ({ id: 1, tasks: tasks || [] });
  const rose = { category: { key: 'kere' }, nameLat: 'Rosa hybrida' };
  const roseClimbing = { category: { key: 'popinave' }, nameLat: 'Rosa multiflora rambler' };
  const roseOrn = { category: { key: 'okrasne' }, nameLat: 'Rosa odorata' };
  const roseId40 = { category: { key: 'bylinky' }, nameLat: 'Rosa' }; // simulace id 40 fallback
  const historicalRose = { category: { key: 'kere' }, nameLat: 'Rosa gallica' };

  {
    // 1. červen → červencové okno (15.) cca 44 dní → v horizontu 50
    const r = summerRosePruningForPin(pin(), rose, null, new Date(2030, 5, 1));
    ok(r.length === 1 && r[0].kind === 'summerRosePruning', 'červen: růže → návrh letního řezu');
    ok(r[0].month === 7, 'růže → měsíc 7');
    ok(r[0].taskType === 'strihani' && r[0].emoji === '✂️', 'task_type strihani, emoji ✂️');
    ok(r[0].due >= 0 && r[0].due <= SUMMER_ROSE_HORIZON_DAYS, 'okno v budoucnu a v horizontu 50');
  }
  {
    const r = summerRosePruningForPin(pin(), roseClimbing, null, new Date(2030, 5, 1));
    ok(r.length === 1 && r[0].month === 7, 'červen: popínavá růže → měsíc 7');
  }
  {
    const r = summerRosePruningForPin(pin(), roseOrn, null, new Date(2030, 5, 1));
    ok(r.length === 1 && r[0].month === 7, 'červen: okrasná růže → měsíc 7');
  }
  {
    const r = summerRosePruningForPin(pin(), roseId40, null, new Date(2030, 5, 1));
    ok(r.length === 1 && r[0].month === 7, 'červen: Rosa zahradní (id 40 ⇒ bylinky fallback) → měsíc 7 (gate pojistka)');
  }
  {
    // Historická → null vždy, nezáleží na sezóně
    ok(summerRosePruningForPin(pin(), historicalRose, null, new Date(2030, 5, 1)).length === 0,
      'červen: historická Rosa gallica → [] (exclude)');
  }

  // Začátek července → okno svítí; pozdní červenec → minulo → []
  ok(summerRosePruningForPin(pin(), rose, null, new Date(2030, 6, 1)).length === 1,
    'začátek července: červencové okno → návrh svítí');
  ok(summerRosePruningForPin(pin(), rose, null, new Date(2030, 6, 20)).length === 0,
    'pozdní červenec: okno (15.) minulo → [] (nikdy do minulosti)');

  // Mimo horizont 50 → skryto
  ok(summerRosePruningForPin(pin(), rose, null, new Date(2030, 0, 15)).length === 0,
    'leden: červencové okno cca 181 dní → mimo horizont 50 → skryto');
  ok(summerRosePruningForPin(pin(), rose, null, new Date(2030, 4, 1)).length === 0,
    'začátek května: červencové okno cca 75 dní → mimo horizont 50 → skryto');
  ok(summerRosePruningForPin(pin(), rose, null, new Date(2030, 4, 26)).length === 1,
    'konec května: červencové okno cca 50 dní → v horizontu 50 → svítí');
  ok(summerRosePruningForPin(pin(), rose, null, new Date(2030, 7, 15)).length === 0,
    'srpen: červencové okno minulo → příští rok >50 dní → skryto');
  ok(summerRosePruningForPin(pin(), rose, null, new Date(2030, 10, 15)).length === 0,
    'listopad: mimo horizont 50 → skryto');
  ok(summerRosePruningForPin(pin(), rose, null, new Date(2030, 2, 15)).length === 0,
    'březen: červencové okno cca 122 dní → mimo horizont 50 → skryto');

  // ---------- (3) Posun klim. zóny / expozice ----------
  // Použijeme „teď = 10. červen" — dává hlavičku 35 dní k 15. červenci, takže i s posunem
  // +14 dní pro severní expozici (= 49 dní) všechno zůstane v horizontu 50.
  {
    const baseNow = new Date(2030, 5, 10);
    const base = summerRosePruningForPin(pin(), rose, null, baseNow)[0];
    const north = summerRosePruningForPin(pin(), rose, { exposure: 'N' }, baseNow)[0];
    ok(north && base && north.suggested > base.suggested,
      'severní expozice → pozdější deadheading (chladnější ⇒ pozdější první vlna)');
    const south = summerRosePruningForPin(pin(), rose, { exposure: 'S' }, baseNow)[0];
    ok(south && south.suggested < base.suggested, 'jižní expozice → dřívější deadheading');
    ok(getZoneOffsetDays('JHC') !== 0, 'climateZones: JHC má nenulový posun');
    const jhc = summerRosePruningForPin(pin(), rose, { climate_zone: 'JHC' }, baseNow)[0];
    ok(jhc && jhc.suggested > base.suggested, 'klim. zóna JHC (chladnější) → pozdější deadheading');
  }

  // ---------- (4) Dvoufázový dedup (strihani + marker) v cílovém měsíci ----------
  {
    const now = new Date(2030, 5, 1); // červen → červencové okno
    const y = now.getFullYear();
    // strihani + marker „růže" v cílovém měsíci → potlačí
    const ruz = [{ title: '✂️ Letní řez růže', task_type: 'strihani', specific_date: `${y}-07-15` }];
    ok(summerRosePruningForPin(pin(ruz), rose, null, now).length === 0,
      'dedup: strihani + „růž" v 7 → potlačeno');
    // různé varianty markeru — deadhead, odkvet, druhá vlna, zwei Florwelle (DE)
    const dh = [{ title: '✂️ Deadhead spent blooms', task_type: 'strihani', specific_date: `${y}-07-10` }];
    ok(summerRosePruningForPin(pin(dh), rose, null, now).length === 0,
      'dedup: strihani + „deadhead" → potlačeno (EN)');
    const odkv = [{ title: '✂️ Odstranit odkvetlé', task_type: 'strihani', specific_date: `${y}-07-12` }];
    ok(summerRosePruningForPin(pin(odkv), rose, null, now).length === 0,
      'dedup: strihani + „odkvet" → potlačeno');
    const vlna = [{ title: '✂️ Druhá vlna kvetení', task_type: 'strihani', specific_date: `${y}-07-14` }];
    ok(summerRosePruningForPin(pin(vlna), rose, null, now).length === 0,
      'dedup: strihani + „druhá vlna" → potlačeno');
    const zweite = [{ title: '✂️ Zweite Florwelle', task_type: 'strihani', specific_date: `${y}-07-14` }];
    ok(summerRosePruningForPin(pin(zweite), rose, null, now).length === 0,
      'dedup: strihani + „zwei…Flor" → potlačeno (DE)');
    // jiný strihani BEZ markeru v cílovém měsíci → NEPOTLAČÍ (simulace hedgeTrim/summerPruning)
    const hedge = [{ title: '🌳 Letní tvarování plotu Buxus', task_type: 'strihani', specific_date: `${y}-07-15` }];
    ok(summerRosePruningForPin(pin(hedge), rose, null, now).length === 1,
      'dedup: strihani bez markeru (hedgeTrim simulace) v 7 → NEpotlačí → návrh svítí');
    const summerApple = [{ title: '✂️ Letní řez Jabloň', task_type: 'strihani', specific_date: `${y}-07-15` }];
    ok(summerRosePruningForPin(pin(summerApple), rose, null, now).length === 1,
      'dedup: strihani „letní řez jabloň" (summerPruning simulace) v 7 → NEpotlačí (nesouvisející řez)');
    const cutback = [{ title: '🌿 Sestřih trvalky', task_type: 'strihani', specific_date: `${y}-07-20` }];
    ok(summerRosePruningForPin(pin(cutback), rose, null, now).length === 1,
      'dedup: strihani bez markeru (perennialCutback simulace) v 7 → NEpotlačí');
    // jiný task_type + marker v cílovém měsíci → NEPOTLAČÍ (AND vyžaduje strihani)
    const jine = [{ title: '✂️ Deadheading růží', task_type: 'jine', specific_date: `${y}-07-15` }];
    ok(summerRosePruningForPin(pin(jine), rose, null, now).length === 1,
      'dedup: task_type jine + marker v 7 → NEpotlačí (AND vyžaduje strihani)');
    // strihani + marker v JINÉM měsíci → nevadí
    const otherMonth = [{ title: '✂️ Deadheading růží', task_type: 'strihani', specific_date: `${y}-08-15` }];
    ok(summerRosePruningForPin(pin(otherMonth), rose, null, now).length === 1,
      'dedup: strihani+marker v JINÉM měsíci (8) → návrh svítí');
    // loňský strihani + marker (jednorázový z minulého roku) → nevadí
    const lastYear = [{ title: '✂️ Deadheading růží', task_type: 'strihani', specific_date: `${y - 1}-07-15` }];
    ok(summerRosePruningForPin(pin(lastYear), rose, null, now).length === 1,
      'dedup: loňský strihani+marker → návrh svítí');
    // opakovaný úkol (frequency_days) v cílovém měsíci s markerem → potlačí (bez ohledu na rok)
    const repeating = [{ title: 'Deadheading růží', task_type: 'strihani', next_due: '2099-07-15', frequency_days: 365 }];
    ok(summerRosePruningForPin(pin(repeating), rose, null, now).length === 0,
      'dedup: opakovaný strihani+marker v 7 → potlačeno (bez ohledu na rok)');
  }

  // ---------- (5) Chybějící vstup ----------
  ok(summerRosePruningForPin(null, rose, null, new Date(2030, 5, 1)).length === 0, 'bez pinu → []');
  ok(summerRosePruningForPin({ id: 1, tasks: [] }, null, null, new Date(2030, 5, 1)).length === 0, 'bez rostliny → []');

  console.log(`\n✅ All ${passed} summer-rose-pruning assertions passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
