// Sanity test pro „Ideální den v okně dle počasí — vyber suchý den pro řez/postřik".
// Klientská rozhodovací logika bestDayInWindow / dayCost (věrná replika z
// frontend/src/idealDay.js — i18n/react import chain nejde v čistém node, proto replikace
// pure funkcí). Vyšší přednost (fenologie/historie) je modelována booleovskými flagy.
// Spuštění: node scripts/test-ideal-day.cjs
const assert = require('assert');

let passed = 0;
const ok = (cond, msg) => {
  assert.ok(cond, msg);
  passed++;
};

// ---------- konstanty + pure logika (replika idealDay.js) ----------
const MIN_DUE_DAYS = 3, MAX_DUE_DAYS = 7, WINDOW_RADIUS = 3;
const FROST_C = 2, WIND_KMH = 30, MIN_IMPROVEMENT = 3;

// weatherPrefForType (replika data/taskTypes.js)
const PREF = { strihani: 'dry', kontrola: 'dry', postrik: 'dry', presazeni: 'mild', zalivka: 'postrain', hnojeni: 'postrain' };
const weatherPrefForType = (type) => PREF[type] ?? null;

function daysFromToday(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function diffDays(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000);
}
const scorable = (d) => d && d.precip != null && d.wind != null && d.tmin != null;

function dayCost(d, pref) {
  if (pref === 'mild') {
    const frost = d.tmin < FROST_C ? (FROST_C - d.tmin) * 4 + 8 : 0;
    return frost + d.precip * 0.6 + Math.max(0, d.wind - WIND_KMH) * 0.2;
  }
  if (pref === 'postrain') {
    return d.precip * 2.0;
  }
  return d.precip * 1.5 + Math.max(0, d.wind - 20) * 0.3;
}

function bestDayInWindow(task, forecast, phenoActive, careActive) {
  if (!forecast || !forecast.days.length || !task?.specific_date) return null;
  const pref = weatherPrefForType(task.task_type);
  if (!pref) return null;
  if (phenoActive) return null; // fenologie má přednost
  if (careActive) return null; // historie má přednost
  const date = String(task.specific_date).slice(0, 10);
  const due = daysFromToday(date);
  if (due === null || due < MIN_DUE_DAYS || due > MAX_DUE_DAYS) return null;
  const scheduled = forecast.byDate[date];
  if (!scorable(scheduled)) return null;
  const today = todayISO();
  const candidates = forecast.days.filter(
    (d) => scorable(d) && d.date >= today && Math.abs(diffDays(d.date, date)) <= WINDOW_RADIUS,
  );
  if (candidates.length === 0) return null;
  const schedCost = dayCost(scheduled, pref);
  let best = scheduled, bestCost = schedCost;
  for (const d of candidates) {
    const c = dayCost(d, pref);
    if (c < bestCost) { bestCost = c; best = d; }
  }
  if (best.date === date) return null;
  if (schedCost - bestCost < MIN_IMPROVEMENT) return null;
  return { date: best.date, pref, earlier: best.date < date };
}

// ---------- test helpery ----------
function mk(offset) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// 7denní předpověď (offsety 0..6) s defaultními metrikami + override jednotlivých dnů.
function week(defaults, overrides = {}) {
  const byDate = {}, days = [];
  for (let i = 0; i <= 6; i++) {
    const m = { ...defaults, ...(overrides[i] || {}) };
    const e = { date: mk(i), precip: m.precip, wind: m.wind, tmin: m.tmin };
    byDate[e.date] = e; days.push(e);
  }
  return { byDate, days };
}

// a) suchý den vyhrává nad deštivým termínem (řez = 'dry')
{
  const fc = week({ precip: 6, wind: 10, tmin: 14 }, { 4: { precip: 12 }, 5: { precip: 0 } });
  const s = bestDayInWindow({ task_type: 'strihani', specific_date: mk(4) }, fc, false, false);
  ok(s && s.date === mk(5), `dry: navrhne suchý den (got ${s && s.date} vs ${mk(5)})`);
  ok(s && s.earlier === false, 'dry: navržený den je později (mk5 > mk4)');
}

// b) žádné zlepšení (termín už suchý a bezvětrný) → skryto
{
  const fc = week({ precip: 0, wind: 8, tmin: 14 });
  ok(bestDayInWindow({ task_type: 'strihani', specific_date: mk(4) }, fc, false, false) === null,
    'no-improvement: vše suché → null');
}

// c) zlepšení pod práh (MIN_IMPROVEMENT) → skryto
{
  const fc = week({ precip: 0, wind: 8, tmin: 14 }, { 4: { precip: 1.8 } }); // schedCost 2.7 < 3
  ok(bestDayInWindow({ task_type: 'strihani', specific_date: mk(4) }, fc, false, false) === null,
    'threshold: zlepšení < 3 → null');
}

// d) návrh vždy v okně ±3 dnů a nikdy do minulosti
{
  const fc = week({ precip: 8, wind: 10, tmin: 14 }, { 5: { precip: 0 } });
  const s = bestDayInWindow({ task_type: 'kontrola', specific_date: mk(4) }, fc, false, false);
  ok(s && Math.abs(diffDays(s.date, mk(4))) <= WINDOW_RADIUS, 'window: návrh v ±3 dnech');
  ok(s && s.date >= todayISO(), 'window: návrh nikdy do minulosti');
}

