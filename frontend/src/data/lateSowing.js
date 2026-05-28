// Letní výsev pro pozdní/zimní sklizeň — second sowing window (7–10).
// Po sklizni hlavní jarní zeleniny se uvolňují záhony a je HLAVNÍ pozdně-letní/podzimní
// úkon VYUŽÍT PRÁZDNÉ ZÁHONY K DRUHÉMU VÝSEVU chladovzdorných druhů pro podzimní/zimní
// sklizeň (špenát, polníček, zimní salát, ředkvička podzimní, rukola, mangold, řepa)
// a v 10 navíc OZIMÝ ČESNEK na další rok. Pozdní výsev = druhá úroda ze stejného záhonu,
// aniž by půda ležela ladem. Druhy jsou ZÁMĚRNĚ chladovzdorné — startují na chladu,
// horké léto by je vyhnalo do květu.
//
// 4 OKNA (LATE_SOWING_TYPES):
//   - midsummer   = 7 (mangold/řepa/ředkvička podzimní pro sklizeň v 8–9),
//   - lateSummer  = 8 (špenát/polníček/rukola — startují na chladu, přezimují),
//   - earlyAutumn = 9 (zimní salát, polníček podruhé),
//   - autumn      = 10 (ozimý česnek — Allium sativum, sázba pro sklizeň v 6–7 příštího roku).
//
// Tahle vrstva cíleně DOPLŇUJE:
//   - data/sowingTasks.js — ten plánuje HLAVNÍ jarní VÝSEV do PŘEDPĚSTOVÁNÍ (3–5,
//     teplomilné plodiny — rajče/paprika/okurka/dýně/letničky); pozdní výsev je naopak
//     PŘÍMO DO ZÁHONU venku (chladomilné plodiny). Jiné okno (7–10 × 3–5), jiný účel
//     (přímý výsev × předpěstování), jiné plodiny (chladomilné × teplomilné).
//   - data/hardeningOff.js — ten otužuje předpěstované sazenice (3 okna 4–6); pozdní
//     výsev je rovnou ven (žádné otužování netřeba). Jiné okno, jiná akce.
//   - data/greenManure.js — ten plánuje zelené hnojení na PRÁZDNÉ záhony BEZ plodiny
//     (jetel/svazenka/hořčice — meziplodina, ne úroda); pozdní výsev je naopak ÚRODOVÁ
//     plodina. JINÝ účel (půdní vrstva × sklizeň), žádný překryv.
//
// ČISTĚ KLIENTSKÁ vrstva — žádné nové schéma ani endpoint. Měsíc výsevu = dateForMonth
// (jeden zdroj pravdy s RecommendedTasks/sowingTasks/hardeningOff) → posun dle klim.
// zóny/expozice. POZN. SMĚR POSUNU: chladnější zóny mají kratší vegetační sezónu na
// konci léta/podzim ⇒ pozdní výsev je tam KRITIČTĚJŠÍ STARTOVAT DŘÍV (aby plodina
// stihla narůst před mrazy). dateForMonth ovšem standardně chladnější zóny VŠECHNY
// úkony posouvá POZDĚJI (kvete to později, jaro je pozdější). Pro symetrii s ostatními
// vrstvami ho ponecháváme tak jak je — uživatel si v notes uvidí, že chladnější zóny
// mají agresivněji startovat (instrukce zmíní „v chladnějších zónách výsev DO konce
// měsíce, ne až ke konci okna"). Návrh nikdy do minulosti (minulá okna → []), horizont
// 60 dní (jako sourozenecké summerPruning/summerRosePruning/peachLeafCurlSpray).
//
// GATE: kategorie `zelenina` + (rod nebo druh) v mapě. Skutečným selektorem je
// kurátorská mapa LATE_SOWING_GENERA / LATE_SOWING_SPECIES — gate je hrubý předfiltr,
// aby nepustil dřeviny/cibuloviny/trvalky/letničky/bylinky (mimo gate → null
// automaticky).
//
// task_type: `presazeni` — `vysev` v taxonomii TASK_TYPES neexistuje (v duchu
// hardeningOff: spec uváděl neexistující `presazovani`, použili jsme `presazeni`).
// `presazeni` je sdílen se sowingTasks.js (jarní výsev) a s běžnou výsadbou ven, ale
// v měsících 7–10 už jarní sowingTasks neaktivní a běžné přesazování v 7–10 je vzácné
// (jaro/podzim), takže task_type dedup v cílovém měsíci je dostatečně přesný.
// + marker v titulku jako pojistka pro EN/DE/PL/SK.
import { dateForMonth } from '../components/RecommendedTasks.jsx';
import { daysFromToday } from '../utils.js';

