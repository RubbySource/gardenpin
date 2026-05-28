// Jarní opory pro vzrostlé trvalky a popínavé — postav podpěry, NEŽ rostlina vyžene.
// U vysokých, převislých nebo poléhavých trvalek (pivoňka, ostrožka, georgina, vysoká
// lilie, slunečnice) a u popínavých (plamének, pnoucí růže, vistárie, chmel) je HLAVNÍ
// jarní úkon POSTAVIT OPORY A VYVÁZAT VÝHONY VČAS — dřív, než rostlina vyžene, aby
// nepoléhala a aby se opora schovala v listoví, ne aby se „dopichovala" do hotového trsu.
//
// 3 TYPY opory (STAKING_TYPES) dle růstu rostliny:
//   - ring    = kruhová / prostorová opora → 4, rozkleslé trsy s těžkými květy
//               (Paeonia / Phlox / Lupinus — postavit, jak trs raší),
//   - stake   = opěrná tyč → 5, vysoké jednotlivé stonky a klasy
//               (Delphinium / Lilium / Dahlia / Gladiolus / Helianthus — i mrazově
//               citlivé jiřiny/gladioly vysazené po mrazech),
//   - trellis = treláž / opora k vyvázání → 4, popínavé
//               (Clematis / Rosa-pnoucí / Wisteria / Humulus / Lonicera-pnoucí).
//
// Tahle vrstva cíleně DOPLŇUJE sezónní řez (ageTasks/perennialCutback) i výsadbu
// (bulbPlanting/sowingTasks) — instalace opory je JINÁ akce (konstrukce / vyvázání),
// jiné okno (4–5), žádný překryv s žádnou existující vrstvou.
//
// ČISTĚ KLIENTSKÁ vrstva — žádné nové schéma ani endpoint. Měsíc postavení opory =
// dateForMonth(month, conditions) → posun dle klim. zóny/expozice/výšky (jeden zdroj
// pravdy s RecommendedTasks/graftingTasks/divisionTasks/sowingTasks…). Nabídne se jen
// je-li okno v BUDOUCNU a v horizontu (~75 dní) — jinak (mimo sezónu 4–5) se skryje.
//
// GATE — POZOR, ODCHYLKA OD SPECU (v duchu opravy fruitThinning): spec psal gate jen
// {trvalky, popinave}, ale v REÁLNÉ plantDatabase řada klíčových opěrných rostlin žije
// MIMO tyto dvě kategorie — Dahlia (jiřina) je `okrasne`, Lilium/Gladiolus `cibuloviny`,
// vzrostlá Helianthus (slunečnice) `okrasne`/`letnicky`. Gate {trvalky, popinave} by tedy
// minul jiřinu (kterou spec výslovně chce!). Proto je gate ROZŠÍŘEN na
// STAKING_CATEGORIES a skutečným selektorem je kurátorská mapa STAKING_GENERA keyovaná na
// ROD (první slovo nameLat). Gate přitom DŮLEŽITĚ vyřazuje kolize rodů:
//   - Rosa: pnoucí/rambler růže je `popinave` (→ treláž), kdežto keřová „Růže zahradní"
//     je `bylinky` (mimo gate → null) — keřová růže oporu nepotřebuje,
//   - Helianthus: vzrostlá slunečnice je `okrasne`/`letnicky` (→ tyč), kdežto topinambur
//     (Helianthus tuberosus) je `zelenina` (mimo gate → null),
//   - Lonicera: pnoucí zimolez je `popinave` (→ treláž), kdežto keřový Lonicera nitida je
//     `kere` (mimo gate → null).
// Mapa je ZÁMĚRNĚ SELEKTIVNÍ — nízké kompaktní trvalky (Hosta/Bergenia/Heuchera…), trávy,
// dřeviny a zelenina nejsou v mapě → null.
import { dateForMonth } from '../components/RecommendedTasks.jsx';
import { daysFromToday } from '../utils.js';

// Jak daleko dopředu opory nabízíme (dny). Sezónní — surface nadcházející jarní okno
// s předstihem, ne celoročně.
export const STAKING_HORIZON_DAYS = 75;

const STAKING_EMOJI = '🪜';

// Typ opory → kotevní měsíc (anchor 15. dne, posunut dateForMonth dle podmínek). Okno 4–5.
//   ring    = kruhová / prostorová opora — postavit brzy zjara, jak trs raší (4),
//   stake   = opěrná tyč — při výsadbě / jak stonky dorůstají, i mrazově citlivé (5),
//   trellis = treláž — vyvázat nový jarní přírůstek včas (4).
export const STAKING_TYPES = {
  ring: { month: 4 },
  stake: { month: 5 },
  trellis: { month: 4 },
};

