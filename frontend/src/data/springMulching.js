// Jarní mulčování trvalek a dřevin — pokryv kůrou/štěpkou pro vlhkost a proti plevelu.
// Po vzejití trvalek a dřevin (4–5) je HLAVNÍ raně-letní úkon ULOŽIT 5–8 cm vrstvy
// organického mulče (drcená kůra, štěpka, sláma, listí) okolo trvalek, keřů, růží
// a ovocných stromů. Mulč drží 30–40 % více půdní vlhkosti přes léto (méně závlahy),
// brzdí klíčení plevele (semena potřebují světlo, mulč ho zablokuje), izoluje
// kořenovou zónu před teplotními extrémy a rozkladem postupně zlepšuje strukturu půdy.
//
// 2 OKNA (SPRING_MULCH_TYPES) dle cílové skupiny:
//   - perennial = 4 (po vzejití trvalek/letniček, před hlavní sušší letní vlnou),
//   - woody     = 5 (keře/stromy/popínavé/ovoce — pozdější, až rostou nové výhony
//                    a půda se prohřála).
//
// Tahle vrstva cíleně DOPLŇUJE:
//   - data/greenManure.js — ten zasévá MEZIPLODINU na PRÁZDNÉ záhony po sklizni (8–10);
//     tady je naopak POVRCHOVÝ POKRYV živých záhonů na jaře. Jiná akce, jiné okno.
//   - data/soilPh.js — ten upravuje pH (vápnění/okyselení), jiný účel.
// Žádný překryv s žádnou existující vrstvou.
//
// ČISTĚ KLIENTSKÁ vrstva — žádné nové schéma ani endpoint. Měsíc mulčování =
// dateForMonth(month, conditions) → posun dle klim. zóny/expozice (jeden zdroj pravdy
// s RecommendedTasks/strawberryRenewal/pinching…). Nabídne se jen je-li okno v BUDOUCNU
// a v horizontu (~60 dní), jinak se skryje — „mimo sezónu → []" je tak přirozený
// důsledek future+horizont kontroly (stejný model jako pinching/strawberryRenewal).
//
// GATE: kategorie `trvalky`/`letnicky`/`kere`/`stromy`/`ovoce`/`popinave`. Mulčování je
// generická akce — gate kategorie stačí jako selektor, žádná kurátorská mapa rodů
// (na rozdíl od pinching/staking, kde jen NĚKTERÉ rody se pinčují/staví opora). Ostatní
// kategorie jsou MIMO:
//   - `zelenina` — tam je samostatná sláma/foliový mulč mimo scope této vrstvy,
//   - `bylinky` — bylinky obvykle suchomilné (Lavandula/Thymus/Origanum/Salvia),
//     mulč drží vlhkost → kořenová hniloba; navíc levandule není „strom"
//     a vyžaduje jiné okno,
//   - `cibuloviny` — mulč by zarazil další jarní cibuloviny,
//   - `vodni` (rostou v jezírku), `sukulenty` (suchomilné, mulč hniloba),
//   - `travy` — okrasné trávy mulčování nepotřebují (nízká pokryvnost listů, snášejí sucho).
//
// EXCLUSIONS: kurátorská mapa SPRING_MULCH_GENERA_EXCLUDE + SPRING_MULCH_SPECIES_EXCLUDE
// — rody/druhy, KDE MULČ ŠKODÍ a jsou přitom v gate kategorií:
//   - Helleborus (čemeřice, trvalky) — kořenový krček citlivý na mulč, hnije,
//   - Iris germanica (kosatec německý, trvalky/ornamental) — oddenek MUSÍ být na slunci,
//     mulč ho zahubí (Iris sibirica/pseudacorus jsou rody přes Iris ne všechny zlikvidují
//     — proto SPECIES-level pravidlo, ne ROD).
// Forward-looking (rody, které v DB jsou JEN v `bylinky` mimo gate, ale jakmile se přidá
// druh v `trvalky`/`kere`, exclusion zafunguje): Lavandula, Thymus, Origanum (suchomilné
// aromatické subkeře); Salvia officinalis, Salvia rosmarinus (species-level pro případ,
// kdy by Salvia jako rod byla v gate). DRUH má přednost před RODEM (model fruitThinning/
// pinching SPECIES precedence).
import { dateForMonth } from '../components/RecommendedTasks.jsx';
import { daysFromToday } from '../utils.js';

