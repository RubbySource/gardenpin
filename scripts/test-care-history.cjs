// Sanity test pro „Učení z historie péče — adaptivní termíny dle loňska".
// (1) Backend agregace /api/care-history/doy přes reálné node:sqlite na temp DB.
// (2) Klientská rozhodovací logika careHistoryState (věrná replika z frontend/src/careHistory.js
//     — i18n/react import chain nejde v čistém node, proto replikace pure funkce).
// Spuštění: node scripts/test-care-history.cjs
const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

let passed = 0;
const ok = (cond, msg) => {
  assert.ok(cond, msg);
  passed++;
};

// ---------- (1) Backend agregace SQL ----------
const tmpDb = path.join(os.tmpdir(), `gp-care-${Date.now()}.db`);
const db = new DatabaseSync(tmpDb);
db.exec(`CREATE TABLE care_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER, pin_id INTEGER NOT NULL, action TEXT NOT NULL,
  notes TEXT, done_at TEXT
);`);
const ins = db.prepare('INSERT INTO care_history (pin_id, action, done_at) VALUES (?, ?, ?)');
// pin 1, "Zastřihni levanduli": 3 roky, jeden rok 2× (průměr)
ins.run(1, 'Zastřihni levanduli', '2023-08-10 09:00:00');
ins.run(1, 'Zastřihni levanduli', '2024-08-20 09:00:00');
ins.run(1, 'Zastřihni levanduli', '2024-08-30 09:00:00'); // 2× v 2024 → průměr s předchozím
ins.run(1, 'Zastřihni levanduli', '2025-08-18 09:00:00');
// pin 1, jiná akce
ins.run(1, 'Nanes hnojivo', '2024-04-05 09:00:00');
// prázdná / null akce se musí ignorovat
ins.run(2, '', '2024-05-05 09:00:00');

const rows = db
  .prepare(
    `SELECT pin_id, action,
      CAST(strftime('%Y', done_at) AS INTEGER) AS year,
      CAST(ROUND(AVG(CAST(strftime('%j', done_at) AS INTEGER))) AS INTEGER) AS doy
     FROM care_history
     WHERE done_at IS NOT NULL AND action IS NOT NULL AND action != ''
     GROUP BY pin_id, action, year
     ORDER BY pin_id, action, year DESC`,
  )
  .all();

const map = new Map();
for (const r of rows) {
  if (r.pin_id == null || !r.action || r.year == null || r.doy == null) continue;
  const key = `${r.pin_id} ${r.action}`;
  if (!map.has(key)) map.set(key, { pin_id: r.pin_id, action: r.action, years: [] });
  map.get(key).years.push({ year: r.year, doy: r.doy });
}

const lavender = map.get('1 Zastřihni levanduli');
ok(lavender, 'agg: lavender entry exists');
ok(lavender.years.length === 3, `agg: 3 prior years (got ${lavender.years.length})`);
ok(lavender.years[0].year === 2025, 'agg: newest year first (DESC)');
// 2024 měl 2 záznamy (doy 232 a 242) → průměr 237
const y2024 = lavender.years.find((y) => y.year === 2024);
ok(y2024 && Math.abs(y2024.doy - 237) <= 1, `agg: 2024 doy averaged ~237 (got ${y2024 && y2024.doy})`);
ok(!map.has('2 '), 'agg: empty action excluded');
ok(map.get('1 Nanes hnojivo'), 'agg: second action present');
db.close();
try { fs.unlinkSync(tmpDb); } catch {}

// ---------- (2) Klientská logika careHistoryState (replika) ----------
const MIN_DUE_DAYS = 3, HORIZON_DAYS = 60, MAX_YEARS = 3, MIN_DIFF_DAYS = 7;
const keyFor = (pinId, action) => `${pinId} ${action}`;

