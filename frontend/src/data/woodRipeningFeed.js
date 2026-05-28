// Podzimní draselné přihnojení pro vyzrání dřeva — konec dusíku, posílení mrazuvzdornosti.
// Koncem léta a začátkem podzimu je u TRVALÝCH DŘEVIN (ovocné stromy/keře, růže, vinná réva,
// okrasné keře, popínavé) HLAVNÍ sezónní úkon PŘEJÍT Z DUSÍKATÉHO NA DRASELNO-FOSFOREČNÉ
// (PK) HNOJENÍ — draslík podpoří VYZRÁNÍ LETOŠNÍHO DŘEVA (jeho zdřevnatění) a tím
// MRAZUVZDORNOST před zimou. Pozdní dusík by naopak hnal měkký přírůstek, který v zimě
// nevyzrálý pomrzne.
//
// Tahle vrstva cíleně DOPLŇUJE data/soilPh.js (úprava REAKCE půdy — vápnění/okyselení)
// i běžné přihnojení z RecommendedTasks/BulkCareModal — tohle je SPECIFICKÉ pozdně-letní
// PK okno se ZÁKAZEM dusíku, vázané na vyzrání dřeva: jiný účel (zazimování × výživa
// růstu), žádný překryv.
//
// ČISTĚ KLIENTSKÁ vrstva — žádné nové schéma ani endpoint. Měsíc PK přihnojení =
// dateForMonth(month, conditions) → posun dle klim. zóny/expozice (jeden zdroj pravdy
// s RecommendedTasks/winterPrep/soilPh…; v chladnějších zónách dřív, aby dřevo stihlo
// vyzrát ještě před mrazem — strukturální posun dělá dateForMonth jednotně).
//
// Sezónní gate (WOOD_RIPENING_SEASON = 8–9, po hlavním růstu, před koncem vegetace) —
// mimo okno se karta vůbec neukáže. Termín nikdy do minulosti (pozdní září → naplánuj
// na dnešek, jako trunkWhitewash). Gate na TRVALÉ DŘEVINY (ovoce/stromy/kere/popinave);
// byliny/trvalky/zelenina/letnicky/cibuloviny nemají vyzrávající dřevo → mimo gate.
import { dateForMonth } from '../components/RecommendedTasks.jsx';
import { daysFromToday } from '../utils.js';

// Jak daleko dopředu úkol nabízíme (dny). PK přihnojení je sezónní — surface okno
// s rozumným předstihem, ne celoročně.
export const WOOD_RIPENING_HORIZON_DAYS = 60;

// Sezónní okno, kdy kartu vůbec ukazujeme (konec léta / začátek podzimu, po hlavním
// růstu, před koncem vegetace; pozdější dusík by hnal měkký přírůstek do mrazu).
export const WOOD_RIPENING_SEASON = [8, 9]; // srpen–září

// Ideální kotevní měsíc. V září kotvíme na září, ať dateForMonth nepřeskočí na srpen
// PŘÍŠTÍHO roku (rollover) a termín zůstane v letošní podzimní sezóně.
const WOOD_RIPENING_IDEAL_MONTH = 8;

const WOOD_RIPENING_EMOJI = '🍂';

// Kategorie, kterých se PK přihnojení týká (trvalé dřeviny — mají letošní přírůstek,
// který musí přes zimu vyzrát). Záměrně VYŘAZENO: byliny/trvalky/zelenina/letnicky/
// cibuloviny (jednoletky a měkké trvalky nemají vyzrávající dřevo); jehličnany v naší
// DB drží zvlášť (`jehlicnany`) a klasické zazimování řeší trunkWhitewash/winterPrep —
// pro PK okno je gate záměrně užší, ať se karta nenabízí pod každou tújí.
const WOOD_RIPENING_CATEGORIES = new Set(['ovoce', 'stromy', 'kere', 'popinave']);

// enrichPlant nahrazuje category za CATEGORY_DEFS objekt ({key,…}); přijmeme i holý string.
function categoryKey(plant) {
  const c = plant?.category;
  if (!c) return null;
  return typeof c === 'string' ? c : c.key || null;
}

// Je rostlina trvalá dřevina, které pomůže PK přihnojení? Přijímá enriched záznam.
export function woodRipeningAppliesTo(plant) {
  if (!plant) return false;
  return WOOD_RIPENING_CATEGORIES.has(categoryKey(plant));
}

function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}

function isoToday(now) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Pin už má v měsíci PK přihnojení (letos / opakovaně) naplánovaný úkon s markerem
// draselného hnojení v titulku? Dedup JEN dle TITULKU — task_type 'hnojeni' je příliš
// obecný (sdílí ho běžné přihnojení dusíkem), takže by nad ním dedup falešně potlačoval.
// Marker je lokalizovaný (cs „draseln" / en „potassium" / de „kalium" …) + jazykově
// nezávislé pojistky „PK" a „K2O" (chemická značka, stejná napříč jazyky).
function hasWoodRipeningInMonth(pinTasks, month, curYear, marker) {
  const mk = marker ? String(marker).toLowerCase() : null;
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    const title = (e.title || '').trim();
    const lowered = title.toLowerCase();
    if (mk && lowered.includes(mk)) return true;
    // Jazykově nezávislé pojistky (chemická značka).
    if (/\bPK\b|K2O/i.test(title)) return true;
  }
  return false;
}

// Hlavní logika: vrať návrh PK přihnojení pro pin (pole 0–1 hintů, kvůli paritě se
// sourozeneckými kartami). Nabídne se, je-li rostlina trvalá dřevina, jsme v sezóně
// (8–9), termín je v budoucnu (po clampu na dnešek) a v horizontu. Mimo gate / mimo
// sezónu / chybějící rostlina → []. conditions = pin.garden_conditions (posun termínu),
// dedupMarker = lokalizovaná značka draselného přihnojení v titulku („draseln"…) pro
// dedup. `now` injektovatelné pro test.
export function woodRipeningForPin(pin, plant, conditions, dedupMarker = null, now = new Date()) {
  if (!pin || !plant) return [];
  if (!woodRipeningAppliesTo(plant)) return [];

  const curMonth = now.getMonth() + 1;
  if (!WOOD_RIPENING_SEASON.includes(curMonth)) return []; // mimo sezónu (8–9)

  // V září kotvi na září (jinak dateForMonth přeskočí na srpen PŘÍŠTÍHO roku).
  const anchorMonth = Math.max(WOOD_RIPENING_IDEAL_MONTH, curMonth);
  let suggested = dateForMonth(anchorMonth, conditions); // okno (posun klim. zóny)
  let due = daysFromToday(suggested);
  if (due === null) return [];
  if (due < 0) {
    // ideál už minul (pozdní září) — naplánuj na dnešek, nikdy do minulosti.
    suggested = isoToday(now);
    due = 0;
  }
  if (due > WOOD_RIPENING_HORIZON_DAYS) return [];

  const m = monthFromIso(suggested);
  if (hasWoodRipeningInMonth(pin.tasks || [], m, now.getFullYear(), dedupMarker)) return [];

  return [{
    kind: 'woodRipening',
    month: m,
    suggested,
    due,
    taskType: 'hnojeni',
    emoji: WOOD_RIPENING_EMOJI,
  }];
}
