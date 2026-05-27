// Sanity test pro „Věkově citlivé sezónní úkony — řez dle stáří rostliny".
// Věrná replika pure logiky z frontend/src/data/ageTasks.js (i18n/react/import chain
// nejde v čistém node, proto replikace pure funkcí — stejně jako test-care-gap.cjs).
// Replika je now-aware (dateForMonth/daysFromToday berou `now`) pro deterministické testy;
// reálný modul defaultuje na new Date(). Spuštění: node scripts/test-age-tasks.cjs
const assert = require('assert');

let passed = 0;
const ok = (cond, msg) => {
  assert.ok(cond, msg);
  passed++;
};

// ---------- replika pure logiky (ageTasks.js + závislosti) ----------
const AGE_HORIZON_DAYS = 150;
const PRUNE_EMOJI = '✂️';
const AGE_RULES = {
  kere: [
    { kind: 'guard', minAge: 0, maxAge: 0 },
    { kind: 'formative', minAge: 1, maxAge: 3, month: 3 },
    { kind: 'rejuvenation', minAge: 6, everyYears: 3, month: 3 },
  ],
  ovoce: [
    { kind: 'guard', minAge: 0, maxAge: 0 },
    { kind: 'formative', minAge: 1, maxAge: 4, month: 3 },
    { kind: 'rejuvenation', minAge: 8, everyYears: 3, month: 2 },
  ],
  stromy: [
    { kind: 'guard', minAge: 0, maxAge: 0 },
    { kind: 'formative', minAge: 2, maxAge: 5, month: 3 },
  ],
  popinave: [
    { kind: 'formative', minAge: 1, maxAge: 3, month: 3 },
    { kind: 'rejuvenation', minAge: 7, everyYears: 4, month: 3 },
  ],
};

const isoLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function daysFromToday(dateStr, now) {
  if (!dateStr) return null;
  const today = new Date(now.getTime());
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}
function dateForMonth(month, conditions, now) {
  // conditions=null → shift 0; den 15 (daleko od hranic měsíce → měsíc stabilní)
  const year = month >= now.getMonth() + 1 ? now.getFullYear() : now.getFullYear() + 1;
  return isoLocal(new Date(year, month - 1, 15));
}
function categoryKey(plant) {
  const c = plant && plant.category;
  if (!c) return null;
  return typeof c === 'string' ? c : c.key || null;
}
function ageInYears(plantingDate, now) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(plantingDate || ''));
  if (!m) return null;
  const py = +m[1];
  const pmo = +m[2] - 1;
  const pd = +m[3];
  let years = now.getFullYear() - py;
  const anniv = new Date(now.getFullYear(), pmo, pd);
  if (now < anniv) years -= 1;
  return years < 0 ? null : years;
}
function ruleApplies(rule, age) {
  if (age < rule.minAge) return false;
  if (rule.kind === 'rejuvenation') {
    const every = rule.everyYears || 1;
    return (age - rule.minAge) % every === 0;
  }
  if (typeof rule.maxAge === 'number') return age <= rule.maxAge;
  return true;
}
function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}
function hasPruningInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type === 'strihani') return true;
    if ((e.title || '').trim().startsWith(PRUNE_EMOJI)) return true;
  }
  return false;
}
function ageTasksForPin(pin, plant, conditions, now) {
  if (!pin || !plant) return [];
  const rules = AGE_RULES[categoryKey(plant)];
  if (!rules) return [];
  const age = ageInYears(pin.planting_date, now);
  if (age === null) return [];
  const curYear = now.getFullYear();
  const pinTasks = pin.tasks || [];
  const hints = [];
  for (const rule of rules) {
    if (!ruleApplies(rule, age)) continue;
    if (rule.kind === 'guard') {
      hints.push({ kind: 'guard', age });
      continue;
    }
    const suggested = dateForMonth(rule.month, conditions, now);
    const due = daysFromToday(suggested, now);
    if (due === null || due < 0 || due > AGE_HORIZON_DAYS) continue;
    const month = monthFromIso(suggested);
    if (hasPruningInMonth(pinTasks, month, curYear)) continue;
    hints.push({ kind: rule.kind, age, suggested, due, month, taskType: 'strihani', emoji: PRUNE_EMOJI });
  }
  hints.sort((a, b) => {
    if (a.kind === 'guard') return b.kind === 'guard' ? 0 : -1;
    if (b.kind === 'guard') return 1;
    return a.due - b.due;
  });
  return hints;
}

// ---------- helpery ----------
const NOW_JAN = new Date(2030, 0, 10); // jaro (březen) ~64 dní dopředu → v horizontu
const NOW_JUN = new Date(2030, 5, 20); // březen už za námi → příští jaro mimo horizont
const shrub = { category: { key: 'kere' } };
const fruit = { category: { key: 'ovoce' } };
const tree = { category: { key: 'stromy' } };
const climber = { category: { key: 'popinave' } };
// planting_date, které dá přesně daný věk k danému `now` (anniversary už proběhla / ještě ne).
function plantedForAge(age, now) {
  const d = new Date(now.getTime());
  d.setFullYear(d.getFullYear() - age);
  d.setMonth(d.getMonth() - 6); // posuň půl roku zpět → výroční den jednoznačně mimo `now`
  return isoLocal(d);
}
const pin = (age, now, tasks) => ({ planting_date: plantedForAge(age, now), tasks: tasks || [] });