// Jak daleko dopředu mulčování nabízíme (dny). Sezónní — surface nadcházející jarní
// okno s předstihem, ne celoročně.
export const SPRING_MULCH_HORIZON_DAYS = 60;

const SPRING_MULCH_EMOJI = '🌿';

// Typ mulčování → kotevní měsíc okna (anchor 15. dne, posunut dateForMonth dle podmínek).
//   perennial = trvalky / letničky — duben, po vzejití, před hlavní sušší letní vlnou,
//   woody     = keře / stromy / popínavé / ovoce — květen, půda se prohřála, jsou nové výhony.
export const SPRING_MULCH_TYPES = {
  perennial: { month: 4 },
  woody: { month: 5 },
};

// Kategorie, ve kterých vůbec hledáme (gate). Mulčování je generická akce — gate kategorie
// je hlavní selektor (žádná kurátorská mapa rodů, na rozdíl od pinching/staking).
//   trvalky / letnicky    → perennial (4),
//   kere / stromy / ovoce / popinave → woody (5).
export const SPRING_MULCH_CATEGORIES = new Set([
  'trvalky', 'letnicky', 'kere', 'stromy', 'ovoce', 'popinave',
]);

// Mapping kategorie → typ mulčování. Pomocná — udržuje 1 zdroj pravdy.
const CATEGORY_TYPE = {
  trvalky: 'perennial',
  letnicky: 'perennial',
  kere: 'woody',
  stromy: 'woody',
  ovoce: 'woody',
  popinave: 'woody',
};

// Rody, KDE MULČ ŠKODÍ a jsou v gate kategorií. ROD = první slovo nameLat. Match jen
// v gate SPRING_MULCH_CATEGORIES — exclusion potlačí návrh, vrátí null. Lavandula/Thymus/
// Origanum jsou „forward-looking" — v současné DB žijí v `bylinky` (mimo gate, exclusion
// se neaktivuje), ale jakmile se přidá druh v `trvalky`/`kere`, exclusion zafunguje.
export const SPRING_MULCH_GENERA_EXCLUDE = new Set([
  'Helleborus',  // čemeřice (trvalky/ornamental) — kořenový krček hnije pod mulčem
  'Lavandula',   // levandule (forward-looking; v DB jen `bylinky` mimo gate)
  'Thymus',      // tymián (forward-looking; v DB jen `bylinky` mimo gate)
  'Origanum',    // dobromysl/oregano (forward-looking; v DB jen `bylinky` mimo gate)
]);

