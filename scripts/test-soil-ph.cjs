// Sanity test pro „Úprava pH půdy — podzimní vápnění záhonu + okyselení pod acidofilní rostliny".
// soilPh.js importuje RecommendedTasks.jsx (React/JSX) → nejde načíst v čistém node, proto
// REPLIKUJEME pure logiku (stejně jako test-green-manure / test-cutting-tasks). Replika je
// věrná soilPh.js a je now-aware (deterministické testy). Kategorie rostlin (findPlantByName),
// geometrie (bedForPin) i regionální posun (getZoneOffsetDays) běží proti REÁLNÝM modulům
// přes dynamický import → ověří, že logika sedí na skutečná data.
// Spuštění: node scripts/test-soil-ph.cjs
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

// ---------- replika pure logiky (soilPh.js) ----------
const SOIL_PH_SEASON = [10, 11];
const SOIL_PH_IDEAL_MONTH = 10;
const SOIL_PH_HORIZON_DAYS = 75;
const SOIL_PH_EMOJI = '🧪';
const BRASSICA_GENUS = 'Brassica';
const ACID_LOVING_GENERA = {
  Vaccinium: true, Rhododendron: true, Calluna: true, Pieris: true,
  Erica: true, Camellia: true, Gaultheria: true, Kalmia: true,
};
const ACID_CATEGORIES = new Set(['kere', 'trvalky', 'ovoce']);

const isoLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthFromIso = (iso) => { const m = /^\d{4}-(\d{2})/.exec(iso || ''); return m ? parseInt(m[1], 10) : null; };
const categoryKey = (p) => { const c = p?.category; if (!c) return null; return typeof c === 'string' ? c : c.key || null; };
const genusOf = (p) => { const lat = String(p?.nameLat || '').trim(); return lat ? lat.split(/\s+/)[0] || null : null; };

// getConditionShiftDays / dateForMonth — věrné repliky z RecommendedTasks (getZoneOffsetDays real).
function getConditionShiftDays(c, getZoneOffsetDays) {
  if (!c) return 0;
  let shift = 0;
  shift += getZoneOffsetDays(c.climate_zone);
  if (c.exposure === 'N') shift += 14;
  if (c.exposure === 'S') shift -= 7;
  if (typeof c.altitude_m === 'number') {
    if (c.altitude_m >= 600) shift += 14;
    else if (c.altitude_m >= 400) shift += 7;
    else if (c.altitude_m <= 200) shift -= 7;
  }
  return Math.max(-21, Math.min(21, shift));
}
function dateForMonth(month, conditions, now, getZoneOffsetDays) {
  const year = month >= now.getMonth() + 1 ? now.getFullYear() : now.getFullYear() + 1;
  const d = new Date(year, month - 1, 15);
  d.setDate(d.getDate() + getConditionShiftDays(conditions, getZoneOffsetDays));
  return isoLocal(d);
}
function daysFromToday(iso, now) {
  const t = new Date(now); t.setHours(0, 0, 0, 0);
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  return Math.round((d - t) / 86400000);
}

