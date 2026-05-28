// Sběr semen z odkvetlých rostlin — podzimní samosběr pro příští sezónu.
// U letniček, vybraných bylinek a samozásobitelské zeleniny je HLAVNÍ pozdně-letní /
// podzimní úkon SEBRAT ZASCHLÉ SEMENÍKY / LUSKY / NAŽKY a uskladnit semena na sucho
// do papírových sáčků: uchovává odrůdu pro příští sezónu, šetří za nákup osiva a
// u některých druhů (mák, koriandr, hrachor) je samosběr nejspolehlivější cesta
// k opakované úrodě.
//
// 3 OKNA (SEED_SAVING_TYPES):
//   - earlyAutumn = 8 (srpen) → koriandr / kopr / měsíček (jemné nažky, dozrávají brzy),
//   - midAutumn   = 9 (září)  → slunečnice / Zinnia / Tagetes (semena dozrávají v září),
//   - lateAutumn  = 10 (říjen) → orlíček / mák (semeníky musí pořádně zaschnout).
//
// Tahle vrstva cíleně DOPLŇUJE:
//   - běžnou „sklizeň" / harvest historii (ta loguje PLODY K JÍDLU, ne semena pro výsev),
//   - data/sowingTasks.js — ten plánuje VÝSEV ZJARA, tohle je SBĚR SEMENE NA PODZIM
//     pro NÁSLEDUJÍCÍ jarní výsev (jiný směr v ročním cyklu, žádný překryv),
//   - data/woodRipeningFeed.js — ten je o trvalých DŘEVINÁCH a PK přihnojení; tohle
//     o BYLINÁCH a sběru semen, ani gate ani okno se nepřekrývá.
//
// ČISTĚ KLIENTSKÁ vrstva — žádné nové schéma ani endpoint. Okno sběru = dateForMonth(month,
// conditions) → posun dle klim. zóny/expozice/výšky (jeden zdroj pravdy s RecommendedTasks/
// pinching/strawberryRenewal…; v chladnějších zónách pozdější dozrání semen ⇒ pozdější
// sběr — strukturální posun dělá dateForMonth jednotně). Nabídne se jen je-li okno
// v BUDOUCNU a v horizontu (~75 dní), jinak se skryje — „mimo sezónu → []" je tak
// přirozený důsledek future+horizont kontroly (stejný model jako pinching/fruitNetting;
// návrh nikdy do minulosti).
//
// GATE: kategorie `letnicky`/`bylinky`/`trvalky`/`zelenina`/`okrasne` + (rod nebo druh)
// v mapě. Skutečný selektor je kurátorská mapa SEED_SAVING_GENERA / SEED_SAVING_SPECIES —
// gate je hrubý předfiltr, aby nepustil dřeviny/cibuloviny/sukulenty (mimo gate → null
// automaticky). `okrasne` v gate je nutné, aby prošel Měsíček lékařský (Calendula
// officinalis v REÁLNÉ DB kategorie `okrasne`, ne `bylinky`) a druhá entry Slunečnice
// (Helianthus annuus má v DB dvě entry — `letnicky` i `okrasne`, sběr semen platí pro obě).
//
// DRUH má přednost před RODEM (model pinching/strawberryRenewal SPECIES precedence), kvůli
// kolizi rodu Helianthus:
//   - Helianthus annuus (letnicky/okrasne) → midAutumn (klasická slunečnice na nažky),
//   - Helianthus tuberosus (topinambur, zelenina) → null (množí se HLÍZAMI, ne semeny;
//     rod Helianthus záměrně NENÍ v GENERA, takže přes mapu vůbec neprojde).
//
// ZÁMĚRNĚ VYNECHÁNO z mapy (žádný mrtvý klíč — model fruitNetting/pinching):
//   - Cosmos / Papaver (mák) / Lathyrus (hrachor) / Nigella (černucha) / Carum (kmín) —
//     v REÁLNÉ plantDatabase aktuálně nejsou; spec backlogu je výslovně jmenuje, ale
//     forward-looking klíče bez 1+ rostliny v DB jsou „mrtvé klíče" a sanity test by je
//     odhalil. Přidat až dorazí do plantDatabase.
import { dateForMonth } from '../components/RecommendedTasks.jsx';
import { daysFromToday } from '../utils.js';

// Jak daleko dopředu sběr nabízíme (dny). Sezónní — surface nadcházející okno s předstihem,
// ne celoročně. Mírně širší horizont než pinching (60), protože tahle vrstva má TŘI okna
// 8–9–10 a uživatel ocení vidět nejbližší + plánovat dál.
export const SEED_SAVING_HORIZON_DAYS = 75;

const SEED_SAVING_EMOJI = '🌾';

// Typ sběru → kotevní měsíc okna (anchor 15. dne, posunut dateForMonth dle podmínek).
//   earlyAutumn = jemné nažky bylinek a měsíčku — srpen,
//   midAutumn   = vysoké letničky — září,
//   lateAutumn  = tobolky / makovice trvalek — říjen.
export const SEED_SAVING_TYPES = {
  earlyAutumn: { month: 8 },
  midAutumn: { month: 9 },
  lateAutumn: { month: 10 },
};

// Kategorie, ve kterých vůbec hledáme (gate). `okrasne` v gate je nutné pro Calendula
// (která je v REÁLNÉ DB kategorie okrasne, ne bylinky) a alternativní entry Slunečnice;
// dřeviny/cibuloviny/sukulenty/popinave jsou MIMO (nesbírají se sezónně nažky tímhle
// stylem — ovoce má sklizeň, cibuloviny dceřinné cibule, sukulenty řízky).
export const SEED_SAVING_CATEGORIES = new Set(['letnicky', 'bylinky', 'trvalky', 'zelenina', 'okrasne']);

