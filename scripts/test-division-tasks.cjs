// Sanity test pro „Dělení trvalek a okrasných trav dle cyklu — omlazení trsu po N letech".
// Věrná replika pure logiky z frontend/src/data/divisionTasks.js (i18n/react/import chain
// nejde v čistém node, proto replikace pure funkcí — stejně jako test-age-tasks.cjs).
// Replika je now-aware (dateForMonth/daysFromToday/ageInYears berou `now`) pro
// deterministické testy; reálný modul defaultuje na new Date().
// Spuštění: node scripts/test-division-tasks.cjs
const assert = require('assert');

let passed = 0;
const ok = (cond, msg) => {
  assert.ok(cond, msg);
  passed++;
};

// ---------- replika pure logiky (divisionTasks.js + závislosti) ----------
const DIVISION_HORIZON_DAYS = 150;
const DIVIDE_EMOJI = '🪴';
const DIVISION_RULES = {
  trvalky: { period: 4, firstYear: 3, bloomAware: true, autumnMonth: 9, springMonth: 4 },
  travy: { period: 4, firstYear: 4, bloomAware: false, fixedMonth: 4 },
};
const AUTUMN_BLOOM_GENERA = new Set([
  'Aster', 'Symphyotrichum', 'Chrysanthemum', 'Dendranthema', 'Sedum', 'Hylotelephium',
  'Anemone', 'Solidago', 'Helenium', 'Rudbeckia', 'Echinacea', 'Helianthus',
]);

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
function genusOf(plant) {
  const lat = String((plant && plant.nameLat) || '').trim();
  if (!lat) return null;
  return lat.split(/\s+/)[0] || null;
}
function isAutumnBloomer(plant) {
  const genus = genusOf(plant);
  return genus ? AUTUMN_BLOOM_GENERA.has(genus) : false;
}
function divisionMonth(rule, plant) {
  if (!rule.bloomAware) return rule.fixedMonth;
  return isAutumnBloomer(plant) ? rule.springMonth : rule.autumnMonth;
}
function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}
function hasDivisionInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type === 'presazeni') return true;
    const title = (e.title || '').trim();
    if (title.startsWith(DIVIDE_EMOJI) || /děl(ení|it)/i.test(title)) return true;
  }
  return false;
}
function divisionTasksForPin(pin, plant, conditions, now) {
  if (!pin || !plant) return [];
  const rule = DIVISION_RULES[categoryKey(plant)];
  if (!rule) return [];
  const age = ageInYears(pin.planting_date, now);
  if (age === null || age < rule.firstYear) return [];
  if ((age - rule.firstYear) % rule.period !== 0) return [];
  const month = divisionMonth(rule, plant);
  const suggested = dateForMonth(month, conditions, now);
  const due = daysFromToday(suggested, now);
  if (due === null || due < 0 || due > DIVISION_HORIZON_DAYS) return [];
  const m = monthFromIso(suggested);
  if (hasDivisionInMonth(pin.tasks || [], m, now.getFullYear())) return [];
  const season = rule.bloomAware && !isAutumnBloomer(plant) ? 'autumn' : 'spring';
  return [{ kind: 'division', age, suggested, due, month: m, season, taskType: 'presazeni', emoji: DIVIDE_EMOJI }];
}

// ---------- helpery ----------
const NOW_MAY = new Date(2030, 4, 10);  // květen → září (autumn div) ~128 dní → v horizontu;
                                        //          duben už za námi → příští duben mimo horizont
const NOW_JAN = new Date(2030, 0, 10);  // leden → duben (spring div) ~95 dní → v horizontu;
                                        //          září ~243 dní → mimo horizont
// kategorie
const perennial = (nameLat) => ({ category: { key: 'trvalky' }, nameLat });
const grass = (nameLat) => ({ category: { key: 'travy' }, nameLat });
const hosta = perennial("Hosta 'Halcyon'");        // jarně/letně kvetoucí → podzim
const aster = perennial('Aster novi-belgii');       // podzimní kvetoucí → zjara
const miscanthus = grass("Miscanthus sinensis 'Gracillimus'");

// planting_date, které dá přesně daný věk k danému `now`.
function plantedForAge(age, now) {
  const d = new Date(now.getTime());
  d.setFullYear(d.getFullYear() - age);
  d.setMonth(d.getMonth() - 6); // půl roku zpět → výroční den jednoznačně mimo `now`
  return isoLocal(d);
}
const pin = (age, now, tasks) => ({ planting_date: plantedForAge(age, now), tasks: tasks || [] });

