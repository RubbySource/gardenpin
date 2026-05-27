// Sestřižení trvalek a okrasných trav — sezónní seříznutí odumřelé nadzemní části.
// Každoroční HLAVNÍ sezónní úkon u trvalek a okrasných trav: SESTŘIHNOUT odumřelou
// nadzemní část. Okrasné trávy a strukturní pozdně kvetoucí trvalky se nechávají PŘES ZIMU
// (zimní silueta + ochrana báze před mrazem) a stříhají se BRZY ZJARA (3) těsně před rašením;
// měkké trvalky bez zimní hodnoty (bohyška, kakost, čechrava…) lze seříznout NA PODZIM (10)
// po zatažení.
//
// Tahle vrstva cíleně DOPLŇUJE data/divisionTasks.js (ten DĚLÍ trs každých N let) i
// data/ageTasks.js (ŘEŽE jen DŘEVINY dle stáří) — tohle je KAŽDOROČNÍ seříznutí byliny, ne
// dělení trsu ani řez dřeviny, žádný překryv. Úkon je ROČNÍ (nezávislý na stáří → bez
// ageInYears), proto stačí pin + plant + conditions.
//
// ČISTĚ KLIENTSKÁ vrstva — žádné nové schéma ani endpoint. Termín = dateForMonth(month,
// conditions) → posun dle klim. zóny/expozice/výšky (jeden zdroj pravdy s RecommendedTasks/
// division…; v chladnějších zónách později). Nabídne se jen je-li okno v BUDOUCNU a v horizontu
// (~120 dní), jinak se skryje — „mimo sezónu → []" je tak přirozený důsledek future+horizont
// kontroly (stejný model jako divisionTasks; návrh nikdy do minulosti).
import { daysFromToday } from '../utils.js';
import { dateForMonth } from '../components/RecommendedTasks.jsx';

// Jak daleko dopředu sestřih nabízíme (dny). Sestřih je sezónní (roční) — surface nadcházející
// okno s rozumným předstihem, ne celoročně.
export const CUTBACK_HORIZON_DAYS = 120;

const CUTBACK_EMOJI = '✂️';

// Sezónní okna sestřihu (kotva 15. dne měsíce, posunutá dateForMonth dle podmínek):
//   spring = brzy zjara, těsně před rašením (po přezimování se zimní siluetou),
//   autumn = na podzim po zatažení (měkké trvalky bez zimní hodnoty).
const SPRING_MONTH = 3;
const AUTUMN_MONTH = 10;

// Kategorie, kterých se každoroční sestřih týká (klíč = enrichPlant `category.key`, čes.).
// Dřeviny (keře/ovoce/stromy/popínavé — řez řeší ageTasks), cibuloviny i zelenina → mimo.
const CUTBACK_CATEGORIES = new Set(['trvalky', 'travy']);

// Rody trvalek se ZIMNÍ HODNOTOU (strukturní pozdně/podzimně kvetoucí, pevné semeníky) → nechej
// přes zimu a sestřihni BRZY ZJARA. Diskriminátor v duchu divisionTasks.AUTUMN_BLOOM_GENERA — NE
// tvrdý selektor (gate je kategorie), takže forward-looking rody, které ještě nejsou v DB
// (Aster/Solidago…), jsou záměrné a neškodné. Rod = první slovo nameLat (jako cropRotation.genusOf).
// VŠECHNY okrasné trávy (kategorie `travy`) jdou zjara vždy — grass rody jsou tu jen dokumentačně.
export const SPRING_CUTBACK_GENERA = new Set([
  // strukturní pozdně/podzimně kvetoucí trvalky (pevné semeníky, zimní silueta)
  'Aster', 'Symphyotrichum',   // astry (forward-looking — pevné trsy přes zimu)
  'Sedum', 'Hylotelephium',    // vysoké podzimní rozchodníky (Herbstfreude, spectabile)
  'Rudbeckia',                 // třapatka (semeníky drží přes zimu)
  'Echinacea',                 // třapatka nachová (semeníky pro ptáky, dělí/stříhá zjara)
  'Solidago',                  // zlatobýl (forward-looking)
  'Helenium',                  // záplevák (forward-looking)
  'Helianthus',                // slunečnice vytrvalá (forward-looking)
  'Chrysanthemum', 'Dendranthema', // chryzantémy (forward-looking)
  'Anemone',                   // sasanka podzimní (forward-looking)
  // okrasné trávy — kategorie `travy` je nutí zjara nezávisle; uvedeny pro dokumentaci
  'Miscanthus', 'Calamagrostis', 'Pennisetum', 'Panicum', 'Molinia', 'Stipa',
  'Deschampsia', 'Festuca', 'Carex', 'Helictotrichon', 'Juncus',
]);

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

// Sezóna sestřihu pro rostlinu: 'spring' (zimní hodnota — nechej přes zimu) nebo 'autumn'
// (měkká trvalka bez zimní hodnoty). Trávy VŽDY zjara (rašící trsy chrání báze i zimní silueta).
export function cutbackSeasonForPlant(plant) {
  const cat = categoryKey(plant);
  if (cat === 'travy') return 'spring';
  if (cat === 'trvalky') {
    const genus = genusOf(plant);
    return genus && SPRING_CUTBACK_GENERA.has(genus) ? 'spring' : 'autumn';
  }
  return null; // mimo gate
}

function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}

// Pin už má v měsíci sestřihu (letos / opakovaně) naplánovaný řez/sestřih? ŠIRŠÍ dedup
// (v duchu divisionTasks.hasDivisionInMonth): potlač, má-li pin v cílovém měsíci task_type
// 'strihani' NEBO titulek se „sestřih"/„seříz" — sestřih je řez, takže existující strihani
// v okně značí stejný úmysl. Marker zachytí i vlastní slovesný titulek („Sestřihnout" → „sestřih").
function hasCutbackInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type === 'strihani') return true;
    const title = (e.title || '').trim();
    if (/sestřih|seříz/i.test(title)) return true;
  }
  return false;
}

// Hlavní logika: vrať návrh sestřihu pro pin (pole 0–1 hintů, kvůli paritě se sourozeneckými
// kartami). Nabídne se, je-li rostlina v gate (trvalky/travy) a sezónní okno (dle typu/květu)
// je v budoucnu a v horizontu. Mimo gate (dřeviny, cibuloviny, zelenina…) / chybějící rostlina
// → []. conditions = pin.garden_conditions (posun termínu). `now` injektovatelné pro test.
export function perennialCutbackForPin(pin, plant, conditions, now = new Date()) {
  if (!pin || !plant) return [];
  if (!CUTBACK_CATEGORIES.has(categoryKey(plant))) return [];
  const season = cutbackSeasonForPlant(plant);
  if (!season) return [];

  const month = season === 'spring' ? SPRING_MONTH : AUTUMN_MONTH;
  const suggested = dateForMonth(month, conditions); // okno sestřihu (posun zóny)
  const due = daysFromToday(suggested);
  if (due === null || due < 0 || due > CUTBACK_HORIZON_DAYS) return [];

  const m = monthFromIso(suggested);
  if (hasCutbackInMonth(pin.tasks || [], m, now.getFullYear())) return [];

  return [{
    kind: 'cutback',
    season,
    month: m,
    suggested,
    due,
    taskType: 'strihani',
    emoji: CUTBACK_EMOJI,
  }];
}