function acidLovingAppliesTo(plant) {
  if (!plant) return false;
  if (!ACID_CATEGORIES.has(categoryKey(plant))) return false;
  const genus = genusOf(plant);
  return !!(genus && ACID_LOVING_GENERA[genus]);
}
function bedHasLiming(tasks, marker, year) {
  if (!tasks?.length || !marker) return false;
  const mk = String(marker).toLowerCase();
  const yr = String(year);
  return tasks.some((tk) => tk
    && String(tk.specific_date || '').slice(0, 4) === yr
    && String(tk.title || '').toLowerCase().includes(mk));
}
function hasAcidifyInMonth(pinTasks, month, curYear, marker) {
  const mk = marker ? String(marker).toLowerCase() : null;
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    const title = e.title || '';
    if (mk && title.toLowerCase().includes(mk)) return true;
    if (title.includes('pH')) return true;
  }
  return false;
}
function soilLimingForGarden({
  pins, beds, lookup, conditions = null, existingByPin = {}, dedupMarker = null, now, bedForPin, getZoneOffsetDays,
}) {
  const month = now.getMonth() + 1;
  if (!SOIL_PH_SEASON.includes(month)) return [];
  if (!Array.isArray(beds) || !Array.isArray(pins) || typeof lookup !== 'function') return [];
  const todayISO = isoLocal(now);
  const year = now.getFullYear();
  const anchor = Math.max(SOIL_PH_IDEAL_MONTH, month);
  const cal = dateForMonth(anchor, conditions, now, getZoneOffsetDays);
  const suggested = cal < todayISO ? todayISO : cal;
  const m = monthFromIso(suggested);
  const out = [];
  for (const bed of beds) {
    const bedPins = pins.filter((p) => bedForPin(p, [bed]) === bed);
    if (!bedPins.length) continue;
    const hasBrassica = bedPins.some((p) => p?.plant_name && genusOf(lookup(p.plant_name)) === BRASSICA_GENUS);
    if (!hasBrassica) continue;
    const bedTasks = bedPins.flatMap((p) => existingByPin[p.id] || []);
    if (bedHasLiming(bedTasks, dedupMarker, year)) continue;
    out.push({ bedId: bed.id, bedName: bed.name, bedColor: bed.color || null, pinId: bedPins[0].id, suggested, month: m, emoji: SOIL_PH_EMOJI });
  }
  return out.sort((a, b) => String(a.bedName || '').localeCompare(String(b.bedName || '')));
}
function soilAcidifyForPin(pin, plant, conditions, dedupMarker, now, getZoneOffsetDays) {
  if (!pin || !plant) return [];
  if (!acidLovingAppliesTo(plant)) return [];
  const curMonth = now.getMonth() + 1;
  if (!SOIL_PH_SEASON.includes(curMonth)) return [];
  const anchor = Math.max(SOIL_PH_IDEAL_MONTH, curMonth);
  let suggested = dateForMonth(anchor, conditions, now, getZoneOffsetDays);
  let due = daysFromToday(suggested, now);
  if (due === null) return [];
  if (due < 0) { suggested = isoLocal(now); due = 0; }
  if (due > SOIL_PH_HORIZON_DAYS) return [];
  const m = monthFromIso(suggested);
  if (hasAcidifyInMonth(pin.tasks || [], m, now.getFullYear(), dedupMarker)) return [];
  return [{ kind: 'acidify', month: m, suggested, due, taskType: 'hnojeni', emoji: SOIL_PH_EMOJI }];
}

