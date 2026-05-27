// Osevní postup — rotace plodin v záhonech. Pro zeleninové/letničkové ZÁHONY je
// střídání plodin zásadní hlavní úkon při VÝSADBĚ: stejná botanická čeleď na stejném
// místě dva roky po sobě = vyčerpání půdy + hromadění chorob a škůdců. Tahle vrstva
// při zakládání výsadby varuje před opakováním čeledi ve stejném záhonu a navrhne
// vhodnou rotační čeleď.
//
// ČISTĚ KLIENTSKÁ vrstva nad existujícími daty — žádné nové schéma ani endpoint:
//   - botanická čeleď se odvodí z RODU (první slovo plant.nameLat) přes GENUS_FAMILY,
//   - příslušnost pinu k záhonu je GEOMETRICKÁ (pin x/y uvnitř obdélníku beds x/y/w/h, %),
//   - historii „co rostlo kde" čteme z aktuálních pinů (plant_name + planting_date/created_at).
//
// Záměrně jen DŘEVINY netýká — rotace dává smysl u jednoletých plodin (zelenina/letničky).
// Trvalé „zeleniny" (chřest, reveň, šťovík, křen, artyčok, topinambur) zůstávají na místě
// → vyřazeny přes PERENNIAL_GENERA (žádné rotační varování). Modul je pure (žádný React/
// i18n import) → přímo testovatelný v node (scripts/test-crop-rotation.cjs).
import { findPlantByName, getPlantCategory, CATEGORY_DEFS } from '../plantDatabase.js';

// Klasický rotační cyklus dle nároku na živiny: luskoviny (fixují dusík) → listová/košťálovitá
// (těží z dusíku) → plodová (silně vyživná) → kořenová (lehký zbytkový příjem) → zpět.
export const ROTATION_GROUP_ORDER = ['legume', 'leaf', 'heavy', 'root'];

// Kolik let zpět hlídáme opakování čeledi (doporučení: stejná čeleď až po ~3–4 letech).
export const ROTATION_LOOKBACK_YEARS = 3;

// Registr botanických čeledí relevantních pro osevní postup.
//   group  = nutriční skupina pro rotační cyklus (viz ROTATION_GROUP_ORDER),
//   core   = jádrová zeleninová čeleď (navrhuje se jako rotace); minor čeledi se jen
//            SLEDUJÍ kvůli detekci opakování (např. petúnie = lilkovité po rajčeti),
//   labelKey = i18n (namespace cropRotation), emoji = ikona čeledi.
export const ROTATION_FAMILIES = {
  fabaceae:       { group: 'legume', core: true,  emoji: '🫘', labelKey: 'cropRotation.famFabaceae' },
  brassicaceae:   { group: 'leaf',   core: true,  emoji: '🥬', labelKey: 'cropRotation.famBrassicaceae' },
  asteraceae:     { group: 'leaf',   core: true,  emoji: '🥗', labelKey: 'cropRotation.famAsteraceae' },
  amaranthaceae:  { group: 'leaf',   core: true,  emoji: '🍃', labelKey: 'cropRotation.famAmaranthaceae' },
  solanaceae:     { group: 'heavy',  core: true,  emoji: '🍅', labelKey: 'cropRotation.famSolanaceae' },
  cucurbitaceae:  { group: 'heavy',  core: true,  emoji: '🥒', labelKey: 'cropRotation.famCucurbitaceae' },
  poaceae:        { group: 'heavy',  core: true,  emoji: '🌽', labelKey: 'cropRotation.famPoaceae' },
  apiaceae:       { group: 'root',   core: true,  emoji: '🥕', labelKey: 'cropRotation.famApiaceae' },
  amaryllidaceae: { group: 'root',   core: true,  emoji: '🧅', labelKey: 'cropRotation.famAmaryllidaceae' },
  // minor / okrasné — jen pro detekci opakování, nenavrhují se
  convolvulaceae: { group: 'root',   core: false, emoji: '🍠', labelKey: 'cropRotation.famConvolvulaceae' },
  portulacaceae:  { group: 'leaf',   core: false, emoji: '🌿', labelKey: 'cropRotation.famPortulacaceae' },
  caprifoliaceae: { group: 'leaf',   core: false, emoji: '🌿', labelKey: 'cropRotation.famCaprifoliaceae' },
  begoniaceae:    { group: 'leaf',   core: false, emoji: '🌸', labelKey: 'cropRotation.famBegoniaceae' },
  campanulaceae:  { group: 'leaf',   core: false, emoji: '🔔', labelKey: 'cropRotation.famCampanulaceae' },
  geraniaceae:    { group: 'leaf',   core: false, emoji: '🌺', labelKey: 'cropRotation.famGeraniaceae' },
  verbenaceae:    { group: 'leaf',   core: false, emoji: '💜', labelKey: 'cropRotation.famVerbenaceae' },
};

