// Úprava pH půdy dle plodiny — podzimní vápnění záhonu + okyselení pod acidofilní rostliny.
// HLAVNÍ sezónní úkon přípravy půdy, který se řeší REAKCÍ půdy (pH), ne živinami:
//   - VÁPNĚNÍ záhonu před košťálovinami (Brassica) zvýší pH a brání nádorovitosti /
//     klubkořenu (Plasmodiophora brassicae) — vápno se aplikuje s předstihem na podzim,
//     ODDĚLENĚ od dusíkatého hnojení,
//   - OKYSELENÍ stanoviště (elementární síra / rašelina) pod ACIDOFILNÍ rostliny
//     (borůvka, pěnišník/azalka, vřes, kamélie…) — chtějí kyselou půdu (pH ~4,5–5,5).
//
// Tahle vrstva cíleně DOPLŇUJE půdní sourozence „Zelené hnojení" (greenManure.js —
// meziplodina do uvolněného záhonu) a „Osevní postup" (cropRotation.js — střídání čeledí)
// o ÚPRAVU REAKCE PŮDY: jiná akce, žádný překryv. ČISTĚ KLIENTSKÁ vrstva — žádné nové
// schéma ani endpoint. Měsíc úpravy = dateForMonth(month, conditions) → posun dle klim.
// zóny/expozice (jeden zdroj pravdy s RecommendedTasks/greenManure/winterPrep…), nikdy
// do minulosti. Sezónní gate SOIL_PH_SEASON (10–11, po sklizni / před zimou, kdy vápno
// i síra mají čas přes zimu zreagovat) — mimo okno se karta vůbec neukáže.
//
// Dvě cesty:
//   (a) ZÁHONOVÁ vápnění jako greenManure — per záhon obsahující košťáloviny (Brassica
//       přes nameLat v geometrickém bedForPin) navrhne podzimní vápnění,
//   (b) PER-PIN okyselení pro acidofilní rody (ACID_LOVING_GENERA přes nameLat v gate
//       kere/trvalky/ovoce) navrhne okyselení / kontrolu pH.
import { dateForMonth } from '../components/RecommendedTasks.jsx';
import { bedForPin } from './cropRotation.js';
import { daysFromToday } from '../utils.js';

// Sezónní okno, kdy se karty vůbec ukazují (pozdní podzim — vápno/síra zreagují přes zimu).
export const SOIL_PH_SEASON = [10, 11]; // říjen–listopad

// Ideální kotevní měsíc. V listopadu kotvíme na listopad, ať dateForMonth nepřeskočí na
// říjen PŘÍŠTÍHO roku (rollover) a termín zůstane v letošní podzimní sezóně.
const SOIL_PH_IDEAL_MONTH = 10;

// Jak daleko dopředu per-pin okyselení nabízíme (dny) — sezónní, surface s předstihem.
export const SOIL_PH_HORIZON_DAYS = 75;

const SOIL_PH_EMOJI = '🧪'; // úprava půdy (reakce) ~ task_type hnojeni

// Rod košťálovin (= první slovo nameLat) — bed s ním navrhne podzimní vápnění.
const BRASSICA_GENUS = 'Brassica';

// Acidofilní RODY (klíč = první slovo nameLat). Gate kere/trvalky/ovoce. Kurátorský
// seznam — rostliny, které ve střední Evropě potřebují kyselou půdu (pH ~4,5–5,5).
export const ACID_LOVING_GENERA = {
  Vaccinium: true,    // borůvka — ovoce
  Rhododendron: true, // pěnišník / azalka — kere
  Calluna: true,      // vřes — kere
  Pieris: true,       // pieris — kere
  // kurátorské (nemusí být v DB — match se prostě nestane)
  Erica: true,        // vřesovec
  Camellia: true,     // kamélie
  Gaultheria: true,   // libavka / pernettya
  Kalmia: true,       // kalmie
};

// Kategorie, kterých se okyselení týká (acidofilní dřeviny/trvalky/drobné ovoce).
const ACID_CATEGORIES = new Set(['kere', 'trvalky', 'ovoce']);

// ---- pure helpery (timezone-safe, lokální složky) ----
function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}

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

// Je rostlina acidofilní (gate kategorie + rod v ACID_LOVING_GENERA)? Přijímá enriched záznam.
export function acidLovingAppliesTo(plant) {
  if (!plant) return false;
  const cat = categoryKey(plant);
  if (!ACID_CATEGORIES.has(cat)) return false;
  const genus = genusOf(plant);
  return !!(genus && ACID_LOVING_GENERA[genus]);
}

// Dedup na úrovni ZÁHONU (vápnění): některý úkol v záhonu už LETOS nese marker vápnění
// v titulku. Dedup je jen dle TITULKU — task_type 'hnojeni' je příliš obecný (sdílí ho
// běžné přihnojení), takže by nad ním dedup falešně potlačoval jiné úkony.
function bedHasLiming(tasks, marker, year) {
  if (!tasks?.length || !marker) return false;
  const mk = String(marker).toLowerCase();
  const yr = String(year);
  return tasks.some(
    (tk) => tk
      && String(tk.specific_date || '').slice(0, 4) === yr
      && String(tk.title || '').toLowerCase().includes(mk),
  );
}

