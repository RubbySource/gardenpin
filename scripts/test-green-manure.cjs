// Sanity test pro „Zelené hnojení po sklizni — meziplodina pro prázdné záhony".
// greenManure.js importuje RecommendedTasks.jsx (React/JSX) → nejde načíst v čistém node,
// proto REPLIKUJEME pure logiku (stejně jako test-winter-prep / test-division-tasks).
// Replika je věrná greenManure.js a je now-aware (deterministické testy). Geometrie
// (bedForPin), kategorie rostlin (findPlantByName) i regionální posun (getZoneOffsetDays)
// běží proti REÁLNÝM modulům přes dynamický import → ověří, že logika sedí na skutečná data.
// Spuštění: node scripts/test-green-manure.cjs
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

// ---------- replika pure logiky (greenManure.js) ----------
const GREEN_MANURE_SEASON = [8, 9, 10];
const ANNUAL = new Set(['zelenina', 'letnicky']);
const MIX_FROST_KILL = { key: 'frostKill', emoji: '🌱' };
const MIX_OVERWINTER = { key: 'overwinter', emoji: '🌱' };
const mixForMonth = (m) => (m <= 9 ? MIX_FROST_KILL : MIX_OVERWINTER);

const isoLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// getConditionShiftDays — věrná replika z RecommendedTasks (getZoneOffsetDays injektovaný real).
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
const categoryKeyOf = (p) => (p?.category?.key || null);
function bedOccupancy(bedPins, lookup) {
  let annualCount = 0;
  let occupied = false;
  for (const p of bedPins || []) {
    const cat = p?.plant_name && typeof lookup === 'function' ? categoryKeyOf(lookup(p.plant_name)) : null;
    if (cat && ANNUAL.has(cat)) annualCount++;
    else occupied = true;
  }
  return { annualCount, occupied };
}
function bedHasGreenManure(tasks, marker, year) {
  if (!tasks?.length || !marker) return false;
  const mk = String(marker).toLowerCase();
  const yr = String(year);
  return tasks.some(
    (tk) => tk && tk.task_type === 'presazeni'
      && String(tk.specific_date || '').slice(0, 4) === yr
      && String(tk.title || '').toLowerCase().includes(mk),
  );
}
function greenManureForGarden({
  pins, beds, lookup, conditions = null, existingByPin = {}, dedupMarker = null, now, bedForPin, getZoneOffsetDays,
}) {
  const month = now.getMonth() + 1;
  if (!GREEN_MANURE_SEASON.includes(month)) return [];
  if (!Array.isArray(beds) || !Array.isArray(pins) || typeof lookup !== 'function') return [];
  const todayISO = isoLocal(now);
  const year = now.getFullYear();
  const mix = mixForMonth(month);
  const cal = dateForMonth(month, conditions, now, getZoneOffsetDays);
  const suggested = cal < todayISO ? todayISO : cal;
  const out = [];
  for (const bed of beds) {
    const bedPins = pins.filter((p) => bedForPin(p, [bed]) === bed);
    if (!bedPins.length) continue;
    const { annualCount, occupied } = bedOccupancy(bedPins, lookup);
    if (occupied || annualCount < 1) continue;
    const bedTasks = bedPins.flatMap((p) => existingByPin[p.id] || []);
    if (bedHasGreenManure(bedTasks, dedupMarker, year)) continue;
    out.push({ bedId: bed.id, bedName: bed.name, bedColor: bed.color || null, pinId: bedPins[0].id, mixKey: mix.key, emoji: mix.emoji, suggested, month });
  }
  return out.sort((a, b) => String(a.bedName || '').localeCompare(String(b.bedName || '')));
}