// ---------- (1) ageInYears ----------
ok(ageInYears(plantedForAge(4, NOW_JAN), NOW_JAN) === 4, 'age: plantedForAge(4) → 4');
ok(ageInYears(plantedForAge(0, NOW_JAN), NOW_JAN) === 0, 'age: výsadbový rok → 0');
ok(ageInYears('2028-12-31', new Date(2030, 5, 15)) === 1, 'age: výroční den ještě nebyl → o rok míň');
ok(ageInYears(null, NOW_JAN) === null, 'age: chybějící datum → null');
ok(ageInYears('nesmysl', NOW_JAN) === null, 'age: neplatné datum → null');
ok(ageInYears('2031-01-01', NOW_JAN) === null, 'age: budoucí datum → null');

// ---------- (2) výchovný řez mladé dřeviny ----------
{
  const h = ageTasksForPin(pin(2, NOW_JAN), shrub, null, NOW_JAN);
  ok(h.length === 1 && h[0].kind === 'formative', 'shrub age 2 → výchovný řez');
  ok(h[0].month === 3 && h[0].taskType === 'strihani' && h[0].emoji === '✂️', 'formative: březen, strihani, ✂️');
}
// ---------- (3) guard ve výsadbovém roce ----------
{
  const h = ageTasksForPin(pin(0, NOW_JAN), shrub, null, NOW_JAN);
  ok(h.length === 1 && h[0].kind === 'guard', 'shrub age 0 → guard (bez akce)');
  ok(h[0].suggested === undefined, 'guard nemá datum');
}
// ---------- (4) omlazovací řez staré dřeviny + perioda ----------
{
  ok(ageTasksForPin(pin(6, NOW_JAN), shrub, null, NOW_JAN)[0].kind === 'rejuvenation', 'shrub age 6 → omlazovací');
  ok(ageTasksForPin(pin(7, NOW_JAN), shrub, null, NOW_JAN).length === 0, 'shrub age 7 → mimo periodu (nic)');
  ok(ageTasksForPin(pin(9, NOW_JAN), shrub, null, NOW_JAN)[0].kind === 'rejuvenation', 'shrub age 9 → omlazovací (6+3)');
}
// ---------- (5) mezera mezi guard a formative (strom) ----------
{
  ok(ageTasksForPin(pin(0, NOW_JAN), tree, null, NOW_JAN)[0].kind === 'guard', 'tree age 0 → guard');
  ok(ageTasksForPin(pin(1, NOW_JAN), tree, null, NOW_JAN).length === 0, 'tree age 1 → nic (guard maxAge 0, formative minAge 2)');
  ok(ageTasksForPin(pin(3, NOW_JAN), tree, null, NOW_JAN)[0].kind === 'formative', 'tree age 3 → výchovný řez');
  ok(ageTasksForPin(pin(12, NOW_JAN), tree, null, NOW_JAN).length === 0, 'tree age 12 → nic (stromy nemají omlazovací)');
}
// ---------- (6) ovoce a popínavé ----------
{
  ok(ageTasksForPin(pin(3, NOW_JAN), fruit, null, NOW_JAN)[0].kind === 'formative', 'fruit age 3 → výchovný řez');
  ok(ageTasksForPin(pin(8, NOW_JAN), fruit, null, NOW_JAN)[0].kind === 'rejuvenation', 'fruit age 8 → omlazovací');
  ok(ageTasksForPin(pin(1, NOW_JAN), climber, null, NOW_JAN)[0].kind === 'formative', 'climber age 1 → výchovný řez');
  ok(ageTasksForPin(pin(7, NOW_JAN), climber, null, NOW_JAN)[0].kind === 'rejuvenation', 'climber age 7 → omlazovací');
  ok(ageTasksForPin(pin(0, NOW_JAN), climber, null, NOW_JAN).length === 0, 'climber age 0 → nic (bez guardu)');
}
// ---------- (7) kategorie mimo mapu / chybějící data ----------
{
  ok(ageTasksForPin(pin(3, NOW_JAN), { category: { key: 'trvalky' } }, null, NOW_JAN).length === 0, 'trvalky → []');
  ok(ageTasksForPin(pin(3, NOW_JAN), { category: { key: 'zelenina' } }, null, NOW_JAN).length === 0, 'zelenina → []');
  ok(ageTasksForPin({ tasks: [] }, shrub, null, NOW_JAN).length === 0, 'bez planting_date → []');
  ok(ageTasksForPin(pin(3, NOW_JAN), null, null, NOW_JAN).length === 0, 'bez plant → []');
}
// ---------- (8) dedup proti existujícímu řezu v okně ----------
{
  const curYear = NOW_JAN.getFullYear();
  const sameMonthStrihani = [{ title: 'Jarní úkon', task_type: 'strihani', specific_date: `${curYear}-03-15` }];
  ok(ageTasksForPin(pin(2, NOW_JAN, sameMonthStrihani), shrub, null, NOW_JAN).length === 0, 'dedup: strihani v březnu → potlačeno');
  const sameMonthEmoji = [{ title: '✂️ Jarní řez', task_type: 'jine', specific_date: `${curYear}-03-20` }];
  ok(ageTasksForPin(pin(2, NOW_JAN, sameMonthEmoji), shrub, null, NOW_JAN).length === 0, 'dedup: ✂️ titulek (jine) v březnu → potlačeno');
  const otherMonth = [{ title: '✂️ Letní řez', task_type: 'strihani', specific_date: `${curYear}-05-10` }];
  ok(ageTasksForPin(pin(2, NOW_JAN, otherMonth), shrub, null, NOW_JAN).length === 1, 'dedup: řez v JINÉM měsíci nevadí → formative svítí');
}
// ---------- (9) horizont (sezónní okno daleko v budoucnu) ----------
{
  ok(ageTasksForPin(pin(2, NOW_JUN), shrub, null, NOW_JUN).length === 0, 'horizont: březen za >150 dní (z června) → skryto');
}

console.log(`\n✅ All ${passed} age-task assertions passed.`);
