// Předjarní výsev do předpěstování — kdy vysít DOVNITŘ zpětně od výsadby ven.
// U teplomilné zeleniny a letniček (rajče, paprika, okurka, dýně, aksamitník…) je PRVNÍ
// hlavní úkon sezóny PŘEDPĚSTOVÁNÍ ze semene v truhlíku — týdny PŘED výsadbou ven
// „po zmrzlých". Appka dnes generuje až venkovní výsadbu; tahle vrstva dopočítá datum
// výsevu DOVNITŘ zpětně dle klimatické zóny (pozdější mráz v horách = pozdější výsev).
//
// ČISTĚ KLIENTSKÁ vrstva nad existujícími daty — žádné nové schéma ani endpoint. Datum
// výsadby ven = dateForMonth(plantMonth, conditions) → posun dle klim. zóny/expozice/výšky
// (jeden zdroj pravdy s RecommendedTasks/ageTasks/divisionTasks); od něj odečteme leadWeeks
// → datum výsevu dovnitř. Nabídne se jen je-li výsev v BUDOUCNU a v horizontu (~90 dní,
// brzké jaro) — mimo výsevní sezónu i mimo kategorie zelenina/letnicky se skryje.
//
// Matchování přes DRUH (genus + species) nebo ROD (první slovo nameLat), DRUH má přednost
// (jako winterPrep): tentýž rod mívá předpěstované i přímo seté členy — Allium porrum
// (pórek) se předpěstovává, Allium cepa (cibule ze sazečky) / sativum (česnek) ne; Solanum
// lycopersicum i melongena se předpěstovávají, ale s jiným předstihem. Přímo seté plodiny
// (mrkev/ředkvička/hrách/fazole/špenát) v mapě záměrně NEJSOU → vrátí [].
import { dateForMonth } from '../components/RecommendedTasks.jsx';
import { daysFromToday } from '../utils.js';

// Jak daleko dopředu výsev nabízíme (dny). Výsev je sezónní (brzké jaro) — surface
// nadcházející okno s rozumným předstihem, ne celoročně.
export const SOWING_HORIZON_DAYS = 90;

const SOW_EMOJI = '🌱';

// Předpěstování per DRUH (genus + species) — pro rody se smíšenými členy (předpěstované
// vs. přímo seté / ze sazečky). Klíč matchuje i kultivary („… 'San Marzano'").
//   leadWeeks  = o kolik týdnů PŘED výsadbou ven vyset do truhlíku,
//   plantMonth = měsíc výsadby ven (po mrazech) — od něj počítáme zpět.
export const SOWING_LEAD_SPECIES = {
  'Solanum lycopersicum': { leadWeeks: 7, plantMonth: 5 }, // rajče — výsev konec března
  'Solanum melongena':    { leadWeeks: 8, plantMonth: 5 }, // lilek — pomalejší, dříve
  'Allium porrum':        { leadWeeks: 8, plantMonth: 5 }, // pórek (cibule/česnek se předpěstovávat nemají)
  'Brassica oleracea':    { leadWeeks: 5, plantMonth: 4 }, // zelnaté (brokolice/květák/zelí/kedlubna/kapusta/kale) — chladuvzdorné, ven dřív
  'Lactuca sativa':       { leadWeeks: 4, plantMonth: 4 }, // salát — předpěstování = dřívější sklizeň
};

// Předpěstování per ROD — rody, jejichž všichni členové v DB se předpěstovávají.
export const SOWING_LEAD_GENERA = {
  // teplomilná zelenina
  Capsicum:    { leadWeeks: 9, plantMonth: 5 }, // paprika — nejpomalejší, výsev začátek března
  Cucumis:     { leadWeeks: 3, plantMonth: 5 }, // okurka — krátký předstih (nesnáší přesazení staré)
  Cucurbita:   { leadWeeks: 4, plantMonth: 5 }, // dýně / cuketa / tykev
  Lagenaria:   { leadWeeks: 4, plantMonth: 5 }, // tykev lahvová
  Apium:       { leadWeeks: 9, plantMonth: 5 }, // celer — velmi dlouhé předpěstování
  Zea:         { leadWeeks: 3, plantMonth: 5 }, // kukuřice cukrová — náskok pro krátkou sezónu
  // letničky (předpěstované ze semene)
  Tagetes:     { leadWeeks: 7, plantMonth: 5 }, // aksamitník
  Callistephus:{ leadWeeks: 6, plantMonth: 5 }, // astra čínská
  Petunia:     { leadWeeks: 10, plantMonth: 5 }, // petúnie / surfinie — pomalá, drobné semeno
  Zinnia:      { leadWeeks: 5, plantMonth: 5 }, // zinie
  Verbena:     { leadWeeks: 8, plantMonth: 5 }, // verbena
};
// Pozn.: rody jako Lobelia (lobelka) jsou v plantDatabase u běžného názvu navázané na
// LEGACY záznam mimo letničky (Lobelka → cibuloviny, Petúnie → okrasné) — findPlantByName
// vrací první (nízké id), takže by se přes kategorii-gate stejně nenabídly. Petunia tu
// zůstává, protože „Surfinie" (letnička) ji aktivuje; Lobelia by byla mrtvé pravidlo.