function daysFromToday(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}
function doyToISO(year, doy) {
  const d = new Date(year, 0, 1);
  d.setDate(doy);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isoForOffset(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function doyOf(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000);
}

// phenoStub: pokud vrací truthy → historie ustoupí
function careHistoryState(task, lookup, phenoState) {
  if (!lookup || !task?.specific_date || task?.pin_id == null || !task?.title) return null;
  if (phenoState) return null; // fenologie má přednost
  const date = String(task.specific_date).slice(0, 10);
  const due = daysFromToday(date);
  if (due === null || due < MIN_DUE_DAYS || due > HORIZON_DAYS) return null;
  const entry = lookup.get(keyFor(task.pin_id, task.title));
  if (!entry || !Array.isArray(entry.years)) return null;
  const curYear = Number(date.slice(0, 4));
  const prior = entry.years
    .filter((y) => y && Number(y.year) < curYear && Number.isFinite(Number(y.doy)))
    .sort((a, b) => b.year - a.year)
    .slice(0, MAX_YEARS);
  if (prior.length === 0) return null;
  const lastYearDoy = Math.round(Number(prior[0].doy));
  const avgDoy = Math.round(prior.reduce((s, y) => s + Number(y.doy), 0) / prior.length);
  const multi = prior.length >= 2;
  const targetDoy = multi ? avgDoy : lastYearDoy;
  const suggested = doyToISO(curYear, targetDoy);
  const sugDue = daysFromToday(suggested);
  if (sugDue === null || sugDue < 0) return null;
  const diff = Math.abs(due - sugDue);
  if (diff < MIN_DIFF_DAYS) return null;
  return { mode: multi ? 'avg' : 'last', suggested, years: prior.length, days: diff, earlier: sugDue < due };
}

const curYear = new Date().getFullYear();
const mk = (offsetDays) => isoForOffset(offsetDays);
const mkLookup = (pinId, action, years) => new Map([[keyFor(pinId, action), { pin_id: pinId, action, years }]]);

// a) žádná historie → null
ok(careHistoryState({ pin_id: 1, title: 'X', specific_date: mk(20) }, new Map(), null) === null, 'logic: no history → null');

// b) 1 prior year, app navrhuje +30 dní, osobní termín +20 dní → diff 10 → fires, mode 'last'
{
  const taskDate = mk(30);
  const personalDate = mk(20);
  const lk = mkLookup(1, 'Řez', [{ year: curYear - 1, doy: doyOf(personalDate) }]);
  const s = careHistoryState({ pin_id: 1, title: 'Řez', specific_date: taskDate }, lk, null);
  ok(s && s.mode === 'last', 'logic: 1 prior year → mode last');
  ok(s && s.suggested === personalDate, `logic: suggested = personal date (${s && s.suggested} vs ${personalDate})`);
  ok(s && s.days === 10, `logic: diff 10 days (got ${s && s.days})`);
  ok(s && s.earlier === true, 'logic: personal term earlier than app');
}

// c) ≥2 prior years → mode 'avg', target = průměr doy
{
  const taskDate = mk(40);
  const d1 = mk(18), d2 = mk(22); // avg doy ≈ +20
  const lk = mkLookup(1, 'Hnojení', [
    { year: curYear - 1, doy: doyOf(d1) },
    { year: curYear - 2, doy: doyOf(d2) },
  ]);
  const s = careHistoryState({ pin_id: 1, title: 'Hnojení', specific_date: taskDate }, lk, null);
  ok(s && s.mode === 'avg', 'logic: 2 prior years → mode avg');
  ok(s && s.years === 2, 'logic: years=2');
  const avgDoy = Math.round((doyOf(d1) + doyOf(d2)) / 2);
  ok(s && s.suggested === doyToISO(curYear, avgDoy), 'logic: suggested = avg doy date');
}

// d) diff < 7 → null (termín už je v podstatě tvůj)
{
  const taskDate = mk(20);
  const personalDate = mk(17); // diff 3
  const lk = mkLookup(1, 'Řez', [{ year: curYear - 1, doy: doyOf(personalDate) }]);
  ok(careHistoryState({ pin_id: 1, title: 'Řez', specific_date: taskDate }, lk, null) === null, 'logic: diff<7 → null');
}

// e) osobní termín už v minulosti (loni dělal dřív, letošní den už proběhl) → null (nikdy do minulosti)
{
  const taskDate = mk(20); // app navrhuje za 20 dní
  const personalDate = mk(-15); // osobní den letošního roku už 15 dní za námi
  const lk = mkLookup(1, 'Řez', [{ year: curYear - 1, doy: doyOf(personalDate) }]);
  ok(careHistoryState({ pin_id: 1, title: 'Řez', specific_date: taskDate }, lk, null) === null, 'logic: past suggestion → null');
}

// f) ustoupí fenologii
{
  const taskDate = mk(30);
  const personalDate = mk(20);
  const lk = mkLookup(1, 'Řez', [{ year: curYear - 1, doy: doyOf(personalDate) }]);
  ok(careHistoryState({ pin_id: 1, title: 'Řez', specific_date: taskDate }, lk, { mode: 'later' }) === null, 'logic: defers to phenology');
}

// g) due < 3 dny → null (mimo okno)
{
  const taskDate = mk(2);
  const personalDate = mk(-10); // ne že by na tom záleželo, due gate je dřív
  const lk = mkLookup(1, 'Řez', [{ year: curYear - 1, doy: doyOf(mk(15)) }]);
  ok(careHistoryState({ pin_id: 1, title: 'Řez', specific_date: taskDate }, lk, null) === null, 'logic: due<3 → null');
}

// h) due > 60 dní → null (mimo horizont)
{
  const taskDate = mk(75);
  const lk = mkLookup(1, 'Řez', [{ year: curYear - 1, doy: doyOf(mk(50)) }]);
  ok(careHistoryState({ pin_id: 1, title: 'Řez', specific_date: taskDate }, lk, null) === null, 'logic: due>60 → null');
}

// i) bez specific_date (opakovaný úkol) → null
{
  const lk = mkLookup(1, 'Řez', [{ year: curYear - 1, doy: doyOf(mk(20)) }]);
  ok(careHistoryState({ pin_id: 1, title: 'Řez', next_due: mk(30), frequency_days: 30 }, lk, null) === null, 'logic: no specific_date → null');
}

// j) jen letošní historie (žádný předchozí rok) → null
{
  const taskDate = mk(30);
  const lk = mkLookup(1, 'Řez', [{ year: curYear, doy: doyOf(mk(5)) }]);
  ok(careHistoryState({ pin_id: 1, title: 'Řez', specific_date: taskDate }, lk, null) === null, 'logic: only current-year history → null');
}

// k) max 3 roky průměrování (4 roky historie → použijí se jen 3 nejnovější)
{
  const taskDate = mk(40);
  const lk = mkLookup(1, 'Řez', [
    { year: curYear - 1, doy: doyOf(mk(20)) },
    { year: curYear - 2, doy: doyOf(mk(20)) },
    { year: curYear - 3, doy: doyOf(mk(20)) },
    { year: curYear - 4, doy: doyOf(mk(60)) }, // tenhle se nesmí započítat
  ]);
  const s = careHistoryState({ pin_id: 1, title: 'Řez', specific_date: taskDate }, lk, null);
  ok(s && s.years === 3, `logic: max 3 years averaged (got ${s && s.years})`);
  ok(s && s.suggested === mk(20), 'logic: oldest 4th year excluded from avg');
}

console.log(`\n✅ All ${passed} care-history assertions passed.`);
