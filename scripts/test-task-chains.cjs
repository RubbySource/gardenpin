// Sanity test pro „Návazné sezónní úkony — po splnění nabídni logické pokračování".
// (1) Validace kurátorské mapy TASK_CHAINS proti REÁLNÉ taxonomii taskTypes.js
//     (každý fromType/toType existuje, offset > 0, validMonths v 1..12).
// (2) Klientská rozhodovací logika (followUpCandidates / pinHasFollowUp) — věrná replika
//     pure funkcí z frontend/src/data/taskChains.js (api/ESM import chain nejde v čistém node).
// Spuštění: node scripts/test-task-chains.cjs
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
const ok = (cond, msg) => {
  assert.ok(cond, msg);
  passed++;
};

const root = path.join(__dirname, '..');

// ---------- (1) Mapa proti reálné taxonomii ----------
// Validní task_type id parsujeme přímo z taskTypes.js (single source of truth).
const typesSrc = fs.readFileSync(path.join(root, 'frontend/src/data/taskTypes.js'), 'utf8');
const VALID = new Set([...typesSrc.matchAll(/\{\s*id:\s*'([^']+)'/g)].map((m) => m[1]));
ok(VALID.has('strihani') && VALID.has('hnojeni') && VALID.has('presazeni') && VALID.has('sklizen'), 'taskTypes id parsed');

// TASK_CHAINS čteme z reálného souboru (object literal jen s literály → bezpečný eval).
const chainsSrc = fs.readFileSync(path.join(root, 'frontend/src/data/taskChains.js'), 'utf8');
const m = chainsSrc.match(/export const TASK_CHAINS = (\{[\s\S]*?\n\});/);
ok(m, 'TASK_CHAINS literal nalezen v taskChains.js');
const TASK_CHAINS = eval('(' + m[1] + ')'); // eslint-disable-line no-eval

let entryCount = 0;
for (const [fromType, list] of Object.entries(TASK_CHAINS)) {
  ok(VALID.has(fromType), `fromType '${fromType}' existuje v taskTypes`);
  ok(Array.isArray(list) && list.length > 0, `'${fromType}' má aspoň jednu návaznost`);
  for (const c of list) {
    entryCount++;
    ok(VALID.has(c.toType), `toType '${c.toType}' (z '${fromType}') existuje v taskTypes`);
    ok(Number.isInteger(c.offsetDays) && c.offsetDays > 0, `'${fromType}'→'${c.toType}' offset > 0`);
    ok(Array.isArray(c.validMonths) && c.validMonths.length > 0, `'${fromType}'→'${c.toType}' validMonths neprázdné`);
    ok(c.validMonths.every((mm) => Number.isInteger(mm) && mm >= 1 && mm <= 12), `'${fromType}'→'${c.toType}' validMonths v 1..12`);
    ok(typeof c.labelKey === 'string' && c.labelKey.startsWith('followUp.'), `'${fromType}'→'${c.toType}' labelKey v namespace followUp`);
    ok(typeof c.emoji === 'string' && c.emoji.length > 0, `'${fromType}'→'${c.toType}' má emoji`);
  }
}
ok(entryCount >= 4, `mapa má návaznosti (${entryCount})`);

// Každý labelKey musí mít překlad v cs.json (zdroj pravdy i18n).
const cs = JSON.parse(fs.readFileSync(path.join(root, 'frontend/src/locales/cs.json'), 'utf8'));
for (const list of Object.values(TASK_CHAINS)) {
  for (const c of list) {
    const leaf = c.labelKey.split('.')[1];
    ok(cs.followUp && typeof cs.followUp[leaf] === 'string', `cs.json má překlad ${c.labelKey}`);
  }
}

// ---------- (2) Rozhodovací logika (replika pure funkcí) ----------
function addDaysISO(base, days) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function followUpCandidates(task, now) {
  if (!task || task.pin_id == null) return [];
  const chains = TASK_CHAINS[task.task_type];
  if (!chains || !chains.length) return [];
  return chains
    .map((c) => {
      const targetDate = addDaysISO(now, c.offsetDays);
      return { ...c, targetDate, month: Number(targetDate.slice(5, 7)) };
    })
    .filter((c) => c.validMonths.includes(c.month));
}
function daysBetweenISO(a, b) {
  return Math.round((new Date(`${String(a).slice(0, 10)}T00:00:00`) - new Date(`${String(b).slice(0, 10)}T00:00:00`)) / 86400000);
}
function pinHasFollowUp(pinTasks, c) {
  if (!pinTasks || !pinTasks.length) return false;
  for (const tk of pinTasks) {
    if (!tk.specific_date) continue;
    if (Math.abs(daysBetweenISO(tk.specific_date, c.targetDate)) > 21) continue;
    if (c.toType !== 'jine' && tk.task_type === c.toType) return true;
    if (tk.title && tk.title.includes(c.emoji)) return true;
  }
  return false;
}

const pin = { id: 7, pin_id: 7 };
const D = (s) => new Date(s + 'T12:00:00'); // lokální poledne, ať +offset nepřeteče přes půlnoc

// řez v dubnu → hnojení (květen) v okně [3..7]
let cands = followUpCandidates({ ...pin, task_type: 'strihani' }, D('2026-04-15'));
ok(cands.length === 1 && cands[0].toType === 'hnojeni', 'řez(duben)→hnojení nabídnuto');
// řez v září → +21 = říjen, mimo růstové okno → nic
ok(followUpCandidates({ ...pin, task_type: 'strihani' }, D('2026-09-15')).length === 0, 'řez(září)→nic (mimo okno)');

// sklizeň v září → podzimní řez (říjen) v [9..2]
cands = followUpCandidates({ ...pin, task_type: 'sklizen' }, D('2026-09-15'));
ok(cands.length === 1 && cands[0].toType === 'strihani', 'sklizeň(září)→řez nabídnut');
// sklizeň v červnu → +30 = červenec, mimo podzim/zimu → nic
ok(followUpCandidates({ ...pin, task_type: 'sklizen' }, D('2026-06-15')).length === 0, 'sklizeň(červen)→nic');

// přesazení na podzim → mulč i ochrana platné, první = mulč (🌾)
cands = followUpCandidates({ ...pin, task_type: 'presazeni' }, D('2026-10-10'));
ok(cands.length === 2 && cands[0].emoji === '🌾', 'přesazení(podzim)→mulč+ochrana, mulč první');
// přesazení na jaře → jen mulč (ochrana je jen 9–11)
cands = followUpCandidates({ ...pin, task_type: 'presazeni' }, D('2026-05-10'));
ok(cands.length === 1 && cands[0].emoji === '🌾', 'přesazení(jaro)→jen mulč');

// neřetězený typ → nic
ok(followUpCandidates({ ...pin, task_type: 'zalivka' }, D('2026-05-10')).length === 0, 'zálivka→žádná návaznost');
ok(followUpCandidates({ ...pin, task_type: 'jine' }, D('2026-05-10')).length === 0, 'jiné→žádná návaznost');

// Dedup: pin už má hnojení v okně → potlačeno
const feed = followUpCandidates({ ...pin, task_type: 'strihani' }, D('2026-04-15'))[0];
ok(pinHasFollowUp([{ specific_date: '2026-05-09', task_type: 'hnojeni', title: '🌱 Přihnojit' }], feed), 'dedup: hnojení v okně potlačí návrh');
ok(!pinHasFollowUp([{ specific_date: '2026-07-01', task_type: 'hnojeni', title: '🌱 Přihnojit' }], feed), 'dedup: hnojení mimo okno nepotlačí');
// Dedup pro 'jine' (mulč) běží přes emoji, ne typ
const mulch = followUpCandidates({ ...pin, task_type: 'presazeni' }, D('2026-10-10'))[0];
ok(pinHasFollowUp([{ specific_date: '2026-10-12', task_type: 'jine', title: '🌾 Namulčovat' }], mulch), 'dedup: mulč dle emoji 🌾');
ok(!pinHasFollowUp([{ specific_date: '2026-10-12', task_type: 'jine', title: '🛡️ Ochránit' }], mulch), 'dedup: jiné jine (🛡️) mulč nepotlačí');

console.log(`✅ test-task-chains: ${passed} asercí prošlo`);
