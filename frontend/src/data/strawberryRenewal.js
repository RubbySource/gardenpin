// Sezónní obnova jahodníku po sklizni — sestřih starých listů + odběr přebytečných odnoží.
// Po hlavní červnové/červencové sklizni je u jahodníku (rod Fragaria) HLAVNÍ raně-letní úkon
// SESTŘIH starých listů nízko nad srdíčkem + ODBĚR přebytečných odnoží (stolonů): odstraní
// listovou hmotu nasáklou plísňovými výtrusy, donutí trs vyhnat čerstvé zdravé listy a nasadit
// květní pupeny pro PŘÍŠTÍ sezónu, a omezí přemnožení odnožemi (trs by se vysílil). Okno 7–8
// (těsně po sklizni — dříve by se sestřihly nasazované plody, později nestihne trs zregenerovat
// do podzimu); kotva měsíc 7, posun zóny posune chladnější regiony do srpna.
//
// Tahle vrstva cíleně DOPLŇUJE:
//   - data/perennialCutback.js — ten ŘEŽE BYLINY v kategoriích `trvalky`/`travy` (sezóna 3/10).
//     Fragaria je `ovoce` → gate cutbacku ji nepustí → překryv neexistuje.
//   - data/fruitNetting.js — ten SÍŤUJE dozrávající jahodník v 6 (před vybarvením plodů).
//     Tohle je úkon PO sklizni v 7 → jiné okno, jiná akce, jiný účel; oba úkony jsou roční.
//
// ČISTĚ KLIENTSKÁ vrstva — žádné nové schéma ani endpoint. Okno obnovy = dateForMonth(month,
// conditions) → posun dle klim. zóny/expozice (jeden zdroj pravdy s RecommendedTasks/fruitNetting/
// perennialCutback…; v chladnějších zónách sklizeň později ⇒ obnova později). Nabídne se jen
// je-li okno v BUDOUCNU a v horizontu (~60 dní), jinak se skryje — „mimo sezónu → []" je
// přirozený důsledek future+horizont kontroly (stejný model jako fruitNetting/fruitThinning;
// návrh nikdy do minulosti).
//
// GATE: `category.key === 'ovoce'` + rod (první slovo `nameLat`) v STRAWBERRY_GENERA.
// Kurátorská **jedno-položková** mapa Fragaria — symetrie se sourozeneckými vrstvami
// (fruitNetting/fruitThinning), forward-looking konzistence. Rybíz Ribes / maliník Rubus
// / borůvka Vaccinium jsou v `ovoce` taky, ale OBNOVA SESTŘIHEM se NEDĚLÁ — tyhle keře
// se řežou na podzim/zjara dle stáří (`ageTasks`); v mapě nejsou → null.
import { dateForMonth } from '../components/RecommendedTasks.jsx';
import { daysFromToday } from '../utils.js';

// Jak daleko dopředu obnovu nabízíme (dny). Sezónní — surface nadcházející okno
// s krátkým předstihem (úkon je „těsně po sklizni"), ne celoročně.
export const STRAWBERRY_RENEWAL_HORIZON_DAYS = 60;

const STRAWBERRY_RENEWAL_EMOJI = '✂️';

// Rody (ROD = první slovo nameLat) → kotevní měsíc okna (anchor 15. dne, posunut dateForMonth
// dle podmínek). Match jen v gate `ovoce`. Záměrně **jedno-položková** mapa — Fragaria je
// jediný rod, kde po sklizni následuje obnova sestřihem listů + odběr stolonů. Forward-looking
// rody (např. jiné druhy Fragaria — F. moschata, F. virginiana) zachytí stejné pravidlo.
export const STRAWBERRY_GENERA = {
  Fragaria: { month: 7 }, // jahodník (ovoce) — sestřih starých listů + odběr odnoží po hlavní sklizni
};

// Kategorie, ve kterých vůbec hledáme (gate). Záměrně **jen `ovoce`** — Fragaria v reálné
// plantDatabase je `ovoce`; ostatní kategorie (`trvalky`/`okrasne` pro plané Fragaria…)
// nepatří do téhle vrstvy.
export const STRAWBERRY_RENEWAL_CATEGORIES = new Set(['ovoce']);

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

// Vrať pravidlo obnovy pro rostlinu ({ month }), nebo null. Match jen v gate
// STRAWBERRY_RENEWAL_CATEGORIES (`ovoce`) — gate i mapa jsou úzce kalibrované.
export function strawberryRenewalRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (!cat || !STRAWBERRY_RENEWAL_CATEGORIES.has(cat)) return null;
  const genus = genusOf(plant);
  if (genus && STRAWBERRY_GENERA[genus]) return { month: STRAWBERRY_GENERA[genus].month };
  return null;
}

function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}

// Pin už má v měsíci obnovy (letos / opakovaně) naplánovaný úkon? Dedup ŠIRŠÍ —
// task_type `strihani` JE specifický (řez), takže ho lze použít jako pojistku pro EN/DE/PL/SK,
// kde lokalizovaný titulek marker „jahodník"/„odnož"/„obnov" nenese. Marker pokrývá všechny
// formy: „jahodník" zachytí podstatné jméno (titulek „Obnova jahodníku …" / „Renew strawberries"
// se zachytí přes task_type, viz dále), „odnož" variantu „odnože / odnoží", „obnov" zachytí
// vlastní slovesný titulek („**Obnov**a / **Obnov**it") i případnou anglickou „**Renew**" —
// ne, „Renew" markerem `obnov` nezachytí; proto je task_type `strihani` v dedupu jako
// jazykově nezávislá pojistka (v duchu perennialCutback).
function hasStrawberryRenewalInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    const title = (e.title || '').trim();
    if (e.task_type === 'strihani') return true;
    if (/jahodník|odnož|obnov/i.test(title)) return true;
  }
  return false;
}

// Hlavní logika: vrať návrh obnovy pro pin (pole 0–1 hintů, kvůli paritě se sourozeneckými
// kartami). Nabídne se, je-li rostlina jahodník (Fragaria) a sezónní okno je v budoucnu
// a v horizontu. Mimo gate / jiné drobné ovoce (rybíz/maliník/borůvka) / chybějící rostlina → [].
// conditions = pin.garden_conditions (posun termínu). `now` injektovatelné pro test
// (rok dedupu; termín drží dateForMonth).
export function strawberryRenewalForPin(pin, plant, conditions, now = new Date()) {
  if (!pin || !plant) return [];
  const rule = strawberryRenewalRuleForPlant(plant);
  if (!rule) return [];

  const suggested = dateForMonth(rule.month, conditions); // okno obnovy (posun zóny)
  const due = daysFromToday(suggested);
  if (due === null || due < 0 || due > STRAWBERRY_RENEWAL_HORIZON_DAYS) return [];

  const m = monthFromIso(suggested);
  if (hasStrawberryRenewalInMonth(pin.tasks || [], m, now.getFullYear())) return [];

  return [{
    kind: 'strawberryRenewal',
    month: m,
    suggested,
    due,
    taskType: 'strihani',
    emoji: STRAWBERRY_RENEWAL_EMOJI,
  }];
}
