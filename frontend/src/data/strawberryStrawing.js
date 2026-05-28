// Mulčování jahodníku slámou před sklizní — ochrana plodů (typicky 5).
// U jahodníku (Fragaria) je HLAVNÍ pozdně-jarní úkon ROZPROSTŘÍT VRSTVU SUCHÉ
// SLÁMY mezi rostliny a pod rozvíjející se květenství těsně předtím, než začnou
// plody dozrávat. Sláma drží plody NAD ZEMÍ (nešpiní se, neuhnijí kontaktem
// s vlhkou půdou), odrazí SLIMÁKY/PLŽE (kteří mají sláďu rádi), omezí výpar
// z půdy a poskytne stabilní vlhkost kořenovému balu. Klasický CZ úkon —
// anglicky „strawberry strawing" (odtud anglický termín „straw-berry").
//
// Tahle vrstva cíleně DOPLŇUJE:
//   - data/strawberryRenewal.js — ten ŘEŽE staré listy + odebírá odnože PO
//     sklizni v 7. JINÉ okno (pomulčování PŘED × obnova PO sklizni), JINÝ účel,
//     JINÁ část rostliny.
//   - data/springMulching.js — ten ukládá KŮRU/ŠTĚPKU pro trvalky/dřeviny v 4–5.
//     JINÝ MATERIÁL (sláma × kůra/štěpka), navíc Fragaria je z springMulching
//     vyloučená (přidáme rod do SPRING_MULCH_GENERA_EXCLUDE), aby si Fragaria
//     vyžádala specifický „sláma" úkon namísto generického „kůra/štěpka" mulče.
//   - data/fruitNetting.js — ten síťuje dozrávající jahodník v 6 (proti ptákům).
//     JINÝ úkon, jiné okno, jiný účel; oba úkony jsou roční a nezasahují do sebe.
// Žádný překryv.
//
// ČISTĚ KLIENTSKÁ vrstva — žádné nové schéma ani endpoint. Měsíc strawingu =
// dateForMonth (jeden zdroj pravdy s RecommendedTasks/strawberryRenewal/
// springMulching…) → posun dle klim. zóny/expozice (chladnější zóny později —
// později kvetou a později dozrávají, proto pozdější sláma). Návrh nikdy do
// minulosti (minulá okna → []), horizont 40 dní — krátký, protože akce je úzce
// vázaná na fenologickou fázi „květy nasazené, plody ještě zelené, brzy začnou
// dozrávat".
//
// GATE: jen `ovoce` — jahodník je v ovoci jako drobné ovoce.
//
// SELEKTOR — kurátorská GENERA klíčovaná na ROD (první slovo nameLat):
//   Fragaria → 5   (typicky polovina/konec května, právě před začátkem
//                   dozrávání plodů; pokud květenství ještě nízko/na zemi,
//                   sláma drží plody nad zemí)
//
// SPECIES je prázdná — rod Fragaria je dostatečně úzký (žádný překryv s lesní
// Fragaria vesca / měsíční Fragaria vesca var. semperflorens / 'Mara des Bois'
// → všechny chtějí slámu stejně). Forward-looking pro pozdní remontantní
// kultivary („Mara des Bois") s druhou vlnou v 7 — prozatím jen primární okno
// v 5; pokud bude potřeba, lze přidat species-level výjimku later.
import { dateForMonth } from '../components/RecommendedTasks.jsx';
import { daysFromToday } from '../utils.js';

// Jak daleko dopředu strawing nabízíme (dny). Krátký horizont — akce je vázaná
// na fenologickou fázi (rozvinuté květenství, plody ještě zelené) těsně před
// dozráváním, kterou si uživatel chce naplánovat s mírným předstihem.
export const STRAWBERRY_STRAWING_HORIZON_DAYS = 40;

const STRAWBERRY_STRAWING_EMOJI = '🌾';

// Gate — jen `ovoce` (jahodník je v reálné plantDatabase pod CATEGORY_DEFS.fruits
// → key='ovoce'). Žádná jiná kategorie nemá pro slámu smysl.
export const STRAWBERRY_STRAWING_CATEGORIES = new Set([
  'ovoce',
]);