// ---------- (1) trvalka: perioda + firstYear ----------
{
  ok(divisionTasksForPin(pin(2, NOW_MAY), hosta, null, NOW_MAY).length === 0, 'trvalka věk 2 < firstYear 3 → nic');
  const h = divisionTasksForPin(pin(3, NOW_MAY), hosta, null, NOW_MAY);
  ok(h.length === 1 && h[0].kind === 'division', 'trvalka věk 3 (=firstYear) → návrh dělení');
  ok(h[0].taskType === 'presazeni' && h[0].emoji === '🪴', 'dělení: task_type presazeni, emoji 🪴');
  ok(divisionTasksForPin(pin(4, NOW_MAY), hosta, null, NOW_MAY).length === 0, 'trvalka věk 4 (3+1) → mimo periodu (nic)');
  ok(divisionTasksForPin(pin(7, NOW_MAY), hosta, null, NOW_MAY).length === 1, 'trvalka věk 7 (3+4) → další perioda');
}
// ---------- (2) sezóna dle doby květu ----------
{
  const hostaH = divisionTasksForPin(pin(3, NOW_MAY), hosta, null, NOW_MAY)[0];
  ok(hostaH.month === 9 && hostaH.season === 'autumn', 'jarně/letně kvetoucí trvalka (Hosta) → podzim (září)');
  const asterH = divisionTasksForPin(pin(3, NOW_JAN), aster, null, NOW_JAN)[0];
  ok(asterH.month === 4 && asterH.season === 'spring', 'podzimní kvetoucí trvalka (Aster) → brzy zjara (duben)');
}
// ---------- (3) trávy: vždy zjara, firstYear 4 ----------
{
  ok(divisionTasksForPin(pin(3, NOW_JAN), miscanthus, null, NOW_JAN).length === 0, 'tráva věk 3 < firstYear 4 → nic');
  const g = divisionTasksForPin(pin(4, NOW_JAN), miscanthus, null, NOW_JAN)[0];
  ok(g && g.month === 4 && g.season === 'spring', 'tráva věk 4 → brzy zjara (duben), bez ohledu na květ');
  ok(divisionTasksForPin(pin(8, NOW_JAN), miscanthus, null, NOW_JAN).length === 1, 'tráva věk 8 (4+4) → další perioda');
  ok(divisionTasksForPin(pin(5, NOW_JAN), miscanthus, null, NOW_JAN).length === 0, 'tráva věk 5 → mimo periodu (nic)');
}
// ---------- (4) kategorie mimo mapu / chybějící data ----------
{
  ok(divisionTasksForPin(pin(4, NOW_MAY), { category: { key: 'kere' }, nameLat: 'Buxus sempervirens' }, null, NOW_MAY).length === 0, 'dřevina (keře) → []');
  ok(divisionTasksForPin(pin(4, NOW_MAY), { category: { key: 'cibuloviny' }, nameLat: 'Tulipa gesneriana' }, null, NOW_MAY).length === 0, 'cibuloviny (vyřazeny) → []');
  ok(divisionTasksForPin(pin(4, NOW_MAY), { category: { key: 'zelenina' }, nameLat: 'Solanum lycopersicum' }, null, NOW_MAY).length === 0, 'zelenina → []');
  ok(divisionTasksForPin({ tasks: [] }, hosta, null, NOW_MAY).length === 0, 'bez planting_date → []');
  ok(divisionTasksForPin(pin(4, NOW_MAY), null, null, NOW_MAY).length === 0, 'bez plant → []');
}
// ---------- (5) horizont (sezónní okno daleko v budoucnu) ----------
{
  // V lednu je září (autumn div Hosta) ~243 dní → mimo 150denní horizont → skryto.
  ok(divisionTasksForPin(pin(3, NOW_JAN), hosta, null, NOW_JAN).length === 0, 'horizont: září z ledna >150 dní → skryto');
  // V květnu je duben (spring div Aster) příští rok → ~340 dní → mimo horizont → skryto.
  ok(divisionTasksForPin(pin(3, NOW_MAY), aster, null, NOW_MAY).length === 0, 'horizont: duben z května (příští rok) >150 dní → skryto');
}
// ---------- (6) dedup proti existujícímu dělení / přesazení v okně ----------
{
  const curYear = NOW_MAY.getFullYear();
  const samePresazeni = [{ title: 'Přesadit', task_type: 'presazeni', specific_date: `${curYear}-09-15` }];
  ok(divisionTasksForPin(pin(3, NOW_MAY, samePresazeni), hosta, null, NOW_MAY).length === 0, 'dedup: presazeni v září → potlačeno');
  const sameEmoji = [{ title: '🪴 Rozdělit trs', task_type: 'jine', specific_date: `${curYear}-09-20` }];
  ok(divisionTasksForPin(pin(3, NOW_MAY, sameEmoji), hosta, null, NOW_MAY).length === 0, 'dedup: 🪴 titulek (jine) v září → potlačeno');
  const titleDeleni = [{ title: 'Dělení bohyšky', task_type: 'jine', specific_date: `${curYear}-09-05` }];
  ok(divisionTasksForPin(pin(3, NOW_MAY, titleDeleni), hosta, null, NOW_MAY).length === 0, 'dedup: titulek „dělení" v září → potlačeno');
  const otherMonth = [{ title: '🪴 Rozdělit trs', task_type: 'presazeni', specific_date: `${curYear}-06-10` }];
  ok(divisionTasksForPin(pin(3, NOW_MAY, otherMonth), hosta, null, NOW_MAY).length === 1, 'dedup: dělení v JINÉM měsíci nevadí → návrh svítí');
}

console.log(`\n✅ All ${passed} division-task assertions passed.`);
