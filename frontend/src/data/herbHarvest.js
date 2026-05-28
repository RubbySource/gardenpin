// Sběr a sušení bylinek pro kuchyňské použití — letní harvest (typicky 6–9).
// U kulinářských bylinek je HLAVNÍ letní úkon SKLIDIT LISTY/NAŤ VE FÁZI MAXIMÁLNÍHO
// OBSAHU ÉTERICKÝCH OLEJŮ (typicky těsně před plným kvetením nebo na začátku kvetení,
// za suchého poledne) a USUŠIT VE STÍNU v provzdušněném prostoru pro zimní zásobu.
// Aroma a léčivé účinky bylinek vrcholí v krátkém okně před květem — po odkvětu
// obsah olejů prudce klesá a listy hořknou.
//
// Tahle vrstva cíleně DOPLŇUJE seedSaving.js (semena 9–10 — JINÝ účel, JINÁ část
// rostliny: semena × listy/nať), pinching.js (vyštipování okrasných letniček 5–6 —
// NE bylinky) a summerRosePruning.js (růže). Žádný překryv.
//
// ČISTĚ KLIENTSKÁ vrstva — žádné nové schéma ani endpoint. Měsíc sklizně =
// dateForMonth (jeden zdroj pravdy s RecommendedTasks/summerPruning…) → posun dle
// klim. zóny/expozice (chladnější zóny pozdější vegetace ⇒ pozdější sklizeň).
// Návrh nikdy do minulosti (minulá okna → []), horizont 50 dní.
//
// GATE: jen `bylinky` — kuchyňské. Ozdobné Salvia (S. nemorosa cv. 'Caradonna'/
// 'Mainacht') v reálné DB padají do `okrasne`/`trvalky` a jsou tak mimo gate
// automaticky (forward-looking pojistka, žádné explicitní vyloučení nutné).
//
// SELEKTOR — kurátorská GENERA klíčovaná na ROD (první slovo nameLat):
//   Ocimum        (bazalka)         → 7
//   Mentha        (máta)            → 7
//   Origanum      (oregano)         → 7
//   Lavandula     (levandule)       → 7
//   Petroselinum  (petržel)         → 7
//   Thymus        (tymián)          → 6
//   Salvia        (šalvěj)          → 6   (Salvia officinalis kuchyňská; ornament
//                                          S. nemorosa mimo gate `bylinky`)
//   Melissa       (meduňka)         → 6
//   Rosmarinus    (rozmarýn)        → 6   (forward-looking — DB má dnes
//                                          Salvia rosmarinus přes reklasifikaci)
//   Anethum       (kopr)            → 6
//   Levisticum    (libeček)         → 6
//
// SPECIES s předností před RODEM:
//   Salvia rosmarinus  (rozmarýn po reklasifikaci) → 6   (rod Salvia by stejně
//                                                         dal 6, ale držíme přes
//                                                         species pro jasnost)
//   Origanum majorana  (majoránka — jednoletka)    → 7   (rod Origanum dá také 7)
import { dateForMonth } from '../components/RecommendedTasks.jsx';
import { daysFromToday } from '../utils.js';

// Jak daleko dopředu sklizeň nabízíme (dny). Krátký horizont — sklizeň je vázaná
// na fenologickou fázi (těsně před plným květem), kterou si uživatel chce naplánovat
// s předstihem několika týdnů, ne měsíců.
export const HERB_HARVEST_HORIZON_DAYS = 50;

const HERB_HARVEST_EMOJI = '🌿';

// Gate — jen kulinářské bylinky. Ornamentální Salvia (S. nemorosa) padá do
// `okrasne`/`trvalky` a vypadne mimo gate automaticky.
export const HERB_HARVEST_CATEGORIES = new Set([
  'bylinky',
]);