// ROD → kotevní měsíc okna (anchor 15. dne, posunut dateForMonth dle podmínek).
// Volba měsíce dle typické fenologie v ČR — jahodník kvete koncem dubna /
// začátkem května, plody dozrávají typicky od konce května do poloviny června;
// slámu chceme rozprostřít TĚSNĚ PŘED dozráváním, tedy v polovině května.
export const STRAWBERRY_STRAWING_GENERA = {
  Fragaria: 5,
};

// SPECIES s předností před RODEM — prozatím prázdná (rod Fragaria je dostatečně
// úzký a všechny druhy v DB sdílí stejný harmonogram). Forward-looking slot pro
// remontantní kultivary s druhou vlnou.
export const STRAWBERRY_STRAWING_SPECIES = {};

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

// Vrať pravidlo strawingu pro rostlinu ({ month }), nebo null. DRUH má přednost
// před RODEM; match jen v gate `ovoce`.
export function strawberryStrawingRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (!STRAWBERRY_STRAWING_CATEGORIES.has(cat)) return null;
  const lat = String(plant.nameLat || '').trim();
  // 1) DRUH má přednost — exact match nebo prefix s mezerou (kultivar)
  for (const sp in STRAWBERRY_STRAWING_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return { month: STRAWBERRY_STRAWING_SPECIES[sp] };
  }
  // 2) ROD
  const genus = genusOf(plant);
  if (genus && STRAWBERRY_STRAWING_GENERA[genus]) return { month: STRAWBERRY_STRAWING_GENERA[genus] };
  return null;
}

function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}

// Pin už má v měsíci strawingu (letos / opakovaně) naplánované mulčování slámou?
// DVOUFÁZOVÝ dedup — task_type `jine` je obecný (sdílí ho mulčování/pinčování/
// opory/sběr semen…), samotný task_type by potlačoval i nesouvisející úkoly.
// Vyžaduje task_type `jine` SOUČASNĚ S markerem v titulku (slám / straw / jahod…mulč
// / strawberry…straw). Marker pokrývá CZ/SK/PL/EN podobu termínu:
//   - „slám"           → český/slovenský STEM („sláma" / „slámou" / „slamou" — SK
//                         píše bez čárky; stem „slám" zachytí oba přes podřetězec
//                         „slám" v „slámou" a stem „slam" v SK přes shodnou
//                         podobu „slamou"; pro SK doplníme „slam" alternativou)
//   - „slam"           → slovenský STEM („slama"/„slamou") — bez akcentu
//   - „straw"          → anglický termín („strawberry straw" / „straw mulch")
//   - „słom"           → polský STEM („słoma"/„słomą")
//   - „jahod.*mulč"    → kombinace „Mulčování jahodníku" / „jahody mulčovat"
//   - „strawberry.*straw" → anglický pořad slov pro EN/DE lokalizaci
//   - „erdbeere.*stroh" / „stroh.*erdbeere" → DE pořad slov
function hasStrawberryStrawingInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type !== 'jine') continue;
    const title = (e.title || '').trim();
    if (/slám|slam|straw|słom|stroh|jahod.*mulč|strawberry.*straw/i.test(title)) return true;
  }
  return false;
}

// Hlavní logika: vrať návrh strawingu pro pin (pole 0–1 hintů, parita se sourozeneckými
// kartami). Nabídne se, je-li rostlina jahodník (Fragaria) a sezónní okno je v budoucnu
// a v horizontu. Mimo gate / jiné drobné ovoce (rybíz/maliník/borůvka) / chybějící rostlina → [].
// conditions = pin.garden_conditions (posun termínu). `now` injektovatelné pro test.
export function strawberryStrawingForPin(pin, plant, conditions, now = new Date()) {
  if (!pin || !plant) return [];
  const rule = strawberryStrawingRuleForPlant(plant);
  if (!rule) return [];

  const suggested = dateForMonth(rule.month, conditions); // okno strawingu (posun zóny)
  const due = daysFromToday(suggested);
  if (due === null || due < 0 || due > STRAWBERRY_STRAWING_HORIZON_DAYS) return [];

  const m = monthFromIso(suggested);
  if (hasStrawberryStrawingInMonth(pin.tasks || [], m, now.getFullYear())) return [];

  return [{
    kind: 'strawberryStrawing',
    month: m,
    suggested,
    due,
    taskType: 'jine',
    emoji: STRAWBERRY_STRAWING_EMOJI,
  }];
}
