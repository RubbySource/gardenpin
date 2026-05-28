// Pinčování letniček a Chelsea chop pozdně-kvetoucích trvalek — vyštípnutí vrcholu pro hustší kvetení.
// U vysokých letniček (Cosmos / Antirrhinum / Zinnia / Petunia / bazalka Ocimum / Salvia farinacea)
// a u strukturních pozdně-kvetoucích trvalek (Aster / Sedum spectabile / Rudbeckia / Echinacea /
// Phlox paniculata / Helenium) je HLAVNÍ pozdně-jarní úkon VYŠTÍPNOUT VRCHOLOVÝ PUPEN — donutí
// rostlinu vyhnat boční výhony, takže místo jednoho dlouhého stonku vyroste hustý kompaktní trs
// s 2–4× více květy a (u Chelsea chop) posune kvetení o 2–3 týdny dál do sezóny.
//
// 2 OKNA (PINCHING_TYPES):
//   - chelseaChop  = 5 (kolem konce května) → pozdně kvetoucí trvalky, „Chelsea chop" sestřih o ~1/3,
//   - annualPinch  = 6 (červen, když rostlina má 4–6 párů listů a ~15–20 cm, ale ještě nevyhnala
//     květní stvol) → vysoké letničky + bazalka.
//
// Tahle vrstva cíleně DOPLŇUJE:
//   - data/plantSupports.js — ten staví OPORY pro vysoké trvalky/popínavé v 4–5; pinčování je
//     JINÁ akce (vyštípnutí vrcholu, ne stavění opory), je o GEN. řízení tvaru rostliny, ne
//     o její podpoře. Mnohé rostliny chtějí OBOJÍ (vysoký Phlox = opora v 4 + Chelsea chop v 5).
//   - data/perennialCutback.js — ten ŘEŽE ODUMŘELOU nadzemní část v 3 nebo 10; pinčování je
//     naopak řízení MLADÉHO ŽIVÉHO výhonu na začátku vegetace, žádný překryv.
//
// ČISTĚ KLIENTSKÁ vrstva — žádné nové schéma ani endpoint. Okno pinčování = dateForMonth(month,
// conditions) → posun dle klim. zóny/expozice/výšky (jeden zdroj pravdy s RecommendedTasks/
// strawberryRenewal/perennialCutback…). Nabídne se jen je-li okno v BUDOUCNU a v horizontu
// (~60 dní), jinak se skryje — „mimo sezónu → []" je tak přirozený důsledek future+horizont
// kontroly (stejný model jako strawberryRenewal/fruitNetting; návrh nikdy do minulosti).
//
// GATE: kategorie `letnicky`/`trvalky`/`bylinky` + (rod nebo druh) v mapě. Skutečný selektor je
// kurátorská mapa PINCHING_GENERA / PINCHING_SPECIES — gate je hrubý předfiltr, aby nepustil
// dřeviny/cibuloviny/zeleninu/sukulenty (mimo gate → null automaticky). DRUH má přednost před
// RODEM (model fruitThinning/strawberryRenewal SPECIES precedence), takže:
//   - Sedum spectabile (trvalky) → chelseaChop, ale ROD Sedum záměrně NENÍ v GENERA → plazivé
//     Sedum album/hispanicum jsou v `sukulenty` (mimo gate) a kultivar Sedum 'Herbstfreude'
//     (rod Sedum bez druhu) → null (kultivar bez druhové specifikace neumíme bezpečně klasifikovat),
//   - Tagetes erecta (vysoký aksamitník, letnicky) → annualPinch, ale ROD Tagetes záměrně NENÍ
//     v GENERA — Tagetes patula (kompaktní afrikán) se NEpinčuje (přirozeně rozvětvený).
//
// ZÁMĚRNĚ VYNECHÁNO z mapy (žádný mrtvý klíč — model fruitNetting/strawberryRenewal):
//   - Aster / Helenium / Cosmos / Antirrhinum / Lathyrus / Salvia farinacea / Phlox subulata —
//     v REÁLNÉ plantDatabase aktuálně nejsou; spec backlogu je výslovně jmenuje, ale forward-looking
//     klíče bez 1+ rostliny v DB jsou „mrtvé klíče" a sanity test by je odhalil. Přidat až dorazí.
//   - Rod Salvia v GENERA NENÍ — v DB jsou Salvia rosmarinus (dřevitý keřík, bylinky) /
//     S. officinalis (bylinka) / S. nemorosa (trvalka), kde žádná se PINČOVÁNÍM VRCHOLU neřídí
//     (rosmarinus je polodřevitý, officinalis se sestřihává po odkvětu, nemorosa rovněž — to je
//     jiná akce „sestřih po odkvětu pro druhou vlnu", ne pinčování mladého výhonu).
import { dateForMonth } from '../components/RecommendedTasks.jsx';
import { daysFromToday } from '../utils.js';

