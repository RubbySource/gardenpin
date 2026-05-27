// Bílení kmenů ovocných stromů na zimu — ochrana před mrazovými deskami.
// Pozdě na podzim je u ovocných stromů a mladých dřevin HLAVNÍ sezónní úkon NABÍLIT KMEN
// a kosterní větve vápenným nátěrem: bílá odráží zimní slunce, brání rozkolísání teploty
// kůry na osluněné jižní straně a tím MRAZOVÝM DESKÁM (podélné praskliny kůry).
//
// Tahle vrstva cíleně DOPLŇUJE „Zazimování" (data/winterPrep.js), které na podzim VYRÝVÁ
// mrazlivé hlízy a OBALUJE/PŘESOUVÁ mrazově CITLIVÉ rostliny — bílení naopak chrání
// MRAZUVZDORNÉ kmeny dřevin před sluncem; jiná akce, jiný okruh rostlin, žádný překryv
// (fíkovník/oleandr/jiřina z winterPrep nejsou ovoce/stromy v gate téhle vrstvy).
//
// ČISTĚ KLIENTSKÁ vrstva — žádné nové schéma ani endpoint. Měsíc bílení = dateForMonth
// (jeden zdroj pravdy s RecommendedTasks/winterPrep/graftingTasks…) → posun dle klim. zóny
// /expozice. Pozn.: dateForMonth posouvá chladnější zóny POZDĚJI (strukturální posun jako
// u všech sourozeneckých vrstev); ±21denní clamp drží termín v listopadovo-prosincovém okně.
//
// Sezónní gate (TRUNK_WHITEWASH_SEASON = 11–12, po opadu listů, před silnými mrazy) — mimo
// okno se karta vůbec neukáže. Termín nikdy do minulosti (pozdní listopad / prosinec →
// naplánuj na dnešek, jako winterPrep). Gate na ovoce/stromy (mrazuvzdorné dřeviny s kmenem);
// mladé keře s jedním kmínkem záměrně vynechány — z dat nejde spolehlivě poznat „kmínek".
import { dateForMonth } from '../components/RecommendedTasks.jsx';
import { daysFromToday } from '../utils.js';

// Jak daleko dopředu úkol nabízíme (dny). Bílení je sezónní — surface okno s předstihem.
export const TRUNK_WHITEWASH_HORIZON_DAYS = 75;

// Sezónní okno, kdy kartu vůbec ukazujeme (pozdní podzim po opadu listů, před silnými mrazy).
export const TRUNK_WHITEWASH_SEASON = [11, 12]; // listopad–prosinec

// Ideální kotevní měsíc (po opadu listů). V prosinci kotvíme na prosinec, ať dateForMonth
// nepřeskočí na listopad PŘÍŠTÍHO roku (rollover) a termín zůstane v letošní sezóně.
const TRUNK_WHITEWASH_IDEAL_MONTH = 11;

const TRUNK_WHITEWASH_EMOJI = '🪵';

// enrichPlant nahrazuje category za CATEGORY_DEFS objekt ({key,…}); přijmeme i holý string.
function categoryKey(plant) {
  const c = plant?.category;
  if (!c) return null;
  return typeof c === 'string' ? c : c.key || null;
}

// Bílí se kmen dřevin — gate na ovoce/stromy (mrazuvzdorné dřeviny s kmenem).
export function trunkWhitewashAppliesTo(plant) {
  if (!plant) return false;
  const cat = categoryKey(plant);
  return cat === 'ovoce' || cat === 'stromy';
}

function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}

function isoToday(now) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Pin už má v měsíci bílení (letos / opakovaně) naplánovaný nátěr? Dedup v duchu
// graftingTasks.hasGraftingInMonth, ale jen dle TITULKU („bíl"/„nátěr") — task_type 'jine'
// je příliš obecný (sdílí ho hromada úkonů), takže by nad ním dedup falešně potlačoval.
function hasWhitewashInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    const title = (e.title || '').trim();
    if (/bíl|nátěr/i.test(title)) return true;
  }
  return false;
}

// Hlavní logika: vrať návrh bílení kmene pro pin (pole 0–1 hintů, kvůli paritě s ostatními
// kartami). Nabídne se, je-li rostlina ovoce/strom, jsme v sezóně (11–12), termín je v
// budoucnu (po clampu na dnešek) a v horizontu. Mimo gate / mimo sezónu / chybějící rostlina
// → []. conditions = pin.garden_conditions (posun termínu). `now` injektovatelné pro test.
export function trunkWhitewashForPin(pin, plant, conditions, now = new Date()) {
  if (!pin || !plant) return [];
  if (!trunkWhitewashAppliesTo(plant)) return [];

  const curMonth = now.getMonth() + 1;
  if (!TRUNK_WHITEWASH_SEASON.includes(curMonth)) return []; // mimo sezónu (11–12)

  // V prosinci kotvi na prosinec (jinak dateForMonth přeskočí na listopad PŘÍŠTÍHO roku).
  const anchorMonth = Math.max(TRUNK_WHITEWASH_IDEAL_MONTH, curMonth);
  let suggested = dateForMonth(anchorMonth, conditions); // okno bílení (posun klim. zóny)
  let due = daysFromToday(suggested);
  if (due === null) return [];
  if (due < 0) {
    // ideál už minul (pozdní listopad / prosinec) — naplánuj na dnešek, nikdy do minulosti.
    suggested = isoToday(now);
    due = 0;
  }
  if (due > TRUNK_WHITEWASH_HORIZON_DAYS) return [];

  const m = monthFromIso(suggested);
  if (hasWhitewashInMonth(pin.tasks || [], m, now.getFullYear())) return [];

  return [{
    kind: 'trunkWhitewash',
    month: m,
    suggested,
    due,
    taskType: 'jine',
    emoji: TRUNK_WHITEWASH_EMOJI,
  }];
}
