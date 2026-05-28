// Ochranné sítě na dozrávající ovoce — zakrytí keřů/stromků/réveje sítí proti ptákům.
// Když ovoce začíná zrát, je HLAVNÍ sezónní úkon VČAS natáhnout ochrannou síť přes keře
// a stromky drobného/peckového ovoce (třešně, višně, rybíz, angrešt, borůvky, maliny,
// vinná réva), aby úrodu nesezobali ptáci. Akce se musí udělat TĚSNĚ PŘED VYBARVENÍM
// plodů — pozdě = ptáci stihnou první. Okno dle plodiny:
//   třešně/višně  → 6 (raně dozrávající peckoviny),
//   drobné ovoce  → 6–7 (rybíz/angrešt/borůvka/maliník — peak léta),
//   vinná réva    → 8 (vybarvuje se na konci léta).
//
// Tahle vrstva cíleně DOPLŇUJE data/fruitThinning.js (červnová PROBÍRKA NÁSADY mladých
// plůdků u jádrovin/velkoplodých peckovin) i „Zazimování" (data/winterPrep.js — podzimní
// ochrana mrazově citlivých rostlin před MRAZEM) — tohle je LETNÍ ochrana ZRAJÍCÍ úrody
// před PTÁKY, jiná akce, jiný účel, žádný překryv.
//
// ČISTĚ KLIENTSKÁ vrstva — žádné nové schéma ani endpoint. Okno zakrytí = dateForMonth(month,
// conditions) → posun dle klim. zóny/expozice (jeden zdroj pravdy s RecommendedTasks/fruitThinning…;
// v chladnějších zónách zraje POZDĚJI, takže i síť jde později). Nabídne se jen je-li okno
// v BUDOUCNU a v horizontu (~50 dní), jinak se skryje — „mimo sezónu → []" je tak přirozený
// důsledek future+horizont kontroly (stejný model jako fruitThinning; návrh nikdy do minulosti).
//
// GATE: ovoce || stromy || popinave (kategorie). Spec backlogu psal gate `{ovoce,stromy,popinave}`
// jako selektor — drobné ovoce je v reálné plantDatabase v kategorii `ovoce` (Ribes/Rubus/
// Vaccinium/Fragaria), peckoviny v `stromy` (Prunus avium/cerasus), vinná réva v `popinave`
// (Vitis vinifera). Gate je tak ŠIROKÝ a skutečným selektorem je kurátorská mapa rodů/druhů —
// jádroviny Malus/Pyrus a okrasné sakury/slivoně se NESÍŤUJÍ → v mapě nejsou → null.
//
// Matchování přes DRUH (genus + species) s předností před RODEM (jako fruitThinning):
//   - peckoviny ovocné: DRUH Prunus avium (třešeň) → měsíc 6. Rod Prunus záměrně NENÍ
//     v GENERA — vyřadí to broskev/meruňku/švestku (velkoplodé, vysoko ve stromě, obvykle
//     se nesíťují — síť na celý strom je nepraktická a na velké plody ptáci jdou méně)
//     i okrasné sakury/slivoně (Prunus serrulata/cerasifera…). VIŠEŇ (Prunus cerasus)
//     ZÁMĚRNĚ VYNECHÁNA z SPECIES — není v reálné plantDatabase, byl by mrtvý klíč
//     (test to hlídá; přidat, až višeň v DB přibude — stejný model jako Fagus v hedgeTrim).
//   - drobné ovoce: ROD Ribes (rybíz/angrešt) / Rubus (maliník/ostružiník) / Vaccinium
//     (borůvka) / Fragaria (jahodník) → měsíc 6 (rybíz/angrešt/jahodník) nebo 7 (maliník/
//     borůvka — pozdější zrání). Drobné peckoviny + bobuloviny jsou klasické cíle ptáků
//     a síť přes nízký keř je praktická.
//   - VINNÁ RÉVA (Vitis) ZÁMĚRNĚ VYNECHÁNA z GENERA — není v reálné plantDatabase, byl by
//     mrtvý klíč (test to hlídá; přidat, až réva v DB přibude — stejný model jako Fagus
//     v hedgeTrim nebo Lathyrus/Aster v plantSupports).
import { dateForMonth } from '../components/RecommendedTasks.jsx';
import { daysFromToday } from '../utils.js';

// Jak daleko dopředu síťování nabízíme (dny). Sezónní — surface nadcházející okno
// s krátkým předstihem (úkon je „těsně před vybarvením"), ne celoročně.
export const FRUIT_NETTING_HORIZON_DAYS = 50;

const FRUIT_NETTING_EMOJI = '🕸️';

