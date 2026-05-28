// Sanity test pro „Mulčování jahodníku slámou před sklizní — ochrana plodů".
// strawberryStrawing.js importuje RecommendedTasks.jsx (React/JSX) → nejde načíst v čistém node,
// proto REPLIKUJEME pure logiku (stejně jako test-strawberry-renewal / test-herb-harvest).
// Replika je věrná strawberryStrawing.js a je now-aware (deterministické testy).
// Matchování STRAWBERRY_STRAWING_GENERA běží proti REÁLNÉ plantDatabase načtené dynamickým
// importem → ověří, že kurátorská mapa sedí na skutečná data (žádné mrtvé klíče) a že
// ostatní drobné ovoce (rybíz/maliník/borůvka) i jádroviny / okrasné / zelenina jsou vyřazené.
// dateForMonth/getConditionShiftDays = věrná replika; getZoneOffsetDays importujeme
// z reálného climateZones.js (jeden zdroj pravdy pro posun klim. zóny).
// Spuštění: node scripts/test-strawberry-strawing.cjs
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

// ---------- replika pure logiky (strawberryStrawing.js) ----------
const STRAWBERRY_STRAWING_HORIZON_DAYS = 40;
const STRAWBERRY_STRAWING_EMOJI = '🌾';
const STRAWBERRY_STRAWING_GENERA = {
  Fragaria: 5,
};
const STRAWBERRY_STRAWING_SPECIES = {};
const STRAWBERRY_STRAWING_CATEGORIES = new Set(['ovoce']);