// Jak daleko dopředu pozdní výsev nabízíme (dny). Sezónní — surface nadcházející okno
// s rozumným předstihem (uživatel potřebuje připravit záhon, nakoupit semena), ne
// celoročně. 60 dní = parita se sourozeneckými letními vrstvami.
export const LATE_SOWING_HORIZON_DAYS = 60;

const LATE_SOWING_EMOJI = '🌱';

// Typ pozdního výsevu → kotevní měsíc okna (anchor 15. dne, posunut dateForMonth dle
// podmínek). Čtyři okna pokrývají typické fáze pozdního léta/podzimu:
//   midsummer   = 7 (mangold/řepa/ředkvička podzimní — sklizeň 8–9),
//   lateSummer  = 8 (špenát/polníček/rukola — chladomilné startují na chladu),
//   earlyAutumn = 9 (zimní salát, polníček podruhé),
//   autumn      = 10 (ozimý česnek — sázba pro sklizeň v 6–7 příštího roku).
export const LATE_SOWING_TYPES = {
  midsummer:   { month: 7 },
  lateSummer:  { month: 8 },
  earlyAutumn: { month: 9 },
  autumn:      { month: 10 },
};

// Kategorie, ve kterých vůbec hledáme (gate). `zelenina` — všechny relevantní druhy
// (špenát/polníček/rukola/mangold/řepa/ředkvička/zimní salát/česnek) jsou v `zelenina`
// (česnek `Allium sativum` je v `zelenina`, ne v `cibuloviny`). Letničky/bylinky/dřeviny
// mimo scope.
export const LATE_SOWING_CATEGORIES = new Set(['zelenina']);

// Rody vhodné pro pozdní výsev — klíč = ROD (první slovo nameLat), hodnota = typ okna.
// Match jen v gate LATE_SOWING_CATEGORIES; jen rody s ≥1 reálnou rostlinou v DB (žádný
// mrtvý klíč — sanity test to hlídá).
//
// Záměrně NEZAHRNUTÉ rody (kolize / nehodící se):
//   - Solanum (rajče/lilek/brambor): jarní teplomilná plodina, nesnese chlad → null automaticky
//   - Capsicum (paprika): totéž
//   - Cucumis/Cucurbita: jarní teplomilné, nemají pozdní výsev → null automaticky
//   - Allium (rod): jen ozimý česnek `Allium sativum` přes SPECIES; cibule kuchyňská
//     `A. cepa` se nesází ze semene v 10, pórek `A. porrum` má jaro, pažitka trvalka
//   - Brassica (rod): rod má smíšené chování — některé letní výsevy by chytly nesprávné
//     plodiny (kapusta brusselská má jiný cyklus než ředkev čínská). Záměrně přes
//     SPECIES jen ty, kde to dává smysl (žádné aktuálně — forward-looking).
export const LATE_SOWING_GENERA = {
  // midsummer = 7 (sklizeň v 8–9, ještě teplo na klíčení)
  Beta: 'midsummer',         // mangold (B. vulgaris var. cicla) + řepa salátová (B. v. conditiva)
  // lateSummer = 8 (chladomilné listové — startují na chladu, přezimují)
  Spinacia: 'lateSummer',    // špenát (Spinacia oleracea) + 'Matador'
  Valerianella: 'lateSummer',// polníček (Valerianella locusta)
  Eruca: 'lateSummer',       // rukola (Eruca vesicaria)
  // earlyAutumn = 9 (zimní salát — Lactuca sativa odrůdy zimní; rod Lactuca obecně)
  Lactuca: 'earlyAutumn',    // salát hlávkový a varianty (var. crispa/capitata/longifolia)
};

