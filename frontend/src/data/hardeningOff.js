// Otužování předpěstovaných sazenic (hardening off) — postupné vystavení ven před výsadbou.
// U sazenic vypěstovaných v interiéru / skleníku (košťáloviny, salát, rajče, paprika, okurka,
// dýně, cuketa, letničky) je HLAVNÍ pozdně-jarní úkon 7–14 DENNÍ POSTUPNÉ OTUŽOVÁNÍ před
// výsadbou natrvalo ven. Bez otužování listy spálí slunce, vítr poláme stonky a teplotní šok
// (z 22 °C uvnitř na 5–10 °C noc venku) zastaví růst o 2–3 týdny — i kdyby sazenice přežila,
// neotužená paralela z dohnaného neotuženého výsadbu nedoženě otuženou kontrolní skupinu.
// Klasický protokol: dny 1–2 ve stínu 1–2 h, dny 3–4 stín 3–4 h, dny 5–7 ranní slunce,
// dny 8–10 plné slunce, dny 11–14 přes noc ven (pokud T_min > 10 °C).
//
// 3 OKNA (HARDENING_OFF_TYPES):
//   - coolSeason  = 4 (duben) → studenokříže — košťáloviny / salát; výsadba ven 5,
//   - warmSeason  = 5 (květen, po ledových mužích ~15. 5.) → teplomilné — rajče/paprika/lilek/okurka,
//   - heatLoving  = 6 (červen) → subtropy — dýně/cuketa/tykev; výsadba 5/6 podle počasí.
//
// Tahle vrstva cíleně DOPLŇUJE:
//   - data/sowingTasks.js — ten plánuje VÝSEV uvnitř (předpěstování); otužování je krok PŘED
//     výsadbou ven (po předpěstování, před presazením), jiná akce / jiný účel.
//   - data/frostSmart.js — ten přeplánuje úkony citlivé na mráz; otužování je aktivita PŘÍPRAVY
//     na ven (ne přesun frost-sensitive úkonů). Žádný překryv.
//   - components/RecommendedTasks.jsx — per-pin sezónní úkony z plantDatabase.seasonalTasks;
//     otužování je doplnění mimo seasonalTasks, vázané na konkrétní kategorii rostlin (zelenina/letnicky).
//
// ČISTĚ KLIENTSKÁ vrstva — žádné nové schéma ani endpoint. Měsíc otužování = dateForMonth (jeden
// zdroj pravdy s RecommendedTasks/strawberryRenewal/pinching/peachLeafCurlSpray) → posun dle
// klim. zóny/expozice (chladnější zóny pozdější výsadba ⇒ pozdější otužování). Návrh nikdy do
// minulosti (minulá okna → []), horizont 50 dní.
//
// GATE: kategorie `zelenina`/`letnicky` + (rod nebo druh) v mapě. Skutečným selektorem je
// kurátorská mapa HARDENING_OFF_GENERA / HARDENING_OFF_SPECIES — gate je hrubý předfiltr,
// aby nepustil dřeviny/cibuloviny/trvalky/sukulenty (mimo gate → null automaticky).
//
// PŘEDPOKLAD PŘEDPĚSTOVÁNÍ: pin v reálné DB nemá flag `start_indoor`. Fallback — všechny rody
// v GENERA jsou v ČR/EU TYPICKY předpěstovávané uvnitř (rajče/paprika/okurka/dýně/košťáloviny/
// salát se reálně předpěstovávají; mrkev/ředkev/řepa, které se vysévají rovnou ven, NEJSOU
// v GENERA → odpadnou mimo mapu, žádný falešný návrh otužování). Když budou pinky s flagem
// `start_indoor`, můžeme zúžit; do té doby gate + GENERA stačí.
//
// ZÁMĚRNĚ VYNECHÁNO z mapy (žádný mrtvý klíč — model fruitNetting/strawberryRenewal/pinching):
//   - `Citrullus` (vodní meloun) — v REÁLNÉ plantDatabase aktuálně NENÍ; spec backlogu ho jmenuje,
//     ale forward-looking klíče bez 1+ rostliny v DB jsou mrtvé klíče a sanity test by je odhalil.
//     Přidat, až dorazí.
//   - `Cucumis melo` (cantaloupe) — v DB nejsou žádné melouny; rod `Cucumis` zachytí jen okurky.
import { dateForMonth } from '../components/RecommendedTasks.jsx';
import { daysFromToday } from '../utils.js';

