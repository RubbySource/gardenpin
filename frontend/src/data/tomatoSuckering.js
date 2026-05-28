// Pasínkování rajčat (vylamování zálistků) — letní průběžný úkon 6–9.
// U indeterminovaných (vysoko rostoucích) rajčat je HLAVNÍ průběžný letní úkon
// VYLAMOVAT ZÁLISTKY (boční výhony v úžlabí listu) — pokud zůstanou, rostlina se
// rozdrobí do mnoha větví, plody jsou malé a pozdě dozrávají. Pasínkování posílá
// energii do hlavního stonku a tvorby plodů. Klasický CZ úkon pro venkovní i
// fóliová rajčata.
//
// SEKUNDÁRNÍ úkon v 8 — APICAL PINCH (vyštipnutí vrcholu hlavního stonku) —
// pomůže dozrát zbývajícím plodům před koncem sezóny (rostlina už nepouští novou
// hmotu nahoru, energie jde do existujících plodů).
//
// Tahle vrstva cíleně DOPLŇUJE pinching.js (vyštipování okrasných letniček/trvalek
// 5–6 pro hustší kvetení — JINÝ účel, JINÉ rostliny) a fruitThinning.js (probírka
// mladých plodů na stromech 6 — JINÝ účel). Žádný překryv.
//
// ČISTĚ KLIENTSKÁ vrstva — žádné nové schéma ani endpoint. Měsíc =
// dateForMonth (jeden zdroj pravdy s RecommendedTasks/summerPruning/herbHarvest…)
// → posun dle klim. zóny/expozice (chladnější zóny pozdější vegetace).
// Návrh nikdy do minulosti, horizont 50 dní.
//
// GATE: jen `zelenina`. Ornamentální Salvia / okrasné Solanum (brambor je v DB
// pravděpodobně rovněž `zelenina`, ale species precedence ho vyloučí) padají
// mimo automaticky.
//
// SELEKTOR — DRUH (species) má přednost, protože ve stejném rodu Solanum je
// brambor (S. tuberosum) i lilek (S. melongena) — pasínkování má smysl jen pro
// rajče. Stejně Capsicum (paprika) se NEPASÍNKUJE klasickým způsobem. Volíme
// úzký species-match místo širšího rodu.
//
//   Solanum lycopersicum  → primary window 6 (pasínkování), apical window 8.
//
// Forward-looking: keřová (determinovaná) rajčata typu 'Bush' / 'Roma' / 'Patio'
// se NEPASÍNKUJÍ, ale plantDatabase rozlišení nemá — zatím všechny `Solanum
// lycopersicum` kultivary zahrnujeme a v notes upozorňujeme „pouze pokud
// indeterminovaný typ".
import { dateForMonth } from '../components/RecommendedTasks.jsx';
import { daysFromToday } from '../utils.js';

// Jak daleko dopředu pasínkování / apical pinch nabízíme (dny).
// Krátký horizont — úkon je vázaný na fenologickou fázi (aktivní růst / dozrávání).
export const TOMATO_SUCKERING_HORIZON_DAYS = 50;

const TOMATO_SUCKERING_EMOJI = '🍅';

// Gate — jen kuchyňská zelenina. Po enrichPlant je `category.key === 'zelenina'`
// (raw category string 'vegetables' → CATEGORY_DEFS.vegetables.key 'zelenina').
export const TOMATO_SUCKERING_CATEGORIES = new Set([
  'zelenina',
]);

// DRUH (species) → měsíce klíčových úkonů. Species precedence — protože paprika
// Capsicum se nepasínkuje stejně a brambor Solanum tuberosum vůbec, určující
// je species ne rod.
//   primary = pasínkování (vylamování zálistků) — měsíc 6
//   apical  = vyštípnutí vrcholu pro dozrávání plodů — měsíc 8
export const TOMATO_SUCKERING_SPECIES = {
  'Solanum lycopersicum': { primary: 6, apical: 8 },
};

// enrichPlant nahrazuje category za CATEGORY_DEFS objekt ({key,…}); přijmeme i holý string.
function categoryKey(plant) {
  const c = plant?.category;
  if (!c) return null;
  return typeof c === 'string' ? c : c.key || null;
}

// Vrať pravidlo pasínkování pro rostlinu ({ primary, apical }), nebo null. Jen v
// gate `zelenina` a jen pro Solanum lycopersicum (exact match nebo prefix s mezerou
// pro kultivary).
export function tomatoSuckeringRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (!TOMATO_SUCKERING_CATEGORIES.has(cat)) return null;
  const lat = String(plant.nameLat || '').trim();
  for (const sp in TOMATO_SUCKERING_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return { ...TOMATO_SUCKERING_SPECIES[sp] };
  }
  return null;
}

function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}

// Pin už má v měsíci pasínkování/apical pinch naplánovaný úkon? DVOUFÁZOVÝ dedup —
// `strihani` sám je sdílený s mnoha vrstvami (hedgeTrim/summerPruning/perennialCutback
// /ageTasks/summerRosePruning), samotný task_type by potlačoval i jiné řezy.
// Vyžaduje task_type `strihani` SOUČASNĚ S markerem v titulku
// (pasínkování / zálistk / sucker / tomato...pinch / vrchol...rajč).
function hasTomatoSuckeringInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type !== 'strihani') continue;
    const title = (e.title || '').trim();
    if (/pasínkování|zálistk|sucker|tomato.*pinch|vrchol.*rajč/i.test(title)) return true;
  }
  return false;
}

// Hlavní logika: vrať návrhy pasínkování / apical pinch pro pin (pole 0–2 hintů).
// Nabídne se, je-li rostlina v mapě a sezónní okno je v budoucnu a v horizontu.
// Primary (kind 'primary') a apical (kind 'apical') se posuzují nezávisle — v
// pozdním červnu už primary minulo, ale apical (8) ještě svítí v horizontu 50.
// conditions = pin.garden_conditions (posun termínu). `now` injektovatelné pro test.
export function tomatoSuckeringForPin(pin, plant, conditions, now = new Date()) {
  if (!pin || !plant) return [];
  const rule = tomatoSuckeringRuleForPlant(plant);
  if (!rule) return [];

  const tasks = pin.tasks || [];
  const curYear = now.getFullYear();
  const hints = [];

  for (const kind of ['primary', 'apical']) {
    const month = rule[kind];
    if (!month) continue;
    const suggested = dateForMonth(month, conditions);
    const due = daysFromToday(suggested);
    if (due === null || due < 0 || due > TOMATO_SUCKERING_HORIZON_DAYS) continue;
    const m = monthFromIso(suggested);
    if (hasTomatoSuckeringInMonth(tasks, m, curYear)) continue;
    hints.push({
      kind,
      month: m,
      suggested,
      due,
      taskType: 'strihani',
      emoji: TOMATO_SUCKERING_EMOJI,
    });
  }
  return hints;
}
