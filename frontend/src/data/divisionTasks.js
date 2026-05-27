// Dělení trvalek a okrasných trav dle cyklu — omlazení trsu po N letech.
// Trvalky a okrasné trávy po několika letech zhušťují trs, ztrácí kvetení a vykvétají
// jen do okraje — HLAVNÍ sezónní úkon je ROZDĚLENÍ trsu každých N let (vyrýt / rozdělit /
// znovu zasadit), ne řez. Tahle vrstva cíleně DOPLŇUJE data/ageTasks.js, který řeší jen
// řez DŘEVIN (keře/ovoce/stromy/popínavé) a bylinné trvalky/trávy záměrně vyřadil.
//
// ČISTĚ KLIENTSKÁ vrstva nad existujícím pins.planting_date — žádné nové schéma ani
// endpoint; chybí-li/neplatné datum → hint se skryje. Věk počítá reuse ageInYears
// z ageTasks.js (jeden zdroj pravdy pro věk, timezone-safe). Termín = dateForMonth
// (posun klim. zóny/expozice/výšky — jeden zdroj pravdy s RecommendedTasks/YearPlanModal).
//
// Měsíc dělení se odvozuje DLE DOBY KVĚTU (aby měl trs celou sezónu zakořenit):
//   - jarní / letní kvetoucí trvalky → dělit NA PODZIM (po odkvětu, září),
//   - podzimní kvetoucí trvalky + VŠECHNY okrasné trávy → BRZY ZJARA (duben).
// Bulbs (cibuloviny) záměrně VYŘAZENY: pravé cibuloviny (tulipány/narcisy) se nedělí
// jako trs, ale oddělují cibulkové odnože — jiný úkon mimo scope této vrstvy.
import { daysFromToday } from '../utils.js';
import { dateForMonth } from '../components/RecommendedTasks.jsx';
import { ageInYears } from './ageTasks.js';

// Jak daleko dopředu dělení nabízíme (dny). Dělení je sezónní (roční) — surface
// nadcházející okno s rozumným předstihem, ne celoročně.
export const DIVISION_HORIZON_DAYS = 150;

const DIVIDE_EMOJI = '🪴';

// Pravidla dělení trsu per kategorie (klíč = enrichPlant `category.key`, čes.).
//   period    = perioda dělení (CELÉ roky),
//   firstYear = nejdřívější věk, kdy dělení nabídneme (po zakořenění, ne výsadbový rok),
//   bloomAware = true → měsíc dělení dle doby květu (viz AUTUMN_BLOOM_GENERA);
//                false → vždy fixedMonth (trávy se dělí jen brzy zjara).
//   autumnMonth / springMonth / fixedMonth = sezónní okno (dělení dřímající rostliny).
export const DIVISION_RULES = {
  // Trvalky — trs se dělí à 4 roky od 3. roku. Měsíc dle doby květu: jarní/letní kvetoucí
  // dělíme na podzim (po odkvětu), podzimní kvetoucí brzy zjara (ať stihnou zakořenit).
  trvalky: { period: 4, firstYear: 3, bloomAware: true, autumnMonth: 9, springMonth: 4 },
  // Okrasné trávy — dělit à 4 roky od 4. roku, VŽDY brzy zjara (teplomilné trsnaté trávy
  // rašící pozdě se dělí, až když začnou obrážet — podzimní dělení špatně zakoření).
  travy: { period: 4, firstYear: 4, bloomAware: false, fixedMonth: 4 },
};

// Rody trvalek, které kvetou v pozdním létě / na podzim → dělit BRZY ZJARA (ne na podzim).
// Standardní zahradnické pravidlo: jarní/letní kvetoucí dělíme na podzim, pozdní/podzimní
// zjara. Rod = první slovo nameLat (jako cropRotation.genusOf).
const AUTUMN_BLOOM_GENERA = new Set([
  'Aster', 'Symphyotrichum',  // astry
  'Chrysanthemum', 'Dendranthema',  // chryzantémy
  'Sedum', 'Hylotelephium',  // vysoké podzimní rozchodníky (Herbstfreude, spectabile)
  'Anemone',  // sasanka japonská/podzimní (jarní sasanky jsou cibuloviny)
  'Solidago',  // zlatobýl
  'Helenium',  // záplevák
  'Rudbeckia',  // třapatka (kvete srpen–mráz)
  'Echinacea',  // třapatka nachová (dělit zjara, špatně snáší podzimní dělení)
  'Helianthus',  // slunečnice hlíznatá / vytrvalá
]);

// enrichPlant nahrazuje category za CATEGORY_DEFS objekt ({key,…}); přijmeme i holý
// string (neobohacený záznam) → vrátíme klíč použitelný do DIVISION_RULES.
function categoryKey(plant) {
  const c = plant?.category;
  if (!c) return null;
  return typeof c === 'string' ? c : c.key || null;
}

// Rod = první slovo latinského názvu.
function genusOf(plant) {
  const lat = String(plant?.nameLat || '').trim();
  if (!lat) return null;
  return lat.split(/\s+/)[0] || null;
}

function isAutumnBloomer(plant) {
  const genus = genusOf(plant);
  return genus ? AUTUMN_BLOOM_GENERA.has(genus) : false;
}

// Měsíc dělení dle pravidla + doby květu rostliny.
function divisionMonth(rule, plant) {
  if (!rule.bloomAware) return rule.fixedMonth;
  return isAutumnBloomer(plant) ? rule.springMonth : rule.autumnMonth;
}

function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}

// Pin už má v daném měsíci (letos / opakovaně) úkon dělení / přesazení? Širší dedup
// v duchu ageTasks.hasPruningInMonth: potlač, má-li pin v cílovém měsíci task_type
// 'presazeni' NEBO titulek s 🪴 / „dělení" (sezónní přesazení s task_type 'jine'),
// ať dělící nudge nezdvojí, co už v okně je.
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

// Hlavní logika: vrať návrh dělení trsu pro pin (pole 0–1 hintů, kvůli parity s
// ageTasks/careGap kartami). Nabídne se, je-li věk ≥ firstYear, padne na periodu
// ((věk − firstYear) % period === 0) a sezónní okno je v horizontu. Kategorie mimo
// mapu (dřeviny, cibuloviny, zelenina…) → []; chybí-li planting_date → [].
// conditions = pin.garden_conditions (posun termínu). `now` injektovatelné pro test.
export function divisionTasksForPin(pin, plant, conditions, now = new Date()) {
  if (!pin || !plant) return [];
  const rule = DIVISION_RULES[categoryKey(plant)];
  if (!rule) return [];
  const age = ageInYears(pin.planting_date, now);
  if (age === null || age < rule.firstYear) return [];
  if ((age - rule.firstYear) % rule.period !== 0) return [];

  const month = divisionMonth(rule, plant);
  const suggested = dateForMonth(month, conditions);
  const due = daysFromToday(suggested);
  if (due === null || due < 0 || due > DIVISION_HORIZON_DAYS) return [];

  const m = monthFromIso(suggested);
  if (hasDivisionInMonth(pin.tasks || [], m, now.getFullYear())) return [];

  const season = rule.bloomAware && !isAutumnBloomer(plant) ? 'autumn' : 'spring';
  return [{
    kind: 'division',
    age,
    suggested,
    due,
    month: m,
    season,
    taskType: 'presazeni',
    emoji: DIVIDE_EMOJI,
  }];
}
