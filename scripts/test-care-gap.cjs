// Sanity test pro „Detektor mezer v péči — loni ano, letos chybí".
// (1) Agregace /api/care-history/doy přes reálné node:sqlite na temp DB → lookup,
//     na který napojíme gap-logiku (end-to-end agregace + rozhodnutí).
// (2) Klientská rozhodovací logika careGapsForPin (věrná replika z frontend/src/careGap.js
//     — i18n/react/import chain nejde v čistém node, proto replikace pure funkcí).
// Spuštění: node scripts/test-care-gap.cjs
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

// ---------- replika pure logiky (careGap.js + závislosti) ----------
const GAP_HORIZON_DAYS = 120;
// BULK_CATEGORIES (BulkCareModal) → emoji → task_type
const EMOJI_CAT = new Map([
  ['✂️', 'strihani'],
  ['🌱', 'hnojeni'],
  ['🪴', 'presazeni'],
  ['🛡️', 'jine'],
  ['🌾', 'jine'],
  ['🧺', 'sklizen'],
  ['🐛', 'kontrola'],
]);

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
function monthFromIso(iso) {
  if (!iso) return null;
  const m = /^\d{4}-(\d{2})/.exec(iso);
  return m ? parseInt(m[1], 10) : null;
}
function dateForMonth(month, conditions) {
  // conditions=null → shift 0 (getConditionShiftDays(null)=0)
  const now = new Date();
  const year = month >= now.getMonth() + 1 ? now.getFullYear() : now.getFullYear() + 1;
  const d = new Date(year, month - 1, 15);
  return d.toISOString().slice(0, 10);
}
function pinAlreadyHas(pinTasks, action, month, taskType, conditions) {
  if (!pinTasks?.length) return false;
  const actLower = action.toLowerCase();
  const targetDate = dateForMonth(month, conditions);
  for (const e of pinTasks) {
    if (e.specific_date === targetDate && e.title && e.title.toLowerCase().includes(actLower)) return true;
    const m = monthFromIso(e.specific_date);
    if (m !== month) continue;
    if (taskType !== 'jine' && e.task_type === taskType) return true;
    if (e.title && e.title.toLowerCase().includes(actLower)) return true;
  }
  return false;
}
function mainSeasonalCategory(action) {
  if (!action) return null;
  for (const [em, taskType] of EMOJI_CAT) {
    if (action.startsWith(em)) return { emoji: em, taskType };
  }
  return null;
}
function plannedThisYear(pinTasks, action, curYear) {
  const al = action.toLowerCase();
  for (const e of pinTasks || []) {
    const tl = (e.title || '').toLowerCase();
    if (!tl) continue;
    if (!(tl.includes(al) || al.includes(tl))) continue;
    if (e.frequency_days) return true;
    const y = Number(String(e.specific_date || e.next_due || '').slice(0, 4));
    if (y === curYear) return true;
  }
  return false;
}
function careGapsForPin(pinId, pinTasks, lookup, conditions, now = new Date()) {
  if (!lookup || pinId == null) return [];
  const curYear = now.getFullYear();
  const gaps = [];
  for (const entry of lookup.values()) {
    if (Number(entry.pin_id) !== Number(pinId) || !Array.isArray(entry.years)) continue;
    const lastYear = entry.years.find((y) => Number(y.year) === curYear - 1);
    if (!lastYear || !Number.isFinite(Number(lastYear.doy))) continue;
    if (entry.years.some((y) => Number(y.year) === curYear)) continue;
    const cat = mainSeasonalCategory(entry.action);
    if (!cat) continue;
    const doy = Math.round(Number(lastYear.doy));
    const suggested = doyToISO(curYear, doy);
    const due = daysFromToday(suggested);
    if (due === null || due < 0 || due > GAP_HORIZON_DAYS) continue;
    const month = monthFromIso(suggested);
    if (pinAlreadyHas(pinTasks, entry.action, month, cat.taskType, conditions)) continue;
    if (plannedThisYear(pinTasks, entry.action, curYear)) continue;
    gaps.push({ action: entry.action, emoji: cat.emoji, taskType: cat.taskType, suggested, due, month });
  }
  gaps.sort((a, b) => a.due - b.due);
  return gaps;
}

// helpery na sestavení dat relativně k dnešku
const curYear = new Date().getFullYear();
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
const mk = (off) => isoForOffset(off);
// lookup s jednou akcí; years = pole {year, doy}
const lk = (pinId, action, years) =>
  new Map([[`${pinId} ${action}`, { pin_id: pinId, action, years }]]);
// doy budoucího dne (offset) namapovaný jako loňský záznam
const lastYearDoy = (off) => doyOf(mk(off));

// ---------- (1) Agregace SQL na temp DB → gap logika ----------
const tmpDb = path.join(os.tmpdir(), `gp-gap-${Date.now()}.db`);
const db = new DatabaseSync(tmpDb);
db.exec(`CREATE TABLE care_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER, pin_id INTEGER NOT NULL, action TEXT NOT NULL,
  notes TEXT, done_at TEXT
);`);
const ins = db.prepare('INSERT INTO care_history (pin_id, action, done_at) VALUES (?, ?, ?)');
// pin 1: loni řez (hlavní) + loni zálivka (micro) — oba s budoucím dnem letos
const prunDoy = lastYearDoy(45);
const waterDoy = lastYearDoy(30);
ins.run(1, '✂️ Zastřihni levanduli', `${doyToISO(curYear - 1, prunDoy)} 09:00:00`);
ins.run(1, '💧 Zalij', `${doyToISO(curYear - 1, waterDoy)} 09:00:00`);

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
db.close();
try { fs.unlinkSync(tmpDb); } catch {}