// Jak daleko dopředu otužování nabízíme (dny). Sezónní — surface nadcházející okno s předstihem
// (uživatel si potřebuje připravit truhlíky / místo na stínu), ne celoročně.
export const HARDENING_OFF_HORIZON_DAYS = 50;

const HARDENING_OFF_EMOJI = '🌤️';

// Typ otužování → kotevní měsíc okna (anchor 15. dne, posunut dateForMonth dle podmínek).
//   coolSeason = studenokříže (košťáloviny/salát) — duben, výsadba ven začátkem května,
//   warmSeason = teplomilné (rajče/paprika/okurka/lilek) — květen, výsadba po ledových mužích,
//   heatLoving = subtropy (dýně/cuketa/tykev) — červen, výsadba 5/6 podle počasí.
export const HARDENING_OFF_TYPES = {
  coolSeason: { month: 4 },
  warmSeason: { month: 5 },
  heatLoving: { month: 6 },
};

// Kategorie, ve kterých vůbec hledáme (gate). `zelenina` pro zeleninové sazenice, `letnicky` pro
// předpěstovávané letničky (petúnie, surfinie, aksamitníky, zinie — všechny se otužují).
// Stromy/keře/popínavé/cibuloviny/trvalky/bylinky/sukulenty/vodní/jehličnany jsou MIMO →
// trvalky/cibuloviny rostou venku celé jaro (otužování nedává smysl).
export const HARDENING_OFF_CATEGORIES = new Set(['zelenina', 'letnicky']);

// Rody vhodné k otužování — klíč = ROD (první slovo nameLat), hodnota = typ otužování.
// Match jen v gate HARDENING_OFF_CATEGORIES; jen rody s ≥1 reálnou rostlinou v DB (žádný mrtvý
// klíč — sanity test to hlídá; Citrullus/Cucumis melo vědomě vyřazeny, viz hlavička).
export const HARDENING_OFF_GENERA = {
  // coolSeason — studenokříže (košťáloviny, salát); výsadba ven začátkem května
  Brassica: 'coolSeason', // brokolice, květák, kapusta, kedluben, zelí, ředkvička pekingská…
  Lactuca: 'coolSeason',  // salát (Lactuca sativa) + odrůdy
  // warmSeason — teplomilné (rajče, paprika, lilek, okurka); výsadba po ledových mužích
  Solanum: 'warmSeason',  // rajče (Solanum lycopersicum), lilek (S. melongena); S. tuberosum → null přes SPECIES
  Capsicum: 'warmSeason', // paprika (Capsicum annuum) + jalapeño, kapie, bohémia
  Cucumis: 'warmSeason',  // okurka (Cucumis sativus) + cornichon, hadovka
  // heatLoving — subtropy (dýně, cuketa, tykev); výsadba 5/6 podle počasí
  Cucurbita: 'heatLoving', // cuketa (C. pepo), dýně (C. maxima), patizon, hokkaido, atlantic giant…
};

