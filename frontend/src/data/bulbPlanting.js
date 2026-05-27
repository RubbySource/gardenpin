// Podzimní výsadba jarních cibulovin — kdy zasadit tulipány, narcisy, krokusy.
// U jarně kvetoucích cibulovin (tulipán, narcis, krokus, hyacint, modřenec, okrasný
// česnek/Allium, řebčík, sněženka, ladoňka…) je úplně PRVNÍ a HLAVNÍ sezónní úkon
// PODZIMNÍ VÝSADBA cibulí (9–11), aby přes zimu zakořenily a na jaře kvetly. Appka dnes
// generuje péči až po výsadbě — tahle vrstva proaktivně připomene, KDY cibule zasadit,
// posunuté dle klimatické zóny (chladnější hory = o něco dřív, než přijde mráz).
//
// SYMETRICKÝ PROTĚJŠEK k data/winterPrep.js: ten na podzim VYRÝVÁ mrazlivé letní hlízy
// (Dahlia/Gladiolus) — tahle vrstva naopak na podzim SÁZÍ mrazuvzdorné jarní cibule
// (jiné rody, jiná akce, žádný překryv).
//
// ČISTĚ KLIENTSKÁ vrstva — žádné nové schéma ani endpoint. Datum výsadby =
// dateForMonth(month, conditions) → posun dle klim. zóny/expozice/výšky (jeden zdroj
// pravdy s RecommendedTasks/ageTasks/divisionTasks/sowingTasks). Nabídne se jen je-li
// výsadba v BUDOUCNU a v horizontu (~75 dní, pozdní léto/podzim) — mimo to se skryje.
//
// Gate = category.key 'cibuloviny' + JARNÍ kvetení (rod v SPRING_BULB_GENERA). Letní
// kvetoucí cibule sázené ZJARA (Gladiolus / Lilium — lilie se sází i na jaře) a podzimní
// kvetoucí (Colchicum / ocún, sázen v létě) do mapy NEPATŘÍ → vrátí []; mečíky/jiřiny
// na podzim řeší naopak data/winterPrep.js (lift).
import { dateForMonth } from '../components/RecommendedTasks.jsx';
import { daysFromToday } from '../utils.js';

// Jak daleko dopředu výsadbu nabízíme (dny). Výsadba je sezónní (pozdní léto / podzim) —
// surface nadcházející okno s rozumným předstihem, ne celoročně.
export const BULB_PLANTING_HORIZON_DAYS = 75;

const BULB_EMOJI = '🌷';

// Kategorie, kde podzimní výsadba jarních cibulí dává smysl.
const BULB_CATEGORY = 'cibuloviny';

// Jarně kvetoucí cibuloviny — výsadba NA PODZIM, aby přes zimu zakořenily a zjara kvetly.
// Klíč = ROD (první slovo nameLat, jako cropRotation.genusOf). `month` = měsíc výsadby
// (anchor 15. dne, posunut dateForMonth dle podmínek), `depthCm` = orientační hloubka.
//
// Kurátorský REFERENČNÍ seznam běžných jarních cibulí ve střední Evropě. Část rodů
// (Crocus/Muscari/Fritillaria/Scilla/Chionodoxa) zatím NENÍ v plantDatabase, ale jsou
// v mapě dopředu — až DB poroste, fungují bez úpravy kódu (a žádné škodí: bez záznamu
// se prostě nikdy nematchnou). VYŘAZENO záměrně: Gladiolus/Lilium (letní kvetení, sází
// se zjara) a Colchicum (podzimní kvetení) — viz hlavička modulu.
export const SPRING_BULB_GENERA = {
  Tulipa:      { month: 10, depthCm: 15 }, // tulipán — říjen, hluboko
  Narcissus:   { month: 9,  depthCm: 15 }, // narcis — o něco dřív, hluboko
  Crocus:      { month: 9,  depthCm: 8 },  // krokus — mělce (forward-looking, zatím mimo DB)
  Hyacinthus:  { month: 10, depthCm: 15 }, // hyacint
  Muscari:     { month: 9,  depthCm: 8 },  // modřenec (forward-looking)
  Allium:      { month: 9,  depthCm: 15 }, // okrasný česnek (jen cibuloviny — zelenina mimo gate)
  Fritillaria: { month: 9,  depthCm: 20 }, // řebčík — velké cibule hluboko (forward-looking)
  Galanthus:   { month: 9,  depthCm: 8 },  // sněženka — kvete velmi brzy zjara
  Scilla:      { month: 9,  depthCm: 8 },  // ladoňka (forward-looking)
  Chionodoxa:  { month: 9,  depthCm: 8 },  // ladoňička (forward-looking)
};

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

// Vrať pravidlo podzimní výsadby pro rostlinu, nebo null. Jen pro kategorii cibuloviny
// + jarně kvetoucí rod (letní/podzimní cibule v mapě nejsou).
export function bulbRuleForPlant(plant) {
  if (!plant) return null;
  if (categoryKey(plant) !== BULB_CATEGORY) return null;
  const genus = genusOf(plant);
  return genus && SPRING_BULB_GENERA[genus] ? SPRING_BULB_GENERA[genus] : null;
}

function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}

// Pin už má v měsíci výsadby (letos / opakovaně) naplánovanou výsadbu cibulí? Dedup
// v duchu sowingTasks.hasSowingInMonth: potlač, má-li pin v cílovém měsíci task_type
// 'presazeni' NEBO titulek s 🌷 / „cibul" (sezónní výsadba s task_type 'jine'), ať
// výsadbový nudge nezdvojí, co už v okně je.
function hasBulbPlantingInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type === 'presazeni') return true;
    const title = (e.title || '').trim();
    if (title.startsWith(BULB_EMOJI) || /cibul/i.test(title)) return true;
  }
  return false;
}

// Hlavní logika: vrať návrh podzimní výsadby cibulí pro pin (pole 0–1 hintů, kvůli paritě
// s divisionTasks/sowingTasks kartami). Nabídne se, je-li rostlina jarní cibulovina,
// datum výsadby je v budoucnu a v horizontu. Mimo kategorii cibuloviny / letní+podzimní
// cibule / chybějící rostlina → []. conditions = pin.garden_conditions (posun termínu).
// `now` injektovatelné pro test (využito pro rok dedupu — termín drží reálné dateForMonth).
export function bulbPlantingForPin(pin, plant, conditions, now = new Date()) {
  if (!pin || !plant) return [];
  const rule = bulbRuleForPlant(plant);
  if (!rule) return [];

  const suggested = dateForMonth(rule.month, conditions); // výsadba na podzim (posun zóny)
  const due = daysFromToday(suggested);
  if (due === null || due < 0 || due > BULB_PLANTING_HORIZON_DAYS) return [];

  const m = monthFromIso(suggested);
  if (hasBulbPlantingInMonth(pin.tasks || [], m, now.getFullYear())) return [];

  return [{
    kind: 'bulbPlanting',
    month: m,
    depthCm: rule.depthCm,
    suggested,
    due,
    taskType: 'presazeni',
    emoji: BULB_EMOJI,
  }];
}