(async () => {
  const db = await imp('frontend/src/plantDatabase.js');
  const cr = await imp('frontend/src/data/cropRotation.js');
  const cz = await imp('frontend/src/data/climateZones.js');
  const find = db.findPlantByName;
  const bedForPin = cr.bedForPin;
  const getZoneOffsetDays = cz.getZoneOffsetDays;
  const lookup = (name) => find(name);

  const LIME_MARKER = 'vápn';   // shodné s soilPh.limeDedup (cs) — podřetězec titulku „Vápnit záhon…"
  const ACID_MARKER = 'okysel'; // shodné s soilPh.acidDedup (cs) — podřetězec titulku „Okyselit půdu pod…"

  // ---------- (0) reálná DB: kategorie a rody kotev sedí ----------
  ok(genusOf(find('Brokolice')) === 'Brassica', "DB: 'Brokolice' → rod Brassica (košťálovina)");
  ok(genusOf(find('Zelí bílé')) === 'Brassica', "DB: 'Zelí bílé' → rod Brassica");
  ok(categoryKey(find('Borůvka zahradní')) === 'ovoce' && genusOf(find('Borůvka zahradní')) === 'Vaccinium', "DB: 'Borůvka zahradní' → ovoce/Vaccinium");
  ok(categoryKey(find('Pěnišník')) === 'kere' && genusOf(find('Pěnišník')) === 'Rhododendron', "DB: 'Pěnišník' → kere/Rhododendron");
  ok(categoryKey(find('Vřes obecný')) === 'kere' && genusOf(find('Vřes obecný')) === 'Calluna', "DB: 'Vřes obecný' → kere/Calluna");
  ok(genusOf(find('Pieris japonský')) === 'Pieris', "DB: 'Pieris japonský' → rod Pieris");

  // acidLovingAppliesTo proti reálné DB
  ok(acidLovingAppliesTo(find('Borůvka zahradní')) === true, 'acid: borůvka → true');
  ok(acidLovingAppliesTo(find('Pěnišník')) === true, 'acid: pěnišník → true');
  ok(acidLovingAppliesTo(find('Vřes obecný')) === true, 'acid: vřes → true');
  ok(acidLovingAppliesTo(find('Pieris japonský')) === true, 'acid: pieris → true');
  ok(acidLovingAppliesTo(find('Rajče')) === false, 'acid: rajče (zelenina) → false');
  ok(acidLovingAppliesTo(find('Levandule')) === false, 'acid: levandule (bylinky) → false');
  ok(acidLovingAppliesTo(find('Jabloň')) === false, 'acid: jabloň (ovoce, ale rod Malus) → false (gate prochází, rod ne)');
  ok(acidLovingAppliesTo(find('Hortenzie velkokvětá')) === false, 'acid: hortenzie (kere, ale rod Hydrangea mimo mapu) → false');

  // ---------- (a) ZÁHONOVÉ VÁPNĚNÍ ----------
  const bedA = { id: 'A', name: 'Záhon A', color: '#8b6f47', x: 10, y: 10, width: 30, height: 30 };
  const brokoliPin = { id: 1, plant_name: 'Brokolice', x: 20, y: 20 };
  const baseLime = { pins: [brokoliPin], beds: [bedA], lookup, bedForPin, getZoneOffsetDays };

  // sezónní gating 10–11
  ok(soilLimingForGarden({ ...baseLime, now: new Date(2030, 4, 10) }).length === 0, 'lime: květen (mimo sezónu) → []');
  ok(soilLimingForGarden({ ...baseLime, now: new Date(2030, 7, 10) }).length === 0, 'lime: srpen (mimo sezónu) → []');
  ok(soilLimingForGarden({ ...baseLime, now: new Date(2030, 11, 1) }).length === 0, 'lime: prosinec (mimo sezónu) → []');
  for (const m of [9, 10]) { // měsíce 10, 11 (0-based 9, 10)
    ok(soilLimingForGarden({ ...baseLime, now: new Date(2030, m, 5) }).length === 1, `lime: měsíc ${m + 1} → 1 návrh`);
  }

  // záhon s košťálovinou → návrh; bez košťáloviny → nic
  {
    const r = soilLimingForGarden({ ...baseLime, now: new Date(2030, 9, 5) });
    ok(r.length === 1 && r[0].bedId === 'A' && r[0].pinId === 1, 'lime: záhon s brokolicí → návrh na Záhon A (reprezentativní pin)');
    ok(r[0].emoji === '🧪', 'lime: emoji 🧪');
    const onlyTomato = soilLimingForGarden({ pins: [{ id: 2, plant_name: 'Rajče', x: 20, y: 20 }], beds: [bedA], lookup, bedForPin, getZoneOffsetDays, now: new Date(2030, 9, 5) });
    ok(onlyTomato.length === 0, 'lime: záhon jen s rajčetem (ne košťálovina) → []');
    // smíšený záhon (rajče + brokolice) → stále navrhne (košťálovina přítomna)
    const mixed = soilLimingForGarden({ pins: [{ id: 3, plant_name: 'Rajče', x: 15, y: 15 }, { id: 4, plant_name: 'Zelí bílé', x: 25, y: 25 }], beds: [bedA], lookup, bedForPin, getZoneOffsetDays, now: new Date(2030, 9, 5) });
    ok(mixed.length === 1, 'lime: záhon s rajčetem + zelím → návrh (košťálovina přítomna)');
  }

  // geometrie: pin mimo záhon / záhon bez pinů → nic
  {
    ok(soilLimingForGarden({ pins: [{ id: 5, plant_name: 'Brokolice', x: 80, y: 80 }], beds: [bedA], lookup, bedForPin, getZoneOffsetDays, now: new Date(2030, 9, 5) }).length === 0, 'lime: brokolice mimo záhon → []');
    ok(soilLimingForGarden({ pins: [], beds: [bedA], lookup, bedForPin, getZoneOffsetDays, now: new Date(2030, 9, 5) }).length === 0, 'lime: záhon bez pinů → []');
  }

  // posun termínu dle klim. zóny/expozice + nikdy do minulosti
  {
    const plain = soilLimingForGarden({ ...baseLime, now: new Date(2030, 9, 1) })[0]; // 1.10. → cal 15.10
    ok(plain.suggested === '2030-10-15', 'lime: bez podmínek → 15. 10.');
    ok(getZoneOffsetDays('JHC') === 4, 'reálný getZoneOffsetDays JHC = +4');
    const south = soilLimingForGarden({ ...baseLime, conditions: { climate_zone: 'JHC', exposure: 'S' }, now: new Date(2030, 9, 1) })[0]; // +4−7=−3 → 12.10.
    ok(south.suggested === '2030-10-12', 'lime: JHC + jižní expozice → 12. 10. (dříve)');
    const north = soilLimingForGarden({ ...baseLime, conditions: { exposure: 'N' }, now: new Date(2030, 9, 1) })[0]; // +14 → 29.10.
    ok(north.suggested === '2030-10-29', 'lime: severní expozice → 29. 10. (později)');
    const late = soilLimingForGarden({ ...baseLime, now: new Date(2030, 9, 20) })[0]; // 20.10. > cal 15.10 → dnešek
    ok(late.suggested === '2030-10-20', 'lime: za ideálním dnem → termín = dnešek (ne do minulosti)');
    // listopad: kotva na listopad (žádný rollover na příští říjen)
    const nov = soilLimingForGarden({ ...baseLime, now: new Date(2030, 10, 3) })[0]; // 3.11. → cal 15.11
    ok(nov.suggested === '2030-11-15', 'lime: listopad → kotva 15. 11. (bez rolloveru na příští rok)');
  }

  // dedup na úrovni záhonu (jen dle titulku — task_type hnojeni je obecný)
  {
    const now = new Date(2030, 9, 5);
    const existing = { 1: [{ task_type: 'hnojeni', specific_date: '2030-10-15', title: '🧪 Vápnit záhon Záhon A' }] };
    ok(soilLimingForGarden({ ...baseLime, existingByPin: existing, dedupMarker: LIME_MARKER, now }).length === 0, 'lime dedup: záhon už má letos vápnění → potlačeno');
    const lastYear = { 1: [{ task_type: 'hnojeni', specific_date: '2029-10-15', title: '🧪 Vápnit záhon Záhon A' }] };
    ok(soilLimingForGarden({ ...baseLime, existingByPin: lastYear, dedupMarker: LIME_MARKER, now }).length === 1, 'lime dedup: loňské vápnění (jiný rok) → návrh svítí');
    const otherFert = { 1: [{ task_type: 'hnojeni', specific_date: '2030-10-15', title: '🌱 Přihnojit záhon' }] };
    ok(soilLimingForGarden({ ...baseLime, existingByPin: otherFert, dedupMarker: LIME_MARKER, now }).length === 1, 'lime dedup: běžné přihnojení (bez markeru) → návrh svítí (task_type hnojeni nestačí)');
    ok(soilLimingForGarden({ ...baseLime, existingByPin: existing, dedupMarker: null, now }).length === 1, 'lime dedup: bez markeru → návrh svítí');
  }

  // řazení dle názvu záhonu
  {
    const bedB = { id: 'B', name: 'Aaa záhon', x: 50, y: 50, width: 20, height: 20 };
    const pins = [{ id: 1, plant_name: 'Brokolice', x: 20, y: 20 }, { id: 2, plant_name: 'Kedlubna', x: 55, y: 55 }];
    const r = soilLimingForGarden({ pins, beds: [bedA, bedB], lookup, bedForPin, getZoneOffsetDays, now: new Date(2030, 9, 5) });
    ok(r.length === 2 && r[0].bedName === 'Aaa záhon' && r[1].bedName === 'Záhon A', 'lime: výstup seřazen dle názvu záhonu');
  }

  // ---------- (b) PER-PIN OKYSELENÍ ----------
  const acidPlant = find('Borůvka zahradní');
  const acidPin = { id: 10, plant_name: 'Borůvka zahradní', tasks: [] };

  // sezónní gating
  ok(soilAcidifyForPin(acidPin, acidPlant, null, ACID_MARKER, new Date(2030, 4, 5), getZoneOffsetDays).length === 0, 'acid: květen (mimo sezónu) → []');
  ok(soilAcidifyForPin(acidPin, acidPlant, null, ACID_MARKER, new Date(2030, 11, 5), getZoneOffsetDays).length === 0, 'acid: prosinec (mimo sezónu) → []');
  {
    const r = soilAcidifyForPin(acidPin, acidPlant, null, ACID_MARKER, new Date(2030, 9, 5), getZoneOffsetDays);
    ok(r.length === 1 && r[0].kind === 'acidify' && r[0].taskType === 'hnojeni' && r[0].emoji === '🧪', 'acid: borůvka v říjnu → návrh (hnojeni 🧪)');
    ok(r[0].suggested === '2030-10-15' && r[0].due === 10, 'acid: termín 15. 10., due 10 dní');
  }
  // neutrální rostlina → nic; pěnišník/vřes/pieris → návrh
  ok(soilAcidifyForPin({ id: 11, plant_name: 'Rajče', tasks: [] }, find('Rajče'), null, ACID_MARKER, new Date(2030, 9, 5), getZoneOffsetDays).length === 0, 'acid: rajče → []');
  ok(soilAcidifyForPin({ id: 12, plant_name: 'Pěnišník', tasks: [] }, find('Pěnišník'), null, ACID_MARKER, new Date(2030, 9, 5), getZoneOffsetDays).length === 1, 'acid: pěnišník → návrh');
  ok(soilAcidifyForPin({ id: 13, plant_name: 'Vřes obecný', tasks: [] }, find('Vřes obecný'), null, ACID_MARKER, new Date(2030, 9, 5), getZoneOffsetDays).length === 1, 'acid: vřes → návrh');

  // posun zóny + nikdy do minulosti + horizont
  {
    const north = soilAcidifyForPin(acidPin, acidPlant, { exposure: 'N' }, ACID_MARKER, new Date(2030, 9, 1), getZoneOffsetDays)[0]; // 15+14=29.10
    ok(north.suggested === '2030-10-29' && north.due <= SOIL_PH_HORIZON_DAYS, 'acid: severní expozice → 29. 10., v horizontu');
    const late = soilAcidifyForPin(acidPin, acidPlant, null, ACID_MARKER, new Date(2030, 9, 25), getZoneOffsetDays)[0]; // 25.10 > 15.10 → dnešek
    ok(late.suggested === '2030-10-25' && late.due === 0, 'acid: za ideálem → termín = dnešek (due 0, ne do minulosti)');
    const nov = soilAcidifyForPin(acidPin, acidPlant, null, ACID_MARKER, new Date(2030, 10, 3), getZoneOffsetDays)[0]; // listopad → kotva 15.11
    ok(nov.suggested === '2030-11-15', 'acid: listopad → kotva 15. 11. (bez rolloveru)');
  }

  // dedup per-pin (titulek marker / „pH", task_type hnojeni nestačí)
  {
    const now = new Date(2030, 9, 5);
    const withAcid = { ...acidPin, tasks: [{ task_type: 'hnojeni', specific_date: '2030-10-12', title: '🧪 Okyselit půdu pod Borůvka zahradní' }] };
    ok(soilAcidifyForPin(withAcid, acidPlant, null, ACID_MARKER, now, getZoneOffsetDays).length === 0, 'acid dedup: pin už má letos okyselení v říjnu → potlačeno');
    const withPh = { ...acidPin, tasks: [{ task_type: 'jine', specific_date: '2030-10-20', title: 'Změřit pH půdy' }] };
    ok(soilAcidifyForPin(withPh, acidPlant, null, ACID_MARKER, now, getZoneOffsetDays).length === 0, 'acid dedup: „pH" v titulku → potlačeno (jazykově nezávislé)');
    const lastYear = { ...acidPin, tasks: [{ task_type: 'hnojeni', specific_date: '2029-10-12', title: '🧪 Okyselit půdu pod Borůvka zahradní' }] };
    ok(soilAcidifyForPin(lastYear, acidPlant, null, ACID_MARKER, now, getZoneOffsetDays).length === 1, 'acid dedup: loňské okyselení (jiný rok) → návrh svítí');
    const otherFert = { ...acidPin, tasks: [{ task_type: 'hnojeni', specific_date: '2030-10-12', title: '🌱 Přihnojit borůvku' }] };
    ok(soilAcidifyForPin(otherFert, acidPlant, null, ACID_MARKER, now, getZoneOffsetDays).length === 1, 'acid dedup: běžné přihnojení (bez markeru) → návrh svítí (hnojeni nestačí)');
  }

  // chybějící vstup → []
  ok(soilAcidifyForPin(null, acidPlant, null, ACID_MARKER, new Date(2030, 9, 5), getZoneOffsetDays).length === 0, 'acid: chybějící pin → []');
  ok(soilAcidifyForPin(acidPin, null, null, ACID_MARKER, new Date(2030, 9, 5), getZoneOffsetDays).length === 0, 'acid: chybějící rostlina → []');

  console.log(`\n✅ All ${passed} soil-pH assertions passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
