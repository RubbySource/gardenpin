// Sanity test pro „Zazimování zahrady — vyrytí citlivých hlíz + zimní ochrana před prvním
// mrazem". winterPrep.js importuje RecommendedTasks.jsx / BulkCareModal.jsx (React/JSX) →
// nejde načíst v čistém node, proto REPLIKUJEME pure logiku (stejně jako test-division-tasks).
// Replika je věrná winterPrep.js a je now-aware (deterministické testy). Matchování ale
// běží proti REÁLNÉ plantDatabase načtené dynamickým importem → ověří, že kurátorské
// TENDER mapy sedí na skutečná data.
// Spuštění: node scripts/test-winter-prep.cjs
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

// ---------- replika pure logiky (winterPrep.js) ----------
const WINTER_PREP_SEASON = [9, 10, 11];
const ACTION_LIFT = { kind: 'lift', taskType: 'presazeni', emoji: '🪴', month: 10, windowMonths: [9, 10], bufferDays: 1 };
const ACTION_PROTECT = { kind: 'protect', taskType: 'jine', emoji: '🛡️', month: 11, windowMonths: [10, 11], bufferDays: 3 };
const TENDER_GENERA = {
  Dahlia: ACTION_LIFT, Gladiolus: ACTION_LIFT, Begonia: ACTION_LIFT, Canna: ACTION_LIFT,
  Nerium: ACTION_PROTECT, Punica: ACTION_PROTECT, Fuchsia: ACTION_PROTECT, Agapanthus: ACTION_PROTECT,
  Citrus: ACTION_PROTECT, Olea: ACTION_PROTECT, Laurus: ACTION_PROTECT,
};
const TENDER_SPECIES = { 'Hydrangea macrophylla': ACTION_PROTECT, 'Ficus carica': ACTION_PROTECT };

const isoLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function addDays(iso, n) {
  const [y, m, d] = String(iso).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
const monthFromIso = (iso) => { const m = /^\d{4}-(\d{2})/.exec(iso || ''); return m ? parseInt(m[1], 10) : null; };
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);
const genusOf = (p) => { const lat = String(p?.nameLat || '').trim(); return lat ? lat.split(/\s+/)[0] || null : null; };

function winterPrepRuleForPlant(plant) {
  if (!plant) return null;
  const lat = String(plant.nameLat || '').trim();
  for (const sp in TENDER_SPECIES) if (lat === sp || lat.startsWith(`${sp} `)) return TENDER_SPECIES[sp];
  const g = genusOf(plant);
  if (g && TENDER_GENERA[g]) return TENDER_GENERA[g];
  return null;
}
function firstFrostDateInForecast(frost) {
  if (!frost || !Array.isArray(frost.days)) return null;
  const f = frost.days.find((d) => d.frost);
  return f ? f.date : null;
}
// getConditionShiftDays — pro testy null conditions (shift 0); plná logika není potřeba.
const getConditionShiftDays = (c) => (c ? 0 : 0);
function autumnDate(month, conditions, now) {
  const d = new Date(now.getFullYear(), month - 1, 15);
  d.setDate(d.getDate() + getConditionShiftDays(conditions));
  return isoLocal(d);
}
// pinAlreadyHas — replika z BulkCareModal (dateForMonth now-aware kvůli determinismu).
function dateForMonth(month, conditions, now) {
  const year = month >= now.getMonth() + 1 ? now.getFullYear() : now.getFullYear() + 1;
  const d = new Date(year, month - 1, 15);
  d.setDate(d.getDate() + getConditionShiftDays(conditions));
  return isoLocal(d);
}
function pinAlreadyHas(pinTasks, action, month, taskType, conditions, now) {
  if (!pinTasks?.length) return false;
  const actLower = action.toLowerCase();
  const targetDate = dateForMonth(month, conditions, now);
  for (const e of pinTasks) {
    if (e.specific_date === targetDate && e.title && e.title.toLowerCase().includes(actLower)) return true;
    const m = monthFromIso(e.specific_date);
    if (m !== month) continue;
    if (taskType !== 'jine' && e.task_type === taskType) return true;
    if (e.title && e.title.toLowerCase().includes(actLower)) return true;
  }
  return false;
}
function winterPrepForGarden({ pins, lookup, existingByPin = {}, frost = null, conditions = null, now }) {
  const month = now.getMonth() + 1;
  if (!WINTER_PREP_SEASON.includes(month)) return [];
  const todayISO = isoLocal(now);
  const frostDate = firstFrostDateInForecast(frost);
  const out = [];
  for (const pin of pins || []) {
    if (!pin?.plant_name) continue;
    const rule = winterPrepRuleForPlant(lookup(pin.plant_name));
    if (!rule) continue;
    if (month < rule.windowMonths[0]) continue;
    const cal = autumnDate(rule.month, conditions, now);
    let suggested = cal < todayISO ? todayISO : cal;
    let frostWarn = null;
    if (frostDate) {
      const adj = addDays(frostDate, -rule.bufferDays);
      const adjClamped = adj < todayISO ? todayISO : adj;
      if (adjClamped < suggested) suggested = adjClamped;
      frostWarn = frostDate;
    }
    const m = monthFromIso(suggested);
    if (pinAlreadyHas(existingByPin[pin.id], rule.emoji, m, rule.taskType, conditions, now)) continue;
    out.push({ pinId: pin.id, plantName: pin.plant_name, kind: rule.kind, taskType: rule.taskType, emoji: rule.emoji, suggested, due: daysBetween(todayISO, suggested), month: m, frostDate: frostWarn });
  }
  return out.sort((a, b) => (a.suggested < b.suggested ? -1 : a.suggested > b.suggested ? 1 : 0));
}

