// Probírka násady ovoce — červnová protrhávka mladých plůdků.
// Po „červnovém propadu" (June drop) je u jádrovin a velkoplodých peckovin HLAVNÍ raně-letní
// úkon RUČNÍ PROBÍRKA přebytečné násady — odstranit část mladých plůdků (ponechat ~1 plod na
// svazek / rozestup 8–10 cm), aby zbylé plody vyrostly větší, nelámaly větve a strom NEVYHNAL
// do střídavé plodnosti (alternance — letos hojně, příští rok skoro nic).
//
// Tahle vrstva cíleně DOPLŇUJE data/graftingTasks.js (množení rouby/očky), data/trunkWhitewash.js
// (zimní ochrana kmene) i data/ageTasks.js (zimní/předjarní řez dle stáří) — probírka je JINÁ
// akce (regulace násady, ne řez ani štěpování), jiné okno (6–7) a jiný účel, žádný překryv.
//
// ČISTĚ KLIENTSKÁ vrstva — žádné nové schéma ani endpoint. Okno probírky = dateForMonth(month,
// conditions) → posun dle klim. zóny/expozice (jeden zdroj pravdy s RecommendedTasks/grafting…;
// v chladnějších zónách později). Nabídne se jen je-li okno v BUDOUCNU a v horizontu (~60 dní),
// jinak se skryje — „mimo sezónu → []" je tak přirozený důsledek future+horizont kontroly
// (stejný model jako graftingTasks; návrh nikdy do minulosti, protože minulá okna → []).
//
// GATE: ovoce || stromy. POZOR — spec backlogu psal gate `category.key === 'ovoce'`, ALE v reálné
// plantDatabase jsou JÁDROVINY (Malus/Pyrus) i VELKOPLODÉ PECKOVINY (Prunus persica/armeniaca/
// domestica) v kategorii `stromy`, kdežto `ovoce` drží právě DROBNÉ ovoce (Ribes/Rubus/Vaccinium/
// Fragaria), které se NEPROBÍRÁ. Gate `ovoce` by tedy minul jabloň a chytil jen to, co máme
// vyřadit. Proto gate = `ovoce || stromy` (jako sourozenecký graftingTasks) a skutečným selektorem
// je kurátorská mapa rodů/druhů — drobné ovoce v `ovoce` v mapě NENÍ → null.
//
// Matchování přes DRUH (genus + species) s předností před RODEM (jako winterPrep/graftingTasks):
//   - jádroviny: ROD Malus (jabloň + okrasné jabloně) / Pyrus (hrušeň) → 'pome' (silná probírka,
//     rozestup 8–10 cm),
//   - velkoplodé peckoviny: DRUH Prunus persica/armeniaca/domestica (broskev/meruňka/švestka) →
//     'stone' (mírnější probírka). Rod Prunus záměrně NENÍ v GENERA — vyřadí to třešeň (Prunus
//     avium, drobnoplodá, neprobírá se) i okrasné sakury/slivoně (Prunus serrulata/cerasifera…).
// Drobné ovoce (Ribes/Rubus/Vaccinium/Fragaria) ani v mapě není → null.
import { dateForMonth } from '../components/RecommendedTasks.jsx';
import { daysFromToday } from '../utils.js';

// Jak daleko dopředu probírku nabízíme (dny). Probírka je sezónní — surface nadcházející okno
// s rozumným předstihem, ne celoročně.
export const FRUIT_THINNING_HORIZON_DAYS = 60;

const FRUIT_THINNING_EMOJI = '🍎';

// Typ probírky → kotevní měsíc okna (anchor 15. dne, posunut dateForMonth dle podmínek).
//   pome  = jádroviny (jabloň/hrušeň) — silná probírka po June drop, rozestup 8–10 cm,
//   stone = velkoplodé peckoviny (broskev/meruňka/švestka) — mírnější probírka.
// Obě v červnu (6) — vrchol June drop; horizont 60 dní surface okno s předstihem.
export const FRUIT_THINNING_TYPES = {
  pome: { month: 6 },
  stone: { month: 6 },
};