// Rod (první slovo nameLat) → klíč čeledi. Pokrývá všechny zeleninové/letničkové rody
// v plantDatabase (ověřeno sanity testem proti reálné DB).
export const GENUS_FAMILY = {
  // zelenina
  Allium: 'amaryllidaceae',
  Apium: 'apiaceae',
  Beta: 'amaranthaceae',
  Brassica: 'brassicaceae',
  Capsicum: 'solanaceae',
  Cicer: 'fabaceae',
  Cichorium: 'asteraceae',
  Cucumis: 'cucurbitaceae',
  Cucurbita: 'cucurbitaceae',
  Daucus: 'apiaceae',
  Eruca: 'brassicaceae',
  Glycine: 'fabaceae',
  Ipomoea: 'convolvulaceae',
  Lactuca: 'asteraceae',
  Lagenaria: 'cucurbitaceae',
  Pastinaca: 'apiaceae',
  Petroselinum: 'apiaceae',
  Phaseolus: 'fabaceae',
  Pisum: 'fabaceae',
  Portulaca: 'portulacaceae',
  Raphanus: 'brassicaceae',
  Solanum: 'solanaceae',
  Spinacia: 'amaranthaceae',
  Valerianella: 'caprifoliaceae',
  Vicia: 'fabaceae',
  Vigna: 'fabaceae',
  Zea: 'poaceae',
  // letničky (okrasné)
  Begonia: 'begoniaceae',
  Callistephus: 'asteraceae',
  Lobelia: 'campanulaceae',
  Pelargonium: 'geraniaceae',
  Petunia: 'solanaceae',
  Tagetes: 'asteraceae',
  Verbena: 'verbenaceae',
  Zinnia: 'asteraceae',
};

// Trvalé „zeleniny" — zůstávají na místě, rotace se jich netýká. Rod je v GENUS_FAMILY
// vynechán schválně → familyForPlant vrátí null (žádné varování).
export const PERENNIAL_GENERA = new Set([
  'Asparagus',   // chřest
  'Rheum',       // reveň
  'Rumex',       // šťovík
  'Armoracia',   // křen
  'Cynara',      // artyčok
  'Helianthus',  // topinambur (i okrasná slunečnice — rotace okrasné jednoletky je okrajová)
]);

// Kategorie, kterých se osevní postup týká (jednoleté plodiny v záhonech).
const ROTATION_CATEGORIES = new Set(['zelenina', 'letnicky']);

// Klíč kategorie z libovolného tvaru záznamu (enriched object / nový string / starý id-range).
function categoryKeyOf(plant) {
  const c = plant?.category;
  if (c && typeof c === 'object' && c.key) return c.key;
  if (typeof c === 'string' && CATEGORY_DEFS[c]) return CATEGORY_DEFS[c].key;
  if (plant?.id != null) return getPlantCategory(plant.id)?.key || null;
  return null;
}

// Rod = první slovo latinského názvu (timezone… ne, jen string split).
export function genusOf(plant) {
  const lat = String(plant?.nameLat || '').trim();
  if (!lat) return null;
  return lat.split(/\s+/)[0] || null;
}

