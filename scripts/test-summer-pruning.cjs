// Sanity test pro „Letní zelený řez ovocných stromů (Sommerschnitt) — regulace letošního
// přírůstku v 7–8". summerPruning.js importuje RecommendedTasks.jsx (React/JSX) → nejde
// načíst v čistém node, proto REPLIKUJEME pure logiku (stejně jako test-fruit-thinning,
// test-peach-leaf-curl-spray …). Replika je věrná summerPruning.js a je now-aware
// (deterministické testy). Matchování GENERA/SPECIES běží proti REÁLNÉ plantDatabase
// načtené dynamickým importem → ověří, že kurátorská mapa sedí na skutečná data (žádné
// mrtvé klíče s výjimkou forward-looking Prunus cerasus) a že drobné ovoce / okrasné
// Prunus / nečlenové gate jsou vyřazené. dateForMonth/getConditionShiftDays = věrná
// replika; getZoneOffsetDays importujeme z reálného climateZones.js.
// Spuštění: node scripts/test-summer-pruning.cjs
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

// ---------- replika pure logiky (summerPruning.js) ----------
const SUMMER_PRUNE_HORIZON_DAYS = 60;
const SUMMER_PRUNE_EMOJI = '✂️';
const SUMMER_PRUNE_CATEGORIES = new Set(['stromy', 'ovoce']);
const SUMMER_PRUNE_GENERA = { Malus: 7, Pyrus: 7, Cydonia: 8 };
const SUMMER_PRUNE_SPECIES = { 'Prunus avium': 7, 'Prunus cerasus': 7 };