// Rody vhodné ke sběru semen — klíč = ROD (první slovo nameLat), hodnota = typ okna.
// Match jen v gate SEED_SAVING_CATEGORIES; jen rody s ≥1 reálnou rostlinou v DB (žádný
// mrtvý klíč — sanity test to hlídá; Cosmos/Papaver/Lathyrus/Nigella/Carum vědomě vyřazeny,
// viz hlavička). Pro kolizi rodu Helianthus (annuus vs. tuberosus) je v GENERA Helianthus
// ZÁMĚRNĚ vynechán — řeší to SPECIES precedence (jen H. annuus → midAutumn).
export const SEED_SAVING_GENERA = {
  // earlyAutumn — bylinky se semenem dozrávajícím v srpnu
  Coriandrum: 'earlyAutumn', // koriandr setý (Coriandrum sativum, bylinky) — kuličkovité nažky
  Anethum: 'earlyAutumn',    // kopr vonný (Anethum graveolens, bylinky) — semena v okolíku
  Calendula: 'earlyAutumn',  // měsíček lékařský (Calendula officinalis, okrasne) — srpkovité nažky
  // midAutumn — vysoké letničky se semenem dozrávajícím v září
  Zinnia: 'midAutumn',       // zinia (Zinnia elegans, letnicky) — nažky v terčíku
  Tagetes: 'midAutumn',      // aksamitník (Tagetes erecta, letnicky) — dlouhé tmavé nažky
  // lateAutumn — trvalky s tobolkami dozrávajícími v říjnu
  Aquilegia: 'lateAutumn',   // orlíček obecný (Aquilegia vulgaris, trvalky) — drobná černá semena
};

// DRUH má přednost před RODEM (model pinching/strawberryRenewal SPECIES precedence). Tady
// kvůli kolizi rodu Helianthus, kde druhy zásadně liší množení:
//   - Helianthus annuus (slunečnice roční) — klasická letnička sběru semen → midAutumn;
//     v DB jsou DVĚ entry (id 47 `okrasne` a id pro `letnicky`), obě validní.
//   - Helianthus tuberosus (topinambur, zelenina) — množí se HLÍZAMI, NE SEMENY → null
//     (rod Helianthus v GENERA NENÍ → bez species matche skončí null).
export const SEED_SAVING_SPECIES = {
  'Helianthus annuus': 'midAutumn', // slunečnice roční — septembrová sklizeň nažek
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

// Vrať pravidlo sběru pro rostlinu ({ type }), nebo null. DRUH má přednost před RODEM;
// match jen v gate SEED_SAVING_CATEGORIES (skutečný selektor je mapa, ne gate).
export function seedSavingRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (!cat || !SEED_SAVING_CATEGORIES.has(cat)) return null;
  const lat = String(plant.nameLat || '').trim();
  // 1) DRUH (genus + species) má přednost
  for (const sp in SEED_SAVING_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return { type: SEED_SAVING_SPECIES[sp] };
  }
  // 2) ROD
  const genus = genusOf(plant);
  if (genus && SEED_SAVING_GENERA[genus]) return { type: SEED_SAVING_GENERA[genus] };
  return null;
}

function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}

// Pin už má v měsíci sběru (letos / opakovaně) naplánovaný úkon? Dedup JEN dle TITULKU —
// task_type `jine` je příliš obecný (sdílí ho hromada úkonů jako pinching/staking/sběr semen…),
// takže by nad ním dedup falešně potlačoval jiné úkony. Marker pokrývá všechny formy:
//   - „semen" zachytí české i anglické podstatné jméno semena/seed/seeds (společný stem),
//   - „nažk" zachytí variantu „nažky/nažek" (botanický termín pro suché plody),
//   - „semeník" zachytí „semeník/semeníky" (tobolka),
//   - „nasbír" zachytí slovesný titulek, který tahle vrstva sama vytvoří („Nasbírat semena …").
function hasSeedSavingInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    const title = (e.title || '').trim();
    if (/semen|nažk|semeník|nasbír/i.test(title)) return true;
  }
  return false;
}

// Hlavní logika: vrať návrh sběru semen pro pin (pole 0–1 hintů, kvůli paritě se sourozeneckými
// kartami). Nabídne se, je-li rostlina v mapě sběru a sezónní okno (dle typu) je v budoucnu
// a v horizontu. Mimo gate / rody mimo mapu / chybějící rostlina → []. conditions =
// pin.garden_conditions (posun termínu). `now` injektovatelné pro test (rok dedupu; termín
// drží dateForMonth).
export function seedSavingForPin(pin, plant, conditions, now = new Date()) {
  if (!pin || !plant) return [];
  const rule = seedSavingRuleForPlant(plant);
  if (!rule) return [];
  const typeDef = SEED_SAVING_TYPES[rule.type];
  if (!typeDef) return [];

  const suggested = dateForMonth(typeDef.month, conditions); // okno sběru (posun zóny)
  const due = daysFromToday(suggested);
  if (due === null || due < 0 || due > SEED_SAVING_HORIZON_DAYS) return [];

  const m = monthFromIso(suggested);
  if (hasSeedSavingInMonth(pin.tasks || [], m, now.getFullYear())) return [];

  return [{
    kind: 'seedSaving',
    type: rule.type,
    month: m,
    suggested,
    due,
    taskType: 'jine',
    emoji: SEED_SAVING_EMOJI,
  }];
}