// Jak daleko dopředu pinčování nabízíme (dny). Sezónní — surface nadcházející okno s předstihem,
// ne celoročně.
export const PINCHING_HORIZON_DAYS = 60;

const PINCHING_EMOJI = '✂️';

// Typ pinčování → kotevní měsíc okna (anchor 15. dne, posunut dateForMonth dle podmínek).
//   chelseaChop = pozdně kvetoucí trvalky — sestřih o ~1/3 kolem konce května,
//   annualPinch = vysoké letničky + bazalka — vyštípnout 2–3 horní listy nad uzlem v červnu.
export const PINCHING_TYPES = {
  chelseaChop: { month: 5 },
  annualPinch: { month: 6 },
};

// Kategorie, ve kterých vůbec hledáme (gate). Bylinky pro bazalku Ocimum (vysoká stonková bylinka,
// pinčuje se pro hustý trs). Stromy/keře/popínavé/cibuloviny/zelenina/sukulenty/vodní jsou MIMO →
// dřevitý keřík rozmarýn (Salvia rosmarinus / bylinky) v mapě stejně není, takže projde gate
// ale skončí null. Plazivé Sedum album/hispanicum jsou `sukulenty` (mimo gate → null automaticky).
export const PINCHING_CATEGORIES = new Set(['letnicky', 'trvalky', 'bylinky']);

// Rody vhodné k pinčování — klíč = ROD (první slovo nameLat), hodnota = typ pinčování.
// Match jen v gate PINCHING_CATEGORIES; jen rody s ≥1 reálnou rostlinou v DB (žádný mrtvý klíč —
// sanity test to hlídá; Aster/Helenium/Cosmos/Antirrhinum vědomě vyřazeny, viz hlavička).
export const PINCHING_GENERA = {
  // Chelsea chop — pozdně kvetoucí strukturní trvalky (květy na novém přírůstku, sestřih o 1/3)
  Phlox: 'chelseaChop',     // Phlox paniculata + kultivary; v DB není plazivý P. subulata, takže rod stačí
  Rudbeckia: 'chelseaChop', // třapatka — fulgida 'Goldsturm' / hirta / 'Cherry Brandy' / fulgida (4 ks)
  Echinacea: 'chelseaChop', // třapatka nachová — purpurea (2 ks)
  // Pinčování letniček / vysokých bylin — vyštípnout vrchol pro 2–4× hustší trs
  Petunia: 'annualPinch',   // petúnie / surfinie — všechny letnicky (3 ks)
  Zinnia: 'annualPinch',    // zinia (Zinnia elegans, letnicky)
  Ocimum: 'annualPinch',    // bazalka (Ocimum basilicum, bylinky) — vysoká stonková, pinč pro hustý trs
};

