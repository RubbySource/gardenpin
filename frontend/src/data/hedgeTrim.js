// Stříhání živých plotů — letní tvarovací řez formálních plotů.
// U rostlin pěstovaných jako ŽIVÝ PLOT / tvarovaná stěna (zimostráz, ptačí zob, habr, buk,
// tis, zerav/túje, zimolez kečíkový Lonicera nitida) je HLAVNÍ opakovaný sezónní úkon LETNÍ
// TVAROVACÍ ŘEZ — sestřih nového přírůstku, aby plot držel hustý a ostrý tvar. Klasická okna:
//   summer1 = začátek léta PO HNÍZDĚNÍ ptáků (7) — seřízni nový přírůstek,
//   summer2 = koncem léta (9) — druhý sestřih, ať jde plot do zimy upravený.
// Nabízíme NEJBLIŽŠÍ BUDOUCÍ okno v horizontu (oba kandidáti se dedupují zvlášť, takže je-li
// první sestřih už naplánovaný, ukáže se ten druhý).
//
// Tahle vrstva cíleně DOPLŇUJE data/ageTasks.js (VÝCHOVNÝ/OMLAZOVACÍ řez dřeviny dle STÁŘÍ
// v pozdní zimě/zjara) i data/perennialCutback.js (seříznutí BYLIN) — tohle je KAŽDOROČNÍ
// tvarování FORMÁLNÍHO plotu v LÉTĚ, nezávislé na stáří, jiné okno, jiný účel, žádný překryv.
//
// ČISTĚ KLIENTSKÁ vrstva — žádné nové schéma ani endpoint. Okno řezu = dateForMonth(month,
// conditions) → posun dle klim. zóny/expozice (jeden zdroj pravdy s RecommendedTasks/cutback…;
// v chladnějších zónách později). Nabídne se jen je-li okno v BUDOUCNU a v horizontu (~75 dní),
// jinak se skryje — „mimo sezónu → []" je tak přirozený důsledek future+horizont kontroly.
//
// GATE woody kategorie {kere, stromy, jehlicnany} je ŠIROKÝ — skutečným selektorem je kurátorská
// mapa HEDGE_GENERA (rody reálně stříhané na ploty) + HEDGE_SPECIES s předností. Gate záměrně
// pustí i Tilia/Pinus/Picea (lípa/borovice/smrk — stromy/jehličnany), které ale mapa ODMÍTNE
// (nejsou plotové rody) → null. Naopak řeší KOLIZI rodu Lonicera (jako plantSupports): pnoucí
// zimolez (Lonicera periclymenum/heckrottii) je `popinave` → mimo gate; KEŘOVÝ zimolez kečíkový
// (Lonicera nitida, `kere`) je klasický plotový druh → v HEDGE_SPECIES (genus Lonicera záměrně
// NENÍ v GENERA, ať se nechytne pnoucí zimolez kdyby kdy spadl do gate). Keřová/pnoucí Rosa je
// `bylinky`/`popinave` a v mapě není → null.
import { dateForMonth } from '../components/RecommendedTasks.jsx';
import { daysFromToday } from '../utils.js';

// Jak daleko dopředu sestřih plotu nabízíme (dny). Sezónní — surface nadcházející letní okno
// s předstihem, ne celoročně.
export const HEDGE_TRIM_HORIZON_DAYS = 75;

const HEDGE_TRIM_EMOJI = '✂️';

// Dvě letní okna tvarovacího řezu (anchor 15. dne měsíce, posunut dateForMonth dle podmínek):
//   summer1 = začátek léta po hnízdění ptáků (7) — první sestřih nového přírůstku,
//   summer2 = koncem léta (9) — druhý sestřih, ať plot jde do zimy upravený.
export const HEDGE_TRIM_WINDOWS = {
  summer1: { month: 7 },
  summer2: { month: 9 },
};

// Kategorie, ve kterých vůbec hledáme (gate) — dřevnaté: keře, stromy, jehličnany. Širší než
// nutné: skutečný selektor je HEDGE_GENERA/SPECIES (Tilia/Pinus/Picea gate projdou, ale mapa je
// odmítne). `popinave` ZÁMĚRNĚ MIMO → vyřadí pnoucí zimolez (kolize rodu Lonicera).
export const HEDGE_CATEGORIES = new Set(['kere', 'stromy', 'jehlicnany']);