// Botanická čeleď rostliny pro účely rotace, nebo null (mimo zelenina/letničky,
// trvalá zelenina, nebo neznámý rod). Přijímá enriched i raw záznam.
export function familyForPlant(plant) {
  if (!plant) return null;
  const cat = categoryKeyOf(plant);
  if (!ROTATION_CATEGORIES.has(cat)) return null;
  const genus = genusOf(plant);
  if (!genus || PERENNIAL_GENERA.has(genus)) return null;
  const fam = GENUS_FAMILY[genus] || null;
  return fam && ROTATION_FAMILIES[fam] ? fam : null;
}

// Čeleď podle českého názvu rostliny (lookup v databázi). Vrátí null, nenajde-li se.
export function familyForPinName(plantName) {
  return familyForPlant(findPlantByName(plantName));
}

// GEOMETRIE: záhon obsahující pin (x/y i x/y/w/h jsou procenta 0–100 mapy). Vrací první
// vyhovující záhon, nebo null (pin mimo všechny záhony → bez rotačního kontextu).
export function bedForPin(pin, beds) {
  if (!Array.isArray(beds) || !pin) return null;
  const px = Number(pin.x);
  const py = Number(pin.y);
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
  for (const b of beds) {
    const bx = Number(b.x);
    const by = Number(b.y);
    const bw = Number(b.width);
    const bh = Number(b.height);
    if (!Number.isFinite(bx) || !Number.isFinite(by) || !Number.isFinite(bw) || !Number.isFinite(bh)) continue;
    if (px >= bx && px <= bx + bw && py >= by && py <= by + bh) return b;
  }
  return null;
}

// Rok, který pin reprezentuje: rok výsadby (planting_date), fallback rok vytvoření pinu.
export function pinYear(pin) {
  const m = /^(\d{4})/.exec(String(pin?.planting_date || pin?.created_at || ''));
  return m ? parseInt(m[1], 10) : null;
}

// Historie čeledí v záhonu z aktuálních pinů: Map familyKey → { years:[desc], latestYear,
// plantNames:Set }. Zahrne jen piny geometricky uvnitř záhonu, s rozpoznanou čeledí a rokem.
export function bedFamilyHistory(bed, pins) {
  const hist = new Map();
  if (!bed || !Array.isArray(pins)) return hist;
  for (const p of pins) {
    if (bedForPin(p, [bed]) !== bed) continue;
    const fam = familyForPinName(p.plant_name);
    if (!fam) continue;
    const y = pinYear(p);
    if (y == null) continue;
    let e = hist.get(fam);
    if (!e) { e = { years: [], latestYear: null, plantNames: new Set() }; hist.set(fam, e); }
    if (!e.years.includes(y)) e.years.push(y);
    if (e.latestYear == null || y > e.latestYear) e.latestYear = y;
    if (p.plant_name) e.plantNames.add(p.plant_name);
  }
  for (const e of hist.values()) e.years.sort((a, b) => b - a);
  return hist;
}

// Doporučené rotační čeledi: jádrové čeledi z nutričních skupin, které v záhonu nedávno
// nebyly, seřazené cyklem počínaje skupinou ZA poslední pěstovanou skupinou.
//   recentFamilies = Set čeledí pěstovaných v záhonu v okně lookbacku,
//   latestGroup    = nutriční skupina poslední (nejnovější) čeledi (nebo null).
export function suggestRotationFamilies(recentFamilies, latestGroup, limit = 3) {
  const recent = recentFamilies instanceof Set ? recentFamilies : new Set(recentFamilies || []);
  const recentGroups = new Set(
    [...recent].map((f) => ROTATION_FAMILIES[f]?.group).filter(Boolean),
  );
  const startIdx = latestGroup ? ROTATION_GROUP_ORDER.indexOf(latestGroup) : -1;
  const scored = Object.keys(ROTATION_FAMILIES)
    .filter((f) => ROTATION_FAMILIES[f].core)
    .filter((f) => !recent.has(f) && !recentGroups.has(ROTATION_FAMILIES[f].group))
    .map((f) => {
      const gi = ROTATION_GROUP_ORDER.indexOf(ROTATION_FAMILIES[f].group);
      const dist = startIdx < 0
        ? gi
        : (gi - startIdx - 1 + ROTATION_GROUP_ORDER.length) % ROTATION_GROUP_ORDER.length;
      return { f, dist };
    })
    .sort((a, b) => a.dist - b.dist || a.f.localeCompare(b.f));
  return scored.slice(0, limit).map((s) => s.f);
}

