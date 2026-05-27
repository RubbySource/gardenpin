// Množení řízkováním — kdy nařezat a zakořenit řízky keřů a trvalek.
// „Namnož si rostliny zdarma" je oblíbený HLAVNÍ sezónní úkon: u keřů, popínavých
// a polodřevitých trvalek/bylin se množí ŘÍZKY v přesném okně dle TYPU řízku:
//   - bylinné / zelené řízky (softwood)  → 5–6, z měkkého jarního/letního přírůstku,
//   - polovyzrálé řízky      (semiripe)  → 7–9, nejširší skupina okrasných keřů,
//   - dřevité / vyzrálé      (hardwood)  → 10–11, opadavé keře přes zimu venku.
//
// Tahle vrstva cíleně DOPLŇUJE data/divisionTasks.js (ten DĚLÍ trsy trvalek/trav)
// i data/ageTasks.js (ten ŘEŽE dřeviny dle stáří) — přidává ROZMNOŽOVÁNÍ řízky jako
// samostatný úkon, ne řez ani dělení.
//
// ČISTĚ KLIENTSKÁ vrstva — žádné nové schéma ani endpoint. Měsíc řízkování =
// dateForMonth(month, conditions) → posun dle klim. zóny/expozice/výšky (jeden zdroj
// pravdy s RecommendedTasks/ageTasks/divisionTasks/sowingTasks/bulbPlanting). Nabídne
// se jen je-li okno v BUDOUCNU a v horizontu (~90 dní) — jinak se skryje.
//
// Matchování přes DRUH (genus + species) nebo ROD (první slovo nameLat), DRUH má
// přednost (jako winterPrep/sowingTasks): Salvia officinalis / S. rosmarinus (dřevnaté
// středomořské) se řízkují, kdežto Salvia nemorosa (bylinná trvalka) se DĚLÍ → ta je
// mimo mapu. Dřeviny matchují jen v kategorii kere/popinave (CUTTING_WOODY); vybrané
// polodřevité trvalky/byliny mimo tyto kategorie (Levandule/Pelargonie/Fuchsie) matchují
// napříč kategoriemi přes explicitní allow (CUTTING_SEMIWOODY / CUTTING_SPECIES).
//
// Mapa je ZÁMĚRNĚ SELEKTIVNÍ (kurátorská) — řada dřevin se množí jinak (Magnolia/
// Rhododendron hřížením/roubováním, Syringa/Prunus roubováním, Corylus/Amelanchier
// hřížením/odkopky). Takové rody v mapě NEJSOU → vrátí []. Ovoce (Ribes) a stromy
// (Salix, Cornus mas) jsou mimo gate kere/popinave → []. Mrazově citlivý oleandr
// (Nerium) řeší zazimování (winterPrep), do řízkové mapy nepatří.
import { dateForMonth } from '../components/RecommendedTasks.jsx';
import { daysFromToday } from '../utils.js';

// Jak daleko dopředu řízkování nabízíme (dny). Řízkování je sezónní — surface
// nadcházející okno s rozumným předstihem, ne celoročně.
export const CUTTING_HORIZON_DAYS = 90;

const CUTTING_EMOJI = '✂️';

// Typ řízku → kotevní měsíc okna (anchor 15. dne, posunut dateForMonth dle podmínek).
//   softwood = bylinné/zelené řízky z měkkého jarního přírůstku (5–6),
//   semiripe = polovyzrálé řízky z letního, na bázi již dřevnatějícího výhonu (7–9),
//   hardwood = dřevité/vyzrálé řízky z opadu, kořenící přes zimu venku (10–11).
export const CUTTING_TYPES = {
  softwood: { month: 6 },
  semiripe: { month: 8 },
  hardwood: { month: 11 },
};

// Dřeviny (keře/popínavé) — match jen v kategorii kere/popinave. Klíč = ROD
// (první slovo nameLat). Kurátorský výběr rodů, kde je řízkování standardní metoda.
export const CUTTING_WOODY = {
  // bylinné / zelené řízky (jaro–začátek léta, z měkkého přírůstku)
  Buddleja: 'softwood',      // komule
  Hydrangea: 'softwood',     // hortenzie (i popínavá petiolaris)
  Philadelphus: 'softwood',  // pustoryl
  Deutzia: 'softwood',       // trojpuk
  Weigela: 'softwood',       // vajgélie
  Spiraea: 'softwood',       // tavolník
  Perovskia: 'softwood',     // perovskie
  Kolkwitzia: 'softwood',    // kolkvície
  Potentilla: 'softwood',    // mochna keříčková
  // polovyzrálé řízky (léto, na bázi dřevnatějící výhon)
  Buxus: 'semiripe',         // zimostráz
  Berberis: 'semiripe',      // dřišťál
  Cotoneaster: 'semiripe',   // skalník
  Cotinus: 'semiripe',       // ruj
  Euonymus: 'semiripe',      // brslen
  Lonicera: 'semiripe',      // zimolez (keřový i popínavý)
  Photinia: 'semiripe',      // blýskavka
  Pieris: 'semiripe',        // pieris
  Skimmia: 'semiripe',       // skimmie
  Viburnum: 'semiripe',      // kalina
  Osmanthus: 'semiripe',     // vonokvětka
  Mahonia: 'semiripe',       // mahónie
  Aucuba: 'semiripe',        // aukuba
  Ilex: 'semiripe',          // cesmína
  Clematis: 'semiripe',      // plamének (popínavá)
  Hedera: 'semiripe',        // břečťan (popínavá)
  Campsis: 'semiripe',       // trubač (popínavá)
  // dřevité / vyzrálé řízky (podzim–zima, z opadu, venku)
  Cornus: 'hardwood',        // svída (kere; Cornus mas/kousa/florida jsou stromy → mimo gate)
  Forsythia: 'hardwood',     // zlatice
  Sambucus: 'hardwood',      // bez
  Ligustrum: 'hardwood',     // ptačí zob
  Symphoricarpos: 'hardwood',// pámelník
  Physocarpus: 'hardwood',   // tavola
  Parthenocissus: 'hardwood',// loubinec (popínavá)
};

