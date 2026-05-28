// Letní řez růží po prvním kvetení — deadheading + light cutback pro druhou vlnu (v 7).
// U remontantních (opakovaně kvetoucích) moderních růží — záhonových, sadových, čajohybridů,
// anglických — je HLAVNÍ středně-letní úkon ODSTRANIT ODKVETLÁ KVĚTENSTVÍ + zkrátit kvetoucí
// výhon o cca 1/3 nad zdravým 5-listým listem směrem ven z keře + odříznout slepé výhony.
// Akce STIMULUJE NASAZENÍ DRUHÉ KVĚTNÍ VLNY v 8–9 (jinak růže zůstane sterilní, vegetativně
// poroste a vlny už nepřijdou). U jednou kvetoucích historických (gallica, damascena, alba,
// centifolia, rugosa pro šípky) se to NEDĚLÁ — kvetly jen jednou a tahem se zničí oblouky
// pro příští sezónu / šípky.
//
// Tahle vrstva cíleně DOPLŇUJE ageTasks.js (zimní zmlazení dřevin v 1–3 — JINÉ okno, JINÝ
// účel: zimní tvarování × letní deadheading), perennialCutback.js (řeže `trvalky`/`travy`,
// ne `kere`/`okrasne`) a hedgeTrim.js (formální ploty z Buxus/Ligustrum, ne růže). Žádný
// překryv.
//
// ČISTĚ KLIENTSKÁ vrstva — žádné nové schéma ani endpoint. Měsíc deadheadingu = dateForMonth
// (jeden zdroj pravdy s RecommendedTasks/summerPruning…) → posun dle klim. zóny/expozice
// (chladnější zóny pozdější první vlna ⇒ pozdější deadheading). Návrh nikdy do minulosti
// (minulá okna → []), horizont 50 dní (krátký, akce je vázaná na konkrétní vlnu kvetení).
//
// GATE: kere/okrasne/popinave (růže v reálné DB spadají do těchto kategorií dle typu —
// keřové, sadové, popínavé) + `bylinky`/`trvalky` jako pojistka pro ID-range fallback
// (Rosa zahradní id 40 padá přes getPlantCategory do `bylinky`, ne do `okrasne` —
// inkonzistence ID-range, kterou nepřebíráme). Skutečným selektorem je kurátorská
// jedno-rodová mapa: jediný klíč `Rosa` → měsíc 7. Genus Rosa je dostatečně unikátní,
// že žádná reálná bylinka/trvalka přes něj neprojde.
//
// SPECIES EXCLUDE s předností před RODEM (vyloučení jednou kvetoucích historických):
//   Rosa gallica       (růže galská)          → null
//   Rosa damascena     (růže damašská)        → null
//   Rosa alba          (růže bílá)            → null
//   Rosa centifolia    (růže stolistá)        → null
//   Rosa rugosa        (růže svraskalá, šípky) → null
// Forward-looking: pokud žádná historická v DB není (aktuální stav), sanity test to
// oznámí ale nebrání (exclusions mohou být forward-looking — model springMulching /
// hardeningOff). Druhá vlna u nich nepřijde a deadheading by zničil šípky/oblouky.
import { dateForMonth } from '../components/RecommendedTasks.jsx';
import { daysFromToday } from '../utils.js';

// Jak daleko dopředu řez nabízíme (dny). Krátký horizont — akce je vázaná na konkrétní
// vlnu kvetení a předtím (jaro/začátek června) by návrh byl matoucí; po sezóně už nemá
// smysl. Sourozenecké letní vrstvy (summerPruning/fruitThinning) drží 60.
export const SUMMER_ROSE_HORIZON_DAYS = 50;

const SUMMER_ROSE_EMOJI = '✂️';

// Kategorie (po enrichPlant; categoryKey() přijme i holý string) — gate, NE selektor.
// Šíře: kere/okrasne/popinave dle spec + `bylinky`/`trvalky` jako pojistka pro id 40
// Rosa zahradní, která přes getPlantCategory(id ≤ 40) skončí v `bylinky` (známá
// inkonzistence ID-range). Genus Rosa je v selektoru unikátní → false-match nehrozí.
export const SUMMER_ROSE_CATEGORIES = new Set([
  'kere',
  'okrasne',
  'popinave',
  'bylinky',
  'trvalky',
]);

