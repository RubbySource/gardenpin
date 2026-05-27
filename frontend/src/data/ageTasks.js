// Věkově citlivé sezónní úkony — řez dle STÁŘÍ rostliny (ne jen měsíce).
// Některé HLAVNÍ sezónní úkony (řez) závisí na věku dřeviny:
//   - výchovný řez mladých keřů/stromů v prvních letech po výsadbě (buduje tvar/korunu),
//   - omlazovací řez starých keřů po N letech (prosvětlí, zmladí),
//   - guard „neřezat první rok po výsadbě" (nech zakořenit).
// Appka eviduje pins.planting_date → odvodíme věk v celých letech. Čistě klientská vrstva
// (žádné nové schéma); chybí-li/neplatné planting_date, hint se skryje.
//
// Kurátorská mapa jen pro DŘEVINY, kde stáří reálně mění řez (keře/ovoce/stromy/popínavé).
// Trvalky, cibuloviny, trávy, jehličnany, zelenina, letničky… věkový strukturální řez
// nemají → nejsou v mapě (vyřazeny přirozeně tím, že jejich kategorie chybí).
//
// Termín řezu = dateForMonth(month, conditions) → posun dle klim. zóny/expozice/výšky
// (jeden zdroj pravdy s RecommendedTasks/YearPlanModal). Dedup proti existujícímu řezu
// ve stejném okně (i sezónnímu „jarnímu řezu", který má task_type 'jine').
import { daysFromToday } from '../utils.js';
import { dateForMonth } from '../components/RecommendedTasks.jsx';

// Jak daleko dopředu věkový nudge nabízíme (dny). Řez je sezónní (roční) — surface
// nadcházející okno s rozumným předstihem, ne celoročně (jinak v létě svítí příští jaro).
export const AGE_HORIZON_DAYS = 150;

const PRUNE_EMOJI = '✂️';

// Pravidla věkového řezu per kategorie (klíč = enrichPlant `category.key`, čes.).
//   kind:
//     'guard'        = informační „1. rok po výsadbě — neřež" (bez tlačítka, bez data)
//     'formative'    = výchovný řez mladé dřeviny → akce
//     'rejuvenation' = omlazovací řez staré dřeviny → akce, opakuje se à everyYears
//   minAge/maxAge = inkluzivní rozsah věku v CELÝCH letech od výsadby (0 = výsadbový rok),
//                   maxAge vynechán u rejuvenation (otevřený horní konec).
//   everyYears = perioda omlazovacího řezu (platí ve věku minAge, minAge+every, …).
//   month = sezónní okno (řez dřevin = pozdní zima / brzké jaro, dokud rostlina spí).
export const AGE_RULES = {
  // Okrasné keře — 1. rok zakořenit; roky 1–3 výchovný řez; rok 6+ omlazovací à 3 roky.
  kere: [
    { kind: 'guard', minAge: 0, maxAge: 0 },
    { kind: 'formative', minAge: 1, maxAge: 3, month: 3 },
    { kind: 'rejuvenation', minAge: 6, everyYears: 3, month: 3 },
  ],
  // Ovoce (keře i stromky) — výsadbový rok být; roky 1–4 výchovný řez (zakládá plodnost);
  // staré rok 8+ omlazovací à 3 roky (pozdní zima).
  ovoce: [
    { kind: 'guard', minAge: 0, maxAge: 0 },
    { kind: 'formative', minAge: 1, maxAge: 4, month: 3 },
    { kind: 'rejuvenation', minAge: 8, everyYears: 3, month: 2 },
  ],
  // Stromy — 1. rok zakořenit; roky 2–5 výchovný řez koruny; pak jen udržovací
  // (žádný pravidelný omlazovací řez — staré stromy se zmlazovat nemají).
  stromy: [
    { kind: 'guard', minAge: 0, maxAge: 0 },
    { kind: 'formative', minAge: 2, maxAge: 5, month: 3 },
  ],
  // Popínavé dřeviny — roky 1–3 výchovný řez (vést na oporu); rok 7+ omlazovací à 4 roky.
  popinave: [
    { kind: 'formative', minAge: 1, maxAge: 3, month: 3 },
    { kind: 'rejuvenation', minAge: 7, everyYears: 4, month: 3 },
  ],
};

// enrichPlant nahrazuje category za CATEGORY_DEFS objekt ({key,label,…}); přijmeme i holý
// string (neobohacený záznam) → vrátíme klíč použitelný do AGE_RULES.
function categoryKey(plant) {
  const c = plant?.category;
  if (!c) return null;
  return typeof c === 'string' ? c : c.key || null;
}

// Celé roky od výsadby k `now`. 0 = ve výsadbovém roce (výroční den ještě nebyl).
// null = chybějící/neplatné planting_date nebo datum v budoucnu. Skládáno z lokálních
// složek (timezone-safe — jako ostatní moduly).
export function ageInYears(plantingDate, now = new Date()) {
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

// Platí pravidlo pro daný věk?
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

// Pin už má v daném měsíci (letos / opakovaně) řezový úkon — emoji ✂️ nebo task_type
// 'strihani'? Širší dedup než RecommendedTasks.isTaskAlreadyAdded: pokryje i sezónní
// „jarní řez" (ten má task_type 'jine', ale titulek začíná ✂️), aby věkový nudge
// nezdvojil řez, který už v okně je.
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

// Hlavní logika: vrať věkově citlivé hinty pro pin (guard + akce řezu). guard první
// (informační), pak akce dle navrženého data vzestupně. plant.category řídí výběr
// pravidel; chybí-li planting_date nebo kategorie není dřevina v mapě → [].
// conditions = pin.garden_conditions (posun termínu). `now` injektovatelné pro test.
export function ageTasksForPin(pin, plant, conditions, now = new Date()) {
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
    const suggested = dateForMonth(rule.month, conditions);
    const due = daysFromToday(suggested);
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