function categoryKey(plant) {
  const c = plant && plant.category;
  if (!c) return null;
  return typeof c === 'string' ? c : c.key || null;
}
function genusOf(plant) {
  const lat = String((plant && plant.nameLat) || '').trim();
  return lat ? lat.split(/\s+/)[0] || null : null;
}
function summerPruningRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (!SUMMER_PRUNE_CATEGORIES.has(cat)) return null;
  const lat = String(plant.nameLat || '').trim();
  for (const sp in SUMMER_PRUNE_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return { month: SUMMER_PRUNE_SPECIES[sp] };
  }
  const genus = genusOf(plant);
  if (genus && SUMMER_PRUNE_GENERA[genus]) return { month: SUMMER_PRUNE_GENERA[genus] };
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
function hasSummerPruningInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type !== 'strihani') continue;
    const title = (e.title || '').trim();
    if (/letní řez|sommerschnitt|zelený řez|letorost|vlk/i.test(title)) return true;
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
  function summerPruningForPin(pin, plant, conditions, now) {
    if (!pin || !plant) return [];
    const rule = summerPruningRuleForPlant(plant);
    if (!rule) return [];
    const suggested = dateForMonth(rule.month, conditions, now);
    const due = daysFromToday(suggested, now);
    if (due === null || due < 0 || due > SUMMER_PRUNE_HORIZON_DAYS) return [];
    const m = monthFromIso(suggested);
    if (hasSummerPruningInMonth(pin.tasks || [], m, now.getFullYear())) return [];
    return [{
      kind: 'summerPruning', month: m, suggested, due,
      taskType: 'strihani', emoji: SUMMER_PRUNE_EMOJI,
    }];
  }

  // ---------- (1) Matchování map proti REÁLNÉ DB ----------
  const db = await imp('frontend/src/plantDatabase.js');
  const enriched = db.PLANT_DATABASE.map(db.enrichPlant);
  const byCz = (name) => enriched.find((p) => p.nameCz === name);
  const ruleCz = (name) => summerPruningRuleForPlant(byCz(name));
  const monthCz = (name) => { const r = ruleCz(name); return r && r.month; };

  // GENERA: Malus/Pyrus → 7, Cydonia → 8
  ok(monthCz('Jabloň') === 7, 'jabloň (Malus domestica, stromy) → měsíc 7 (rod Malus)');
  ok(monthCz('Hruška') === 7, 'hrušeň (Pyrus communis, stromy) → měsíc 7 (rod Pyrus)');
  ok(monthCz('Kdouloň') === 8, 'kdouloň (Cydonia oblonga, stromy) → měsíc 8 (rod Cydonia)');

  // SPECIES s předností před RODEM: Prunus avium → 7 (rod Prunus mimo GENERA, druh přes mapu)
  ok(monthCz('Třešeň') === 7, 'třešeň (Prunus avium, stromy) → měsíc 7 (species precedence, rod Prunus mimo)');

  // okrasné jabloně (Malus 'Royalty') — rod chytí → 7 (over-suggestion, neškodné jako u fruitThinning)
  const royalty = enriched.find((p) => /Malus 'Royalty'/.test(p.nameLat || ''));
  if (royalty) ok((summerPruningRuleForPlant(royalty) || {}).month === 7,
    'okrasná jabloň „Royalty" (Malus, stromy) → 7 (rod chytí okrasné jabloně — neškodné)');

  // Rod Prunus záměrně MIMO GENERA — broskev/meruňka/švestka/sakury/slivoně → null
  ok(ruleCz('Broskvoň') === null, 'broskvoň (Prunus persica) → null (rod Prunus mimo GENERA, druh mimo SPECIES)');
  ok(ruleCz('Meruňka') === null, 'meruňka (Prunus armeniaca) → null (rod Prunus mimo)');
  ok(ruleCz('Švestka') === null, 'švestka (Prunus domestica) → null (rod Prunus mimo)');
  ok(ruleCz('Sakura Kanzan') === null, 'okrasná sakura (Prunus serrulata) → null');
  ok(ruleCz('Slivoň Nigra') === null, 'okrasná slivoň (Prunus cerasifera) → null');
  ok(ruleCz('Bobkovišeň lékařská') === null, 'bobkovišeň (Prunus laurocerasus) → null (okrasná, ne ovocná)');

  // ořešák a další stromy mimo mapa → null
  ok(ruleCz('Ořešák královský') === null, 'ořešák (Juglans, stromy) → null (mimo mapa)');

  // jehličnany a okrasné stromy mimo gate (jiná kategorie) → null
  const pinus = enriched.find((p) => /^Pinus /.test(p.nameLat || ''));
  if (pinus) ok(summerPruningRuleForPlant(pinus) === null,
    `${pinus.nameCz} (Pinus, ${pinus.category.key}) → null (mimo gate stromy/ovoce)`);
  const picea = enriched.find((p) => /^Picea /.test(p.nameLat || ''));
  if (picea) ok(summerPruningRuleForPlant(picea) === null,
    `${picea.nameCz} (Picea, ${picea.category.key}) → null (mimo gate)`);

  // drobné ovoce — v gate (ovoce), ale mimo mapu → null
  ok(ruleCz('Rybíz černý') === null, 'Ribes (ovoce) v gate ale mimo mapu → null');
  ok(ruleCz('Maliník červený') === null, 'Rubus (ovoce) v gate ale mimo mapu → null');
  ok(ruleCz('Borůvka zahradní') === null, 'Vaccinium (ovoce) v gate ale mimo mapu → null');
  ok(ruleCz('Jahoda lesní') === null, 'Fragaria (ovoce) v gate ale mimo mapu → null');

  // mimo gate → null
  ok(summerPruningRuleForPlant({ category: { key: 'zelenina' }, nameLat: 'Solanum lycopersicum' }) === null,
    'rajče (zelenina) → null (mimo gate)');
  ok(summerPruningRuleForPlant({ category: { key: 'trvalky' }, nameLat: 'Hosta sieboldiana' }) === null,
    'trvalka (Hosta) → null');
  ok(summerPruningRuleForPlant({ category: { key: 'cibuloviny' }, nameLat: 'Tulipa gesneriana' }) === null,
    'cibulovina (Tulipa) → null');
  ok(summerPruningRuleForPlant({ category: { key: 'letnicky' }, nameLat: 'Tagetes patula' }) === null,
    'letnička (Tagetes) → null');
  ok(summerPruningRuleForPlant({ category: { key: 'bylinky' }, nameLat: 'Mentha piperita' }) === null,
    'bylinka (Mentha) → null');
  ok(summerPruningRuleForPlant({ category: { key: 'kere' }, nameLat: 'Malus domestica' }) === null,
    'jabloň v kategorii kere → null (mimo gate)');
  ok(summerPruningRuleForPlant(null) === null, 'bez rostliny → null');

  // holý string kategorie (před enrichPlant) funguje
  ok((summerPruningRuleForPlant({ category: 'stromy', nameLat: 'Malus domestica' }) || {}).month === 7,
    'holý string category=stromy + Malus → 7');
  ok((summerPruningRuleForPlant({ category: 'ovoce', nameLat: 'Cydonia oblonga' }) || {}).month === 8,
    'holý string category=ovoce + Cydonia → 8 (kdouloň keřová forma — forward-looking)');

  // integrita: každý rod/druh v mapě má ≥1 reálnou rostlinu v gate (žádný mrtvý klíč
  // s výjimkou forward-looking Prunus cerasus, který v DB zatím nemusí být — sanity to
  // jen oznámí, nebrání).
  const inGate = (p) => SUMMER_PRUNE_CATEGORIES.has(p.category.key);
  for (const g of Object.keys(SUMMER_PRUNE_GENERA)) {
    ok(enriched.some((p) => inGate(p) && genusOf(p) === g),
      `SUMMER_PRUNE_GENERA: rod ${g} je v DB (stromy/ovoce) — žádný mrtvý klíč`);
  }
  const cerasus = enriched.some((p) => {
    const l = String(p.nameLat || '');
    return inGate(p) && (l === 'Prunus cerasus' || l.startsWith('Prunus cerasus '));
  });
  ok(enriched.some((p) => inGate(p) && (p.nameLat === 'Prunus avium' || (p.nameLat || '').startsWith('Prunus avium '))),
    'SUMMER_PRUNE_SPECIES: Prunus avium je v DB (stromy) — žádný mrtvý klíč');
  // Prunus cerasus = forward-looking. Pokud chybí, oznam ale neselhej.
  if (!cerasus) console.log('   ℹ Prunus cerasus chybí v DB (forward-looking — povolené).');

  // ---------- (2) Logika summerPruningForPin (now-aware) ----------
  const pin = (tasks) => ({ id: 1, tasks: tasks || [] });
  const apple = { category: { key: 'stromy' }, nameLat: 'Malus domestica' };
  const pear = { category: { key: 'stromy' }, nameLat: 'Pyrus communis' };
  const quince = { category: { key: 'stromy' }, nameLat: 'Cydonia oblonga' };
  const cherry = { category: { key: 'stromy' }, nameLat: 'Prunus avium' };

  {
    // 1. červen → červencové okno (15.) cca 44 dní → v horizontu 60
    const r = summerPruningForPin(pin(), apple, null, new Date(2030, 5, 1));
    ok(r.length === 1 && r[0].kind === 'summerPruning', 'červen: jabloň → návrh letního řezu');
    ok(r[0].month === 7, 'jabloň → měsíc 7');
    ok(r[0].taskType === 'strihani' && r[0].emoji === '✂️', 'task_type strihani, emoji ✂️');
    ok(r[0].due >= 0 && r[0].due <= SUMMER_PRUNE_HORIZON_DAYS, 'okno v budoucnu a v horizontu');
  }
  {
    const r = summerPruningForPin(pin(), pear, null, new Date(2030, 5, 1));
    ok(r.length === 1 && r[0].month === 7, 'červen: hrušeň → měsíc 7');
  }
  {
    const r = summerPruningForPin(pin(), cherry, null, new Date(2030, 5, 1));
    ok(r.length === 1 && r[0].month === 7, 'červen: třešeň → měsíc 7 (species precedence)');
  }
  {
    // 1. červen: Cydonia má okno 8 (15.8.) — to je ~75 dní, mimo horizont 60 → []
    ok(summerPruningForPin(pin(), quince, null, new Date(2030, 5, 1)).length === 0,
      'červen: kdouloň (Cydonia → 8) cca 75 dní → mimo horizont 60 → []');
    // ale začátkem července už srpnové okno spadá do horizontu (cca 45 dní)
    const r = summerPruningForPin(pin(), quince, null, new Date(2030, 6, 1));
    ok(r.length === 1 && r[0].month === 8, 'začátek července: kdouloň → měsíc 8 (Cydonia srpnová varianta)');
  }

  // začátek července → okno svítí; pozdní červenec → minulo → []
  ok(summerPruningForPin(pin(), apple, null, new Date(2030, 6, 1)).length === 1,
    'začátek července: červencové okno → návrh svítí');
  ok(summerPruningForPin(pin(), apple, null, new Date(2030, 6, 20)).length === 0,
    'pozdní červenec: okno (15.) minulo → [] (nikdy do minulosti)');

  // pozdní červenec pro kdouloň (Cydonia) → srpnové okno svítí
  ok(summerPruningForPin(pin(), quince, null, new Date(2030, 6, 20)).length === 1,
    'pozdní červenec: kdouloň → srpnové okno svítí (15.8.)');

  // mimo horizont → skryto
  ok(summerPruningForPin(pin(), apple, null, new Date(2030, 8, 15)).length === 0,
    'září: červencové okno minulo → příští rok >60 dní → skryto');
  ok(summerPruningForPin(pin(), apple, null, new Date(2030, 10, 15)).length === 0,
    'listopad: mimo horizont 60 → skryto');
  ok(summerPruningForPin(pin(), apple, null, new Date(2030, 2, 15)).length === 0,
    'březen: červencové okno cca 122 dní → mimo horizont 60 → skryto');

  // ---------- (3) Posun klim. zóny / expozice ----------
  {
    const base = summerPruningForPin(pin(), apple, null, new Date(2030, 5, 1))[0];
    const north = summerPruningForPin(pin(), apple, { exposure: 'N' }, new Date(2030, 5, 1))[0];
    ok(north.suggested > base.suggested, 'severní expozice → pozdější řez (chladnější ⇒ pozdější přírůstek)');
    const south = summerPruningForPin(pin(), apple, { exposure: 'S' }, new Date(2030, 5, 1))[0];
    ok(south.suggested < base.suggested, 'jižní expozice → dřívější řez');
    ok(getZoneOffsetDays('JHC') !== 0, 'climateZones: JHC má nenulový posun (kotva pro zónu)');
    const jhc = summerPruningForPin(pin(), apple, { climate_zone: 'JHC' }, new Date(2030, 5, 1))[0];
    ok(jhc.suggested > base.suggested, 'klim. zóna JHC (chladnější) → pozdější řez');
  }

  // ---------- (4) Dvoufázový dedup (strihani + marker) v cílovém měsíci ----------
  {
    const now = new Date(2030, 5, 1); // červen → červencové okno
    const y = now.getFullYear();
    // strihani + marker „letní řez" v cílovém měsíci → potlačí
    const both = [{ title: '✂️ Letní řez Jabloň', task_type: 'strihani', specific_date: `${y}-07-15` }];
    ok(summerPruningForPin(pin(both), apple, null, now).length === 0,
      'dedup: strihani + „letní řez" v 7 → potlačeno');
    // různé varianty markeru — Sommerschnitt, zelený řez, letorost, vlk
    const sommer = [{ title: '✂️ Sommerschnitt', task_type: 'strihani', specific_date: `${y}-07-10` }];
    ok(summerPruningForPin(pin(sommer), apple, null, now).length === 0,
      'dedup: strihani + „sommerschnitt" → potlačeno (DE)');
    const green = [{ title: '✂️ Zelený řez koruny', task_type: 'strihani', specific_date: `${y}-07-12` }];
    ok(summerPruningForPin(pin(green), apple, null, now).length === 0,
      'dedup: strihani + „zelený řez" → potlačeno');
    const letorost = [{ title: '✂️ Zkrátit letorost o 1/3', task_type: 'strihani', specific_date: `${y}-07-14` }];
    ok(summerPruningForPin(pin(letorost), apple, null, now).length === 0,
      'dedup: strihani + „letorost" → potlačeno');
    const vlk = [{ title: '✂️ Odstranit vlky z koruny', task_type: 'strihani', specific_date: `${y}-07-08` }];
    ok(summerPruningForPin(pin(vlk), apple, null, now).length === 0,
      'dedup: strihani + „vlk" → potlačeno');
    // jiný strihani BEZ markeru v cílovém měsíci → NEPOTLAČÍ
    // (simulace hedgeTrim/perennialCutback v 7 — nesmí kolidovat)
    const hedge = [{ title: '🌳 Letní tvarování plotu Buxus', task_type: 'strihani', specific_date: `${y}-07-15` }];
    ok(summerPruningForPin(pin(hedge), apple, null, now).length === 1,
      'dedup: strihani bez markeru (hedgeTrim simulace) v 7 → NEpotlačí → návrh svítí');
    const cutback = [{ title: '🌿 Sestřih trvalky', task_type: 'strihani', specific_date: `${y}-07-20` }];
    ok(summerPruningForPin(pin(cutback), apple, null, now).length === 1,
      'dedup: strihani bez markeru (perennialCutback simulace) v 7 → NEpotlačí → návrh svítí');
    const zimni = [{ title: '✂️ Zimní řez', task_type: 'strihani', specific_date: `${y}-07-15` }];
    ok(summerPruningForPin(pin(zimni), apple, null, now).length === 1,
      'dedup: strihani „zimní řez" (matoucí, ale jiný účel) v 7 → NEpotlačí');
    // jiný task_type + marker v cílovém měsíci → NEPOTLAČÍ (DVOUFÁZOVÝ AND vyžaduje strihani)
    const jine = [{ title: '✂️ Letní řez Jabloň', task_type: 'jine', specific_date: `${y}-07-15` }];
    ok(summerPruningForPin(pin(jine), apple, null, now).length === 1,
      'dedup: task_type jine + marker v 7 → NEpotlačí (AND vyžaduje strihani)');
    // strihani + marker v JINÉM měsíci → nevadí
    const otherMonth = [{ title: '✂️ Letní řez Jabloň', task_type: 'strihani', specific_date: `${y}-08-15` }];
    ok(summerPruningForPin(pin(otherMonth), apple, null, now).length === 1,
      'dedup: strihani+marker v JINÉM měsíci → návrh svítí');
    // loňský strihani + marker (jednorázový z minulého roku) → nevadí
    const lastYear = [{ title: '✂️ Letní řez', task_type: 'strihani', specific_date: `${y - 1}-07-15` }];
    ok(summerPruningForPin(pin(lastYear), apple, null, now).length === 1,
      'dedup: loňský strihani+marker → návrh svítí');
    // opakovaný úkol (frequency_days) v cílovém měsíci s markerem → potlačí (bez ohledu na rok)
    const repeating = [{ title: 'Letní řez', task_type: 'strihani', next_due: '2099-07-15', frequency_days: 365 }];
    ok(summerPruningForPin(pin(repeating), apple, null, now).length === 0,
      'dedup: opakovaný strihani+marker v 7 → potlačeno (bez ohledu na rok)');
  }

  // ---------- (5) Chybějící vstup ----------
  ok(summerPruningForPin(null, apple, null, new Date(2030, 5, 1)).length === 0, 'bez pinu → []');
  ok(summerPruningForPin({ id: 1, tasks: [] }, null, null, new Date(2030, 5, 1)).length === 0, 'bez rostliny → []');

  console.log(`\n✅ All ${passed} summer-pruning assertions passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