// DRUH má přednost před RODEM (model sowingTasks/hardeningOff SPECIES precedence).
// Tady kvůli:
//   - Allium sativum (česnek ozimý) — rod Allium záměrně NENÍ v GENERA (mixed kontext),
//     proto SPECIES jednorázově přidává jen česnek se sázbou v 10.
//   - Raphanus sativus (ředkvička podzimní) — rod Raphanus má jen tuto plodinu v DB,
//     ale midsummer výsev (ne lateSummer) — proto SPECIES explicitně 'midsummer'.
//     Daikon (Raphanus sativus var. longipinnatus) dědí přes startsWith.
export const LATE_SOWING_SPECIES = {
  'Allium sativum':   'autumn',     // ozimý česnek — sázba stroužků v 10, sklizeň 6–7 příštího roku
  'Raphanus sativus': 'midsummer',  // ředkvička podzimní + daikon (přes startsWith)
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

// Vrať pravidlo pozdního výsevu pro rostlinu ({ type }), nebo null. DRUH má přednost
// před RODEM; match jen v gate LATE_SOWING_CATEGORIES (skutečný selektor je mapa,
// ne gate).
export function lateSowingRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (!cat || !LATE_SOWING_CATEGORIES.has(cat)) return null;
  const lat = String(plant.nameLat || '').trim();
  // 1) DRUH (genus + species) má přednost
  for (const sp in LATE_SOWING_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) {
      const t = LATE_SOWING_SPECIES[sp];
      return t ? { type: t } : null;
    }
  }
  // 2) ROD
  const genus = genusOf(plant);
  if (genus && LATE_SOWING_GENERA[genus]) return { type: LATE_SOWING_GENERA[genus] };
  return null;
}

function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}

// Pin už má v měsíci pozdního výsevu (letos / opakovaně) naplánovaný výsev? DVOUFÁZOVÝ
// dedup — task_type `presazeni` je sdílen se sowingTasks a běžnou výsadbou (i když
// v 7–10 je obojí vzácné), proto kombinujeme AND s markerem v titulku jako pojistka:
//   - „druhý výsev" zachytí české slovesné/podstatné formy + vlastní titulek,
//   - „late.*sow" anglické „late sowing / late summer sowing",
//   - „ozimý česnek" specifický termín pro autumn okno,
//   - „second.*sow" anglické „second sowing" (alias).
// task_type `presazeni` SAMOSTATNĚ stačí (v cílovém měsíci 7–10 je už primární výsev
// dávno mimo sezónu), marker je jazyková pojistka pro EN/DE/PL/SK.
function hasLateSowingInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type === 'presazeni') return true;
    const title = (e.title || '').trim();
    if (/druhý výsev|late.*sow|ozimý česnek|second.*sow/i.test(title)) return true;
  }
  return false;
}

// Hlavní logika: vrať návrh pozdního výsevu pro pin (pole 0–1 hintů, kvůli paritě se
// sourozeneckými kartami). Nabídne se, je-li rostlina v mapě pozdního výsevu (rod/druh
// v gate) a sezónní okno (dle typu) je v budoucnu a v horizontu. Mimo gate / mimo mapy
// / chybějící rostlina → []. conditions = pin.garden_conditions (posun termínu). `now`
// injektovatelné pro test (rok dedupu; termín drží dateForMonth).
export function lateSowingForPin(pin, plant, conditions, now = new Date()) {
  if (!pin || !plant) return [];
  const rule = lateSowingRuleForPlant(plant);
  if (!rule) return [];
  const typeDef = LATE_SOWING_TYPES[rule.type];
  if (!typeDef) return [];

  const suggested = dateForMonth(typeDef.month, conditions); // okno pozdního výsevu
  const due = daysFromToday(suggested);
  if (due === null || due < 0 || due > LATE_SOWING_HORIZON_DAYS) return [];

  const m = monthFromIso(suggested);
  if (hasLateSowingInMonth(pin.tasks || [], m, now.getFullYear())) return [];

  return [{
    kind: 'lateSowing',
    type: rule.type,
    month: m,
    suggested,
    due,
    taskType: 'presazeni',
    emoji: LATE_SOWING_EMOJI,
  }];
}
