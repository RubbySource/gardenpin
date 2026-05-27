// Návazné sezónní úkony — po splnění HLAVNÍHO sezónního úkonu nabídni logické pokračování.
//
// Hlavní sezónní úkony se přirozeně řetězí:
//   - po ŘEZU přijde za pár týdnů PŘIHNOJENÍ (regenerace po řezu, růstová sezóna),
//   - po PŘESAZENÍ / výsadbě ven MULČOVÁNÍ (udrží vláhu) + OCHRANA nové výsadby (na zimu),
//   - po SKLIZNI ovocných PODZIMNÍ/ZIMNÍ ŘEZ.
// Dnes každý navazující úkon plánuje uživatel ručně; tahle vrstva to po splnění nenásilně
// nabídne jedním tapnutím (FollowUpPrompt → api.createTask). Žádné nové schéma.
//
// Kurátorská mapa drží JEN hlavní sezónní návaznosti dle vize — NE zalévání ani micro-tasky.
// `validMonths` = ve kterých měsících má navazující úkon smysl; cílový měsíc (dnešek + offset)
// musí padnout do okna, jinak se návrh nenabídne (např. po letní sklizni nehnojíme do dormance).
//
// Termín = den splnění + offsetDays (relativně, takže respektuje, KDY uživatel úkon reálně
// dokončil — strukturální posun zóny/expozice už byl zapečený v původním termínu).
import { api } from '../api.js';

// fromType (kanonický task_type) → seznam navazujících úkonů (v pořadí priority).
export const TASK_CHAINS = {
  // Řez → přihnojení po řezu (jen růstová sezóna — pozdní hnojení dusíkem škodí).
  strihani: [
    { toType: 'hnojeni', emoji: '🌱', offsetDays: 21, labelKey: 'followUp.actFeedAfterPruning', validMonths: [3, 4, 5, 6, 7] },
  ],
  // Přesazení/výsadba → mulčování (udrží vláhu, mimo zimu) + ochrana nové výsadby (na zimu).
  presazeni: [
    { toType: 'jine', emoji: '🌾', offsetDays: 3, labelKey: 'followUp.actMulchAfterTransplant', validMonths: [3, 4, 5, 6, 7, 8, 9, 10, 11] },
    { toType: 'jine', emoji: '🛡️', offsetDays: 7, labelKey: 'followUp.actProtectAfterTransplant', validMonths: [9, 10, 11] },
  ],
  // Sklizeň (ovocné) → podzimní/zimní řez.
  sklizen: [
    { toType: 'strihani', emoji: '✂️', offsetDays: 30, labelKey: 'followUp.actPruneAfterHarvest', validMonths: [9, 10, 11, 12, 1, 2] },
  ],
};

// Okno (dny) pro dedup proti už existujícímu navazujícímu úkonu na pinu.
const DEDUP_WINDOW_DAYS = 21;

// Dnešek + days → YYYY-MM-DD, skládáno z lokálních složek (timezone-safe jako careHistory.js).
function addDaysISO(base, days) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetweenISO(isoA, isoB) {
  const a = new Date(`${String(isoA).slice(0, 10)}T00:00:00`);
  const b = new Date(`${String(isoB).slice(0, 10)}T00:00:00`);
  return Math.round((a - b) / 86400000);
}

// Pin už navazující úkon naplánovaný má? Téhož typu (ne-'jine') NEBO shoda emoji v titulku
// (mulč/ochrana jsou 'jine' → rozliší je emoji, stejně jako je sází BulkCareModal) v cílovém okně.
function pinHasFollowUp(pinTasks, candidate) {
  if (!pinTasks?.length) return false;
  for (const tk of pinTasks) {
    if (!tk.specific_date) continue;
    if (Math.abs(daysBetweenISO(tk.specific_date, candidate.targetDate)) > DEDUP_WINDOW_DAYS) continue;
    if (candidate.toType !== 'jine' && tk.task_type === candidate.toType) return true;
    if (tk.title && tk.title.includes(candidate.emoji)) return true;
  }
  return false;
}

// Sestav kandidáty pro splněný úkol: termín v platném měsíci. Čistě synchronní (bez fetch).
export function followUpCandidates(task, now = new Date()) {
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

// Vyřeš navazující návrh pro splněný úkol, nebo null. Async = dedup proti pinovým úkolům.
// Vrací první kandidát (dle priority), který pin ještě nemá. Offline (fetch selže) → bez dedup.
export async function resolveFollowUp(task, now = new Date()) {
  const candidates = followUpCandidates(task, now);
  if (!candidates.length) return null;

  let pinTasks = [];
  try {
    const all = await api.listTasks();
    pinTasks = all.filter((tk) => tk.pin_id === task.pin_id);
  } catch {
    pinTasks = []; // offline-first: bez dedup raději nabídnout než nenabídnout
  }

  const pick = candidates.find((c) => !pinHasFollowUp(pinTasks, c));
  if (!pick) return null;
  return {
    fromTaskId: task.id,
    fromTitle: task.title || '',
    pinId: task.pin_id,
    toType: pick.toType,
    emoji: pick.emoji,
    labelKey: pick.labelKey,
    offsetDays: pick.offsetDays,
    targetDate: pick.targetDate,
  };
}