// Dedup na úrovni PINU (okyselení): pin už má v cílovém měsíci (letos / opakovaně) úkol
// s markerem okyselení / „pH" v titulku. Opět jen dle TITULKU (task_type 'hnojeni' obecný).
function hasAcidifyInMonth(pinTasks, month, curYear, marker) {
  const mk = marker ? String(marker).toLowerCase() : null;
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    const title = e.title || '';
    if (mk && title.toLowerCase().includes(mk)) return true;
    if (title.includes('pH')) return true; // jazykově nezávislá pojistka („Změřit pH"…)
  }
  return false;
}

// (a) ZÁHONOVÉ VÁPNĚNÍ — vrať záhony s košťálovinami, které lze na podzim povápnit
// (řazeno dle názvu záhonu). Mimo sezónu (10–11) → []. Termín = 15. dne kotevního měsíce
// posunutý dle podmínek, nikdy do minulosti (jeden termín pro celou zahradu jako greenManure).
//   pins/beds  = aktuální piny a záhony zahrady,
//   lookup     = findPlantByName,
//   conditions = garden conditions (posun termínu),
//   existingByPin = mapa pin_id → [tasky] (dedup na úrovni záhonu),
//   dedupMarker   = lokalizovaná značka vápnění v titulku pro dedup („vápn").
export function soilLimingForGarden({
  pins, beds, lookup, conditions = null, existingByPin = {}, dedupMarker = null, now = new Date(),
}) {
  const month = now.getMonth() + 1;
  if (!SOIL_PH_SEASON.includes(month)) return [];
  if (!Array.isArray(beds) || !Array.isArray(pins) || typeof lookup !== 'function') return [];

  const todayISO = isoLocal(now);
  const year = now.getFullYear();
  const anchor = Math.max(SOIL_PH_IDEAL_MONTH, month); // v listopadu kotvi na listopad
  const cal = dateForMonth(anchor, conditions);
  const suggested = cal < todayISO ? todayISO : cal; // nikdy do minulosti
  const m = monthFromIso(suggested);

  const out = [];
  for (const bed of beds) {
    const bedPins = pins.filter((p) => bedForPin(p, [bed]) === bed);
    if (!bedPins.length) continue; // bez pinů netušíme, co v záhonu roste
    const hasBrassica = bedPins.some(
      (p) => p?.plant_name && typeof lookup === 'function' && genusOf(lookup(p.plant_name)) === BRASSICA_GENUS,
    );
    if (!hasBrassica) continue;
    // Dedup na úrovni záhonu — některý pin v záhonu už má letos naplánované vápnění.
    const bedTasks = bedPins.flatMap((p) => existingByPin[p.id] || []);
    if (bedHasLiming(bedTasks, dedupMarker, year)) continue;

    out.push({
      bedId: bed.id,
      bedName: bed.name,
      bedColor: bed.color || null,
      pinId: bedPins[0].id, // reprezentativní pin v záhonu (úkol potřebuje pin_id)
      suggested,
      month: m,
      emoji: SOIL_PH_EMOJI,
    });
  }
  return out.sort((a, b) => String(a.bedName || '').localeCompare(String(b.bedName || '')));
}

// (b) PER-PIN OKYSELENÍ — vrať návrh okyselení pro pin (pole 0–1 hintů, kvůli paritě
// s ostatními kartami). Nabídne se, je-li rostlina acidofilní, jsme v sezóně (10–11),
// termín je v budoucnu (po clampu na dnešek) a v horizontu. Mimo gate / mimo sezónu /
// chybějící rostlina → []. conditions = pin.garden_conditions (posun termínu),
// dedupMarker = lokalizovaná značka okyselení v titulku („okysel"). `now` injektovatelné.
export function soilAcidifyForPin(pin, plant, conditions, dedupMarker = null, now = new Date()) {
  if (!pin || !plant) return [];
  if (!acidLovingAppliesTo(plant)) return [];

  const curMonth = now.getMonth() + 1;
  if (!SOIL_PH_SEASON.includes(curMonth)) return []; // mimo sezónu (10–11)

  const anchor = Math.max(SOIL_PH_IDEAL_MONTH, curMonth); // v listopadu kotvi na listopad
  let suggested = dateForMonth(anchor, conditions);
  let due = daysFromToday(suggested);
  if (due === null) return [];
  if (due < 0) {
    // ideál už minul (pozdní podzim) — naplánuj na dnešek, nikdy do minulosti.
    suggested = isoLocal(now);
    due = 0;
  }
  if (due > SOIL_PH_HORIZON_DAYS) return [];

  const m = monthFromIso(suggested);
  if (hasAcidifyInMonth(pin.tasks || [], m, now.getFullYear(), dedupMarker)) return [];

  return [{
    kind: 'acidify',
    month: m,
    suggested,
    due,
    taskType: 'hnojeni',
    emoji: SOIL_PH_EMOJI,
  }];
}
