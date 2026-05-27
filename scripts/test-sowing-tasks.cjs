// Sanity test pro „Předjarní výsev do předpěstování — kdy vysít dovnitř zpětně od výsadby
// ven". sowingTasks.js importuje RecommendedTasks.jsx (React/JSX) → nejde načíst v čistém
// node, proto REPLIKUJEME pure logiku (stejně jako test-division-tasks / test-winter-prep).
// Replika je věrná sowingTasks.js a je now-aware (deterministické testy). Matchování
// SOWING_LEAD běží proti REÁLNÉ plantDatabase načtené dynamickým importem → ověří, že
// kurátorská mapa sedí na skutečná data a přímo seté plodiny jsou vyřazené.
// dateForMonth/getConditionShiftDays = věrná replika; getZoneOffsetDays importujeme z
// reálného climateZones.js (jeden zdroj pravdy pro posun klim. zóny).
// Spuštění: node scripts/test-sowing-tasks.cjs
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

// ---------- replika pure logiky (sowingTasks.js) ----------
const SOWING_HORIZON_DAYS = 90;
const SOW_EMOJI = '🌱';
const SOWING_LEAD_SPECIES = {
  'Solanum lycopersicum': { leadWeeks: 7, plantMonth: 5 },
  'Solanum melongena':    { leadWeeks: 8, plantMonth: 5 },
  'Allium porrum':        { leadWeeks: 8, plantMonth: 5 },
  'Brassica oleracea':    { leadWeeks: 5, plantMonth: 4 },
  'Lactuca sativa':       { leadWeeks: 4, plantMonth: 4 },
};
const SOWING_LEAD_GENERA = {
  Capsicum: { leadWeeks: 9, plantMonth: 5 },
  Cucumis: { leadWeeks: 3, plantMonth: 5 },
  Cucurbita: { leadWeeks: 4, plantMonth: 5 },
  Lagenaria: { leadWeeks: 4, plantMonth: 5 },
  Apium: { leadWeeks: 9, plantMonth: 5 },
  Zea: { leadWeeks: 3, plantMonth: 5 },
  Tagetes: { leadWeeks: 7, plantMonth: 5 },
  Callistephus: { leadWeeks: 6, plantMonth: 5 },
  Petunia: { leadWeeks: 10, plantMonth: 5 },
  Zinnia: { leadWeeks: 5, plantMonth: 5 },
  Verbena: { leadWeeks: 8, plantMonth: 5 },
};
const SOWING_CATEGORIES = new Set(['zelenina', 'letnicky']);