// ROD → kotevní měsíc sklizně (anchor 15. dne, posunut dateForMonth dle podmínek).
// Volba měsíce dle typické fenologie v ČR — bazalka/máta/oregano/levandule/petržel
// vrcholí v 7 (těsně před / na začátku kvetení); šalvěj/tymián/meduňka/rozmarýn/
// kopr/libeček v 6 (časnější kvetení nebo bylinné druhy s rychlejším náběhem).
export const HERB_HARVEST_GENERA = {
  Ocimum: 7,
  Mentha: 7,
  Origanum: 7,
  Lavandula: 7,
  Petroselinum: 7,
  Thymus: 6,
  Salvia: 6,
  Melissa: 6,
  Rosmarinus: 6,
  Anethum: 6,
  Levisticum: 6,
};

// DRUH má přednost před RODEM — držíme z důvodu taxonomické historie / forward-looking
// pro jednoletou majoránku (rod Origanum dá také 7, ale jednoletka má fenologicky
// jinou křivku — držíme přes species pro jasnost a pro budoucí jemné úpravy).
// `Salvia rosmarinus` ↔ rozmarýn po reklasifikaci z `Rosmarinus officinalis`.
export const HERB_HARVEST_SPECIES = {
  'Salvia rosmarinus': 6,
  'Origanum majorana': 7,
};

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

// Vrať pravidlo sklizně bylinky pro rostlinu ({ month }), nebo null. DRUH má přednost
// před RODEM; match jen v gate `bylinky`.
export function herbHarvestRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (!HERB_HARVEST_CATEGORIES.has(cat)) return null;
  const lat = String(plant.nameLat || '').trim();
  // 1) DRUH má přednost — exact match nebo prefix s mezerou (kultivar)
  for (const sp in HERB_HARVEST_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return { month: HERB_HARVEST_SPECIES[sp] };
  }
  // 2) ROD
  const genus = genusOf(plant);
  if (genus && HERB_HARVEST_GENERA[genus]) return { month: HERB_HARVEST_GENERA[genus] };
  return null;
}

function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}

// Pin už má v měsíci sklizně (letos / opakovaně) naplánovanou sklizeň bylinky? DVOUFÁZOVÝ
// dedup — `sklizen` sám je sdílený s běžnou sklizní ovoce/zeleniny (např. „Sklizeň jahod"),
// samotný task_type by potlačoval i jiné sklizně. Vyžaduje task_type `sklizen` SOUČASNĚ
// S markerem v titulku (sušení / sušit / harvest...dry / dry...herb / kuchyňské bylinky)
// — marker pokrývá CZ slovesný titulek a EN termíny.
function hasHerbHarvestInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    if (e.task_type !== 'sklizen') continue;
    const title = (e.title || '').trim();
    if (/sušení|sušit|harvest.*dry|dry.*herb|kuchyňské bylinky/i.test(title)) return true;
  }
  return false;
}

// Hlavní logika: vrať návrh sklizně bylinky pro pin (pole 0–1 hintů, parita se
// sourozeneckými kartami). Nabídne se, je-li rostlina v mapě a sezónní okno je
// v budoucnu a v horizontu. Mimo gate / mimo mapu / pozdní okno → [].
// conditions = pin.garden_conditions (posun termínu). `now` injektovatelné pro test.
export function herbHarvestForPin(pin, plant, conditions, now = new Date()) {
  if (!pin || !plant) return [];
  const rule = herbHarvestRuleForPlant(plant);
  if (!rule) return [];

  const suggested = dateForMonth(rule.month, conditions); // okno (15. cílového měsíce, posun)
  const due = daysFromToday(suggested);
  if (due === null || due < 0 || due > HERB_HARVEST_HORIZON_DAYS) return [];

  const m = monthFromIso(suggested);
  if (hasHerbHarvestInMonth(pin.tasks || [], m, now.getFullYear())) return [];

  return [{
    kind: 'herbHarvest',
    month: m,
    suggested,
    due,
    taskType: 'sklizen',
    emoji: HERB_HARVEST_EMOJI,
  }];
}