function categoryKey(plant) {
  const c = plant && plant.category;
  if (!c) return null;
  return typeof c === 'string' ? c : c.key || null;
}
function genusOf(plant) {
  const lat = String((plant && plant.nameLat) || '').trim();
  return lat ? lat.split(/\s+/)[0] || null : null;
}
function strawberryStrawingRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (!STRAWBERRY_STRAWING_CATEGORIES.has(cat)) return null;
  const lat = String((plant && plant.nameLat) || '').trim();
  for (const sp in STRAWBERRY_STRAWING_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return { month: STRAWBERRY_STRAWING_SPECIES[sp] };
  }
  const genus = genusOf(plant);
  if (genus && STRAWBERRY_STRAWING_GENERA[genus]) return { month: STRAWBERRY_STRAWING_GENERA[genus] };
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
function hasStrawberryStrawingInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type !== 'jine') continue;
    const title = (e.title || '').trim();
    if (/slám|slam|straw|słom|stroh|jahod.*mulč|strawberry.*straw/i.test(title)) return true;
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
  function strawberryStrawingForPin(pin, plant, conditions, now) {
    if (!pin || !plant) return [];
    const rule = strawberryStrawingRuleForPlant(plant);
    if (!rule) return [];
    const suggested = dateForMonth(rule.month, conditions, now);
    const due = daysFromToday(suggested, now);
    if (due === null || due < 0 || due > STRAWBERRY_STRAWING_HORIZON_DAYS) return [];
    const m = monthFromIso(suggested);
    if (hasStrawberryStrawingInMonth(pin.tasks || [], m, now.getFullYear())) return [];
    return [{
      kind: 'strawberryStrawing', month: m, suggested, due,
      taskType: 'jine', emoji: STRAWBERRY_STRAWING_EMOJI,
    }];
  }

  // ---------- (1) Matchování map proti REÁLNÉ DB ----------
  const db = await imp('frontend/src/plantDatabase.js');
  const enriched = db.PLANT_DATABASE.map(db.enrichPlant);
  const byCz = (name) => enriched.find((p) => p.nameCz === name);
  const ruleCz = (name) => strawberryStrawingRuleForPlant(byCz(name));
  const monthCz = (name) => { const r = ruleCz(name); return r && r.month; };

  // jahodník — Fragaria v ovoci → květen (5)
  ok(monthCz('Jahoda lesní') === 5, 'jahoda lesní (Fragaria vesca, ovoce) → květen');
  ok(monthCz('Jahoda měsíční') === 5, 'jahoda měsíční (Fragaria vesca var. semperflorens, ovoce) → květen');
  ok(monthCz('Jahodník') === 5, 'jahodník (Fragaria × ananassa, ovoce) → květen');

  // ostatní drobné ovoce (rybíz/maliník/angrešt/ostružiník/borůvka) — v ovoci, ale rod mimo mapu → null
  ok(ruleCz('Rybíz černý') === null, 'rybíz černý (Ribes nigrum, ovoce) → null (mimo mapu)');
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
  ok(strawberryStrawingRuleForPlant({ category: { key: 'zelenina' }, nameLat: 'Fragaria virginiana' }) === null,
    'Fragaria v zelenině → null (mimo gate)');
  ok(strawberryStrawingRuleForPlant({ category: { key: 'trvalky' }, nameLat: 'Fragaria vesca' }) === null,
    'Fragaria v trvalkách → null (mimo gate)');
  ok(strawberryStrawingRuleForPlant({ category: { key: 'okrasne' }, nameLat: 'Fragaria virginiana' }) === null,
    'Fragaria v okrasne → null (mimo gate — jen ovoce)');
  ok(strawberryStrawingRuleForPlant({ category: { key: 'bylinky' }, nameLat: 'Fragaria vesca' }) === null,
    'Fragaria v bylinkách → null (mimo gate)');
  ok(strawberryStrawingRuleForPlant({ category: { key: 'stromy' }, nameLat: 'Fragaria vesca' }) === null,
    'Fragaria ve stromech → null (mimo gate)');
  ok(strawberryStrawingRuleForPlant({ category: { key: 'ovoce' }, nameLat: 'Solanum lycopersicum' }) === null,
    'rajče v ovoci (nereálné, ale gate projde) — rod mimo mapu → null');
  ok(strawberryStrawingRuleForPlant(null) === null, 'bez rostliny → null');
  ok(strawberryStrawingRuleForPlant({ category: null, nameLat: 'Fragaria vesca' }) === null,
    'bez kategorie → null');
  ok(strawberryStrawingRuleForPlant({ category: { key: 'ovoce' }, nameLat: '' }) === null,
    'prázdný nameLat → null (rod neurčen)');

  // gate akceptuje i holý string kategorie
  ok((strawberryStrawingRuleForPlant({ category: 'ovoce', nameLat: 'Fragaria vesca' }) || {}).month === 5,
    'holý string category=ovoce + Fragaria → květen');
  // forward-looking druhy Fragaria (F. moschata, F. virginiana) přes ROD chytí stejně
  ok((strawberryStrawingRuleForPlant({ category: 'ovoce', nameLat: 'Fragaria moschata' }) || {}).month === 5,
    'forward-looking F. moschata v ovoci → květen (rod Fragaria)');
  // kultivary přes prefix ROD-match
  ok((strawberryStrawingRuleForPlant({ category: 'ovoce', nameLat: "Fragaria × ananassa 'Mara des Bois'" }) || {}).month === 5,
    "kultivar Fragaria × ananassa 'Mara des Bois' → květen (rod Fragaria)");

  // integrita: žádný mrtvý klíč mapy (každý rod existuje v reálné DB v gate)
  const inGate = (p) => STRAWBERRY_STRAWING_CATEGORIES.has(p.category.key);
  const generaInGate = new Set(enriched.filter(inGate).map(genusOf));
  for (const g of Object.keys(STRAWBERRY_STRAWING_GENERA)) {
    ok(generaInGate.has(g), `STRAWBERRY_STRAWING_GENERA: rod ${g} je v DB (ovoce) — žádný mrtvý klíč`);
  }

  // ---------- (2) Logika strawberryStrawingForPin (now-aware) ----------
  const pin = (tasks) => ({ id: 1, tasks: tasks || [] });
  const frag = { category: { key: 'ovoce' }, nameLat: 'Fragaria vesca' }; // květen (5)

  {
    const r = strawberryStrawingForPin(pin(), frag, null, new Date(2030, 3, 20)); // 20. duben → květen
    ok(r.length === 1 && r[0].kind === 'strawberryStrawing', 'duben: jahodník → návrh strawingu');
    ok(r[0].month === 5 && r[0].taskType === 'jine' && r[0].emoji === '🌾', 'měsíc 5, task_type jine, emoji 🌾');
    ok(r[0].due >= 0 && r[0].due <= STRAWBERRY_STRAWING_HORIZON_DAYS, 'okno v budoucnu a v horizontu');
  }
  {
    const r = strawberryStrawingForPin(pin(), frag, null, new Date(2030, 4, 1)); // 1. květen → svítí
    ok(r.length === 1 && r[0].month === 5, 'začátek května: jahodník → návrh svítí');
  }

  // pozdně v cílovém měsíci (po 15.) → [] (nikdy do minulosti)
  ok(strawberryStrawingForPin(pin(), frag, null, new Date(2030, 4, 20)).length === 0,
    'pozdní květen: okno (15.) minulo → [] (nikdy do minulosti)');

  // mimo horizont → skryto (horizont 40 dní krátký)
  ok(strawberryStrawingForPin(pin(), frag, null, new Date(2030, 1, 15)).length === 0,
    'únor: květnové okno >40 dní → skryto');
  ok(strawberryStrawingForPin(pin(), frag, null, new Date(2030, 2, 1)).length === 0,
    'začátek března: květnové okno >40 dní → skryto');
  ok(strawberryStrawingForPin(pin(), frag, null, new Date(2030, 5, 20)).length === 0,
    'konec června: květnové okno minulo → příští rok >40 dní → skryto');
  ok(strawberryStrawingForPin(pin(), frag, null, new Date(2030, 7, 1)).length === 0,
    'srpen: příští rok květen >40 dní → skryto');
  ok(strawberryStrawingForPin(pin(), frag, null, new Date(2030, 10, 1)).length === 0,
    'listopad: příští rok květen >40 dní → skryto');

  // přesně na hraně horizontu — duben 5. by měl být v rozsahu (do 15. května cca 40 dní)
  {
    const r = strawberryStrawingForPin(pin(), frag, null, new Date(2030, 3, 5));
    ok(r.length === 1, '5. duben: do 15. května ~40 dní → na hraně horizontu, svítí');
  }
  // 1. duben → 44 dní → mimo horizont 40 → skryto
  {
    const r = strawberryStrawingForPin(pin(), frag, null, new Date(2030, 3, 1));
    ok(r.length === 0, '1. duben: do 15. května ~44 dní → mimo horizont 40 → skryto');
  }

  // ---------- (3) Posun klim. zóny / expozice ----------
  {
    const base = strawberryStrawingForPin(pin(), frag, null, new Date(2030, 3, 20))[0];
    const north = strawberryStrawingForPin(pin(), frag, { exposure: 'N' }, new Date(2030, 3, 20))[0];
    ok(north.suggested > base.suggested, 'severní expozice → pozdější straw (později kvete, pozdější plody)');
    const south = strawberryStrawingForPin(pin(), frag, { exposure: 'S' }, new Date(2030, 3, 20))[0];
    ok(south.suggested < base.suggested, 'jižní expozice → dřívější straw (teplejší, dřívější plody)');
    ok(getZoneOffsetDays('JHC') !== 0, 'climateZones: JHC má nenulový posun (kotva pro zónu)');
    const jhc = strawberryStrawingForPin(pin(), frag, { climate_zone: 'JHC' }, new Date(2030, 3, 20))[0];
    ok(jhc.suggested > base.suggested, 'klim. zóna JHC (chladnější) → pozdější straw');
  }

  // ---------- (4) Dedup DVOUFÁZOVÝ (task_type `jine` + marker) ----------
  {
    const now = new Date(2030, 3, 20); // květnové okno
    const y = now.getFullYear();

    // Vlastní slovesný titulek („Mulčování jahodníku slámou") — obsahuje markery „sláma" i „jahod.*mulč",
    // task_type `jine` → potlačí
    const own = [{ title: '🌾 Mulčování jahodníku Jahoda lesní slámou', task_type: 'jine', specific_date: `${y}-05-12` }];
    ok(strawberryStrawingForPin(pin(own), frag, null, now).length === 0,
      'dedup: vlastní titulek se „sláma" + task_type jine v květnu → potlačeno');

    // marker EN „straw" + task_type jine → potlačí
    const enStraw = [{ title: 'Straw-mulch strawberries', task_type: 'jine', specific_date: `${y}-05-10` }];
    ok(strawberryStrawingForPin(pin(enStraw), frag, null, now).length === 0,
      'dedup: titulek se „straw" v květnu (jine) → potlačeno');

    // marker „strawberry…straw" (EN/DE řazení slov) + task_type jine → potlačí
    const strawEN = [{ title: 'Strawberry straw spreading', task_type: 'jine', specific_date: `${y}-05-08` }];
    ok(strawberryStrawingForPin(pin(strawEN), frag, null, now).length === 0,
      'dedup: titulek „strawberry…straw" v květnu (jine) → potlačeno');

    // marker „jahod…mulč" + task_type jine → potlačí
    const jahodMulc = [{ title: 'Jahodník mulčovat', task_type: 'jine', specific_date: `${y}-05-12` }];
    ok(strawberryStrawingForPin(pin(jahodMulc), frag, null, now).length === 0,
      'dedup: titulek „jahod…mulč" v květnu (jine) → potlačeno');

    // task_type `jine` BEZ markeru → NEpotlačí (klíčový test AND dedupu)
    const otherJine = [{ title: '🪴 Přesazení sazenic', task_type: 'jine', specific_date: `${y}-05-10` }];
    ok(strawberryStrawingForPin(pin(otherJine), frag, null, now).length === 1,
      'dedup: jiný „jine" úkol BEZ markeru v květnu → NEpotlačí (AND s markerem)');

    // marker v titulku ALE jiný task_type (strihani místo jine) → NEpotlačí (klíčový test AND dedupu)
    const wrongType = [{ title: '✂️ Sláma řezat', task_type: 'strihani', specific_date: `${y}-05-12` }];
    ok(strawberryStrawingForPin(pin(wrongType), frag, null, now).length === 1,
      'dedup: marker „sláma" ALE task_type strihani → NEpotlačí (AND s task_type jine)');

    // straw v JINÉM měsíci nevadí
    const otherMonth = [{ title: '🌾 Mulčování jahodníku slámou', task_type: 'jine', specific_date: `${y}-07-10` }];
    ok(strawberryStrawingForPin(pin(otherMonth), frag, null, now).length === 1,
      'dedup: straw v JINÉM měsíci nevadí → návrh svítí');

    // loňský straw ve stejném měsíci nevadí (jednorázový úkol z minulého roku)
    const lastYear = [{ title: '🌾 Mulčování jahodníku slámou', task_type: 'jine', specific_date: `${y - 1}-05-12` }];
    ok(strawberryStrawingForPin(pin(lastYear), frag, null, now).length === 1,
      'dedup: loňský straw v květnu (jednorázový) → návrh svítí');

    // opakovaný úkol (frequency_days) s markerem ve stejném měsíci potlačí bez ohledu na rok
    const repeating = [{ title: 'Mulčování jahodníku slámou', task_type: 'jine', next_due: '2099-05-01', frequency_days: 365 }];
    ok(strawberryStrawingForPin(pin(repeating), frag, null, now).length === 0,
      'dedup: opakovaný úkol s markerem v květnu → potlačeno (bez ohledu na rok)');

    // springMulching kůru („Mulčování kůrou") v dubnu/květnu pro JINOU rostlinu nesmí kolidovat —
    // ale springMulching by ho přidal jako task v Pinu rostliny v gate trvalky/dřeviny, NIKOLIV
    // pro Fragaria (vyloučená v SPRING_MULCH_GENERA_EXCLUDE). Test ale ověříme dedup:
    // task „Mulčování kůrou" obsahuje „mulč" ale ne „sláma|straw|jahod.*mulč|strawberry.*straw",
    // takže NEPOTLAČÍ.
    const otherMulch = [{ title: 'Mulčování kůrou', task_type: 'jine', specific_date: `${y}-05-08` }];
    ok(strawberryStrawingForPin(pin(otherMulch), frag, null, now).length === 1,
      'dedup: cizí „Mulčování kůrou" v květnu BEZ specifického markeru → NEpotlačí');
  }

  // ---------- (5) Chybějící vstup ----------
  ok(strawberryStrawingForPin(null, frag, null, new Date(2030, 3, 20)).length === 0, 'bez pinu → []');
  ok(strawberryStrawingForPin(pin(), null, null, new Date(2030, 3, 20)).length === 0, 'bez rostliny → []');

  // ---------- (6) Návaznost na springMulching exclude ----------
  // Zkontroluj, že springMulching EXCLUDE seznam obsahuje Fragaria — aby si Fragaria
  // nevybírala generickou kůrovou kartu navíc. springMulching.js importuje
  // RecommendedTasks.jsx (React/JSX) → nelze dynamickým importem v pure node;
  // ověřujeme staticky čtením souboru.
  const fs = require('fs');
  const smSrc = fs.readFileSync(path.join(root, 'frontend/src/data/springMulching.js'), 'utf8');
  const inExclude = /SPRING_MULCH_GENERA_EXCLUDE[\s\S]*?'Fragaria'[\s\S]*?\]\)/.test(smSrc);
  ok(inExclude,
    'springMulching: Fragaria je v SPRING_MULCH_GENERA_EXCLUDE (žádný překryv s kůrou)');

  console.log(`\n✅ All ${passed} strawberry-strawing assertions passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
