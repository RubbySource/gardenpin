// Letní zelený řez ovocných stromů (Sommerschnitt) — regulace letošního přírůstku.
// U vzrostlých ovocných stromů (jabloň, hrušeň, kdoule, třešeň po sklizni) je HLAVNÍ
// pozdně-letní úkon MÍRNÝ ZELENÝ ŘEZ letošních letorostů (zkrácení o 1/3, odstranění
// vlků a zahušťujících výhonů, zaštípnutí nepotřebných terminálů) — koriguje příliš
// silný vegetativní růst, zlepšuje proslunění/větrání koruny pro zrání plodů a omezuje
// nutnost agresivního zimního řezu. Brzy = stimulace nového výhonu, pozdě = oslabí
// strom před zimou.
//
// Tahle vrstva cíleně DOPLŇUJE ageTasks.js (zimní výchovný/omlazovací řez v 1–2
// v dormanci — JINÉ okno, JINÝ účel: zimní tvaruje strukturu, letní reguluje letošní
// přírůstek), fruitThinning.js (probírka 6 — sklizeň-pre), fruitNetting.js (síť 6–7 —
// ochrana před ptáky), peachLeafCurlSpray.js (fungicid 3 — preventivní postřik).
// Žádný překryv.
//
// ČISTĚ KLIENTSKÁ vrstva — žádné nové schéma ani endpoint. Měsíc řezu = dateForMonth
// (jeden zdroj pravdy s RecommendedTasks/fruitThinning…) → posun dle klim. zóny/expozice
// (chladnější zóny pozdější přírůstek ⇒ pozdější řez). Návrh nikdy do minulosti (minulá
// okna → []), horizont 60 dní (jako sourozenecký fruitThinning).
//
// GATE: stromy || ovoce (jádroviny v `stromy`, drobné ovoce v `ovoce` — keřové formy
// jabloní/hrušní pokud existují). Skutečným selektorem je kurátorská mapa rodů/druhů:
//
//   GENERA klíčované na ROD (první slovo nameLat):
//     Malus  (jabloň + okrasné jabloně) → měsíc 7
//     Pyrus  (hrušeň)                   → měsíc 7
//     Cydonia (kdoule)                  → měsíc 8
//
//   SPECIES s předností před RODEM (model fruitThinning/peachLeafCurlSpray):
//     Prunus avium   (třešeň, po sklizni) → měsíc 7
//     Prunus cerasus (višeň, pokud v DB)  → měsíc 7
//
// Rod Prunus záměrně MIMO GENERA (broskev/meruňka/švestka v 7–8 nepřišly se silným
// tlakem na letní řez; okrasné sakury/slivoně se neřežou letní formou). Drobné ovoce
// (Ribes/Rubus/Vaccinium/Fragaria) NEPATŘÍ — řeší ageTasks nebo strawberryRenewal,
// žádný mrtvý klíč mapy (sanity test hlídá).
import { dateForMonth } from '../components/RecommendedTasks.jsx';
import { daysFromToday } from '../utils.js';

// Jak daleko dopředu řez nabízíme (dny). Surface nadcházející okno s rozumným předstihem,
// ne celoročně — stejně jako sourozenecký fruitThinning.
export const SUMMER_PRUNE_HORIZON_DAYS = 60;

const SUMMER_PRUNE_EMOJI = '✂️';

// Kategorie (po enrichPlant; categoryKey() přijme i holý string) — gate, NE selektor.
export const SUMMER_PRUNE_CATEGORIES = new Set(['stromy', 'ovoce']);

// ROD → kotevní měsíc letního řezu (anchor 15. dne, posunut dateForMonth dle podmínek).
// Kdoule (Cydonia) má posunuté okno do 8 — pozdější fruchtnost, řez až po nasazení plodu.
export const SUMMER_PRUNE_GENERA = {
  Malus: 7,    // jabloň + okrasné jabloně
  Pyrus: 7,    // hrušeň
  Cydonia: 8,  // kdoule
};

// DRUH má přednost před RODEM — třešeň po sklizni se řeže letní formou (zimní řez
// rozšiřuje moniliózu); rod Prunus záměrně NENÍ v GENERA (sakury/slivoně/broskev/
// meruňka/švestka by chytly nesprávně).
export const SUMMER_PRUNE_SPECIES = {
  'Prunus avium': 7,    // třešeň — po sklizni, rány se rychle hojí v plné vegetaci
  'Prunus cerasus': 7,  // višeň — pokud v DB (forward-looking; sanity test nehlídá existenci)
};

// enrichPlant nahrazuje category za CATEGORY_DEFS objekt ({key,…}); přijmeme i holý string.
function categoryKey(plant) {
  const c = plant?.category;
  if (!c) return null;
  return typeof c === 'string' ? c : c.key || null;
}

function genusOf(plant) {
  const lat = String(plant?.nameLat || '').trim();
  return lat ? lat.split(/\s+/)[0] || null : null;
}

// Vrať pravidlo letního řezu pro rostlinu ({ month }), nebo null. DRUH má přednost před
// RODEM; match jen v kategorii stromy/ovoce (skutečný selektor je mapa, ne gate).
export function summerPruningRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (!SUMMER_PRUNE_CATEGORIES.has(cat)) return null;
  const lat = String(plant.nameLat || '').trim();
  // 1) DRUH (genus + species) má přednost
  for (const sp in SUMMER_PRUNE_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return { month: SUMMER_PRUNE_SPECIES[sp] };
  }
  // 2) ROD
  const genus = genusOf(plant);
  if (genus && SUMMER_PRUNE_GENERA[genus]) return { month: SUMMER_PRUNE_GENERA[genus] };
  return null;
}

function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}

// Pin už má v měsíci řezu (letos / opakovaně) naplánovaný letní řez? DVOUFÁZOVÝ dedup —
// `strihani` je sdílený s ostatními řezovými vrstvami (hedgeTrim, perennialCutback,
// ageTasks), samotný task_type by potlačoval nepříbuzné řezy. Vyžaduje task_type
// `strihani` SOUČASNĚ S markerem v titulku („letní řez", „sommerschnitt", „zelený řez",
// „letorost", „vlk") — marker pokrývá CZ/DE/EN termíny + neformální označení.
function hasSummerPruningInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type !== 'strihani') continue;
    const title = (e.title || '').trim();
    if (/letní řez|sommerschnitt|zelený řez|letorost|vlk/i.test(title)) return true;
  }
  return false;
}

// Hlavní logika: vrať návrh letního řezu pro pin (pole 0–1 hintů, parita se sourozeneckými
// kartami). Nabídne se, je-li rostlina v mapě a sezónní okno (dle rodu/druhu) je
// v budoucnu a v horizontu. Mimo gate / mimo mapu / pozdní léto+ → []. conditions =
// pin.garden_conditions (posun termínu). `now` injektovatelné pro test (rok dedupu).
export function summerPruningForPin(pin, plant, conditions, now = new Date()) {
  if (!pin || !plant) return [];
  const rule = summerPruningRuleForPlant(plant);
  if (!rule) return [];

  const suggested = dateForMonth(rule.month, conditions); // okno letního řezu (posun zóny)
  const due = daysFromToday(suggested);
  if (due === null || due < 0 || due > SUMMER_PRUNE_HORIZON_DAYS) return [];

  const m = monthFromIso(suggested);
  if (hasSummerPruningInMonth(pin.tasks || [], m, now.getFullYear())) return [];

  return [{
    kind: 'summerPruning',
    month: m,
    suggested,
    due,
    taskType: 'strihani',
    emoji: SUMMER_PRUNE_EMOJI,
  }];
}
