// Preventivní jarní postřik proti broskvové kadeřavosti — měďnatý fungicid před pučením.
// U broskvoně a meruňky je HLAVNÍ raně-jarní úkon NABÍLIT (postříkat) pupeny měďnatým
// fungicidem (Bordeauxská jícha / Kuprikol) TĚSNĚ PŘED PUČENÍM, ať se zablokuje infekce
// houby Taphrina deformans (kadeřavost). Pozdě = houba už pronikla do pupenu a list zčervená;
// brzy = mráz spláchne postřik. Bez postřiku ztráta úrody 50–80 %.
//
// Tahle vrstva cíleně DOPLŇUJE ageTasks.js (zimní výchovný řez dle stáří), trunkWhitewash.js
// (bílení kmene 11), fruitThinning.js (probírka 6), fruitNetting.js (síť 6-7), graftingTasks.js
// (rouby) — postřik je JINÁ akce (preventivní fungicid, ne řez/ochrana), JINÉ okno (2-3),
// JINÝ účel (houbová infekce na pupenech), žádný překryv.
//
// ČISTĚ KLIENTSKÁ vrstva — žádné nové schéma ani endpoint. Měsíc postřiku = dateForMonth
// (jeden zdroj pravdy s RecommendedTasks/winterPrep/fruitThinning…) → posun dle klim. zóny
// /expozice (chladnější zóny pozdější pučení ⇒ pozdější postřik). Návrh nikdy do minulosti
// (minulá okna → []), horizont 75 dní (širší než ostatní vrstvy, protože okno je brzy
// v sezóně a chceme ho surface s předstihem).
//
// GATE: stromy (peckoviny v reálné plantDatabase jsou v kategorii `stromy`, jako u
// fruitThinning). Skutečným selektorem je kurátorská mapa DRUHŮ — rod Prunus záměrně NENÍ
// v GENERA (vyřadí to třešeň, švestku, okrasné sakury/slivoně), match jen přes konkrétní
// druh broskvoně/meruňky.
//
// Druhý postřik začátkem 2 pro silně napadené stromy = vědomě VYNECHÁN (default = jeden
// postřik 3; ne každý uživatel měl loni napadené, uživatel si druhý umí přidat ručně).
import { dateForMonth } from '../components/RecommendedTasks.jsx';
import { daysFromToday } from '../utils.js';

// Jak daleko dopředu postřik nabízíme (dny). Širší než ostatní vrstvy (60), protože okno
// je brzy v sezóně (3) a uživatel ho musí naplánovat s předstihem — měďnatý fungicid je
// třeba předem koupit a vystihnout suché bezvětrné okno.
export const PEACH_CURL_HORIZON_DAYS = 75;

const PEACH_CURL_EMOJI = '🛡️';

// Typ postřiku → kotevní měsíc okna (anchor 15. dne, posunut dateForMonth dle podmínek).
//   strong = broskvoň (Prunus persica) — silně doporučeno, vysoká citlivost na kadeřavost,
//   mild   = meruňka (Prunus armeniaca) — mírněji doporučeno, citlivost menší (ale netriviální).
// Obě v březnu (3) — vrchol „těsně před pučením" v ČR.
export const PEACH_CURL_TYPES = {
  strong: { month: 3 },
  mild: { month: 3 },
};

// DRUH má přednost před RODEM — rod Prunus záměrně NENÍ v žádné GENERA mapě (třešeň/višeň
// /švestka/okrasné sakury kadeřavostí netrpí, model fruitThinning). Match jen přes konkrétní
// druh broskvoně/meruňky.
export const PEACH_CURL_SPECIES = {
  'Prunus persica': 'strong',   // broskvoň — silně doporučeno
  'Prunus armeniaca': 'mild',   // meruňka — mírněji doporučeno
};

// enrichPlant nahrazuje category za CATEGORY_DEFS objekt ({key,…}); přijmeme i holý string.
function categoryKey(plant) {
  const c = plant?.category;
  if (!c) return null;
  return typeof c === 'string' ? c : c.key || null;
}

// Vrať pravidlo postřiku pro rostlinu ({ type }), nebo null. DRUH má přednost před RODEM
// (rod Prunus záměrně mimo GENERA — viz výše); match jen v kategorii stromy.
export function peachCurlSprayRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (cat !== 'stromy') return null;
  const lat = String(plant.nameLat || '').trim();
  for (const sp in PEACH_CURL_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return { type: PEACH_CURL_SPECIES[sp] };
  }
  return null;
}

function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}

// Pin už má v měsíci postřiku (letos / opakovaně) naplánovaný postřik? Dedup je ŠIRŠÍ než
// u sourozeneckých vrstev — sleduje task_type 'postrik' (přesný úzký typ, který tahle vrstva
// sama používá) NEBO TITULEK s markerem. Marker pokrývá vlastní slovesný titulek („postřik
// proti **kadeřav**osti"), aktivní látky („**měďnat**ý", „**bordeaux**ská", „**kuprikol**")
// i obecný termín „**fungicid**" — to jako jazyková pojistka pro EN/DE/PL/SK, kde
// lokalizovaný titulek může nést jen aktivní látku.
function hasPeachCurlSprayInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type === 'postrik') return true;
    const title = (e.title || '').trim();
    if (/kadeřav|měďnat|bordeaux|kuprikol|fungicid/i.test(title)) return true;
  }
  return false;
}

// Hlavní logika: vrať návrh postřiku pro pin (pole 0–1 hintů, kvůli paritě se sourozeneckými
// kartami). Nabídne se, je-li rostlina broskvoň/meruňka a sezónní okno (3) je v budoucnu
// a v horizontu (75 dní). Mimo gate stromy / mimo mapu druhů / pozdní březen+ → []. conditions
// = pin.garden_conditions (posun termínu). `now` injektovatelné pro test (rok dedupu; termín
// drží dateForMonth).
export function peachLeafCurlSprayForPin(pin, plant, conditions, now = new Date()) {
  if (!pin || !plant) return [];
  const rule = peachCurlSprayRuleForPlant(plant);
  if (!rule) return [];
  const typeDef = PEACH_CURL_TYPES[rule.type];
  if (!typeDef) return [];

  const suggested = dateForMonth(typeDef.month, conditions); // okno postřiku (posun zóny)
  const due = daysFromToday(suggested);
  if (due === null || due < 0 || due > PEACH_CURL_HORIZON_DAYS) return [];

  const m = monthFromIso(suggested);
  if (hasPeachCurlSprayInMonth(pin.tasks || [], m, now.getFullYear())) return [];

  return [{
    kind: 'peachLeafCurlSpray',
    type: rule.type,
    month: m,
    suggested,
    due,
    taskType: 'postrik',
    emoji: PEACH_CURL_EMOJI,
  }];
}
