// Promeškané sezónní okno — čistě klientská vrstva nad existujícími daty úkolů.
// Sezónní úkon (zastřihni v srpnu, přesaď na podzim) má smysl jen ve svém okně;
// když termín (specific_date) minul o víc, než je sezónní okno daného task_type,
// ukážeme badge „Okno zmeškáno" + nabídku přesunout na příští sezónu / stihnout teď / zrušit.
// Žádné nové endpointy ani schéma — reuse api.snoozeTask / api.deleteTask.
//
// Neduplikuje frost (frost.js řeší blízký mrazivý den u citlivé výsadby; tohle řeší
// dávno propadlý termín). Obě se vzájemně vylučují: mrazové riziko padá do 3denní
// předpovědi, zmeškané okno vyžaduje termín po termínu o > windowDays (min. 14 dní).
import { windowDaysForType } from './data/taskTypes.js';
import { daysFromToday } from './utils.js';

// Stav promeškaného okna pro úkol, nebo null.
// Platí jen pro jednorázové sezónní úkony (specific_date), které jsou po termínu
// o víc dní, než je sezónní okno jejich typu.
export function seasonWindowState(task) {
  if (!task || !task.specific_date) return null;
  if (isCaughtUp(task.id)) return null;
  const ref = task.next_due || task.specific_date;
  const days = daysFromToday(ref);
  if (days === null || days >= 0) return null; // ještě není po termínu
  const overdue = -days;
  const windowDays = windowDaysForType(task.task_type);
  if (overdue <= windowDays) return null; // pořád v okně
  return { overdue, windowDays, nextDate: nextSeasonalDate(task.specific_date) };
}

// Příští budoucí výskyt stejného dne v roce (zachová měsíc = příští sezónní okno).
// V běžném případě (úkon po termínu v rámci roku) = posun o rok dopředu; pro starší
// úkony rovnou skočí na nejbližší budoucí výskyt, ať výsledek není zase v minulosti.
// Date normalizuje 29. 2. v nepřestupném roce na 1. 3.; výstup skládáme z lokálních
// složek (ne toISOString), aby timezone neposunula datum.
export function nextSeasonalDate(iso) {
  if (!iso) return null;
  const [, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!m || !d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let candidate = new Date(today.getFullYear(), m - 1, d);
  candidate.setHours(0, 0, 0, 0);
  if (candidate <= today) candidate = new Date(today.getFullYear() + 1, m - 1, d);
  const yy = candidate.getFullYear();
  const mm = String(candidate.getMonth() + 1).padStart(2, '0');
  const dd = String(candidate.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// Session-paměť „stihnu teď" — uživatel badge zavřel; do reloadu/příště ho neukazuj
// (jinak by overdue úkol badge znovu rozsvítil po každém reloadu listu).
const caughtUp = new Set();
export function markCaughtUp(id) {
  caughtUp.add(id);
}
export function isCaughtUp(id) {
  return caughtUp.has(id);
}