// Rody (ROD = první slovo nameLat) → kotevní měsíc okna (anchor 15. dne, posunut dateForMonth
// dle podmínek). Match jen v gate `ovoce || stromy || popinave`.
//   month 6 = červen (rybíz/angrešt/jahodník — raně dozrávající bobule),
//   month 7 = červenec (maliník/borůvka — peak léta).
// Jádroviny Malus/Pyrus záměrně NEJSOU v mapě → null (stromy se obvykle nesíťují;
// jsou v gate, ale mapa odmítne). Vitis (réva) ZÁMĚRNĚ VYNECHÁNA — není v DB (mrtvý klíč).
export const NETTING_GENERA = {
  Ribes: { month: 6 },     // rybíz červený/černý/bílý, angrešt (ovoce)
  Rubus: { month: 7 },     // maliník, ostružiník (ovoce)
  Vaccinium: { month: 7 }, // borůvka kanadská/zahradní (ovoce)
  Fragaria: { month: 6 },  // jahodník (ovoce)
};

// DRUH má přednost před RODEM — drobnoplodá třešeň se síťuje, ale velkoplodé peckoviny
// (broskev/meruňka/švestka) a okrasné sakury NE → rod Prunus v GENERA NENÍ, jen tento druh
// v SPECIES (model fruitThinning). Prunus cerasus (višeň) ZÁMĚRNĚ VYNECHÁNA — není v DB.
export const NETTING_SPECIES = {
  'Prunus avium': { month: 6 },   // třešeň (drobnoplodá peckovina)
};

// Kategorie, ve kterých vůbec hledáme (gate). Širší než nutné — skutečný selektor je
// NETTING_GENERA/SPECIES. Jádroviny (Malus/Pyrus) jsou ve `stromy`, ale mapa je odmítne.
// `bylinky` mimo gate (Fragaria je v `ovoce`, ne `bylinky` — viz reálná DB).
export const NETTING_CATEGORIES = new Set(['ovoce', 'stromy', 'popinave']);

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

// Vrať pravidlo síťování pro rostlinu ({ month }), nebo null. DRUH má přednost před RODEM;
// match jen v gate NETTING_CATEGORIES (skutečný selektor je mapa, ne gate — viz hlavička).
export function fruitNettingRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (!cat || !NETTING_CATEGORIES.has(cat)) return null;
  const lat = String(plant.nameLat || '').trim();
  // 1) DRUH (genus + species) má přednost
  for (const sp in NETTING_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return { month: NETTING_SPECIES[sp].month };
  }
  // 2) ROD
  const genus = genusOf(plant);
  if (genus && NETTING_GENERA[genus]) return { month: NETTING_GENERA[genus].month };
  return null;
}

function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}

// Pin už má v měsíci síťování (letos / opakovaně) naplánované zakrytí? Dedup JEN dle TITULKU
// (task_type 'jine' je příliš obecný — sdílí ho hromada úkonů, dedup nad ním by falešně
// potlačoval). Marker pokrývá obě formy: „síť" zachytí slovesný titulek, který tahle vrstva
// sama vytvoří („Zasíťovat …" — „síť" je v něm jako podřetězec), „zasíťov" podstatné jméno
// „zasíťování", „zakry" variantu „zakrytí sítí".
function hasNettingInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    const title = (e.title || '').trim();
    if (/síť|zasíťov|zakry/i.test(title)) return true;
  }
  return false;
}

// Hlavní logika: vrať návrh síťování pro pin (pole 0–1 hintů, kvůli paritě se sourozeneckými
// kartami). Nabídne se, je-li rostlina v mapě síťování a sezónní okno (dle rodu/druhu) je
// v budoucnu a v horizontu. Mimo gate / jádroviny / okrasné Prunus / chybějící rostlina → [].
// conditions = pin.garden_conditions (posun termínu). `now` injektovatelné pro test
// (rok dedupu; termín drží dateForMonth).
export function fruitNettingForPin(pin, plant, conditions, now = new Date()) {
  if (!pin || !plant) return [];
  const rule = fruitNettingRuleForPlant(plant);
  if (!rule) return [];

  const suggested = dateForMonth(rule.month, conditions); // okno síťování (posun zóny)
  const due = daysFromToday(suggested);
  if (due === null || due < 0 || due > FRUIT_NETTING_HORIZON_DAYS) return [];

  const m = monthFromIso(suggested);
  if (hasNettingInMonth(pin.tasks || [], m, now.getFullYear())) return [];

  return [{
    kind: 'fruitNetting',
    month: m,
    suggested,
    due,
    taskType: 'jine',
    emoji: FRUIT_NETTING_EMOJI,
  }];
}
