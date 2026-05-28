// Sanity test pro „Otužování předpěstovaných sazenic (hardening off) — postupné vystavení ven
// před výsadbou". hardeningOff.js importuje RecommendedTasks.jsx (React/JSX) → nejde načíst
// v čistém node, proto REPLIKUJEME pure logiku (stejně jako test-pinching / test-fruit-thinning
// / test-peach-leaf-curl-spray). Replika je věrná hardeningOff.js a je now-aware (deterministické
// testy). Matchování HARDENING_OFF_GENERA / HARDENING_OFF_SPECIES běží proti REÁLNÉ
// plantDatabase načtené dynamickým importem → ověří, že kurátorská mapa sedí na skutečná data
// (žádné mrtvé klíče v GENERA) a že trvalky/cibuloviny/dřeviny / mrkev/ředkev jsou vyřazené.
// dateForMonth/getConditionShiftDays = věrná replika; getZoneOffsetDays importujeme z reálného
// climateZones.js (jeden zdroj pravdy pro posun klim. zóny).
// Spuštění: node scripts/test-hardening-off.cjs
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

// ---------- replika pure logiky (hardeningOff.js) ----------
const HARDENING_OFF_HORIZON_DAYS = 50;
const HARDENING_OFF_EMOJI = '🌤️';
const HARDENING_OFF_TYPES = {
  coolSeason: { month: 4 },
  warmSeason: { month: 5 },
  heatLoving: { month: 6 },
};
const HARDENING_OFF_CATEGORIES = new Set(['zelenina', 'letnicky']);
const HARDENING_OFF_GENERA = {
  Brassica: 'coolSeason',
  Lactuca: 'coolSeason',
  Solanum: 'warmSeason',
  Capsicum: 'warmSeason',
  Cucumis: 'warmSeason',
  Cucurbita: 'heatLoving',
};
const HARDENING_OFF_SPECIES = {
  'Solanum tuberosum': null, // brambor — exclude
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
function hardeningOffRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (!cat || !HARDENING_OFF_CATEGORIES.has(cat)) return null;
  const lat = String(plant.nameLat || '').trim();
  for (const sp in HARDENING_OFF_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) {
      const t = HARDENING_OFF_SPECIES[sp];
      return t ? { type: t } : null;
    }
  }
  const genus = genusOf(plant);
  if (genus && HARDENING_OFF_GENERA[genus]) return { type: HARDENING_OFF_GENERA[genus] };
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
function hasHardeningOffInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    const title = (e.title || '').trim();
    if (/otuž|otuze|harden|aklimatiz|abhärt|hartowan/i.test(title)) return true;
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
  function hardeningOffForPin(pin, plant, conditions, now) {
    if (!pin || !plant) return [];
    const rule = hardeningOffRuleForPlant(plant);
    if (!rule) return [];
    const typeDef = HARDENING_OFF_TYPES[rule.type];
    if (!typeDef) return [];
    const suggested = dateForMonth(typeDef.month, conditions, now);
    const due = daysFromToday(suggested, now);
    if (due === null || due < 0 || due > HARDENING_OFF_HORIZON_DAYS) return [];
    const m = monthFromIso(suggested);
    if (hasHardeningOffInMonth(pin.tasks || [], m, now.getFullYear())) return [];
    return [{
      kind: 'hardeningOff', type: rule.type, month: m, suggested, due,
      taskType: 'presazeni', emoji: HARDENING_OFF_EMOJI,
    }];
  }

  // ---------- (1) Matchování map proti REÁLNÉ DB ----------
  const db = await imp('frontend/src/plantDatabase.js');
  const enriched = db.PLANT_DATABASE.map(db.enrichPlant);
  const byCz = (name) => enriched.find((p) => p.nameCz === name);
  const ruleCz = (name) => hardeningOffRuleForPlant(byCz(name));
  const typeCz = (name) => { const r = ruleCz(name); return r && r.type; };

  // coolSeason — Brassica (košťáloviny) + Lactuca (salát)
  ok(typeCz('Brokolice Calabrese') === 'coolSeason', 'Brassica oleracea (brokolice, zelenina) → coolSeason');
  ok(typeCz('Květák Snowball') === 'coolSeason', 'Brassica oleracea (květák) → coolSeason');
  ok(typeCz('Kapusta Vertus') === 'coolSeason', 'Brassica oleracea (kapusta) → coolSeason');
  ok(typeCz('Salát hlávkový') === 'coolSeason' || typeCz('Salát listový') === 'coolSeason'
    || enriched.some((p) => p.category.key === 'zelenina' && genusOf(p) === 'Lactuca'),
    'Lactuca (salát, zelenina) → coolSeason — existuje ≥1 salát v DB');

  // warmSeason — Solanum (rajče/lilek), Capsicum, Cucumis
  ok(typeCz('Rajče') === 'warmSeason' || typeCz('Rajče San Marzano') === 'warmSeason',
    'Solanum lycopersicum (rajče) → warmSeason');
  ok(typeCz('Paprika sladká') === 'warmSeason' || typeCz('Paprika Jalapeño') === 'warmSeason',
    'Capsicum annuum (paprika) → warmSeason');
  ok(typeCz('Okurka salátová') === 'warmSeason' || enriched.some((p) =>
    p.category.key === 'zelenina' && genusOf(p) === 'Cucumis'),
    'Cucumis sativus (okurka) → warmSeason — existuje ≥1 okurka v DB');

  // heatLoving — Cucurbita (dýně/cuketa)
  ok(typeCz('Cuketa Black Beauty') === 'heatLoving', 'Cucurbita pepo (cuketa) → heatLoving');
  ok(typeCz('Dýně Hokkaido') === 'heatLoving', 'Cucurbita maxima (dýně) → heatLoving');
  ok(typeCz('Patizon') === 'heatLoving', 'Cucurbita pepo var. clypeata (patizon) → heatLoving');
  ok(typeCz('Dýně máslová') === 'heatLoving', 'Cucurbita moschata (dýně máslová) → heatLoving');

  // DRUH má přednost — Solanum tuberosum (brambor) → null PŘESTO že rod Solanum je warmSeason
  ok(hardeningOffRuleForPlant({ category: 'zelenina', nameLat: 'Solanum tuberosum' }) === null,
    'Solanum tuberosum (brambor, zelenina) → null (species precedence — sazečka rovnou do země)');
  ok(hardeningOffRuleForPlant({ category: 'zelenina', nameLat: "Solanum tuberosum 'Adéla'" }) === null,
    'forward-looking: Solanum tuberosum s kultivarem → null přes prefix species precedence');

  // letnicky — Petunia / Tagetes / Zinnia matchují přes rod? Žádný z těchto rodů v GENERA NENÍ
  // (zatím — letnicky se otužují, ale spec definovala jen zeleninu/košťáloviny). letničky v gate
  // jsou kvůli budoucímu rozšíření; aktuálně bez genus match → null. Test: Petúnie je v gate
  // ale rod není v GENERA → null (forward-looking gate je širší než aktuální mapa).
  ok(ruleCz('Petúnie') === null, 'Petúnie (Petunia, letnicky) → null (rod Petunia mimo GENERA — forward-looking gate)');
  ok(ruleCz('Aksamitník vzpřímený') === null, 'Tagetes erecta (letnicky) → null (rod Tagetes mimo GENERA)');
  ok(ruleCz('Zinia') === null, 'Zinnia (letnicky) → null (rod Zinnia mimo GENERA)');

  // mimo gate → null
  ok(hardeningOffRuleForPlant({ category: 'stromy', nameLat: 'Malus domestica' }) === null,
    'jabloň (stromy) → null mimo gate');
  ok(hardeningOffRuleForPlant({ category: 'trvalky', nameLat: 'Hosta sieboldiana' }) === null,
    'trvalka → null mimo gate');
  ok(hardeningOffRuleForPlant({ category: 'cibuloviny', nameLat: 'Tulipa gesneriana' }) === null,
    'tulipán (cibuloviny) → null mimo gate');
  ok(hardeningOffRuleForPlant({ category: 'ovoce', nameLat: 'Fragaria vesca' }) === null,
    'jahoda (ovoce) → null mimo gate');
  ok(hardeningOffRuleForPlant({ category: 'bylinky', nameLat: 'Ocimum basilicum' }) === null,
    'bazalka (bylinky) → null mimo gate');
  ok(hardeningOffRuleForPlant({ category: 'sukulenty', nameLat: 'Sedum album' }) === null,
    'plazivý rozchodník (sukulenty) → null mimo gate');
  ok(hardeningOffRuleForPlant({ category: 'kere', nameLat: 'Solanum lycopersicum' }) === null,
    'rajče s falešnou kategorií keře → null (mimo gate)');
  ok(hardeningOffRuleForPlant(null) === null, 'bez rostliny → null');

  // mrkev/ředkev/řepa (přímý výsev ven) NEJSOU v GENERA → null automaticky
  ok(hardeningOffRuleForPlant({ category: 'zelenina', nameLat: 'Daucus carota' }) === null,
    'mrkev (Daucus, zelenina) → null mimo GENERA (přímý výsev ven)');
  ok(hardeningOffRuleForPlant({ category: 'zelenina', nameLat: 'Raphanus sativus' }) === null,
    'ředkev (Raphanus, zelenina) → null mimo GENERA');
  ok(hardeningOffRuleForPlant({ category: 'zelenina', nameLat: 'Beta vulgaris' }) === null,
    'řepa (Beta, zelenina) → null mimo GENERA');

  // gate akceptuje i holý string kategorie
  ok((hardeningOffRuleForPlant({ category: 'zelenina', nameLat: 'Solanum lycopersicum' }) || {}).type === 'warmSeason',
    'holý string category=zelenina + rajče → warmSeason');
  ok((hardeningOffRuleForPlant({ category: 'zelenina', nameLat: 'Brassica oleracea' }) || {}).type === 'coolSeason',
    'holý string category=zelenina + košťálovina → coolSeason');
  ok((hardeningOffRuleForPlant({ category: 'zelenina', nameLat: 'Cucurbita pepo' }) || {}).type === 'heatLoving',
    'holý string category=zelenina + cuketa → heatLoving');

  // forward-looking druh s kultivarem („Solanum lycopersicum 'San Marzano'") matchuje rod přes prefix
  ok((hardeningOffRuleForPlant({ category: 'zelenina', nameLat: "Solanum lycopersicum 'San Marzano'" }) || {}).type === 'warmSeason',
    'forward-looking: rajče s kultivarem → warmSeason přes rod');

  // integrita: každý ROD v GENERA existuje v reálné DB v gate (žádný mrtvý klíč). SPECIES s null
  // hodnotou jsou intentional exclusions (forward-looking) — vynecháno z dead-key check.
  const inGate = (p) => HARDENING_OFF_CATEGORIES.has(p.category.key);
  for (const g of Object.keys(HARDENING_OFF_GENERA)) {
    ok(enriched.some((p) => inGate(p) && genusOf(p) === g),
      `HARDENING_OFF_GENERA: rod ${g} je v DB (zelenina/letnicky) — žádný mrtvý klíč`);
  }

  // ---------- (2) Logika hardeningOffForPin (now-aware) ----------
  const pin = (tasks) => ({ id: 1, tasks: tasks || [] });
  const tomato = { category: 'zelenina', nameLat: 'Solanum lycopersicum' };
  const broccoli = { category: 'zelenina', nameLat: 'Brassica oleracea var. italica' };
  const zucchini = { category: 'zelenina', nameLat: 'Cucurbita pepo' };

  {
    // březen → dubnové coolSeason okno (~30 dní) → v horizontu 50
    const r = hardeningOffForPin(pin(), broccoli, null, new Date(2030, 2, 15));
    ok(r.length === 1 && r[0].kind === 'hardeningOff', 'březen: brokolice → návrh otužování');
    ok(r[0].type === 'coolSeason' && r[0].month === 4, 'coolSeason → měsíc 4');
    ok(r[0].taskType === 'presazeni' && r[0].emoji === '🌤️', 'task_type presazeni, emoji 🌤️');
    ok(r[0].due >= 0 && r[0].due <= HARDENING_OFF_HORIZON_DAYS, 'okno v budoucnu a v horizontu');
  }
  {
    // duben → květnové warmSeason okno (~30 dní)
    const r = hardeningOffForPin(pin(), tomato, null, new Date(2030, 3, 15));
    ok(r.length === 1 && r[0].type === 'warmSeason' && r[0].month === 5,
      'duben: rajče → warmSeason v květnu');
  }
  {
    // květen → červnové heatLoving okno (~30 dní)
    const r = hardeningOffForPin(pin(), zucchini, null, new Date(2030, 4, 15));
    ok(r.length === 1 && r[0].type === 'heatLoving' && r[0].month === 6,
      'květen: cuketa → heatLoving v červnu');
  }

  // brzy v dubnu (před 15.) → svítí; nikdy do minulosti (po okně → [])
  ok(hardeningOffForPin(pin(), broccoli, null, new Date(2030, 3, 1)).length === 1,
    'začátek dubna: dubnové coolSeason okno → návrh svítí');
  ok(hardeningOffForPin(pin(), broccoli, null, new Date(2030, 3, 20)).length === 0,
    'pozdní duben: okno (15.) minulo → [] (nikdy do minulosti)');
  ok(hardeningOffForPin(pin(), tomato, null, new Date(2030, 4, 20)).length === 0,
    'pozdní květen: warmSeason okno (15.) minulo → []');

  // mimo horizont → skryto (horizont 50)
  ok(hardeningOffForPin(pin(), broccoli, null, new Date(2030, 0, 15)).length === 0,
    'leden: dubnové okno >50 dní → skryto');
  ok(hardeningOffForPin(pin(), broccoli, null, new Date(2030, 6, 15)).length === 0,
    'červenec: dubnové okno minulo → příští rok >50 dní → skryto');
  ok(hardeningOffForPin(pin(), zucchini, null, new Date(2030, 10, 15)).length === 0,
    'listopad: červnové okno >50 dní → skryto');
  ok(hardeningOffForPin(pin(), zucchini, null, new Date(2030, 7, 1)).length === 0,
    'srpen: mimo horizont → skryto');

  // ---------- (3) Posun klim. zóny / expozice ----------
  {
    const base = hardeningOffForPin(pin(), tomato, null, new Date(2030, 3, 15))[0];
    const north = hardeningOffForPin(pin(), tomato, { exposure: 'N' }, new Date(2030, 3, 15))[0];
    ok(north.suggested > base.suggested, 'severní expozice → pozdější otužování (chladnější ⇒ pozdější výsadba)');
    const south = hardeningOffForPin(pin(), tomato, { exposure: 'S' }, new Date(2030, 3, 15))[0];
    ok(south.suggested < base.suggested, 'jižní expozice → dřívější otužování');
    ok(getZoneOffsetDays('JHC') !== 0, 'climateZones: JHC má nenulový posun (kotva pro zónu)');
    const jhc = hardeningOffForPin(pin(), tomato, { climate_zone: 'JHC' }, new Date(2030, 3, 15))[0];
    ok(jhc.suggested > base.suggested, 'klim. zóna JHC (chladnější) → pozdější otužování');
  }

  // ---------- (4) Dedup proti existujícímu otužování v měsíci ----------
  {
    const now = new Date(2030, 3, 15); // duben → květnové warmSeason okno (rajče)
    const y = now.getFullYear();
    // marker „otuž" v titulku potlačí (české slovesný titulek „Otužit sazenici …")
    const byOtuz = [{ title: '🌤️ Otužit sazenici Rajče', task_type: 'presazeni', specific_date: `${y}-05-10` }];
    ok(hardeningOffForPin(pin(byOtuz), tomato, null, now).length === 0,
      'dedup: titulek „otuž" v květnu → potlačeno');
    // marker „harden" (anglický) potlačí
    const byHarden = [{ title: 'Harden off tomato seedlings', task_type: 'presazeni', specific_date: `${y}-05-12` }];
    ok(hardeningOffForPin(pin(byHarden), tomato, null, now).length === 0,
      'dedup: titulek „harden" v květnu → potlačeno (anglicky)');
    // marker „abhärt" (německý) potlačí
    const byAbhart = [{ title: 'Tomate abhärten', task_type: 'presazeni', specific_date: `${y}-05-12` }];
    ok(hardeningOffForPin(pin(byAbhart), tomato, null, now).length === 0,
      'dedup: titulek „abhärt" v květnu → potlačeno (německy)');
    // marker „hartowan" (polský) potlačí
    const byHart = [{ title: 'Hartowanie sadzonek', task_type: 'presazeni', specific_date: `${y}-05-12` }];
    ok(hardeningOffForPin(pin(byHart), tomato, null, now).length === 0,
      'dedup: titulek „hartowan" v květnu → potlačeno (polsky)');
    // marker „aklimatiz" potlačí
    const byAklim = [{ title: 'Aklimatizace sazenic', task_type: 'presazeni', specific_date: `${y}-05-12` }];
    ok(hardeningOffForPin(pin(byAklim), tomato, null, now).length === 0,
      'dedup: titulek „aklimatiz" v květnu → potlačeno');
    // jiný `presazeni` v květnu bez markeru NEpotlačí (task_type je sdílen s výsadbou ven)
    const otherPresazeni = [{ title: '🪴 Vysadit sazenici ven', task_type: 'presazeni', specific_date: `${y}-05-25` }];
    ok(hardeningOffForPin(pin(otherPresazeni), tomato, null, now).length === 1,
      'dedup: jiný `presazeni` bez markeru v květnu → návrh svítí (task_type sdílen s výsadbou)');
    // otužování v JINÉM měsíci nevadí
    const otherMonth = [{ title: '🌤️ Otužit sazenici', task_type: 'presazeni', specific_date: `${y}-04-25` }];
    ok(hardeningOffForPin(pin(otherMonth), tomato, null, now).length === 1,
      'dedup: otužování v JINÉM měsíci (duben) nevadí → návrh svítí');
    // loňské otužování ve stejném měsíci nevadí (jednorázový úkol z minulého roku)
    const lastYear = [{ title: '🌤️ Otužit sazenici', task_type: 'presazeni', specific_date: `${y - 1}-05-12` }];
    ok(hardeningOffForPin(pin(lastYear), tomato, null, now).length === 1,
      'dedup: loňské otužování v květnu (jednorázový) → návrh svítí');
    // opakovaný úkol (frequency_days) ve stejném měsíci potlačí bez ohledu na rok
    const repeating = [{ title: 'Otužit sazenici', task_type: 'presazeni', next_due: `2099-05-01`, frequency_days: 365 }];
    ok(hardeningOffForPin(pin(repeating), tomato, null, now).length === 0,
      'dedup: opakovaný úkol s markerem „otuž" v květnu → potlačeno (bez ohledu na rok)');
  }

  // ---------- (5) Chybějící vstup ----------
  ok(hardeningOffForPin(null, tomato, null, new Date(2030, 3, 15)).length === 0, 'bez pinu → []');
  ok(hardeningOffForPin({ id: 1, tasks: [] }, null, null, new Date(2030, 3, 15)).length === 0,
    'bez rostliny → []');

  console.log(`\n✅ All ${passed} hardening-off assertions passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