(async () => {
  const db = await imp('frontend/src/plantDatabase.js');
  const find = db.findPlantByName;

  // ---------- (1) Matchování TENDER map proti REÁLNÉ plantDatabase ----------
  const liftAnchors = ['Dahlia (Jiřina)', 'Gladiola', 'Begónie hlíznatá'];
  for (const name of liftAnchors) {
    const p = find(name);
    ok(p, `DB obsahuje '${name}'`);
    const r = winterPrepRuleForPlant(p);
    ok(r && r.kind === 'lift', `'${name}' → lift (vyrýt hlízy)`);
  }
  const protectAnchors = ['Fuchsie', 'Agapanthus', 'Oleandr', 'Fíkovník (fík)', 'Hortenzie velkokvětá'];
  for (const name of protectAnchors) {
    const p = find(name);
    ok(p, `DB obsahuje '${name}'`);
    const r = winterPrepRuleForPlant(p);
    ok(r && r.kind === 'protect', `'${name}' → protect (zazimovat)`);
  }
  // Kultivar hortenzie velkolisté → species match i s přívlastkem.
  const es = find('Hortenzie Endless Summer');
  ok(es && winterPrepRuleForPlant(es)?.kind === 'protect', 'Hydrangea macrophylla kultivar → protect');

  // ---------- (2) Mrazuvzdorné rostliny VYŘAZENY (null) ----------
  const hardy = ['Hortenzie latnatá', 'Hortenzie Annabelle', 'Tulipán', 'Rajče', 'Buxus (zimostráz)'];
  for (const name of hardy) {
    const p = find(name);
    if (!p) continue; // jméno nemusí v DB být — test jen pro existující
    ok(winterPrepRuleForPlant(p) === null, `mrazuvzdorná '${name}' → null (nematchuje)`);
  }
  // H. paniculata/arborescens jsou hortenzie, ale NE macrophylla → nesmí matchovat.
  ok(winterPrepRuleForPlant({ nameLat: 'Hydrangea paniculata' }) === null, 'Hydrangea paniculata → null');
  ok(winterPrepRuleForPlant({ nameLat: 'Hydrangea arborescens' }) === null, 'Hydrangea arborescens → null');
  // Žádná rostlina / prázdná → null
  ok(winterPrepRuleForPlant(null) === null, 'null plant → null');
  ok(winterPrepRuleForPlant({ nameLat: '' }) === null, 'prázdný nameLat → null');

  // Celá DB: nic se tiše neztratí — počet matchů je rozumný a vše má známý kind.
  const enriched = db.PLANT_DATABASE.map(db.enrichPlant);
  let matched = 0;
  for (const p of enriched) {
    const r = winterPrepRuleForPlant(p);
    if (r) { matched++; ok(r.kind === 'lift' || r.kind === 'protect', `match má platný kind (${p.nameCz})`); }
  }
  ok(matched >= 6, `DB má dost citlivých rostlin k zazimování (${matched})`);

  // ---------- helpery pro logiku ----------
  const NOW_OCT = new Date(2030, 9, 5);   // 5. října → v sezóně (10)
  const NOW_NOV = new Date(2030, 10, 20); // 20. listopadu → v sezóně (11)
  const NOW_MAY = new Date(2030, 4, 10);  // květen → mimo sezónu
  const lookup = (name) => find(name);
  const dahliaPin = { id: 1, plant_name: 'Dahlia (Jiřina)' };
  const oleanderPin = { id: 2, plant_name: 'Oleandr' };
  const appleish = { id: 3, plant_name: 'Hortenzie latnatá' }; // mrazuvzdorná → ignorováno

  // ---------- (3) Sezónní gating 9–11 ----------
  {
    ok(winterPrepForGarden({ pins: [dahliaPin], lookup, now: NOW_MAY }).length === 0, 'mimo sezónu (květen) → []');
    const oct = winterPrepForGarden({ pins: [dahliaPin], lookup, now: NOW_OCT });
    ok(oct.length === 1 && oct[0].kind === 'lift', 'v sezóně (říjen) → návrh lift pro jiřinu');
    ok(oct[0].taskType === 'presazeni' && oct[0].emoji === '🪴', 'lift: task_type presazeni, emoji 🪴');
  }
  // protect okno začíná v říjnu — v září by se protect ještě neukázal
  {
    const NOW_SEP = new Date(2030, 8, 10); // 10. září
    const sep = winterPrepForGarden({ pins: [oleanderPin], lookup, now: NOW_SEP });
    ok(sep.length === 0, 'protect (oleandr) okno [10,11] → v září ještě skryto');
    const oct = winterPrepForGarden({ pins: [oleanderPin], lookup, now: NOW_OCT });
    ok(oct.length === 1 && oct[0].kind === 'protect' && oct[0].taskType === 'jine' && oct[0].emoji === '🛡️', 'oleandr v říjnu → protect (jine 🛡️)');
  }

  // ---------- (4) Mrazuvzdorná rostlina vyřazena z výstupu ----------
  ok(winterPrepForGarden({ pins: [appleish], lookup, now: NOW_OCT }).length === 0, 'mrazuvzdorná rostlina → není ve výstupu');

  // ---------- (5) Termín dle frostu vs. fallback okno ----------
  {
    // bez předpovědi → kalendářní okno (lift měsíc 10 → 15. října), frostDate null
    const noFrost = winterPrepForGarden({ pins: [dahliaPin], lookup, now: NOW_OCT })[0];
    ok(noFrost.suggested === '2030-10-15' && noFrost.frostDate === null, 'bez frostu → kalendářní 15. 10., bez varování');
    // mráz 8. 10. v předpovědi → lift (buffer 1) na 7. 10. (dřív než okno), frostDate vyplněn
    const frost = { days: [{ date: '2030-10-06', min: 5, frost: false }, { date: '2030-10-07', min: 3, frost: false }, { date: '2030-10-08', min: -1, frost: true }] };
    const withFrost = winterPrepForGarden({ pins: [dahliaPin], lookup, frost, now: NOW_OCT })[0];
    ok(withFrost.suggested === '2030-10-07', 'frost 8.10 − buffer 1 → termín 7. 10. (dřív než okno)');
    ok(withFrost.frostDate === '2030-10-08', 'frostDate = předpovězený mrazivý den');
    // pokud je kalendářní okno DŘÍVE než mráz, ber okno (min) — v listopadu lift měsíc 10 už za námi → dnešek
    const novNoFrost = winterPrepForGarden({ pins: [dahliaPin], lookup, now: NOW_NOV })[0];
    ok(novNoFrost.suggested === isoLocal(NOW_NOV), 'za ideálním oknem (listopad) → termín = dnešek (ne do minulosti)');
  }

  // ---------- (6) Dedup proti už naplánovanému zazimování ----------
  {
    // lift v říjnu už naplánovaný (presazeni v měsíci 10) → potlačeno
    const existing = { 1: [{ task_type: 'presazeni', specific_date: '2030-10-20', title: '🪴 Vyrýt a uložit hlízy' }] };
    ok(winterPrepForGarden({ pins: [dahliaPin], lookup, existingByPin: existing, now: NOW_OCT }).length === 0, 'dedup: presazeni v říjnu → potlačeno');
    // protect (jine) — dedup přes emoji 🛡️ v titulku ve stejném měsíci
    const existProt = { 2: [{ task_type: 'jine', specific_date: '2030-11-10', title: '🛡️ Zazimovat a přikrýt' }] };
    ok(winterPrepForGarden({ pins: [oleanderPin], lookup, existingByPin: existProt, now: NOW_OCT }).length === 0, 'dedup: 🛡️ titulek (jine) v listopadu → potlačeno');
    // jiný měsíc nevadí
    const otherMonth = { 1: [{ task_type: 'presazeni', specific_date: '2030-06-10', title: '🪴 Přesadit' }] };
    ok(winterPrepForGarden({ pins: [dahliaPin], lookup, existingByPin: otherMonth, now: NOW_OCT }).length === 1, 'dedup: presazeni v JINÉM měsíci nevadí → návrh svítí');
  }

  // ---------- (7) firstFrostDateInForecast ----------
  ok(firstFrostDateInForecast(null) === null, 'frost null → null');
  ok(firstFrostDateInForecast({ days: [{ date: '2030-10-06', frost: false }] }) === null, 'předpověď bez mrazu → null');
  ok(firstFrostDateInForecast({ days: [{ date: '2030-10-06', frost: false }, { date: '2030-10-07', frost: true }] }) === '2030-10-07', 'první mrazivý den = 7. 10.');

  console.log(`\n✅ All ${passed} winter-prep assertions passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
