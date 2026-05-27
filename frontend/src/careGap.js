// Detektor mezer v péči — „loni ano, letos chybí". Čistě klientská vrstva nad agregovanou
// care_history (endpoint /api/care-history/doy, sdílený s careHistory.js). Zatímco
// careHistory.js POSOUVÁ termín EXISTUJÍCÍHO úkolu na „tvůj" den, tahle vrstva najde
// hlavní sezónní úkon, který uživatel LONI reálně splnil, ale LETOS ho nemá nikde
// (ani naplánovaný, ani splněný) — a jeho loňský den v roce je ještě v budoucnu.
//
// Žádné nové schéma ani endpoint. Pro každý pin porovnáme množinu akcí splněných loni
// (curYear-1) proti tomu, co pin letos plánuje / splnil; chybějící akce s budoucím
// loňským dnem se nabídne jako „mezera" s tlačítkem Naplánovat (api.createTask).
//
// FILTR „hlavní sezónní akce": akce nese v titulku care emoji (care_history.action =
// task.title). Bereme jen emoji z kurátorského BULK_CATEGORIES (✂️🌱🪴🛡️🌾🧺🐛 —
// jeden zdroj pravdy s BulkCareModal), čímž přirozeně vyřadíme zálivku 💧, plení 🌿
// i dlouhý chvost (🪵🥒…). task_type se odvodí z téhož mapování (ne natvrdo 'jine').
//
// DEDUP: stejná logika jako pinAlreadyHas (BulkCareModal) — měsíc + task_type/titulek —
// plus širší pojistka „stejný titulek naplánovaný kdekoliv letos / opakovaný úkol".
import { daysFromToday } from './utils.js';
import { BULK_CATEGORIES, pinAlreadyHas, monthFromIso } from './components/BulkCareModal.jsx';

// Jak daleko dopředu mezeru nabízíme. Loňský den v budoucnu, ale ne dřív než ~4 měsíce
// předem — ať nudge přijde s rozumným předstihem, ne celoročně.
export const GAP_HORIZON_DAYS = 120;

// Care emoji → kurátorská kategorie (task_type). Jeden zdroj pravdy s BulkCareModal.
const EMOJI_CAT = new Map();
for (const c of BULK_CATEGORIES) for (const em of c.emojis) EMOJI_CAT.set(em, c);

// Den v roce (1–366) → YYYY-MM-DD daného roku, skládáno z lokálních složek (jako
// careHistory.js/seasonWindow.js) → timezone neposune výsledek.
function doyToISO(year, doy) {
  const d = new Date(year, 0, 1);
  d.setDate(doy);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Titulek akce (care_history.action) → kategorie hlavního sezónního úkonu dle vedoucího
// care emoji, nebo null (zálivka / micro-task / neznámé emoji → vyřadit).
export function mainSeasonalCategory(action) {
  if (!action) return null;
  for (const [em, cat] of EMOJI_CAT) {
    if (action.startsWith(em)) return { emoji: em, taskType: cat.taskType };
  }
  return null;
}

// Pin už tutéž akci letos řeší? (širší pojistka nad pinAlreadyHas, která matchuje jen
// na cílový měsíc): opakovaný úkol stejného titulku, NEBO jednorázový se specific_date/
// next_due v letošním roce.
function plannedThisYear(pinTasks, action, curYear) {
  const al = action.toLowerCase();
  for (const e of pinTasks || []) {
    const tl = (e.title || '').toLowerCase();
    if (!tl) continue;
    if (!(tl.includes(al) || al.includes(tl))) continue;
    if (e.frequency_days) return true; // opakovaný úkol pokrývá akci každý rok
    const y = Number(String(e.specific_date || e.next_due || '').slice(0, 4));
    if (y === curYear) return true;
  }
  return false;
}

// Hlavní logika: vrať pole mezer pro pin (seřazeno dle navrženého data vzestupně).
// lookup = Map z useCareHistory (`${pin_id} ${action}` → { pin_id, action, years }).
// conditions = pin.garden_conditions (pro dedup pinAlreadyHas). `now` injektovatelné pro test.
export function careGapsForPin(pinId, pinTasks, lookup, conditions, now = new Date()) {
  if (!lookup || pinId == null) return [];
  const curYear = now.getFullYear();
  const gaps = [];
  for (const entry of lookup.values()) {
    if (Number(entry.pin_id) !== Number(pinId) || !Array.isArray(entry.years)) continue;
    // Musel proběhnout LONI (curYear-1) — to je jádro „loni ano".
    const lastYear = entry.years.find((y) => Number(y.year) === curYear - 1);
    if (!lastYear || !Number.isFinite(Number(lastYear.doy))) continue;
    // Letos už splněno → není mezera.
    if (entry.years.some((y) => Number(y.year) === curYear)) continue;
    // Jen hlavní sezónní akce (vyřaď zálivku / micro-tasky / neznámá emoji).
    const cat = mainSeasonalCategory(entry.action);
    if (!cat) continue;

    const doy = Math.round(Number(lastYear.doy));
    const suggested = doyToISO(curYear, doy);
    const due = daysFromToday(suggested);
    // Loňský den musí být ještě v budoucnu (nepropásnuté okno) a v rozumném horizontu.
    if (due === null || due < 0 || due > GAP_HORIZON_DAYS) continue;

    const month = monthFromIso(suggested);
    if (pinAlreadyHas(pinTasks, entry.action, month, cat.taskType, conditions)) continue;
    if (plannedThisYear(pinTasks, entry.action, curYear)) continue;

    gaps.push({
      action: entry.action,        // celý titulek vč. emoji (= care_history.action)
      emoji: cat.emoji,
      taskType: cat.taskType,
      suggested,                   // YYYY-MM-DD letošního roku (= loňský den)
      due,
      month,
    });
  }
  gaps.sort((a, b) => a.due - b.due);
  return gaps;
}
