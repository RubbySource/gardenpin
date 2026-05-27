// Roubování a očkování ovocných stromů — jarní roubování + letní očkování.
// U ovocných stromů (a okrasných dřevin množených na podnož) je HLAVNÍ sezónní úkon
// množení/přeštěpování ROUBY a OČKY v přesných oknech dle TYPU:
//   - jarní roubování (spring) → 3–4, kopulace / za kůru / do boku, když začíná proudit
//     míza a podnož raší — jádroviny (Malus/Pyrus/Cydonia/Sorbus),
//   - letní očkování   (summer) → 7–8, T-očkování na spící oko, kdy se kůra dobře
//     odlupuje — peckoviny (Prunus) a ořešák (Juglans, amatérsky spolehlivější očkováním).
//
// Tahle vrstva cíleně DOPLŇUJE data/cuttingTasks.js (ten ŘÍZKUJE keře/trvalky),
// data/divisionTasks.js (ten DĚLÍ trsy) i data/ageTasks.js (ten ŘEŽE dle stáří) —
// roubování je JINÁ akce (spojení s podnoží), jiný okruh rostlin (ovoce/stromy) a jiné
// okno, žádný překryv. Pozn.: keřová svída (Cornus alba) je v cuttingTasks (kere → řízky),
// kdežto stromový dřín (Cornus mas, trees) tady → očkování — gate je rozdělí.
//
// ČISTĚ KLIENTSKÁ vrstva — žádné nové schéma ani endpoint. Měsíc roubování =
// dateForMonth(month, conditions) → posun dle klim. zóny/expozice/výšky (jeden zdroj
// pravdy s RecommendedTasks/cuttingTasks/ageTasks/divisionTasks/sowingTasks/bulbPlanting).
// Nabídne se jen je-li okno v BUDOUCNU a v horizontu (~90 dní) — jinak se skryje.
//
// Matchování přes DRUH (genus + species) nebo ROD (první slovo nameLat), DRUH má
// přednost (jako winterPrep/cuttingTasks): Cornus mas (dřín — stromový, jeho ušlechtilé
// plodné kultivary se očkují) matchuje jako DRUH, kdežto Cornus kousa/florida (okrasné
// svídy) zůstanou mimo (rod Cornus není v GRAFTING_GENERA). Rody matchují jen v kategorii
// ovoce/stromy (GRAFTING_GENERA).
//
// Mapa je ZÁMĚRNĚ SELEKTIVNÍ (kurátorská) — drobné ovoce (Ribes/Vaccinium/Rubus/Fragaria)
// se množí řízky/odnožemi, ne roubováním → v mapě NEJSOU. Stromy množené generativně /
// řízky (Betula/Acer/Quercus/Tilia/Salix…) tu také nejsou → vrátí []. Mrazově citlivé /
// keřové druhy řeší jiné vrstvy.
import { dateForMonth } from '../components/RecommendedTasks.jsx';
import { daysFromToday } from '../utils.js';

// Jak daleko dopředu roubování nabízíme (dny). Roubování je sezónní — surface nadcházející
// okno s rozumným předstihem, ne celoročně.
export const GRAFTING_HORIZON_DAYS = 90;

const GRAFTING_EMOJI = '🌳';

// Typ roubování → kotevní měsíc okna (anchor 15. dne, posunut dateForMonth dle podmínek).
//   spring = jarní roubování (roub) — kopulace / za kůru / do boku (3–4, míza proudí),
//   summer = letní očkování (očko) — T-očkování na spící oko (7–8, kůra se odlupuje).
export const GRAFTING_TYPES = {
  spring: { month: 4 },
  summer: { month: 8 },
};

// Rody vhodné k roubování — match jen v kategorii ovoce/stromy. Klíč = ROD (první slovo
// nameLat). Kurátorský výběr, kde je roubování/očkování standardní metoda množení.
export const GRAFTING_GENERA = {
  // jádroviny — jarní roubování (kopulace, za kůru)
  Malus: 'spring',    // jabloň + okrasná jabloň
  Pyrus: 'spring',    // hrušeň
  Cydonia: 'spring',  // kdouloň
  Sorbus: 'spring',   // jeřáb / oskeruše (jádrovina, roubuje se na Sorbus aucuparia)
  // peckoviny + ořešák — letní očkování na spící oko
  Prunus: 'summer',   // třešeň / švestka / broskvoň / meruňka + okrasné sakury/slivoně
  Juglans: 'summer',  // ořešák — amatérsky spolehlivější letní čipové očkování
};

// DRUH má přednost před RODEM — pro rody se smíšenými členy. Cornus mas (dřín obecný,
// stromová ovocná dřevina) se u ušlechtilých plodných kultivarů OČKUJE, kdežto okrasné
// svídy stejného rodu (Cornus kousa/florida) se množí jinak → rod Cornus v GENERA NENÍ,
// jen tento druh.
export const GRAFTING_SPECIES = {
  'Cornus mas': 'summer',
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

// Vrať pravidlo roubování pro rostlinu ({ type }), nebo null. DRUH má přednost před RODEM;
// match jen v kategorii ovoce/stromy.
export function graftingRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (cat !== 'ovoce' && cat !== 'stromy') return null;
  const lat = String(plant.nameLat || '').trim();
  // 1) DRUH (genus + species) má přednost
  for (const sp in GRAFTING_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return { type: GRAFTING_SPECIES[sp] };
  }
  // 2) ROD
  const genus = genusOf(plant);
  if (genus && GRAFTING_GENERA[genus]) return { type: GRAFTING_GENERA[genus] };
  return null;
}

function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}

// Pin už má v měsíci roubování (letos / opakovaně) naplánovaný úkon? Dedup v duchu
// cuttingTasks.hasCuttingInMonth: potlač, má-li pin v cílovém měsíci task_type 'presazeni'
// NEBO titulek s „roub"/„očk"/„štěp".
function hasGraftingInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type === 'presazeni') return true;
    const title = (e.title || '').trim();
    if (/roub|očk|štěp/i.test(title)) return true;
  }
  return false;
}

// Hlavní logika: vrať návrh roubování pro pin (pole 0–1 hintů, kvůli paritě s
// cuttingTasks/divisionTasks/sowingTasks/bulbPlanting kartami). Nabídne se, je-li rostlina
// v mapě roubování a sezónní okno (dle typu) je v budoucnu a v horizontu. Mimo gate ovoce/
// stromy / rody množené jinak / chybějící rostlina → []. conditions = pin.garden_conditions
// (posun termínu). `now` injektovatelné pro test (rok dedupu; termín drží dateForMonth).
export function graftingTaskForPin(pin, plant, conditions, now = new Date()) {
  if (!pin || !plant) return [];
  const rule = graftingRuleForPlant(plant);
  if (!rule) return [];
  const typeDef = GRAFTING_TYPES[rule.type];
  if (!typeDef) return [];

  const suggested = dateForMonth(typeDef.month, conditions); // okno roubování (posun zóny)
  const due = daysFromToday(suggested);
  if (due === null || due < 0 || due > GRAFTING_HORIZON_DAYS) return [];

  const m = monthFromIso(suggested);
  if (hasGraftingInMonth(pin.tasks || [], m, now.getFullYear())) return [];

  return [{
    kind: 'grafting',
    type: rule.type,
    month: m,
    suggested,
    due,
    taskType: 'presazeni',
    emoji: GRAFTING_EMOJI,
  }];
}