const sqlGaps = careGapsForPin(1, [], map, null);
ok(sqlGaps.length === 1, `sql: exactly 1 gap (řez), watering excluded (got ${sqlGaps.length})`);
ok(sqlGaps[0] && sqlGaps[0].taskType === 'strihani', 'sql: gap task_type = strihani z emoji ✂️');
ok(sqlGaps[0] && Math.abs(sqlGaps[0].due - 45) <= 1, `sql: due ≈ 45 (got ${sqlGaps[0] && sqlGaps[0].due})`);

// ---------- (2) rozhodovací logika ----------
// a) základní mezera: loni ano, letos nic, budoucí den, hlavní emoji → 1 gap
{
  const g = careGapsForPin(1, [], lk(1, '✂️ Řez', [{ year: curYear - 1, doy: lastYearDoy(40) }]), null);
  ok(g.length === 1 && g[0].taskType === 'strihani', 'logic: basic gap fires');
  ok(g[0].suggested === mk(40), `logic: suggested = loňský den letos (${g[0].suggested} vs ${mk(40)})`);
}
// b) letos už splněno (years má curYear) → žádná mezera
{
  const g = careGapsForPin(1, [], lk(1, '✂️ Řez', [
    { year: curYear - 1, doy: lastYearDoy(40) },
    { year: curYear, doy: lastYearDoy(5) },
  ]), null);
  ok(g.length === 0, 'logic: done this year → no gap');
}
// c) loni NEdělal (jen předloni) → žádná mezera
{
  const g = careGapsForPin(1, [], lk(1, '✂️ Řez', [{ year: curYear - 2, doy: lastYearDoy(40) }]), null);
  ok(g.length === 0, 'logic: not done last year → no gap');
}
// d) zálivka 💧 (micro) → vyřazeno
{
  const g = careGapsForPin(1, [], lk(1, '💧 Zalij', [{ year: curYear - 1, doy: lastYearDoy(40) }]), null);
  ok(g.length === 0, 'logic: watering excluded');
}
// e) loňský den už v minulosti (okno propásnuto) → žádná mezera
{
  const g = careGapsForPin(1, [], lk(1, '✂️ Řez', [{ year: curYear - 1, doy: lastYearDoy(-10) }]), null);
  ok(g.length === 0, 'logic: past window → no gap');
}
// f) za horizontem (> 120 dní) → žádná mezera
{
  const g = careGapsForPin(1, [], lk(1, '✂️ Řez', [{ year: curYear - 1, doy: lastYearDoy(150) }]), null);
  ok(g.length === 0, 'logic: beyond horizon → no gap');
}
// g) dedup pinAlreadyHas: pin už má úkol stejný měsíc + stejný task_type → žádná mezera
{
  const suggested = mk(40);
  const tasks = [{ title: '✂️ Něco jiného', task_type: 'strihani', specific_date: suggested }];
  const g = careGapsForPin(1, tasks, lk(1, '✂️ Řez', [{ year: curYear - 1, doy: lastYearDoy(40) }]), null);
  ok(g.length === 0, 'logic: dedup by month+task_type (pinAlreadyHas)');
}
// h) dedup plannedThisYear: stejný titulek naplánovaný letos v JINÉM měsíci → žádná mezera
{
  const other = mk(80); // jiný měsíc než suggested (40)
  const tasks = [{ title: '✂️ Řez', task_type: 'jine', specific_date: other }];
  const g = careGapsForPin(1, tasks, lk(1, '✂️ Řez', [{ year: curYear - 1, doy: lastYearDoy(40) }]), null);
  ok(g.length === 0, 'logic: dedup same title planned this year (other month)');
}
// i) opakovaný úkol stejného titulku → žádná mezera
{
  const tasks = [{ title: '✂️ Řez', task_type: 'jine', frequency_days: 365, next_due: mk(10) }];
  const g = careGapsForPin(1, tasks, lk(1, '✂️ Řez', [{ year: curYear - 1, doy: lastYearDoy(40) }]), null);
  ok(g.length === 0, 'logic: recurring task covers action → no gap');
}
// j) více mezer → seřazeno dle due vzestupně + správné task_type z emoji
{
  const lookup = new Map([
    ['1 ✂️ Řez', { pin_id: 1, action: '✂️ Řez', years: [{ year: curYear - 1, doy: lastYearDoy(60) }] }],
    ['1 🧺 Sklizeň', { pin_id: 1, action: '🧺 Sklizeň', years: [{ year: curYear - 1, doy: lastYearDoy(20) }] }],
    ['1 🐛 Kontrola', { pin_id: 1, action: '🐛 Kontrola', years: [{ year: curYear - 1, doy: lastYearDoy(40) }] }],
  ]);
  const g = careGapsForPin(1, [], lookup, null);
  ok(g.length === 3, `logic: 3 gaps (got ${g.length})`);
  ok(g[0].taskType === 'sklizen' && g[1].taskType === 'kontrola' && g[2].taskType === 'strihani', 'logic: sorted by due asc');
}
// k) nerozpoznané emoji (🪵) → vyřazeno
{
  const g = careGapsForPin(1, [], lk(1, '🪵 Něco', [{ year: curYear - 1, doy: lastYearDoy(40) }]), null);
  ok(g.length === 0, 'logic: unknown emoji excluded');
}
// l) jiný pin v lookupu se ignoruje
{
  const g = careGapsForPin(1, [], lk(2, '✂️ Řez', [{ year: curYear - 1, doy: lastYearDoy(40) }]), null);
  ok(g.length === 0, 'logic: other pin ignored');
}

console.log(`\n✅ All ${passed} care-gap assertions passed.`);