function categoryKey(plant) {
  const c = plant && plant.category;
  if (!c) return null;
  return typeof c === 'string' ? c : c.key || null;
}
function genusOf(plant) {
  const lat = String((plant && plant.nameLat) || '').trim();
  return lat ? lat.split(/\s+/)[0] || null : null;
}
function sowingLeadForPlant(plant) {
  if (!plant) return null;
  if (!SOWING_CATEGORIES.has(categoryKey(plant))) return null;
  const lat = String(plant.nameLat || '').trim();
  for (const sp in SOWING_LEAD_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return SOWING_LEAD_SPECIES[sp];
  }
  const genus = genusOf(plant);
  if (genus && SOWING_LEAD_GENERA[genus]) return SOWING_LEAD_GENERA[genus];
  return null;
}
function addDays(iso, n) {
  const [y, m, d] = String(iso).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
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
function hasSowingInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type === 'presazeni') return true;
    const title = (e.title || '').trim();
    if (title.startsWith(SOW_EMOJI) || /vys(ít|et|ev)|výsev|předpěst/i.test(title)) return true;
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
  function sowingTaskForPin(pin, plant, conditions, now) {
    if (!pin || !plant) return [];
    const rule = sowingLeadForPlant(plant);
    if (!rule) return [];
    const plantDate = dateForMonth(rule.plantMonth, conditions, now);
    const suggested = addDays(plantDate, -rule.leadWeeks * 7);
    const due = daysFromToday(suggested, now);
    if (due === null || due < 0 || due > SOWING_HORIZON_DAYS) return [];
    const m = monthFromIso(suggested);
    if (hasSowingInMonth(pin.tasks || [], m, now.getFullYear())) return [];
    return [{
      kind: 'sowing', leadWeeks: rule.leadWeeks, plantMonth: rule.plantMonth,
      plantDate, suggested, due, month: m, taskType: 'presazeni', emoji: SOW_EMOJI,
    }];
  }

  // ---------- (1) Matchování SOWING_LEAD proti REÁLNÉ DB ----------
  const db = await imp('frontend/src/plantDatabase.js');
  const enriched = db.PLANT_DATABASE.map(db.enrichPlant);
  const byCz = (cz) => enriched.find((p) => p.nameCz === cz);
  const lead = (cz) => sowingLeadForPlant(byCz(cz));

  const targets = enriched.filter((p) => SOWING_CATEGORIES.has(p.category.key));
  ok(targets.length >= 90, `DB má dost zeleniny/letniček (${targets.length})`);

  // teplomilná zelenina → resolvuje s očekávaným předstihem/měsícem
  ok(lead('Rajče') && lead('Rajče').leadWeeks === 7 && lead('Rajče').plantMonth === 5, 'rajče → lead 7 týd., výsadba 5');
  ok(lead('Paprika') && lead('Paprika').leadWeeks === 9, 'paprika → lead 9 týd.');
  ok(lead('Paprika Habanero') && lead('Paprika Habanero').leadWeeks === 9, 'paprika Habanero (Capsicum chinense) → rod Capsicum, lead 9');
  ok(lead('Okurka salátová') && lead('Okurka salátová').leadWeeks === 3, 'okurka → krátký lead 3 týd.');
  ok(lead('Cuketa') && lead('Cuketa').leadWeeks === 4, 'cuketa (Cucurbita) → lead 4');
  ok(lead('Dýně hokkaidó') && lead('Dýně hokkaidó').leadWeeks === 4, 'dýně (Cucurbita) → lead 4');
  ok(lead('Lilek vejcoplodý') && lead('Lilek vejcoplodý').leadWeeks === 8, 'lilek (Solanum melongena) → druh, lead 8');
  ok(lead('Pórek') && lead('Pórek').leadWeeks === 8, 'pórek (Allium porrum) → druh, lead 8');
  ok(lead('Celer bulvový') && lead('Celer bulvový').leadWeeks === 9, 'celer (Apium) → dlouhý lead 9');
  ok(lead('Brokolice') && lead('Brokolice').leadWeeks === 5 && lead('Brokolice').plantMonth === 4, 'brokolice (Brassica oleracea) → lead 5, ven dřív (4)');
  ok(lead('Kedlubna'), 'kedlubna (Brassica oleracea var.) → resolvuje druhem');
  ok(lead('Salát hlávkový') && lead('Salát hlávkový').plantMonth === 4, 'salát (Lactuca sativa) → ven dřív (4)');
  ok(lead('Kukuřice cukrová') && lead('Kukuřice cukrová').leadWeeks === 3, 'kukuřice cukrová (Zea) → lead 3');

  // letničky předpěstované
  ok(lead('Aksamitník vzpřímený') && lead('Aksamitník vzpřímený').leadWeeks === 7, 'aksamitník (Tagetes) → lead 7');
  ok(lead('Astra čínská') && lead('Astra čínská').leadWeeks === 6, 'astra (Callistephus) → lead 6');
  ok(lead('Surfinie') && lead('Surfinie').leadWeeks === 10, "surfinie (Petunia 'Surfinia', letnička) → rod Petunia, lead 10");
  ok(lead('Petúnie') === null, 'petúnie → null: běžný název míří na LEGACY okrasný záznam (kategorie-gate)');
  ok(lead('Zinia') && lead('Zinia').leadWeeks === 5, 'zinie (Zinnia) → lead 5');
  ok(lead('Verbena') && lead('Verbena').leadWeeks === 8, 'verbena (Verbena) → lead 8');

  // přímo seté plodiny / ze sazečky / cibule → VYŘAZENY (null)
  ok(lead('Mrkev') === null, 'mrkev (Daucus) → přímý výsev, null');
  ok(lead('Ředkev / Ředkvička') === null, 'ředkvička (Raphanus) → přímý výsev, null');
  ok(lead('Hrášek zahradní') === null, 'hrách (Pisum) → přímý výsev, null');
  ok(lead('Fazole keříčková') === null, 'fazole (Phaseolus) → přímý výsev, null');
  ok(lead('Špenát') === null, 'špenát (Spinacia) → přímý výsev, null');
  ok(lead('Cibule kuchyňská') === null, 'cibule (Allium cepa) → ze sazečky, null (jen Allium porrum matchuje)');
  ok(lead('Česnek') === null, 'česnek (Allium sativum) → podzimní sadba, null');
  ok(lead('Pastinák obecný') === null, 'pastinák (Pastinaca) → přímý výsev, null');
  ok(lead('Bob zahradní') === null, 'bob (Vicia) → přímý výsev, null');

  // každý klíč mapy matchuje aspoň jednu reálnou rostlinu (žádný mrtvý klíč)
  for (const sp in SOWING_LEAD_SPECIES) {
    ok(enriched.some((p) => { const l = String(p.nameLat || ''); return l === sp || l.startsWith(`${sp} `); }),
      `SPECIES klíč '${sp}' matchuje reálnou rostlinu`);
  }
  for (const g in SOWING_LEAD_GENERA) {
    ok(enriched.some((p) => genusOf(p) === g && SOWING_CATEGORIES.has(p.category.key)),
      `GENERA klíč '${g}' matchuje reálnou zeleninu/letničku`);
  }

  // ---------- (2) Kategorie gate ----------
  ok(sowingLeadForPlant({ category: { key: 'trvalky' }, nameLat: 'Solanum lycopersicum' }) === null,
    'kategorie gate: stejný nameLat v trvalkách → null (nepředpěstovává se)');
  ok(sowingLeadForPlant(db.findPlantByName('Hortenzie Annabelle')) === null, 'keř → null');
  ok(sowingLeadForPlant(null) === null, 'bez rostliny → null');

  // ---------- (3) Logika sowingTaskForPin (now-aware) ----------
  const tomato = { category: { key: 'zelenina' }, nameLat: 'Solanum lycopersicum' };
  const pin = (tasks) => ({ id: 1, tasks: tasks || [] });
  const NOW_FEB = new Date(2030, 1, 15);  // únor → výsev rajčat (~konec března) v budoucnu & horizontu
  const NOW_JUN = new Date(2030, 5, 1);   // červen → příští květnová výsadba → výsev příští březen (mimo horizont)
  const NOW_APR = new Date(2030, 3, 20);  // duben → ideální výsev (konec března) už za námi → due < 0

  {
    const r = sowingTaskForPin(pin(), tomato, null, NOW_FEB);
    ok(r.length === 1 && r[0].kind === 'sowing', 'únor: rajče → návrh výsevu');
    ok(r[0].taskType === 'presazeni' && r[0].emoji === '🌱', 'výsev: task_type presazeni, emoji 🌱');
    ok(r[0].month === 3, 'zpětný výpočet: výsadba ven (květen) − 7 týdnů → výsev v březnu');
    ok(r[0].plantMonth === 5 && r[0].leadWeeks === 7, 'hint nese plantMonth 5 + leadWeeks 7');
    ok(r[0].due >= 0 && r[0].due <= SOWING_HORIZON_DAYS, 'výsev v budoucnu a v horizontu');
  }
  ok(sowingTaskForPin(pin(), tomato, null, NOW_JUN).length === 0, 'červen: výsev až příští březen >90 dní → skryto');
  ok(sowingTaskForPin(pin(), tomato, null, NOW_APR).length === 0, 'duben: ideální výsev (březen) už minul → due<0 → skryto');

  // ---------- (4) Posun klim. zóny / expozice ----------
  {
    const base = sowingTaskForPin(pin(), tomato, null, NOW_FEB)[0];
    const north = sowingTaskForPin(pin(), tomato, { exposure: 'N' }, NOW_FEB)[0];
    ok(north.suggested > base.suggested, 'severní expozice → pozdější výsadba ven → pozdější výsev');
    // reálný klim. posun přes getZoneOffsetDays (JHC = +4 dny, chladnější)
    ok(getZoneOffsetDays('JHC') !== 0, 'climateZones: JHC má nenulový posun (kotva pro zónu)');
    const jhc = sowingTaskForPin(pin(), tomato, { climate_zone: 'JHC' }, NOW_FEB)[0];
    ok(jhc.suggested > base.suggested, 'klim. zóna JHC (+dny) → pozdější výsev než bez podmínek');
  }

  // ---------- (5) Dedup proti existujícímu výsevu v měsíci ----------
  {
    const curYear = NOW_FEB.getFullYear();
    const presaz = [{ title: 'X', task_type: 'presazeni', specific_date: `${curYear}-03-15` }];
    ok(sowingTaskForPin(pin(presaz), tomato, null, NOW_FEB).length === 0, 'dedup: presazeni v březnu → potlačeno');
    const emoji = [{ title: '🌱 Vysít rajče', task_type: 'jine', specific_date: `${curYear}-03-20` }];
    ok(sowingTaskForPin(pin(emoji), tomato, null, NOW_FEB).length === 0, 'dedup: 🌱 titulek (jine) v březnu → potlačeno');
    const vysev = [{ title: 'Výsev rajčat', task_type: 'jine', specific_date: `${curYear}-03-05` }];
    ok(sowingTaskForPin(pin(vysev), tomato, null, NOW_FEB).length === 0, 'dedup: titulek „Výsev" v březnu → potlačeno');
    const other = [{ title: '🌱 Vysít rajče', task_type: 'presazeni', specific_date: `${curYear}-01-10` }];
    ok(sowingTaskForPin(pin(other), tomato, null, NOW_FEB).length === 1, 'dedup: výsev v JINÉM měsíci nevadí → návrh svítí');
  }

  // ---------- (6) Chybějící vstup ----------
  ok(sowingTaskForPin(null, tomato, null, NOW_FEB).length === 0, 'bez pinu → []');
  ok(sowingTaskForPin(pin(), null, null, NOW_FEB).length === 0, 'bez rostliny → []');

  console.log(`\n✅ All ${passed} sowing-task assertions passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