// Kategorie, kde výsev do předpěstování dává smysl (jednoleté plodiny). Trvalky/dřeviny
// se nepředpěstovávají ze semene v truhlíku → mimo scope.
const SOWING_CATEGORIES = new Set(['zelenina', 'letnicky']);

// enrichPlant nahrazuje category za CATEGORY_DEFS objekt ({key,…}); přijmeme i holý string.
function categoryKey(plant) {
  const c = plant?.category;
  if (!c) return null;
  return typeof c === 'string' ? c : c.key || null;
}

// Rod = první slovo latinského názvu.
function genusOf(plant) {
  const lat = String(plant?.nameLat || '').trim();
  return lat ? lat.split(/\s+/)[0] || null : null;
}

// Vrať pravidlo předpěstování pro rostlinu (DRUH má přednost před RODEM), nebo null.
// Jen pro kategorie zelenina/letnicky — jinde se nepředpěstovává.
export function sowingLeadForPlant(plant) {
  if (!plant) return null;
  if (!SOWING_CATEGORIES.has(categoryKey(plant))) return null;
  const lat = String(plant.nameLat || '').trim();
  for (const sp in SOWING_LEAD_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return SOWING_LEAD_SPECIES[sp];
  }
  const genus = genusOf(plant);
  if (genus && SOWING_LEAD_GENERA[genus]) return SOWING_LEAD_GENERA[genus];
  return null;
}

// Bezpečné přičtení dnů k YYYY-MM-DD přes UTC (ať timezone neposune datum).
function addDays(iso, n) {
  const [y, m, d] = String(iso).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}

// Pin už má v měsíci výsevu (letos / opakovaně) naplánovaný výsev? Dedup v duchu
// divisionTasks.hasDivisionInMonth: potlač, má-li pin v cílovém měsíci task_type
// 'presazeni' NEBO titulek s 🌱 / „výsev"/„vysít"/„předpěst" (sezónní výsev s task_type
// 'jine'), ať výsevní nudge nezdvojí, co už v okně je.
function hasSowingInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type === 'presazeni') return true;
    const title = (e.title || '').trim();
    if (title.startsWith(SOW_EMOJI) || /vys(ít|et|ev)|výsev|předpěst/i.test(title)) return true;
  }
  return false;
}

// Hlavní logika: vrať návrh výsevu do předpěstování pro pin (pole 0–1 hintů, kvůli paritě
// s ageTasks/divisionTasks kartami). Nabídne se, je-li rostlina v mapě předpěstování,
// datum výsevu (= výsadba ven − leadWeeks) je v budoucnu a v horizontu. Kategorie mimo
// zelenina/letnicky / přímo setá plodina / chybějící rostlina → [].
// conditions = pin.garden_conditions (posun termínu). `now` injektovatelné pro test.
export function sowingTaskForPin(pin, plant, conditions, now = new Date()) {
  if (!pin || !plant) return [];
  const rule = sowingLeadForPlant(plant);
  if (!rule) return [];

  const plantDate = dateForMonth(rule.plantMonth, conditions); // výsadba ven (posun zóny)
  const suggested = addDays(plantDate, -rule.leadWeeks * 7);    // výsev dovnitř zpětně
  const due = daysFromToday(suggested);
  if (due === null || due < 0 || due > SOWING_HORIZON_DAYS) return [];

  const m = monthFromIso(suggested);
  if (hasSowingInMonth(pin.tasks || [], m, now.getFullYear())) return [];

  return [{
    kind: 'sowing',
    leadWeeks: rule.leadWeeks,
    plantMonth: rule.plantMonth,
    plantDate,
    suggested,
    due,
    month: m,
    taskType: 'presazeni',
    emoji: SOW_EMOJI,
  }];
}
