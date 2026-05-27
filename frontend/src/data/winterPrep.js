// Zazimování zahrady — vyrytí citlivých hlíz + zimní ochrana před prvním mrazem.
// Na podzim je HLAVNÍ sezónní úkon vyrýt a uskladnit nemrazuvzdorné hlízy/cibule
// (jiřiny, gladioly, begónie, kana) a zazimovat citlivé dřeviny/kbelíkové rostliny
// (fíkovník, oleandr, hortenzie velkolisté, fuchsie, agapanthus…) — vše načasované
// na PRVNÍ mráz.
//
// Cíleně DOPLŇUJE „Mrazově-chytré přeplánování" (frost.js), které jen ODKLÁDÁ existující
// citlivé úkony ZA mráz — tahle vrstva proaktivně VYTVOŘÍ podzimní ochranný úkon PŘED
// prvním mrazem. Reuse existující frost forecast (předáván jako `frost`) → žádný nový
// endpoint ani schéma. Termín = min(první předpovězený mráz − buffer, kalendářní okno),
// posun kalendářního okna dle klim. zóny/expozice přes sdílený getConditionShiftDays
// (jeden zdroj pravdy s RecommendedTasks/BulkCareModal). Dedup přes sdílený pinAlreadyHas.
//
// Matchování je přes ROD (první slovo nameLat) nebo DRUH (genus + species) — mrazově
// citlivé rostliny prostupují víc kategorií (cibuloviny/letnicky/okrasne/keře), takže
// kategorie samotná nestačí (tulipán je cibulovina, ale mrazuvzdorný). Hortenzie a fíkovník
// mají mrazuvzdorné příbuzné → matchují se na úrovni DRUHU (jen H. macrophylla / Ficus carica).
import { getConditionShiftDays } from '../components/RecommendedTasks.jsx';
import { pinAlreadyHas } from '../components/BulkCareModal.jsx';

// Sezónní okno, kdy kartu vůbec ukazujeme (podzimní příprava na zimu).
export const WINTER_PREP_SEASON = [9, 10, 11]; // září–listopad

// Dva druhy podzimní akce:
//   lift    = vyrýt + uskladnit hlízy/cibule nad bodem mrazu (presazeni 🪴),
//   protect = zazimovat / přikrýt / přesunout citlivou rostlinu na místě (jine 🛡️).
// month      = ideální kalendářní měsíc (frost ho jen zpřesní),
// windowMonths = od kdy do kdy je akce v sezóně (item se mimo okno neukáže),
// bufferDays = o kolik dní před předpovězeným mrazem akci nabídnout.
export const ACTION_LIFT = {
  kind: 'lift', taskType: 'presazeni', emoji: '🪴',
  month: 10, windowMonths: [9, 10], bufferDays: 1,
};
export const ACTION_PROTECT = {
  kind: 'protect', taskType: 'jine', emoji: '🛡️',
  month: 11, windowMonths: [10, 11], bufferDays: 3,
};

// Mrazově citlivé RODY (= první slovo nameLat). Kurátorský seznam — jen rostliny, které
// ve střední Evropě bez zazimování nepřežijí.
export const TENDER_GENERA = {
  // vyrýt hlízy/cibule (lift)
  Dahlia: ACTION_LIFT,      // jiřina — hlíza
  Gladiolus: ACTION_LIFT,   // gladiola — hlíza
  Begonia: ACTION_LIFT,     // begónie hlíznatá — hlíza
  Canna: ACTION_LIFT,       // dosna — oddenek (kurátorské; nemusí být v DB)
  // zazimovat / přikrýt / přesunout (protect)
  Nerium: ACTION_PROTECT,     // oleandr — kbelíková rostlina
  Punica: ACTION_PROTECT,     // granátovník (kurátorské; nemusí být v DB)
  Fuchsia: ACTION_PROTECT,    // fuchsie — přezimovat frost-free
  Agapanthus: ACTION_PROTECT, // agapanthus — přenést do chladné místnosti
  Citrus: ACTION_PROTECT,     // citrusy (kurátorské)
  Olea: ACTION_PROTECT,       // oliva (kurátorské)
  Laurus: ACTION_PROTECT,     // vavřín (kurátorské)
};

// Mrazově citlivé DRUHY (genus + species) — pro rody s mrazuvzdornými příbuznými.
// Klíč matchuje přesný název i kultivary („… 'Endless Summer'").
export const TENDER_SPECIES = {
  'Hydrangea macrophylla': ACTION_PROTECT, // hortenzie velkolistá (paniculata/arborescens jsou mrazuvzdorné → NEmatchují)
  'Ficus carica': ACTION_PROTECT,          // fíkovník (jiné fíky = pokojovky mimo zahradní DB)
};