// Polodřevité trvalky / byliny mimo kategorii kere/popinave — match napříč kategoriemi
// (explicitní allow). Levandule (bylinky), Pelargonie / Fuchsie (okrasné/letničky).
export const CUTTING_SEMIWOODY = {
  Lavandula: 'semiripe',     // levandule — polovyzrálé řízky po odkvětu
  Pelargonium: 'softwood',   // pelargonie / muškát — zelené řízky k přezimování mladých rostlin
  Fuchsia: 'softwood',       // fuchsie — měkké vrcholové řízky
};

// DRUH má přednost před RODEM — dřevnaté druhy rodu se smíšenými členy. Salvia officinalis
// (šalvěj lékařská) i S. rosmarinus (rozmarýn) jsou polodřevité → řízkují se; S. nemorosa
// (šalvěj hajní, bylinná trvalka) se DĚLÍ (divisionTasks) → v mapě NENÍ.
export const CUTTING_SPECIES = {
  'Salvia officinalis': 'semiripe',
  'Salvia rosmarinus': 'semiripe',
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

// Vrať pravidlo řízkování pro rostlinu ({ type }), nebo null. DRUH má přednost před RODEM;
// dřeviny matchují jen v kategorii kere/popinave, vybrané polodřevité trvalky/byliny napříč.
export function cuttingRuleForPlant(plant) {
  if (!plant) return null;
  const lat = String(plant.nameLat || '').trim();
  // 1) DRUH (genus + species) má přednost
  for (const sp in CUTTING_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return { type: CUTTING_SPECIES[sp] };
  }
  const genus = genusOf(plant);
  if (!genus) return null;
  // 2) polodřevité trvalky/byliny mimo kere/popinave (explicitní allow napříč kategoriemi)
  if (CUTTING_SEMIWOODY[genus]) return { type: CUTTING_SEMIWOODY[genus] };
  // 3) dřeviny — jen v kategorii kere/popinave
  const cat = categoryKey(plant);
  if ((cat === 'kere' || cat === 'popinave') && CUTTING_WOODY[genus]) {
    return { type: CUTTING_WOODY[genus] };
  }
  return null;
}

function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}

// Pin už má v měsíci řízkování (letos / opakovaně) naplánované množení? Dedup v duchu
// sowingTasks.hasSowingInMonth: potlač, má-li pin v cílovém měsíci task_type 'presazeni'
// NEBO titulek s „řízk"/„množ". Pozn.: NEdedupujeme dle emoji ✂️ — to nese i řez
// (task_type 'strihani'), takže by řez ve stejném měsíci falešně potlačil řízkový nudge.
function hasCuttingInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type === 'presazeni') return true;
    const title = (e.title || '').trim();
    if (/říz(k|n)|množ/i.test(title)) return true;
  }
  return false;
}

// Hlavní logika: vrať návrh řízkování pro pin (pole 0–1 hintů, kvůli paritě s
// divisionTasks/sowingTasks/bulbPlanting kartami). Nabídne se, je-li rostlina v mapě
// řízkování a sezónní okno (dle typu řízku) je v budoucnu a v horizontu. Mimo gate /
// rody množené jinak / chybějící rostlina → []. conditions = pin.garden_conditions
// (posun termínu). `now` injektovatelné pro test (rok dedupu; termín drží dateForMonth).
export function cuttingTaskForPin(pin, plant, conditions, now = new Date()) {
  if (!pin || !plant) return [];
  const rule = cuttingRuleForPlant(plant);
  if (!rule) return [];
  const typeDef = CUTTING_TYPES[rule.type];
  if (!typeDef) return [];

  const suggested = dateForMonth(typeDef.month, conditions); // okno řízkování (posun zóny)
  const due = daysFromToday(suggested);
  if (due === null || due < 0 || due > CUTTING_HORIZON_DAYS) return [];

  const m = monthFromIso(suggested);
  if (hasCuttingInMonth(pin.tasks || [], m, now.getFullYear())) return [];

  return [{
    kind: 'cutting',
    type: rule.type,
    month: m,
    suggested,
    due,
    taskType: 'presazeni',
    emoji: CUTTING_EMOJI,
  }];
}