// Kontrola při ZAKLÁDÁNÍ VÝSADBY: chystám se zasadit `plantName` na pozici (x,y).
// Vrací null (žádný rotační kontext — pin mimo záhon nebo rostlina mimo rotaci) nebo
// { bed, family, conflictYear, suggestions[] }. conflictYear != null ⇒ stejná čeleď
// rostla v tomto záhonu v některém z minulých `lookback` let → varuj.
export function rotationCheckForPlanting({ plantName, x, y, beds, pins, now = new Date() }) {
  const family = familyForPinName(plantName);
  if (!family) return null;
  const bed = bedForPin({ x, y }, beds);
  if (!bed) return null;
  const cur = now.getFullYear();
  const hist = bedFamilyHistory(bed, pins);

  // Minulé roky (< letošek) v okně lookbacku, kdy v záhonu rostla TÁŽ čeleď.
  const fe = hist.get(family);
  const priorYears = (fe?.years || []).filter((y) => y < cur && y >= cur - ROTATION_LOOKBACK_YEARS);
  const conflictYear = priorYears.length ? priorYears[0] : null;

  // Čeledi pěstované v okně lookbacku (vč. letoška) → základ pro doporučení rotace.
  const recent = new Set();
  let latestYear = null;
  let latestGroup = null;
  for (const [fam, e] of hist) {
    const within = e.years.some((y) => y >= cur - ROTATION_LOOKBACK_YEARS && y <= cur);
    if (!within) continue;
    recent.add(fam);
    if (latestYear == null || e.latestYear > latestYear) {
      latestYear = e.latestYear;
      latestGroup = ROTATION_FAMILIES[fam]?.group || null;
    }
  }
  const suggestions = suggestRotationFamilies(recent, latestGroup);
  return { bed, family, conflictYear, suggestions };
}

// Přehled osevního postupu pro celou zahradu (záložka Statistiky). Vrací pole záznamů
// jen za záhony s ≥1 rotační rostlinou:
//   { bed, families:[{ family, latestYear, years[], plantNames[] }], warnings:[{ family, lastYear }],
//     suggestions:[familyKey] }
// warning = čeleď pěstovaná v ≥2 různých letech v okně lookbacku (opakování bez rotace).
export function gardenRotationOverview({ beds, pins, now = new Date() }) {
  if (!Array.isArray(beds) || !Array.isArray(pins)) return [];
  const cur = now.getFullYear();
  const out = [];
  for (const bed of beds) {
    const hist = bedFamilyHistory(bed, pins);
    if (hist.size === 0) continue;

    const families = [];
    const warnings = [];
    const recent = new Set();
    let latestYear = null;
    let latestGroup = null;
    for (const [fam, e] of hist) {
      families.push({
        family: fam,
        latestYear: e.latestYear,
        years: e.years.slice(),
        plantNames: [...e.plantNames],
      });
      const recentYears = e.years.filter((y) => y >= cur - ROTATION_LOOKBACK_YEARS && y <= cur);
      if (recentYears.length) recent.add(fam);
      if (recentYears.length >= 2) {
        warnings.push({ family: fam, lastYear: recentYears[0] });
      }
      if (e.latestYear != null && (latestYear == null || e.latestYear > latestYear)) {
        latestYear = e.latestYear;
        latestGroup = ROTATION_FAMILIES[fam]?.group || null;
      }
    }
    families.sort((a, b) => (b.latestYear || 0) - (a.latestYear || 0));
    const suggestions = suggestRotationFamilies(recent, latestGroup);
    out.push({ bed, families, warnings, suggestions });
  }
  return out;
}
