// Sanity test pro „Preventivní jarní postřik proti broskvové kadeřavosti — měďnatý
// fungicid před pučením". peachLeafCurlSpray.js importuje RecommendedTasks.jsx (React/JSX)
// → nejde načíst v čistém node, proto REPLIKUJEME pure logiku (stejně jako test-fruit-thinning
// / test-trunk-whitewash / test-grafting-tasks). Replika je věrná peachLeafCurlSpray.js
// a je now-aware (deterministické testy). Matchování PEACH_CURL_SPECIES běží proti REÁLNÉ
// plantDatabase načtené dynamickým importem → ověří, že kurátorská mapa sedí na skutečná
// data (žádné mrtvé klíče) a že třešeň/sakury/švestka/jabloň/hrušeň/drobné ovoce jsou
// vyřazené. dateForMonth/getConditionShiftDays = věrná replika; getZoneOffsetDays
// importujeme z reálného climateZones.js (jeden zdroj pravdy pro posun klim. zóny).
// Spuštění: node scripts/test-peach-leaf-curl-spray.cjs
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

// ---------- replika pure logiky (peachLeafCurlSpray.js) ----------
const PEACH_CURL_HORIZON_DAYS = 75;
const PEACH_CURL_EMOJI = '🛡️';
const PEACH_CURL_TYPES = {
  strong: { month: 3 },
  mild: { month: 3 },
};
const PEACH_CURL_SPECIES = {
  'Prunus persica': 'strong',
  'Prunus armeniaca': 'mild',
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
function peachCurlSprayRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (cat !== 'stromy') return null;
  const lat = String(plant.nameLat || '').trim();
  for (const sp in PEACH_CURL_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return { type: PEACH_CURL_SPECIES[sp] };
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
function hasPeachCurlSprayInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type === 'postrik') return true;
    const title = (e.title || '').trim();
    if (/kadeřav|měďnat|bordeaux|kuprikol|fungicid/i.test(title)) return true;
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
  function peachLeafCurlSprayForPin(pin, plant, conditions, now) {
    if (!pin || !plant) return [];
    const rule = peachCurlSprayRuleForPlant(plant);
    if (!rule) return [];
    const typeDef = PEACH_CURL_TYPES[rule.type];
    if (!typeDef) return [];
    const suggested = dateForMonth(typeDef.month, conditions, now);
    const due = daysFromToday(suggested, now);
    if (due === null || due < 0 || due > PEACH_CURL_HORIZON_DAYS) return [];
    const m = monthFromIso(suggested);
    if (hasPeachCurlSprayInMonth(pin.tasks || [], m, now.getFullYear())) return [];
    return [{
      kind: 'peachLeafCurlSpray', type: rule.type, month: m, suggested, due,
      taskType: 'postrik', emoji: PEACH_CURL_EMOJI,
    }];
  }

  // ---------- (1) Matchování map proti REÁLNÉ DB ----------
  const db = await imp('frontend/src/plantDatabase.js');
  const enriched = db.PLANT_DATABASE.map(db.enrichPlant);
  const byCz = (name) => enriched.find((p) => p.nameCz === name);
  const ruleCz = (name) => peachCurlSprayRuleForPlant(byCz(name));
  const typeCz = (name) => { const r = ruleCz(name); return r && r.type; };

  // broskvoň (Prunus persica) → strong, meruňka (Prunus armeniaca) → mild
  ok(typeCz('Broskvoň') === 'strong', 'broskvoň (Prunus persica, stromy) → strong (silně doporučeno)');
  ok(typeCz('Meruňka') === 'mild', 'meruňka (Prunus armeniaca, stromy) → mild (doporučeno)');

  // DRUH má přednost — rod Prunus NENÍ v žádné GENERA mapě → ostatní Prunus → null
  ok(ruleCz('Třešeň') === null, 'třešeň (Prunus avium) → null (rod Prunus mimo mapu)');
  ok(ruleCz('Švestka') === null, 'švestka (Prunus domestica) → null (kadeřavostí netrpí)');
  ok(ruleCz('Sakura Kanzan') === null, 'okrasná sakura (Prunus serrulata) → null');
  ok(ruleCz('Slivoň Nigra') === null, 'okrasná slivoň (Prunus cerasifera) → null');

  // jádroviny (jabloň/hrušeň) → null
  ok(ruleCz('Jabloň') === null, 'jabloň (Malus, stromy) → null (kadeřavostí netrpí)');
  ok(ruleCz('Hruška') === null, 'hrušeň (Pyrus, stromy) → null');
  ok(ruleCz('Ořešák královský') === null, 'ořešák (Juglans, stromy) → null');

  // drobné ovoce (kategorie ovoce) — mimo gate stromy → null
  ok(ruleCz('Rybíz černý') === null, 'Ribes (ovoce) → null (mimo gate stromy)');
  ok(ruleCz('Maliník červený') === null, 'Rubus (ovoce) → null (mimo gate)');
  ok(ruleCz('Borůvka zahradní') === null, 'Vaccinium (ovoce) → null (mimo gate)');
  ok(ruleCz('Jahoda lesní') === null, 'Fragaria (ovoce) → null (mimo gate)');

  // mimo gate → null
  ok(peachCurlSprayRuleForPlant({ category: { key: 'zelenina' }, nameLat: 'Solanum lycopersicum' }) === null,
    'rajče (zelenina) → null');
  ok(peachCurlSprayRuleForPlant({ category: { key: 'trvalky' }, nameLat: 'Hosta sieboldiana' }) === null,
    'trvalka → null');
  ok(peachCurlSprayRuleForPlant({ category: { key: 'kere' }, nameLat: 'Prunus persica' }) === null,
    'broskev v jiné kategorii než stromy → null (mimo gate)');
  ok(peachCurlSprayRuleForPlant(null) === null, 'bez rostliny → null');

  // gate akceptuje i holý string kategorie
  ok((peachCurlSprayRuleForPlant({ category: 'stromy', nameLat: 'Prunus persica' }) || {}).type === 'strong',
    'holý string category=stromy + broskev → strong');
  ok((peachCurlSprayRuleForPlant({ category: 'stromy', nameLat: 'Prunus armeniaca' }) || {}).type === 'mild',
    'holý string category=stromy + meruňka → mild');

  // forward-looking druhy s kultivarem („Prunus persica 'Redhaven'") matchují přes prefix
  ok((peachCurlSprayRuleForPlant({ category: 'stromy', nameLat: "Prunus persica 'Redhaven'" }) || {}).type === 'strong',
    'forward-looking: broskev s kultivarem → strong');

  // integrita: každý druh v mapě existuje v reálné DB v gate stromy (žádný mrtvý klíč)
  const inGate = (p) => p.category.key === 'stromy';
  for (const sp of Object.keys(PEACH_CURL_SPECIES)) {
    ok(enriched.some((p) => {
      const l = String(p.nameLat || '');
      return inGate(p) && (l === sp || l.startsWith(`${sp} `));
    }), `PEACH_CURL_SPECIES: druh ${sp} je v DB (stromy) — žádný mrtvý klíč`);
  }

  // ---------- (2) Logika peachLeafCurlSprayForPin (now-aware) ----------
  const pin = (tasks) => ({ id: 1, tasks: tasks || [] });
  const peach = { category: { key: 'stromy' }, nameLat: 'Prunus persica' };
  const apricot = { category: { key: 'stromy' }, nameLat: 'Prunus armeniaca' };

  {
    // leden → březnové okno cca 73 dní → v horizontu 75
    const r = peachLeafCurlSprayForPin(pin(), peach, null, new Date(2030, 0, 1));
    ok(r.length === 1 && r[0].kind === 'peachLeafCurlSpray', 'leden: broskev → návrh postřiku');
    ok(r[0].type === 'strong' && r[0].month === 3, 'strong → měsíc 3');
    ok(r[0].taskType === 'postrik' && r[0].emoji === '🛡️', 'task_type postrik, emoji 🛡️');
    ok(r[0].due >= 0 && r[0].due <= PEACH_CURL_HORIZON_DAYS, 'okno v budoucnu a v horizontu');
  }
  {
    const r = peachLeafCurlSprayForPin(pin(), apricot, null, new Date(2030, 1, 15));
    ok(r.length === 1 && r[0].type === 'mild' && r[0].month === 3, 'únor: meruňka → mild postřik v březnu');
  }

  // brzy v březnu (před 15.) → svítí; nikdy do minulosti (po okně → [])
  ok(peachLeafCurlSprayForPin(pin(), peach, null, new Date(2030, 2, 1)).length === 1,
    'začátek března: březnové okno → návrh svítí');
  ok(peachLeafCurlSprayForPin(pin(), peach, null, new Date(2030, 2, 20)).length === 0,
    'pozdní březen: okno (15.) minulo → [] (nikdy do minulosti)');

  // mimo horizont → skryto
  ok(peachLeafCurlSprayForPin(pin(), peach, null, new Date(2030, 10, 15)).length === 0,
    'listopad: březnové okno >75 dní → skryto');
  ok(peachLeafCurlSprayForPin(pin(), peach, null, new Date(2030, 5, 15)).length === 0,
    'červen: březnové okno minulo → příští rok >75 dní → skryto');
  ok(peachLeafCurlSprayForPin(pin(), peach, null, new Date(2030, 7, 1)).length === 0,
    'srpen: mimo horizont → skryto');

  // horizont je širší než ostatní vrstvy (75) — leden o ~73 dní svítí, kdyby byl 60 → []
  {
    const r = peachLeafCurlSprayForPin(pin(), peach, null, new Date(2030, 0, 1));
    ok(r.length === 1, 'horizont 75: 1. leden → březnové okno (~73 dní) svítí (širší než 60)');
  }

  // ---------- (3) Posun klim. zóny / expozice ----------
  {
    const base = peachLeafCurlSprayForPin(pin(), peach, null, new Date(2030, 1, 15))[0];
    const north = peachLeafCurlSprayForPin(pin(), peach, { exposure: 'N' }, new Date(2030, 1, 15))[0];
    ok(north.suggested > base.suggested, 'severní expozice → pozdější postřik (chladnější ⇒ pozdější pučení)');
    const south = peachLeafCurlSprayForPin(pin(), peach, { exposure: 'S' }, new Date(2030, 1, 15))[0];
    ok(south.suggested < base.suggested, 'jižní expozice → dřívější postřik');
    ok(getZoneOffsetDays('JHC') !== 0, 'climateZones: JHC má nenulový posun (kotva pro zónu)');
    const jhc = peachLeafCurlSprayForPin(pin(), peach, { climate_zone: 'JHC' }, new Date(2030, 1, 15))[0];
    ok(jhc.suggested > base.suggested, 'klim. zóna JHC (chladnější) → pozdější postřik');
  }

  // ---------- (4) Dedup proti existující postřiku v měsíci ----------
  {
    const now = new Date(2030, 1, 15); // únor → březnové okno
    const y = now.getFullYear();
    // task_type 'postrik' v cílovém měsíci potlačí (přesný úzký typ)
    const byType = [{ title: 'Jakýkoli postřik', task_type: 'postrik', specific_date: `${y}-03-10` }];
    ok(peachLeafCurlSprayForPin(pin(byType), peach, null, now).length === 0,
      'dedup: task_type postrik v březnu → potlačeno (úzký typ)');
    // marker „kadeřav" v titulku potlačí (i bez task_type postrik)
    const byCurl = [{ title: '🛡️ Postřik proti kadeřavosti Broskvoň', task_type: 'jine', specific_date: `${y}-03-12` }];
    ok(peachLeafCurlSprayForPin(pin(byCurl), peach, null, now).length === 0,
      'dedup: titulek „kadeřav" v březnu → potlačeno');
    const byCu = [{ title: 'Měďnatý postřik', task_type: 'jine', specific_date: `${y}-03-08` }];
    ok(peachLeafCurlSprayForPin(pin(byCu), peach, null, now).length === 0,
      'dedup: titulek „měďnat" v březnu → potlačeno');
    const byBordeaux = [{ title: 'Bordeauxská jícha', task_type: 'jine', specific_date: `${y}-03-05` }];
    ok(peachLeafCurlSprayForPin(pin(byBordeaux), peach, null, now).length === 0,
      'dedup: titulek „bordeaux" v březnu → potlačeno');
    const byKuprikol = [{ title: 'Aplikace Kuprikolu', task_type: 'jine', specific_date: `${y}-03-10` }];
    ok(peachLeafCurlSprayForPin(pin(byKuprikol), peach, null, now).length === 0,
      'dedup: titulek „kuprikol" v březnu → potlačeno');
    const byFungicid = [{ title: 'Měďnatý fungicid', task_type: 'jine', specific_date: `${y}-03-11` }];
    ok(peachLeafCurlSprayForPin(pin(byFungicid), peach, null, now).length === 0,
      'dedup: titulek „fungicid" v březnu → potlačeno');
    // jiný typ bez markeru v březnu NEpotlačí (jine je obecný + titulek nemá marker)
    const otherJine = [{ title: '🌾 Mulčování', task_type: 'jine', specific_date: `${y}-03-10` }];
    ok(peachLeafCurlSprayForPin(pin(otherJine), peach, null, now).length === 1,
      'dedup: jiný „jine" úkol bez markeru v březnu → návrh svítí');
    // postřik v JINÉM měsíci nevadí
    const otherMonth = [{ title: '🛡️ Postřik proti kadeřavosti Broskvoň', task_type: 'postrik', specific_date: `${y}-05-10` }];
    ok(peachLeafCurlSprayForPin(pin(otherMonth), peach, null, now).length === 1,
      'dedup: postřik v JINÉM měsíci nevadí → návrh svítí');
    // loňský postřik ve stejném měsíci nevadí (jednorázový úkol z minulého roku)
    const lastYear = [{ title: '🛡️ Postřik proti kadeřavosti', task_type: 'postrik', specific_date: `${y - 1}-03-12` }];
    ok(peachLeafCurlSprayForPin(pin(lastYear), peach, null, now).length === 1,
      'dedup: loňský postřik v březnu (jednorázový) → návrh svítí');
    // opakovaný úkol (frequency_days) ve stejném měsíci potlačí bez ohledu na rok
    const repeating = [{ title: 'Postřik proti kadeřavosti', task_type: 'postrik', next_due: `2099-03-01`, frequency_days: 365 }];
    ok(peachLeafCurlSprayForPin(pin(repeating), peach, null, now).length === 0,
      'dedup: opakovaný úkol postrik v březnu → potlačeno (bez ohledu na rok)');
  }

  // ---------- (5) Chybějící vstup ----------
  ok(peachLeafCurlSprayForPin(null, peach, null, new Date(2030, 1, 15)).length === 0, 'bez pinu → []');
  ok(peachLeafCurlSprayForPin({ id: 1, tasks: [] }, null, null, new Date(2030, 1, 15)).length === 0, 'bez rostliny → []');

  console.log(`\n✅ All ${passed} peach-leaf-curl-spray assertions passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