// DRUH má přednost před RODEM (model fruitThinning/strawberryRenewal/pinching SPECIES precedence).
// Tady kvůli kolizím rodů, kde jen NĚKTERÉ druhy se otužují:
//   - Solanum tuberosum (brambor) — sazečka jde rovnou do země z kupní bedny, nepředpěstovává se
//     v truhlíku a neotužuje se. Forward-looking exclusion proti rodu Solanum (rajče/lilek = ANO).
//     Aktuálně v DB NENÍ → species je čistě FORWARD-LOOKING, sanity test dead-key check
//     filtruje null hodnoty (intentional exclusion) a forward-looking syntetický test ověří chování.
export const HARDENING_OFF_SPECIES = {
  'Solanum tuberosum': null, // brambor — neotužuje se (sazečka rovnou do země)
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

// Vrať pravidlo otužování pro rostlinu ({ type }), nebo null. DRUH má přednost před RODEM;
// match jen v gate HARDENING_OFF_CATEGORIES (skutečný selektor je mapa, ne gate).
// Pokud SPECIES vrací null (intentional exclusion jako Solanum tuberosum), vrátíme null PŘÍMO
// — neprobereme se na rod (jinak by brambor matchnul Solanum → warmSeason chyba).
export function hardeningOffRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (!cat || !HARDENING_OFF_CATEGORIES.has(cat)) return null;
  const lat = String(plant.nameLat || '').trim();
  // 1) DRUH (genus + species) má přednost — i null hodnota (intentional exclusion)
  for (const sp in HARDENING_OFF_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) {
      const t = HARDENING_OFF_SPECIES[sp];
      return t ? { type: t } : null; // null = forward-looking exclusion (např. Solanum tuberosum)
    }
  }
  // 2) ROD
  const genus = genusOf(plant);
  if (genus && HARDENING_OFF_GENERA[genus]) return { type: HARDENING_OFF_GENERA[genus] };
  return null;
}

function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}

// Pin už má v měsíci otužování (letos / opakovaně) naplánovaný úkon? Dedup JEN dle TITULKU —
// task_type `presazeni` je sdílen s běžnou výsadbou ven, takže by nad ním dedup falešně
// potlačoval výsadbu po otužování. Marker pokrývá všechny formy / všechny jazyky:
//   - „otuž" zachytí české „otužovat/otužování" + slovesný titulek („Otužit …") + polské „otuż",
//   - „otuze" zachytí německé „abhärten" (úkon „abhärten" → titulek „Abhärten der …"; varianta
//     bez ASCII fold „otuže" pro fold-bezpečnost),
//   - „harden" zachytí anglické „harden off / hardening off",
//   - „aklimatiz" zachytí univerzální termín „aklimatizace/aclimatize/Akklimatisierung",
//   - „abhärt" zachytí čistě německé „abhärten" (kořenová morf),
//   - „hartowan" zachytí polské „hartowanie sadzonek" (kořenová morf).
function hasHardeningOffInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    const title = (e.title || '').trim();
    if (/otuž|otuze|harden|aklimatiz|abhärt|hartowan/i.test(title)) return true;
  }
  return false;
}

// Hlavní logika: vrať návrh otužování pro pin (pole 0–1 hintů, kvůli paritě se sourozeneckými
// kartami). Nabídne se, je-li rostlina v mapě otužování (rod/druh v gate) a sezónní okno (dle
// typu) je v budoucnu a v horizontu. Mimo gate / mimo mapy / chybějící rostlina → []. conditions
// = pin.garden_conditions (posun termínu). `now` injektovatelné pro test (rok dedupu; termín
// drží dateForMonth).
export function hardeningOffForPin(pin, plant, conditions, now = new Date()) {
  if (!pin || !plant) return [];
  const rule = hardeningOffRuleForPlant(plant);
  if (!rule) return [];
  const typeDef = HARDENING_OFF_TYPES[rule.type];
  if (!typeDef) return [];

  const suggested = dateForMonth(typeDef.month, conditions); // okno otužování (posun zóny)
  const due = daysFromToday(suggested);
  if (due === null || due < 0 || due > HARDENING_OFF_HORIZON_DAYS) return [];

  const m = monthFromIso(suggested);
  if (hasHardeningOffInMonth(pin.tasks || [], m, now.getFullYear())) return [];

  return [{
    kind: 'hardeningOff',
    type: rule.type,
    month: m,
    suggested,
    due,
    taskType: 'presazeni',
    emoji: HARDENING_OFF_EMOJI,
  }];
}