(async () => {
  const db = await imp('frontend/src/plantDatabase.js');
  const cr = await imp('frontend/src/data/cropRotation.js');
  const cz = await imp('frontend/src/data/climateZones.js');
  const find = db.findPlantByName;
  const bedForPin = cr.bedForPin;
  const getZoneOffsetDays = cz.getZoneOffsetDays;
  const lookup = (name) => find(name);

  const MARKER = 'zelené hnojení'; // shodné s greenManure.dedupMarker (cs) — podřetězec titulku

  // ---------- (0) reálná DB: kategorie kotev sedí ----------
  ok(categoryKeyOf(find('Rajče')) === 'zelenina', "DB: 'Rajče' → zelenina");
  ok(categoryKeyOf(find('Mrkev')) === 'zelenina', "DB: 'Mrkev' → zelenina");
  ok(categoryKeyOf(find('Surfinie')) === 'letnicky', "DB: 'Surfinie' → letnicky (jednoletka)");
  ok(categoryKeyOf(find('Levandule')) === 'bylinky', "DB: 'Levandule' → bylinky (trvalý obyvatel)");
  ok(categoryKeyOf(find('Jabloň')) === 'stromy', "DB: 'Jabloň' → stromy (dřevina)");
  ok(categoryKeyOf(find('Tulipán')) === 'cibuloviny', "DB: 'Tulipán' → cibuloviny (trvalý obyvatel)");

  // ---------- (1) sezónní gating 8–10 ----------
  const bedA = { id: 'A', name: 'Záhon A', color: '#8b6f47', x: 10, y: 10, width: 30, height: 30 };
  const vegPin = { id: 1, plant_name: 'Rajče', x: 20, y: 20 };
  const base = { pins: [vegPin], beds: [bedA], lookup, bedForPin, getZoneOffsetDays };
  ok(greenManureForGarden({ ...base, now: new Date(2030, 4, 10) }).length === 0, 'květen (mimo sezónu) → []');
  ok(greenManureForGarden({ ...base, now: new Date(2030, 11, 1) }).length === 0, 'prosinec (mimo sezónu) → []');
  for (const m of [7, 8, 9]) { // měsíce 8,9,10 (0-based 7,8,9)
    const r = greenManureForGarden({ ...base, now: new Date(2030, m, 5) });
    ok(r.length === 1, `měsíc ${m + 1} → 1 návrh`);
  }

  // ---------- (2) prázdný (uvolněný) zeleninový záhon → návrh ----------
  {
    const r = greenManureForGarden({ ...base, now: new Date(2030, 7, 5) });
    ok(r.length === 1 && r[0].bedId === 'A', 'uvolněný záhon s rajčetem → návrh na Záhon A');
    ok(r[0].pinId === 1, 'návrh nese reprezentativní pin v záhonu');
    ok(r[0].bedColor === '#8b6f47', 'návrh nese barvu záhonu');
  }
  // víc jednoletek (zelenina + letnička) v záhonu → stále jeden návrh na záhon
  {
    const pins = [vegPin, { id: 2, plant_name: 'Surfinie', x: 25, y: 25 }, { id: 3, plant_name: 'Mrkev', x: 30, y: 30 }];
    const r = greenManureForGarden({ pins, beds: [bedA], lookup, bedForPin, getZoneOffsetDays, now: new Date(2030, 7, 5) });
    ok(r.length === 1, 'tři jednoletky v záhonu → jeden návrh na záhon');
  }

  // ---------- (3) brzký vs. pozdní výsev (volba směsi) ----------
  {
    const aug = greenManureForGarden({ ...base, now: new Date(2030, 7, 5) })[0];   // srpen
    const sep = greenManureForGarden({ ...base, now: new Date(2030, 8, 5) })[0];   // září
    const oct = greenManureForGarden({ ...base, now: new Date(2030, 9, 5) })[0];   // říjen
    ok(aug.mixKey === 'frostKill', 'srpen → mráz-citlivá směs (vymrzne sama)');
    ok(sep.mixKey === 'frostKill', 'září → mráz-citlivá směs');
    ok(oct.mixKey === 'overwinter', 'říjen → ozimá směs (přezimuje)');
    ok(mixForMonth(8) === MIX_FROST_KILL && mixForMonth(10) === MIX_OVERWINTER, 'mixForMonth: 8→frostKill, 10→overwinter');
  }

  // ---------- (4) bed s trvalkou/dřevinou VYŘAZEN ----------
  {
    const withLavender = [vegPin, { id: 9, plant_name: 'Levandule', x: 22, y: 22 }];
    ok(greenManureForGarden({ pins: withLavender, beds: [bedA], lookup, bedForPin, getZoneOffsetDays, now: new Date(2030, 7, 5) }).length === 0,
      'záhon s trvalkou (levandule) → vyřazen (není uvolněný)');
    const withTree = [vegPin, { id: 10, plant_name: 'Jabloň', x: 22, y: 22 }];
    ok(greenManureForGarden({ pins: withTree, beds: [bedA], lookup, bedForPin, getZoneOffsetDays, now: new Date(2030, 7, 5) }).length === 0,
      'záhon s dřevinou (jabloň) → vyřazen');
    const withBulb = [vegPin, { id: 11, plant_name: 'Tulipán', x: 22, y: 22 }];
    ok(greenManureForGarden({ pins: withBulb, beds: [bedA], lookup, bedForPin, getZoneOffsetDays, now: new Date(2030, 7, 5) }).length === 0,
      'záhon s cibulovinou (tulipán) → vyřazen');
  }
  // bedOccupancy přímo
  {
    const occ = bedOccupancy([{ plant_name: 'Rajče' }, { plant_name: 'Levandule' }], lookup);
    ok(occ.annualCount === 1 && occ.occupied === true, 'bedOccupancy: rajče+levandule → 1 jednoletka, occupied');
    const clean = bedOccupancy([{ plant_name: 'Rajče' }, { plant_name: 'Mrkev' }], lookup);
    ok(clean.annualCount === 2 && clean.occupied === false, 'bedOccupancy: rajče+mrkev → 2 jednoletky, ne occupied');
    const empty = bedOccupancy([{}], lookup);
    ok(empty.occupied === true, 'bedOccupancy: pin bez plant_name → occupied (neznámý obyvatel)');
  }

  // ---------- (5) geometrie: pin mimo záhon se nepočítá ----------
  {
    const outsidePin = { id: 5, plant_name: 'Rajče', x: 80, y: 80 };
    ok(greenManureForGarden({ pins: [outsidePin], beds: [bedA], lookup, bedForPin, getZoneOffsetDays, now: new Date(2030, 7, 5) }).length === 0,
      'pin mimo záhon → záhon bez pinů → []');
    // záhon úplně bez pinů → vyřazen (netušíme, že je to zeleninový záhon)
    ok(greenManureForGarden({ pins: [], beds: [bedA], lookup, bedForPin, getZoneOffsetDays, now: new Date(2030, 7, 5) }).length === 0,
      'záhon bez pinů → vyřazen');
  }

  // ---------- (6) posun termínu dle klim. zóny/expozice ----------
  {
    const plain = greenManureForGarden({ ...base, now: new Date(2030, 7, 1) })[0]; // 1.8. → cal 15.8 v budoucnu
    ok(plain.suggested === '2030-08-15', 'bez podmínek → výsev 15. 8.');
    // JHC (+4) + jižní expozice (−7) = −3 → 12. 8.
    const south = greenManureForGarden({ ...base, conditions: { climate_zone: 'JHC', exposure: 'S' }, now: new Date(2030, 7, 1) })[0];
    ok(getZoneOffsetDays('JHC') === 4, 'reálný getZoneOffsetDays JHC = +4');
    ok(south.suggested === '2030-08-12', 'JHC + jižní expozice → posun na 12. 8. (dříve)');
    // severní expozice (+14) → posun na 29. 8.
    const north = greenManureForGarden({ ...base, conditions: { exposure: 'N' }, now: new Date(2030, 7, 1) })[0];
    ok(north.suggested === '2030-08-29', 'severní expozice → posun na 29. 8. (později)');
    // nikdy do minulosti: dnes 27.8., cal 15.8 už za námi → dnešek
    const late = greenManureForGarden({ ...base, now: new Date(2030, 7, 27) })[0];
    ok(late.suggested === '2030-08-27', 'za ideálním dnem (27.8.) → termín = dnešek (ne do minulosti)');
  }

  // ---------- (7) dedup na úrovni záhonu ----------
  {
    const now = new Date(2030, 7, 5);
    // bed pin už má LETOS naplánovaný výsev hnojení (presazeni + marker v titulku)
    const existing = { 1: [{ task_type: 'presazeni', specific_date: '2030-08-20', title: '🌱 Zasít zelené hnojení do záhonu Záhon A' }] };
    ok(greenManureForGarden({ ...base, existingByPin: existing, dedupMarker: MARKER, now }).length === 0,
      'dedup: záhon už má letos výsev hnojení → potlačeno');
    // dedup funguje i přes JINÝ pin ve stejném záhonu
    {
      const pins = [vegPin, { id: 2, plant_name: 'Mrkev', x: 25, y: 25 }];
      const existing2 = { 2: [{ task_type: 'presazeni', specific_date: '2030-09-10', title: '🌱 Zasít zelené hnojení do záhonu Záhon A' }] };
      ok(greenManureForGarden({ pins, beds: [bedA], lookup, bedForPin, getZoneOffsetDays, existingByPin: existing2, dedupMarker: MARKER, now }).length === 0,
        'dedup: hnojení na jiném pinu téhož záhonu → potlačeno');
    }
    // LOŇSKÝ výsev hnojení nevadí (jiný rok)
    const lastYear = { 1: [{ task_type: 'presazeni', specific_date: '2029-08-20', title: '🌱 Zasít zelené hnojení do záhonu Záhon A' }] };
    ok(greenManureForGarden({ ...base, existingByPin: lastYear, dedupMarker: MARKER, now }).length === 1,
      'dedup: loňský výsev hnojení (jiný rok) → návrh svítí');
    // jiný úkol (ne hnojení) ve stejném roce nevadí
    const otherTask = { 1: [{ task_type: 'presazeni', specific_date: '2030-08-20', title: '🌱 Vysít rajče do truhlíku' }] };
    ok(greenManureForGarden({ ...base, existingByPin: otherTask, dedupMarker: MARKER, now }).length === 1,
      'dedup: jiný výsevový úkol (bez markeru) → návrh svítí');
    // bez markeru (offline) → bez dedupu
    ok(greenManureForGarden({ ...base, existingByPin: existing, dedupMarker: null, now }).length === 1,
      'dedup: bez markeru → návrh svítí (raději nabídnout)');
  }

  // ---------- (8) řazení dle názvu záhonu ----------
  {
    const bedB = { id: 'B', name: 'Aaa záhon', x: 50, y: 50, width: 20, height: 20 };
    const pins = [{ id: 1, plant_name: 'Rajče', x: 20, y: 20 }, { id: 2, plant_name: 'Mrkev', x: 55, y: 55 }];
    const r = greenManureForGarden({ pins, beds: [bedA, bedB], lookup, bedForPin, getZoneOffsetDays, now: new Date(2030, 7, 5) });
    ok(r.length === 2 && r[0].bedName === 'Aaa záhon' && r[1].bedName === 'Záhon A', 'výstup seřazen dle názvu záhonu');
  }

  console.log(`\n✅ All ${passed} green-manure assertions passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