// ROD → kotevní měsíc letního řezu (anchor 15. dne, posunut dateForMonth dle podmínek).
// Jediný klíč — Rosa. Druhové výjimky (historické jednou kvetoucí) v SUMMER_ROSE_SPECIES_EXCLUDE.
export const SUMMER_ROSE_GENERA = {
  Rosa: 7,
};

// DRUH má přednost před RODEM — historické jednou kvetoucí růže (gallica/damascena/alba/
// centifolia/rugosa) v 7 NEDEADHEADUJEME. Druhá vlna nepřijde, tah ničí oblouky/šípky.
// `null` = explicitní vyloučení (model summerPruning SPECIES s null hodnotou v hardeningOff).
export const SUMMER_ROSE_SPECIES_EXCLUDE = {
  'Rosa gallica': null,
  'Rosa damascena': null,
  'Rosa alba': null,
  'Rosa centifolia': null,
  'Rosa rugosa': null,
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

// Vrať pravidlo letního řezu růže pro rostlinu ({ month }), nebo null. DRUH má přednost
// před RODEM; match jen v gate kategoriích. Vyloučení historických přes SPECIES_EXCLUDE
// s null hodnotou — funguje jako rychlý short-circuit před rod match.
export function summerRosePruningRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (!SUMMER_ROSE_CATEGORIES.has(cat)) return null;
  const lat = String(plant.nameLat || '').trim();
  // 1) DRUH má přednost — exclusions (null) krátkou cestou ven
  for (const sp in SUMMER_ROSE_SPECIES_EXCLUDE) {
    if (lat === sp || lat.startsWith(`${sp} `)) return null;
  }
  // 2) ROD — Rosa → 7
  const genus = genusOf(plant);
  if (genus && SUMMER_ROSE_GENERA[genus]) return { month: SUMMER_ROSE_GENERA[genus] };
  return null;
}

function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}

// Pin už má v měsíci řezu (letos / opakovaně) naplánovaný letní řez růže? DVOUFÁZOVÝ
// dedup — `strihani` je sdílený s ostatními řezovými vrstvami (hedgeTrim/summerPruning/
// perennialCutback/ageTasks), samotný task_type by potlačoval nepříbuzné řezy. Vyžaduje
// task_type `strihani` SOUČASNĚ S markerem v titulku (růž / deadhead / odkvet / druhá vlna /
// zwei … Flor) — marker pokrývá CZ slovesný titulek + EN/DE termíny.
function hasSummerRosePruningInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type !== 'strihani') continue;
    const title = (e.title || '').trim();
    if (/růž|deadhead|odkvet|druhá vlna|zwei.*Flor/i.test(title)) return true;
  }
  return false;
}

// Hlavní logika: vrať návrh letního řezu růže pro pin (pole 0–1 hintů, parita se
// sourozeneckými kartami). Nabídne se, je-li rostlina v mapě, NENÍ vyloučená druhem
// (historické jednou kvetoucí), a sezónní okno je v budoucnu a v horizontu. Mimo gate /
// mimo mapu / historická / pozdní červenec+ → []. conditions = pin.garden_conditions
// (posun termínu). `now` injektovatelné pro test (rok dedupu).
export function summerRosePruningForPin(pin, plant, conditions, now = new Date()) {
  if (!pin || !plant) return [];
  const rule = summerRosePruningRuleForPlant(plant);
  if (!rule) return [];

  const suggested = dateForMonth(rule.month, conditions); // okno (15. cílového měsíce, posun)
  const due = daysFromToday(suggested);
  if (due === null || due < 0 || due > SUMMER_ROSE_HORIZON_DAYS) return [];

  const m = monthFromIso(suggested);
  if (hasSummerRosePruningInMonth(pin.tasks || [], m, now.getFullYear())) return [];

  return [{
    kind: 'summerRosePruning',
    month: m,
    suggested,
    due,
    taskType: 'strihani',
    emoji: SUMMER_ROSE_EMOJI,
  }];
}