// Rody reálně pěstované jako STŘÍHANÝ FORMÁLNÍ PLOT — klíč = ROD (první slovo nameLat). Match jen
// v gate HEDGE_CATEGORIES. Kurátorský výběr (SELEKTIVNÍ): Fagus (buk) ZÁMĚRNĚ VYNECHÁN — není
// v reálné plantDatabase, byl by mrtvý klíč (test to hlídá; přidat, až buk v DB přibude).
export const HEDGE_GENERA = new Set([
  'Buxus',     // zimostráz — klasický nízký formální plot (kere)
  'Ligustrum', // ptačí zob — rychle rostoucí plot, 2 sestřihy/rok (kere)
  'Carpinus',  // habr — listnatý tvarovaný plot/stěna (stromy)
  'Taxus',     // tis — pomalý hustý jehličnatý plot (kere)
  'Thuja',     // zerav / túje — stálezelená plotová stěna (jehlicnany)
  'Berberis',  // dřišťál — trnitý nízký plot (kere)
  'Photinia',  // fotinie Red Robin — barevný stálezelený plot (kere)
]);

// DRUH má přednost (jako winterPrep/graftingTasks/fruitThinning) — KEŘOVÝ zimolez kečíkový je
// plotový druh, kdežto rod Lonicera obecně NE (pnoucí zimolez = popinave, mimo gate). Proto
// genus Lonicera NENÍ v GENERA, jen tento druh je v SPECIES.
export const HEDGE_SPECIES = new Set([
  'Lonicera nitida', // zimolez kečíkový — drobnolistý keřový plotový zimolez (kere)
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

// Je rostlina pěstovaná jako stříhaný formální plot? Match jen v gate HEDGE_CATEGORIES a je-li
// DRUH v HEDGE_SPECIES (přednost) NEBO rod v HEDGE_GENERA. Mimo gate (popinave, trvalky,
// zelenina…) / rody mimo mapu (Tilia/Pinus/Picea/Malus…) → false.
export function isHedgePlant(plant) {
  if (!plant) return false;
  const cat = categoryKey(plant);
  if (!cat || !HEDGE_CATEGORIES.has(cat)) return false;
  const lat = String(plant.nameLat || '').trim();
  // 1) DRUH (genus + species) má přednost
  for (const sp of HEDGE_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return true;
  }
  // 2) ROD
  const genus = genusOf(plant);
  return !!(genus && HEDGE_GENERA.has(genus));
}

function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}

// Pin už má v měsíci sestřihu plotu (letos / opakovaně) naplánovaný řez? Dedup v duchu
// perennialCutback.hasCutbackInMonth — potlač, má-li pin v cílovém měsíci task_type 'strihani'
// NEBO titulek s „plot"/„sestřih"/„tvarov". Marker zachytí i vlastní titulek („Sestřihnout plot").
function hasHedgeTrimInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type === 'strihani') return true;
    const title = (e.title || '').trim();
    if (/plot|sestřih|tvarov/i.test(title)) return true;
  }
  return false;
}

// Hlavní logika: vrať návrh sestřihu plotu pro pin (pole 0–1 hintů, kvůli paritě se
// sourozeneckými kartami). Nabídne NEJBLIŽŠÍ BUDOUCÍ okno (summer1/summer2), které je v horizontu
// a NENÍ už naplánované (oba kandidáti se dedupují zvlášť — je-li první sestřih hotový, ukáže se
// druhý). Mimo gate / rody mimo mapu / chybějící rostlina → []. conditions = pin.garden_conditions
// (posun termínu). `now` injektovatelné pro test (rok dedupu; termín drží dateForMonth).
export function hedgeTrimForPin(pin, plant, conditions, now = new Date()) {
  if (!pin || !plant) return [];
  if (!isHedgePlant(plant)) return [];

  const curYear = now.getFullYear();
  let best = null;
  for (const window of Object.keys(HEDGE_TRIM_WINDOWS)) {
    const suggested = dateForMonth(HEDGE_TRIM_WINDOWS[window].month, conditions);
    const due = daysFromToday(suggested);
    if (due === null || due < 0 || due > HEDGE_TRIM_HORIZON_DAYS) continue;
    const m = monthFromIso(suggested);
    if (hasHedgeTrimInMonth(pin.tasks || [], m, curYear)) continue;
    if (!best || due < best.due) best = { window, month: m, suggested, due };
  }
  if (!best) return [];

  return [{
    kind: 'hedgeTrim',
    window: best.window,
    month: best.month,
    suggested: best.suggested,
    due: best.due,
    taskType: 'strihani',
    emoji: HEDGE_TRIM_EMOJI,
  }];
}