// Kategorie, ve kterých vůbec hledáme (gate). Viz hlavička — širší než spec, protože
// jiřina/lilie/gladiola/slunečnice žijí mimo trvalky/popinave; skutečný selektor je
// STAKING_GENERA. Bylinky/zelenina/kere/travy/vodni/sukulenty/stromy/ovoce jsou MIMO →
// vyřadí keřovou růži, topinambur i keřový zimolez (kolize rodů).
export const STAKING_CATEGORIES = new Set([
  'trvalky', 'popinave', 'okrasne', 'letnicky', 'cibuloviny',
]);

// Rody vhodné k podepření — klíč = ROD (první slovo nameLat), hodnota = typ opory.
// Kurátorský výběr vysokých / poléhavých / popínavých rodů. Match jen v gate
// STAKING_CATEGORIES (viz hlavička — řeší kolize Rosa/Helianthus/Lonicera).
export const STAKING_GENERA = {
  // rozkleslé trsy s těžkými květy → kruhová / prostorová opora
  Paeonia: 'ring',     // pivoňka — květy po dešti polehnou
  Phlox: 'ring',       // flox latnatý — vysoký rozkleslý trs
  Lupinus: 'ring',     // lupina — rozkleslý trs
  // vysoké jednotlivé stonky / klasy → opěrná tyč
  Delphinium: 'stake', // ostrožka — vysoké křehké klasy
  Lilium: 'stake',     // lilie — vysoký stonek s těžkými květy
  Dahlia: 'stake',     // jiřina (georgina) — křehké duté stonky (okrasne)
  Gladiolus: 'stake',  // gladiola — těžký květní klas (cibuloviny)
  Helianthus: 'stake', // slunečnice — vysoký stonek (okrasne/letnicky; topinambur je mimo gate)
  // popínavé → treláž / opora k vyvázání
  Clematis: 'trellis', // plamének
  Rosa: 'trellis',     // pnoucí / rambler růže (keřová růže je mimo gate → bylinky)
  Wisteria: 'trellis', // vistárie
  Humulus: 'trellis',  // chmel
  Lonicera: 'trellis', // pnoucí zimolez (keřový Lonicera nitida je mimo gate → kere)
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

// Vrať pravidlo opory pro rostlinu ({ type }), nebo null. Match jen v gate
// STAKING_CATEGORIES a je-li rod v STAKING_GENERA.
export function stakingRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (!cat || !STAKING_CATEGORIES.has(cat)) return null;
  const genus = genusOf(plant);
  if (genus && STAKING_GENERA[genus]) return { type: STAKING_GENERA[genus] };
  return null;
}

function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}

// Pin už má v měsíci opory (letos / opakovaně) naplánovaný úkon? Dedup JEN dle TITULKU
// (marker „opor"/„vyváz"/„podpěr") — task_type je `jine` (příliš obecný, dedup nad ním by
// falešně potlačoval jiné úkony). Marker „opor" zachytí i vlastní titulek „Postavit oporu".
function hasSupportInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    const title = (e.title || '').trim();
    if (/opor|vyváz|podpěr/i.test(title)) return true;
  }
  return false;
}

// Hlavní logika: vrať návrh opory pro pin (pole 0–1 hintů, kvůli paritě s ostatními
// kartami). Nabídne se, je-li rostlina v mapě opor a sezónní okno (dle typu) je v budoucnu
// a v horizontu. Mimo gate / rody mimo mapu / chybějící rostlina → []. conditions =
// pin.garden_conditions (posun termínu). `now` injektovatelné pro test (rok dedupu).
export function plantSupportForPin(pin, plant, conditions, now = new Date()) {
  if (!pin || !plant) return [];
  const rule = stakingRuleForPlant(plant);
  if (!rule) return [];
  const typeDef = STAKING_TYPES[rule.type];
  if (!typeDef) return [];

  const suggested = dateForMonth(typeDef.month, conditions); // okno opory (posun zóny)
  const due = daysFromToday(suggested);
  if (due === null || due < 0 || due > STAKING_HORIZON_DAYS) return [];

  const m = monthFromIso(suggested);
  if (hasSupportInMonth(pin.tasks || [], m, now.getFullYear())) return [];

  return [{
    kind: 'support',
    type: rule.type,
    month: m,
    suggested,
    due,
    taskType: 'jine',
    emoji: STAKING_EMOJI,
  }];
}