// Rody vhodné k probírce — match jen v kategorii ovoce/stromy. Klíč = ROD (první slovo nameLat).
// Jen jádroviny: silná probírka násady (rozestup 8–10 cm). Pozn.: zachytí i okrasné jabloně
// (Malus 'Royalty'…) — stejně jako genus-level Malus v graftingTasks; over-suggestion je
// neškodná (lze ignorovat) a drží mapu jednoduchou.
export const FRUIT_THINNING_GENERA = {
  Malus: 'pome', // jabloň + okrasné jabloně
  Pyrus: 'pome', // hrušeň
};

// DRUH má přednost před RODEM — velkoplodé peckoviny se probírají, ale třešeň (Prunus avium,
// drobnoplodá) a okrasné Prunus (sakura, slivoň) NE → rod Prunus v GENERA NENÍ, jen tyto druhy.
export const FRUIT_THINNING_SPECIES = {
  'Prunus persica': 'stone',   // broskvoň
  'Prunus armeniaca': 'stone', // meruňka
  'Prunus domestica': 'stone', // švestka (velkoplodá)
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

// Vrať pravidlo probírky pro rostlinu ({ type }), nebo null. DRUH má přednost před RODEM;
// match jen v kategorii ovoce/stromy (skutečný selektor je mapa, ne gate — viz hlavička).
export function fruitThinningRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (cat !== 'ovoce' && cat !== 'stromy') return null;
  const lat = String(plant.nameLat || '').trim();
  // 1) DRUH (genus + species) má přednost
  for (const sp in FRUIT_THINNING_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return { type: FRUIT_THINNING_SPECIES[sp] };
  }
  // 2) ROD
  const genus = genusOf(plant);
  if (genus && FRUIT_THINNING_GENERA[genus]) return { type: FRUIT_THINNING_GENERA[genus] };
  return null;
}

function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}

// Pin už má v měsíci probírky (letos / opakovaně) naplánovanou probírku? Dedup JEN dle TITULKU,
// v duchu trunkWhitewash.hasWhitewashInMonth — task_type 'jine' je příliš obecný (sdílí ho
// hromada úkonů), takže by nad ním dedup falešně potlačoval jiné úkony. Marker pokrývá obě formy:
// „probr" zachytí slovesný titulek, který tahle vrstva sama vytvoří („Probrat násadu …"), „probír"
// podstatné jméno („probírka"), „protrh" variantu („protrhávka").
function hasThinningInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    const title = (e.title || '').trim();
    if (/probr|probír|protrh/i.test(title)) return true;
  }
  return false;
}

// Hlavní logika: vrať návrh probírky pro pin (pole 0–1 hintů, kvůli paritě se sourozeneckými
// kartami). Nabídne se, je-li rostlina v mapě probírky a sezónní okno (dle typu) je v budoucnu
// a v horizontu. Mimo gate ovoce/stromy / drobné ovoce / cherry+okrasné Prunus / chybějící
// rostlina → []. conditions = pin.garden_conditions (posun termínu). `now` injektovatelné pro
// test (rok dedupu; termín drží dateForMonth).
export function fruitThinningForPin(pin, plant, conditions, now = new Date()) {
  if (!pin || !plant) return [];
  const rule = fruitThinningRuleForPlant(plant);
  if (!rule) return [];
  const typeDef = FRUIT_THINNING_TYPES[rule.type];
  if (!typeDef) return [];

  const suggested = dateForMonth(typeDef.month, conditions); // okno probírky (posun zóny)
  const due = daysFromToday(suggested);
  if (due === null || due < 0 || due > FRUIT_THINNING_HORIZON_DAYS) return [];

  const m = monthFromIso(suggested);
  if (hasThinningInMonth(pin.tasks || [], m, now.getFullYear())) return [];

  return [{
    kind: 'fruitThinning',
    type: rule.type,
    month: m,
    suggested,
    due,
    taskType: 'jine',
    emoji: FRUIT_THINNING_EMOJI,
  }];
}