// DRUH má přednost před RODEM (model fruitThinning/strawberryRenewal SPECIES precedence). Tady
// kvůli kolizím rodů, kde jen NĚKTERÉ druhy se pinčují:
//   - Sedum spectabile — vyšší rozchodník v trvalky, klasický Chelsea chop; rod Sedum v GENERA
//     NENÍ → plazivé Sedum album/hispanicum jsou v `sukulenty` (mimo gate → null) a kultivar
//     Sedum 'Herbstfreude' (rod Sedum bez druhu) skončí null (záměrné: bez druhové specifikace
//     neumíme bezpečně rozhodnout, jestli je vysoký nebo plazivý — pesimistický default).
//   - Tagetes erecta — vysoký vzpřímený aksamitník v letnicky, pinčuje se pro hustší trs; rod
//     Tagetes v GENERA NENÍ → kompaktní T. patula (přirozeně rozvětvený, nepinčuje se) → null.
export const PINCHING_SPECIES = {
  'Sedum spectabile': 'chelseaChop', // vyšší rozchodník nádherný (trvalky)
  'Tagetes erecta': 'annualPinch',   // aksamitník vzpřímený (letnicky)
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

// Vrať pravidlo pinčování pro rostlinu ({ type }), nebo null. DRUH má přednost před RODEM;
// match jen v gate PINCHING_CATEGORIES (skutečný selektor je mapa, ne gate).
export function pinchingRuleForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKey(plant);
  if (!cat || !PINCHING_CATEGORIES.has(cat)) return null;
  const lat = String(plant.nameLat || '').trim();
  // 1) DRUH (genus + species) má přednost
  for (const sp in PINCHING_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return { type: PINCHING_SPECIES[sp] };
  }
  // 2) ROD
  const genus = genusOf(plant);
  if (genus && PINCHING_GENERA[genus]) return { type: PINCHING_GENERA[genus] };
  return null;
}

function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}

// Pin už má v měsíci pinčování (letos / opakovaně) naplánovaný úkon? Dedup JEN dle TITULKU —
// task_type `jine` je příliš obecný (sdílí ho hromada úkonů jako pinning/staking/sběr semen…),
// takže by nad ním dedup falešně potlačoval jiné úkony. Marker pokrývá všechny formy:
//   - „pinč" zachytí české „pinčování / pinčovat",
//   - „vyštíp" zachytí slovesný titulek, který tahle vrstva sama vytvoří („Vyštípnout vrchol …"),
//   - „zaštíp" je alternativa, kterou uživatel může napsat,
//   - „Chelsea" zachytí anglický termín „Chelsea chop", který je v zahradnické komunitě běžný
//     i u nás (i18n titulky v EN/DE/PL/SK mohou termín použít beze změny).
function hasPinchingInMonth(pinTasks, month, curYear) {
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    const title = (e.title || '').trim();
    if (/pinč|vyštíp|zaštíp|Chelsea/i.test(title)) return true;
  }
  return false;
}

// Hlavní logika: vrať návrh pinčování pro pin (pole 0–1 hintů, kvůli paritě se sourozeneckými
// kartami). Nabídne se, je-li rostlina v mapě pinčování a sezónní okno (dle typu) je v budoucnu
// a v horizontu. Mimo gate / rody mimo mapu / chybějící rostlina → []. conditions =
// pin.garden_conditions (posun termínu). `now` injektovatelné pro test (rok dedupu; termín drží
// dateForMonth).
export function pinchingForPin(pin, plant, conditions, now = new Date()) {
  if (!pin || !plant) return [];
  const rule = pinchingRuleForPlant(plant);
  if (!rule) return [];
  const typeDef = PINCHING_TYPES[rule.type];
  if (!typeDef) return [];

  const suggested = dateForMonth(typeDef.month, conditions); // okno pinčování (posun zóny)
  const due = daysFromToday(suggested);
  if (due === null || due < 0 || due > PINCHING_HORIZON_DAYS) return [];

  const m = monthFromIso(suggested);
  if (hasPinchingInMonth(pin.tasks || [], m, now.getFullYear())) return [];

  return [{
    kind: 'pinching',
    type: rule.type,
    month: m,
    suggested,
    due,
    taskType: 'jine',
    emoji: PINCHING_EMOJI,
  }];
}