// ---- pure helpery (timezone-safe, lokální složky) ----
function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Bezpečné přičtení dnů k YYYY-MM-DD přes UTC (ať timezone neposune datum).
function addDays(iso, n) {
  const [y, m, d] = String(iso).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}
function daysBetween(fromISO, toISO) {
  return Math.round((new Date(`${toISO}T00:00:00`) - new Date(`${fromISO}T00:00:00`)) / 86400000);
}

function genusOf(plant) {
  const lat = String(plant?.nameLat || '').trim();
  return lat ? lat.split(/\s+/)[0] || null : null;
}

// Vrať pravidlo zazimování pro rostlinu (DRUH má přednost před RODEM), nebo null.
export function winterPrepRuleForPlant(plant) {
  if (!plant) return null;
  const lat = String(plant.nameLat || '').trim();
  for (const sp in TENDER_SPECIES) {
    if (lat === sp || lat.startsWith(`${sp} `)) return TENDER_SPECIES[sp];
  }
  const genus = genusOf(plant);
  if (genus && TENDER_GENERA[genus]) return TENDER_GENERA[genus];
  return null;
}

// První předpovězený mrazivý den ve (3denní) předpovědi, nebo null.
export function firstFrostDateInForecast(frost) {
  if (!frost || !Array.isArray(frost.days)) return null;
  const f = frost.days.find((d) => d.frost);
  return f ? f.date : null;
}

// Kalendářní ideální den akce v AKTUÁLNÍM roce (podzim) posunutý dle klim. zóny/expozice.
// Den 15 měsíce daleko od hranic → měsíc po posunu stabilní.
function autumnDate(month, conditions, now) {
  const d = new Date(now.getFullYear(), month - 1, 15);
  d.setDate(d.getDate() + getConditionShiftDays(conditions));
  return isoLocal(d);
}

// Hlavní logika: vrať seznam pinů, které je třeba zazimovat (řazeno dle termínu).
// Mimo sezónu (9–11) → []. Termín = min(mráz − buffer, kalendářní okno), nikdy do minulosti.
// `lookup` = findPlantByName, `existingByPin` = mapa pin_id → [tasky] (dedup),
// `frost` = forecast z useFrostForecast (nebo null offline), `conditions` = garden conditions.
export function winterPrepForGarden({
  pins, lookup, existingByPin = {}, frost = null, conditions = null, now = new Date(),
}) {
  const month = now.getMonth() + 1;
  if (!WINTER_PREP_SEASON.includes(month)) return [];

  const todayISO = isoLocal(now);
  const frostDate = firstFrostDateInForecast(frost);
  const out = [];

  for (const pin of pins || []) {
    if (!pin?.plant_name) continue;
    const rule = winterPrepRuleForPlant(lookup(pin.plant_name));
    if (!rule) continue;
    if (month < rule.windowMonths[0]) continue; // sezóna akce ještě nezačala

    // Kalendářní okno (nikdy do minulosti — pokud jsme za ideálem, plánuj na dnešek).
    const cal = autumnDate(rule.month, conditions, now);
    let suggested = cal < todayISO ? todayISO : cal;

    // Mráz v předpovědi → akci urychli (vyrýt/přikrýt PŘED ním), ber dřívější termín.
    let frostWarn = null;
    if (frostDate) {
      const adj = addDays(frostDate, -rule.bufferDays);
      const adjClamped = adj < todayISO ? todayISO : adj;
      if (adjClamped < suggested) suggested = adjClamped;
      frostWarn = frostDate;
    }

    const m = monthFromIso(suggested);
    // Dedup — sdílený pinAlreadyHas: emoji jako „akce" pokryje i 'jine' (protect 🛡️),
    // task_type pokryje lift (presazeni). Přeskoč piny, co už zazimování naplánované mají.
    if (pinAlreadyHas(existingByPin[pin.id], rule.emoji, m, rule.taskType, conditions)) continue;

    out.push({
      pinId: pin.id,
      plantName: pin.plant_name,
      kind: rule.kind,
      taskType: rule.taskType,
      emoji: rule.emoji,
      suggested,
      due: daysBetween(todayISO, suggested),
      month: m,
      frostDate: frostWarn,
    });
  }

  return out.sort((a, b) => (a.suggested < b.suggested ? -1 : a.suggested > b.suggested ? 1 : 0));
}
