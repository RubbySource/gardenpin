// Sanity test pro „Letní výsev pro pozdní/zimní sklizeň — second sowing window 7–10".
// lateSowing.js importuje RecommendedTasks.jsx (React/JSX) → nejde načíst v čistém node,
// proto REPLIKUJEME pure logiku (stejně jako test-hardening-off / test-pinching). Replika
// je věrná lateSowing.js a je now-aware (deterministické testy). Matchování LATE_SOWING_GENERA
// / LATE_SOWING_SPECIES běží proti REÁLNÉ plantDatabase načtené dynamickým importem → ověří,
// že kurátorská mapa sedí na skutečná data (žádné mrtvé klíče v GENERA) a že teplomilné /
// jarní plodiny / dřeviny jsou vyřazené. dateForMonth/getConditionShiftDays = věrná replika;
// getZoneOffsetDays importujeme z reálného climateZones.js (jeden zdroj pravdy pro posun
// klim. zóny).
// Spuštění: node scripts/test-late-sowing.cjs
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

// ---------- replika pure logiky (lateSowing.js) ----------
const LATE_SOWING_HORIZON_DAYS = 60;
const LATE_SOWING_EMOJI = '🌱';
const LATE_SOWING_TYPES = {
  midsummer:   { month: 7 },
  lateSummer:  { month: 8 },
  earlyAutumn: { month: 9 },
  autumn:      { month: 10 },
};
const LATE_SOWING_CATEGORIES = new Set(['zelenina']);
const LATE_SOWING_GENERA = {
  Beta: 'midsummer',
  Spinacia: 'lateSummer',
  Valerianella: 'lateSummer',
  Eruca: 'lateSummer',
  Lactuca: 'earlyAutumn',
};
const LATE_SOWING_SPECIES = {
  'Allium sativum':   'autumn',
  'Raphanus sativus': 'midsummer',
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
function lateSowingRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (!cat || !LATE_SOWING_CATEGORIES.has(cat)) return null;
  const lat = String(plant.nameLat || '').trim();
  for (const sp in LATE_SOWING_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) {
      const t = LATE_SOWING_SPECIES[sp];
      return t ? { type: t } : null;
    }
  }
  const genus = genusOf(plant);
  if (genus && LATE_SOWING_GENERA[genus]) return { type: LATE_SOWING_GENERA[genus] };
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
function hasLateSowingInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type === 'presazeni') return true;
    const title = (e.title || '').trim();
    if (/druhý výsev|late.*sow|ozimý česnek|second.*sow/i.test(title)) return true;
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
  function lateSowingForPin(pin, plant, conditions, now) {
    if (!pin || !plant) return [];
    const rule = lateSowingRuleForPlant(plant);
    if (!rule) return [];
    const typeDef = LATE_SOWING_TYPES[rule.type];
    if (!typeDef) return [];
    const suggested = dateForMonth(typeDef.month, conditions, now);
    const due = daysFromToday(suggested, now);
    if (due === null || due < 0 || due > LATE_SOWING_HORIZON_DAYS) return [];
    const m = monthFromIso(suggested);
    if (hasLateSowingInMonth(pin.tasks || [], m, now.getFullYear())) return [];
    return [{
      kind: 'lateSowing', type: rule.type, month: m, suggested, due,
      taskType: 'presazeni', emoji: LATE_SOWING_EMOJI,
    }];
  }

  // ---------- (1) Matchování map proti REÁLNÉ DB ----------
  const db = await imp('frontend/src/plantDatabase.js');
  const enriched = db.PLANT_DATABASE.map(db.enrichPlant);
  const byCz = (name) => enriched.find((p) => p.nameCz === name);
  const ruleCz = (name) => lateSowingRuleForPlant(byCz(name));
  const typeCz = (name) => { const r = ruleCz(name); return r && r.type; };

  // midsummer = 7 (Beta — mangold/řepa)
  ok(typeCz('Mangold') === 'midsummer', 'Beta vulgaris var. cicla (mangold) → midsummer');
  ok(typeCz('Řepa červená') === 'midsummer', 'Beta vulgaris subsp. vulgaris conditiva (řepa) → midsummer');

  // lateSummer = 8 (Spinacia, Valerianella, Eruca)
  ok(typeCz('Špenát') === 'lateSummer', 'Spinacia oleracea (špenát) → lateSummer');
  ok(typeCz('Špenát Matador') === 'lateSummer' || enriched.some((p) =>
    p.category.key === 'zelenina' && genusOf(p) === 'Spinacia'),
    'Spinacia oleracea cv. → lateSummer (existuje ≥1 v DB)');
  ok(typeCz('Polníček kozlíček') === 'lateSummer', 'Valerianella locusta (polníček) → lateSummer');
  ok(typeCz('Rukola') === 'lateSummer', 'Eruca vesicaria (rukola) → lateSummer');

  // earlyAutumn = 9 (Lactuca — salát)
  ok(typeCz('Salát hlávkový') === 'earlyAutumn' || enriched.some((p) =>
    p.category.key === 'zelenina' && genusOf(p) === 'Lactuca'),
    'Lactuca sativa (salát) → earlyAutumn (existuje ≥1 v DB)');

  // autumn = 10 (Allium sativum — ozimý česnek přes SPECIES precedence)
  ok(typeCz('Česnek') === 'autumn', 'Allium sativum (česnek) → autumn přes SPECIES precedence');

  // midsummer = 7 (Raphanus sativus — ředkvička podzimní přes SPECIES)
  ok(typeCz('Ředkev / Ředkvička') === 'midsummer',
    'Raphanus sativus (ředkvička) → midsummer přes SPECIES precedence');
  ok((lateSowingRuleForPlant({ category: 'zelenina', nameLat: 'Raphanus sativus var. longipinnatus' }) || {}).type === 'midsummer',
    'forward-looking: daikon (Raphanus sativus var.) → midsummer přes prefix species');

  // DRUH má přednost — Allium (rod) NENÍ v GENERA, jen sativum v SPECIES
  ok(lateSowingRuleForPlant({ category: 'zelenina', nameLat: 'Allium cepa' }) === null,
    'Allium cepa (cibule, zelenina) → null (rod Allium MIMO GENERA — jen sativum přes SPECIES)');
  ok(lateSowingRuleForPlant({ category: 'zelenina', nameLat: 'Allium porrum' }) === null,
    'Allium porrum (pórek, zelenina) → null (rod Allium MIMO GENERA)');
  ok((lateSowingRuleForPlant({ category: 'zelenina', nameLat: "Allium sativum 'Dukát'" }) || {}).type === 'autumn',
    'forward-looking: česnek s kultivarem → autumn přes prefix species precedence');

  // Solanum/Capsicum/Cucumis/Cucurbita (jarní teplomilné) v zelenině ALE mimo mapy → null
  ok(lateSowingRuleForPlant({ category: 'zelenina', nameLat: 'Solanum lycopersicum' }) === null,
    'rajče (Solanum, zelenina) → null mimo GENERA (jarní teplomilná, ne druhý výsev)');
  ok(lateSowingRuleForPlant({ category: 'zelenina', nameLat: 'Solanum tuberosum' }) === null,
    'brambor (Solanum tuberosum, zelenina) → null mimo GENERA (jarní sázba)');
  ok(lateSowingRuleForPlant({ category: 'zelenina', nameLat: 'Capsicum annuum' }) === null,
    'paprika (Capsicum, zelenina) → null mimo GENERA (jarní teplomilná)');
  ok(lateSowingRuleForPlant({ category: 'zelenina', nameLat: 'Cucumis sativus' }) === null,
    'okurka (Cucumis, zelenina) → null mimo GENERA (jarní teplomilná)');
  ok(lateSowingRuleForPlant({ category: 'zelenina', nameLat: 'Cucurbita pepo' }) === null,
    'cuketa (Cucurbita, zelenina) → null mimo GENERA (jarní teplomilná)');

  // mrkev (Daucus) — přímý výsev jarní/letní v jarní sezóně, NENÍ v mapě pro druhý výsev
  // (i když by se v 7 mohla podzimní mrkev sít — forward-looking). Aktuálně → null.
  ok(lateSowingRuleForPlant({ category: 'zelenina', nameLat: 'Daucus carota' }) === null,
    'mrkev (Daucus, zelenina) → null mimo GENERA (forward-looking — podzimní mrkev zatím vyhrazená)');

  // mimo gate → null
  ok(lateSowingRuleForPlant({ category: 'stromy', nameLat: 'Malus domestica' }) === null,
    'jabloň (stromy) → null mimo gate');
  ok(lateSowingRuleForPlant({ category: 'trvalky', nameLat: 'Hosta sieboldiana' }) === null,
    'trvalka → null mimo gate');
  ok(lateSowingRuleForPlant({ category: 'cibuloviny', nameLat: 'Tulipa gesneriana' }) === null,
    'tulipán (cibuloviny) → null mimo gate');
  ok(lateSowingRuleForPlant({ category: 'ovoce', nameLat: 'Fragaria vesca' }) === null,
    'jahodník (ovoce) → null mimo gate');
  ok(lateSowingRuleForPlant({ category: 'bylinky', nameLat: 'Ocimum basilicum' }) === null,
    'bazalka (bylinky) → null mimo gate');
  ok(lateSowingRuleForPlant({ category: 'letnicky', nameLat: 'Petunia hybrida' }) === null,
    'petúnie (letnicky) → null mimo gate (gate jen zelenina)');
  ok(lateSowingRuleForPlant({ category: 'travy', nameLat: 'Festuca glauca' }) === null,
    'okrasná tráva → null mimo gate');
  ok(lateSowingRuleForPlant({ category: 'sukulenty', nameLat: 'Sedum album' }) === null,
    'sukulent → null mimo gate');
  ok(lateSowingRuleForPlant({ category: 'kere', nameLat: 'Lactuca sativa' }) === null,
    'salát s falešnou kategorií keře → null (mimo gate)');
  ok(lateSowingRuleForPlant(null) === null, 'bez rostliny → null');

  // gate akceptuje i holý string kategorie
  ok((lateSowingRuleForPlant({ category: 'zelenina', nameLat: 'Spinacia oleracea' }) || {}).type === 'lateSummer',
    'holý string category=zelenina + špenát → lateSummer');
  ok((lateSowingRuleForPlant({ category: 'zelenina', nameLat: 'Allium sativum' }) || {}).type === 'autumn',
    'holý string category=zelenina + česnek → autumn (species precedence)');
  ok((lateSowingRuleForPlant({ category: 'zelenina', nameLat: 'Beta vulgaris' }) || {}).type === 'midsummer',
    'holý string category=zelenina + Beta → midsummer (rod)');

  // forward-looking druh s kultivarem matchuje rod přes prefix
  ok((lateSowingRuleForPlant({ category: 'zelenina', nameLat: "Spinacia oleracea 'Monstrueux'" }) || {}).type === 'lateSummer',
    'forward-looking: špenát s kultivarem → lateSummer přes rod');
  ok((lateSowingRuleForPlant({ category: 'zelenina', nameLat: "Lactuca sativa 'Lollo Rosso'" }) || {}).type === 'earlyAutumn',
    'forward-looking: salát s kultivarem → earlyAutumn přes rod');

  // integrita: každý ROD v GENERA + DRUH v SPECIES existuje v reálné DB v gate (žádný mrtvý
  // klíč). SPECIES s null hodnotou by byly intentional exclusions — tady žádné nemáme.
  const inGate = (p) => p.category && LATE_SOWING_CATEGORIES.has(p.category.key);
  for (const g of Object.keys(LATE_SOWING_GENERA)) {
    ok(enriched.some((p) => inGate(p) && genusOf(p) === g),
      `LATE_SOWING_GENERA: rod ${g} je v DB (zelenina) — žádný mrtvý klíč`);
  }
  for (const sp of Object.keys(LATE_SOWING_SPECIES)) {
    if (LATE_SOWING_SPECIES[sp] === null) continue; // forward-looking exclusion vynechán
    ok(enriched.some((p) => inGate(p) && (p.nameLat === sp || String(p.nameLat || '').startsWith(`${sp} `))),
      `LATE_SOWING_SPECIES: druh ${sp} je v DB (zelenina) — žádný mrtvý klíč`);
  }

  // ---------- (2) Logika lateSowingForPin (now-aware) ----------
  const pin = (tasks) => ({ id: 1, tasks: tasks || [] });
  const spinach = { category: 'zelenina', nameLat: 'Spinacia oleracea' };
  const chard = { category: 'zelenina', nameLat: 'Beta vulgaris var. cicla' };
  const lettuce = { category: 'zelenina', nameLat: 'Lactuca sativa' };
  const garlic = { category: 'zelenina', nameLat: 'Allium sativum' };
  const radish = { category: 'zelenina', nameLat: 'Raphanus sativus' };

  {
    // červen → červencové midsummer okno (~30 dní) → v horizontu 60
    const r = lateSowingForPin(pin(), chard, null, new Date(2030, 5, 15));
    ok(r.length === 1 && r[0].kind === 'lateSowing', 'červen: mangold → návrh pozdního výsevu');
    ok(r[0].type === 'midsummer' && r[0].month === 7, 'midsummer → měsíc 7');
    ok(r[0].taskType === 'presazeni' && r[0].emoji === '🌱', 'task_type presazeni, emoji 🌱');
    ok(r[0].due >= 0 && r[0].due <= LATE_SOWING_HORIZON_DAYS, 'okno v budoucnu a v horizontu');
  }
  {
    // červenec → srpnové lateSummer okno (~30 dní)
    const r = lateSowingForPin(pin(), spinach, null, new Date(2030, 6, 15));
    ok(r.length === 1 && r[0].type === 'lateSummer' && r[0].month === 8,
      'červenec: špenát → lateSummer v srpnu');
  }
  {
    // srpen → zářijové earlyAutumn okno (~30 dní)
    const r = lateSowingForPin(pin(), lettuce, null, new Date(2030, 7, 15));
    ok(r.length === 1 && r[0].type === 'earlyAutumn' && r[0].month === 9,
      'srpen: salát → earlyAutumn v září');
  }
  {
    // září → říjnové autumn okno (~30 dní) pro česnek
    const r = lateSowingForPin(pin(), garlic, null, new Date(2030, 8, 15));
    ok(r.length === 1 && r[0].type === 'autumn' && r[0].month === 10,
      'září: česnek → autumn v říjnu');
  }
  {
    // červen → ředkvička podzimní midsummer
    const r = lateSowingForPin(pin(), radish, null, new Date(2030, 5, 15));
    ok(r.length === 1 && r[0].type === 'midsummer' && r[0].month === 7,
      'červen: ředkvička → midsummer v červenci');
  }

  // brzy v cílovém měsíci (před 15.) → svítí; nikdy do minulosti (po okně → [])
  ok(lateSowingForPin(pin(), chard, null, new Date(2030, 6, 1)).length === 1,
    'začátek července: midsummer okno → návrh svítí');
  ok(lateSowingForPin(pin(), chard, null, new Date(2030, 6, 20)).length === 0,
    'pozdní červenec: midsummer okno (15.) minulo → [] (nikdy do minulosti)');
  ok(lateSowingForPin(pin(), spinach, null, new Date(2030, 7, 20)).length === 0,
    'pozdní srpen: lateSummer okno (15.) minulo → []');
  ok(lateSowingForPin(pin(), garlic, null, new Date(2030, 9, 20)).length === 0,
    'pozdní říjen: autumn okno minulo → []');

  // mimo horizont → skryto (horizont 60)
  ok(lateSowingForPin(pin(), chard, null, new Date(2030, 0, 15)).length === 0,
    'leden: červencové okno >60 dní → skryto');
  ok(lateSowingForPin(pin(), spinach, null, new Date(2030, 2, 15)).length === 0,
    'březen: srpnové okno >60 dní → skryto');
  ok(lateSowingForPin(pin(), garlic, null, new Date(2030, 11, 15)).length === 0,
    'prosinec: říjnové okno minulo → příští rok >60 dní → skryto');
  ok(lateSowingForPin(pin(), lettuce, null, new Date(2030, 10, 1)).length === 0,
    'listopad: zářijové okno minulo → příští rok >60 dní → skryto');

  // ---------- (3) Posun klim. zóny / expozice ----------
  {
    const base = lateSowingForPin(pin(), spinach, null, new Date(2030, 6, 15))[0];
    const north = lateSowingForPin(pin(), spinach, { exposure: 'N' }, new Date(2030, 6, 15))[0];
    ok(north.suggested > base.suggested,
      'severní expozice → pozdější pozdní výsev (chladnější ⇒ pozdější mraz vzdálenější)');
    const south = lateSowingForPin(pin(), spinach, { exposure: 'S' }, new Date(2030, 6, 15))[0];
    ok(south.suggested < base.suggested, 'jižní expozice → dřívější pozdní výsev');
    ok(getZoneOffsetDays('JHC') !== 0, 'climateZones: JHC má nenulový posun (kotva pro zónu)');
    const jhc = lateSowingForPin(pin(), spinach, { climate_zone: 'JHC' }, new Date(2030, 6, 15))[0];
    ok(jhc.suggested > base.suggested, 'klim. zóna JHC (chladnější) → pozdější pozdní výsev');
  }

  // ---------- (4) Dedup proti existujícímu pozdnímu výsevu v měsíci ----------
  {
    const now = new Date(2030, 6, 15); // červenec → srpnové lateSummer okno (špenát)
    const y = now.getFullYear();
    // task_type `presazeni` v srpnu potlačí (i bez markeru — v 7–10 už primární výsev mimo sezónu)
    const byPresazeni = [{ title: 'Výsadba salátu ven', task_type: 'presazeni', specific_date: `${y}-08-10` }];
    ok(lateSowingForPin(pin(byPresazeni), spinach, null, now).length === 0,
      'dedup: task_type `presazeni` v srpnu → potlačeno (v 7–10 je primární výsev/výsadba vzácná)');
    // marker „druhý výsev" potlačí (české slovesné/podstatné)
    const byMarker = [{ title: '🌱 Druhý výsev Špenát', task_type: 'jine', specific_date: `${y}-08-10` }];
    ok(lateSowingForPin(pin(byMarker), spinach, null, now).length === 0,
      'dedup: titulek „druhý výsev" v srpnu → potlačeno (i s task_type jine)');
    // marker „late sow" (anglický) potlačí
    const byLate = [{ title: 'Late sowing of spinach', task_type: 'jine', specific_date: `${y}-08-12` }];
    ok(lateSowingForPin(pin(byLate), spinach, null, now).length === 0,
      'dedup: titulek „late sow" v srpnu → potlačeno (anglicky)');
    // marker „second sow" (anglický alias) potlačí
    const bySecond = [{ title: 'Second sowing', task_type: 'jine', specific_date: `${y}-08-12` }];
    ok(lateSowingForPin(pin(bySecond), spinach, null, now).length === 0,
      'dedup: titulek „second sow" v srpnu → potlačeno (anglický alias)');
    // marker „ozimý česnek" (specifický pro autumn okno) potlačí
    const garlicNow = new Date(2030, 8, 15); // září → říjnové autumn
    const byGarlic = [{ title: 'Sázba ozimý česnek', task_type: 'jine', specific_date: `${y}-10-10` }];
    ok(lateSowingForPin(pin(byGarlic), garlic, null, garlicNow).length === 0,
      'dedup: titulek „ozimý česnek" v říjnu → potlačeno');
    // dedup v JINÉM měsíci nevadí
    const otherMonth = [{ title: '🌱 Druhý výsev', task_type: 'presazeni', specific_date: `${y}-07-25` }];
    ok(lateSowingForPin(pin(otherMonth), spinach, null, now).length === 1,
      'dedup: druhý výsev v JINÉM měsíci (červenec) nevadí → návrh v srpnu svítí');
    // loňský dedup ve stejném měsíci nevadí (jednorázový úkol z minulého roku)
    const lastYear = [{ title: '🌱 Druhý výsev', task_type: 'presazeni', specific_date: `${y - 1}-08-12` }];
    ok(lateSowingForPin(pin(lastYear), spinach, null, now).length === 1,
      'dedup: loňský pozdní výsev v srpnu (jednorázový) → návrh svítí');
    // opakovaný úkol (frequency_days) ve stejném měsíci potlačí bez ohledu na rok
    const repeating = [{ title: 'Druhý výsev', task_type: 'presazeni', next_due: `2099-08-01`, frequency_days: 365 }];
    ok(lateSowingForPin(pin(repeating), spinach, null, now).length === 0,
      'dedup: opakovaný úkol presazeni v srpnu → potlačeno (bez ohledu na rok)');
    // jarní sowingTasks (březnový `presazeni` pro Solanum lycopersicum) v JINÉM měsíci NEvadí
    const springSowing = [{ title: '🌱 Předpěstování rajče', task_type: 'presazeni', specific_date: `${y}-03-15` }];
    ok(lateSowingForPin(pin(springSowing), spinach, null, now).length === 1,
      'dedup: jarní sowingTasks v březnu nevadí → návrh pozdního výsevu v srpnu svítí');
  }

  // ---------- (5) Chybějící vstup ----------
  ok(lateSowingForPin(null, spinach, null, new Date(2030, 6, 15)).length === 0, 'bez pinu → []');
  ok(lateSowingForPin({ id: 1, tasks: [] }, null, null, new Date(2030, 6, 15)).length === 0,
    'bez rostliny → []');

  console.log(`\n✅ All ${passed} late-sowing assertions passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