// e) typ bez počasové preference → null (sklizeň/plení/jine)
{
  const fc = week({ precip: 10, wind: 10, tmin: 14 }, { 5: { precip: 0 } });
  ok(bestDayInWindow({ task_type: 'sklizen', specific_date: mk(4) }, fc, false, false) === null,
    'pref: sklizeň nemá weatherPref → null');
}

// f) due < 3 dny → null (mrazové „teď" okno, mimo náš dosah)
{
  const fc = week({ precip: 10, wind: 10, tmin: 14 }, { 2: { precip: 0 } });
  ok(bestDayInWindow({ task_type: 'strihani', specific_date: mk(2) }, fc, false, false) === null,
    'window: due<3 → null');
}

// g) due > 7 dní → null (mimo předpověď)
{
  const fc = week({ precip: 10, wind: 10, tmin: 14 });
  ok(bestDayInWindow({ task_type: 'strihani', specific_date: mk(9) }, fc, false, false) === null,
    'window: due>7 → null');
}

// h) ustoupí fenologii i historii (vyšší přednost)
{
  const fc = week({ precip: 12, wind: 10, tmin: 14 }, { 5: { precip: 0 } });
  ok(bestDayInWindow({ task_type: 'strihani', specific_date: mk(4) }, fc, true, false) === null,
    'precedence: ustoupí fenologii');
  ok(bestDayInWindow({ task_type: 'strihani', specific_date: mk(4) }, fc, false, true) === null,
    'precedence: ustoupí historii');
}

// i) mild: mrazivý termín ustoupí mírnému dni (přesazení)
{
  const fc = week({ precip: 0, wind: 8, tmin: 10 }, { 4: { tmin: -2 }, 5: { tmin: 9 } });
  const s = bestDayInWindow({ task_type: 'presazeni', specific_date: mk(4) }, fc, false, false);
  ok(s && s.pref === 'mild', 'mild: presazeni má pref mild');
  ok(s && s.date !== mk(4), 'mild: mrazivý termín nahrazen mírným dnem');
}

// j) termín mimo předpověď (chybí data dne) → null
{
  const fc = week({ precip: 8, wind: 10, tmin: 14 });
  delete fc.byDate[mk(4)]; // termín bez dat
  ok(bestDayInWindow({ task_type: 'strihani', specific_date: mk(4) }, fc, false, false) === null,
    'data: termín bez předpovědi → null');
}

// k) bez specific_date (opakovaný úkol) → null
{
  const fc = week({ precip: 10, wind: 10, tmin: 14 }, { 5: { precip: 0 } });
  ok(bestDayInWindow({ task_type: 'strihani', next_due: mk(4), frequency_days: 30 }, fc, false, false) === null,
    'data: bez specific_date → null');
}

// l) dayCost: deštivý+větrný den dráž než suchý bezvětrný (dry)
{
  ok(dayCost({ precip: 10, wind: 40, tmin: 14 }, 'dry') > dayCost({ precip: 0, wind: 8, tmin: 14 }, 'dry'),
    'dayCost: déšť+vítr > sucho (dry)');
  ok(dayCost({ precip: 0, wind: 8, tmin: -3 }, 'mild') > dayCost({ precip: 0, wind: 8, tmin: 9 }, 'mild'),
    'dayCost: mráz > mírno (mild)');
}

// m) postrain (zálivka/hnojení): deštivý den > suchý, vítr ignorován
{
  ok(dayCost({ precip: 8, wind: 5, tmin: 14 }, 'postrain') > dayCost({ precip: 0, wind: 5, tmin: 14 }, 'postrain'),
    'dayCost: déšť > sucho (postrain)');
  // Vítr nemá penalizaci v postrain (zalévat se dá za větru)
  ok(dayCost({ precip: 0, wind: 50, tmin: 14 }, 'postrain') === dayCost({ precip: 0, wind: 5, tmin: 14 }, 'postrain'),
    'dayCost: vítr ignorován (postrain)');
}

// n) postrain: deštivý termín → navrhne sušší den (vícero kandidátů; libovolný sušší)
{
  const fc = week({ precip: 0, wind: 10, tmin: 14 }, { 4: { precip: 5 } });
  const s = bestDayInWindow({ task_type: 'zalivka', specific_date: mk(4) }, fc, false, false);
  ok(s && s.pref === 'postrain', 'postrain: zalivka má pref postrain');
  ok(s && s.date !== mk(4), 'postrain: deštivý termín nahrazen sušším dnem');
}

// o) postrain (hnojení): podobné — sušší den vyhrává
{
  const fc = week({ precip: 5, wind: 10, tmin: 14 }, { 5: { precip: 0 } });
  const s = bestDayInWindow({ task_type: 'hnojeni', specific_date: mk(4) }, fc, false, false);
  ok(s && s.pref === 'postrain', 'postrain: hnojeni má pref postrain');
  ok(s && s.date === mk(5), `postrain: hnojeni → sušší den (got ${s && s.date} vs ${mk(5)})`);
}

console.log(`\n✅ All ${passed} ideal-day assertions passed.`);