// Druhy, KDE MULČ ŠKODÍ a jsou v gate kategorií. DRUH má přednost před RODEM (species
// precedence, model fruitThinning/pinching). Iris jako ROD by potlačil i Iris sibirica
// (mokřadní, mulčování OK) — proto species-level: jen 'Iris germanica' (oddenek na slunci).
// 'Salvia officinalis' / 'Salvia rosmarinus' jsou forward-looking pro případ migrace
// salvií do trvalek/keřů.
export const SPRING_MULCH_SPECIES_EXCLUDE = new Set([
  'Iris germanica',     // kosatec německý (trvalky/ornamental) — oddenek MUSÍ být na slunci
  'Salvia officinalis', // šalvěj lékařská (forward-looking; v DB jen `bylinky`)
  'Salvia rosmarinus',  // rozmarýn (forward-looking; v DB jen `bylinky`)
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

// Druh (genus + species) = první dvě slova nameLat bez kultivaru. Pokud má kultivar (jednoslovný
// nameLat jako „Sedum 'Herbstfreude'"), nevrátí druh — ten species-match nesedne.
function speciesOf(plant) {
  const lat = String(plant?.nameLat || '').trim();
  return lat;
}

// Druh-match: lat začíná „{species}" nebo „{species} "? Kultivar v jednoslovných („Iris 'XYZ'")
// nesedí, protože druh „Iris germanica" má jako prefix mezeru.
function matchesSpecies(plant, speciesSet) {
  const lat = speciesOf(plant);
  if (!lat) return false;
  for (const sp of speciesSet) {
    if (lat === sp || lat.startsWith(`${sp} `)) return true;
  }
  return false;
}

// Vrať pravidlo mulčování pro rostlinu ({ type }), nebo null. Logika:
//   1) GATE — kategorie v SPRING_MULCH_CATEGORIES, jinak null,
//   2) SPECIES exclusion má přednost před RODEM,
//   3) GENUS exclusion potlačí návrh,
//   4) jinak typ z CATEGORY_TYPE dle gate kategorie.
export function springMulchingRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (!cat || !SPRING_MULCH_CATEGORIES.has(cat)) return null;
  // 1) DRUH má přednost — exclusion pro Iris germanica / Salvia officinalis / S. rosmarinus
  if (matchesSpecies(plant, SPRING_MULCH_SPECIES_EXCLUDE)) return null;
  // 2) ROD exclusion — Helleborus / Lavandula / Thymus / Origanum
  const genus = genusOf(plant);
  if (genus && SPRING_MULCH_GENERA_EXCLUDE.has(genus)) return null;
  // 3) Typ dle gate kategorie
  const type = CATEGORY_TYPE[cat];
  return type ? { type } : null;
}

function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}

// Pin už má v měsíci mulčování (letos / opakovaně) naplánovaný úkon? Dedup JEN dle TITULKU
// (task_type `jine` je příliš obecný — sdílí ho mulčování/pinčování/opory/sběr semen…).
// Marker pokrývá všechny formy:
//   - „mulč" zachytí české „mulčování / mulčovat" + vlastní slovesný titulek („Mulčovat …"),
//   - „mulch" zachytí anglický/německý/polský/slovenský termín (mulch / Mulchen / mulczowanie /
//     mulčovanie — kořen „mulch" je společný),
//   - „kůr" zachytí české „kůra / kůrou" (materiál),
//   - „štěpk" zachytí české „štěpka / štěpkou" (materiál).
function hasSpringMulchingInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    const title = (e.title || '').trim();
    if (/mulč|mulch|kůr|štěpk/i.test(title)) return true;
  }
  return false;
}

// Hlavní logika: vrať návrh mulčování pro pin (pole 0–1 hintů, kvůli paritě se sourozeneckými
// kartami). Nabídne se, je-li rostlina v gate kategorií, není ve výjimkách a sezónní okno
// (dle typu) je v budoucnu a v horizontu. Mimo gate / vyloučená / chybějící rostlina → [].
// conditions = pin.garden_conditions (posun termínu). `now` injektovatelné pro test
// (rok dedupu; termín drží dateForMonth).
export function springMulchingForPin(pin, plant, conditions, now = new Date()) {
  if (!pin || !plant) return [];
  const rule = springMulchingRuleForPlant(plant);
  if (!rule) return [];
  const typeDef = SPRING_MULCH_TYPES[rule.type];
  if (!typeDef) return [];

  const suggested = dateForMonth(typeDef.month, conditions); // okno mulčování (posun zóny)
  const due = daysFromToday(suggested);
  if (due === null || due < 0 || due > SPRING_MULCH_HORIZON_DAYS) return [];

  const m = monthFromIso(suggested);
  if (hasSpringMulchingInMonth(pin.tasks || [], m, now.getFullYear())) return [];

  return [{
    kind: 'springMulching',
    type: rule.type,
    month: m,
    suggested,
    due,
    taskType: 'jine',
    emoji: SPRING_MULCH_EMOJI,
  }];
}
