// Jednotná taxonomie typů úkonů — SINGLE SOURCE OF TRUTH.
//
// Sjednocuje tři dříve rozcházející se slovníky (viz docs/FUNCTIONAL_AUDIT.md §3 body 3, 4, 7):
//   - utils.TASK_TYPES (emoji ikony)
//   - TasksPage.TASK_TYPE_ICON (SVG ikony — měl ŠPATNÉ klíče zaliti/rez/vysadba…)
//   - iCal filtr (anglické klíče pruning/fertilizing…)
//
// Každý typ nese: id (kanonický task_type v DB), label (cs), icon (emoji),
// iconName (název SVG ikony v components/Icon.jsx), icalCategory (do jaké iCal kategorie spadá)
// a windowDays (jak dlouho po termínu má sezónní úkon ještě smysl — práh pro „okno zmeškáno";
// rychlé akce mají krátké okno, řez/výsadba delší — viz seasonWindow.js).
//
// POZN. backend (backend/server.js → ICAL_TYPE_FILTERS) zrcadlí icalCategory + id;
// při změně typů drž backend v souladu.

// weatherPref = krátkodobá počasová preference pro výběr ideálního DNE v okně (idealDay.js):
//   'dry'  = suchý bezvětrný den (řez — vlhké rány = houbová infekce; postřik/ochrana smyje déšť)
//   'mild' = mírný den bez mrazu (přesazení/výsadba — tendr kořeny nesnesou mráz)
// Bez flagu = úkon nemá počasovou preferenci (zálivka/hnojení/sklizeň/plení).
export const TASK_TYPES = [
  { id: 'zalivka',   label: 'Zálivka',   icon: '💧', iconName: 'droplet',  icalCategory: null,          windowDays: 14 },
  { id: 'hnojeni',   label: 'Hnojení',   icon: '🌱', iconName: 'sparkles', icalCategory: 'fertilizing', windowDays: 30 },
  { id: 'strihani',  label: 'Stříhání',  icon: '✂️', iconName: 'scissors', icalCategory: 'pruning',     windowDays: 45, weatherPref: 'dry' },
  { id: 'presazeni', label: 'Přesazení', icon: '🪴', iconName: 'leaf',     icalCategory: 'planting',    windowDays: 45, frostSensitive: true, weatherPref: 'mild' },
  { id: 'plet',      label: 'Plení',     icon: '🌿', iconName: 'leaf',     icalCategory: null,          windowDays: 14 },
  { id: 'sklizen',   label: 'Sklizeň',   icon: '🧺', iconName: 'leaf',     icalCategory: 'harvest',     windowDays: 14 },
  { id: 'kontrola',  label: 'Kontrola',  icon: '🔍', iconName: 'search',   icalCategory: null,          windowDays: 21, weatherPref: 'dry' },
  { id: 'postrik',   label: 'Postřik',   icon: '🛡️', iconName: 'sparkles', icalCategory: 'prevention',  windowDays: 14, weatherPref: 'dry' },
  { id: 'jine',      label: 'Jiné',      icon: '📋', iconName: 'leaf',     icalCategory: null,          windowDays: 21 },
];

// Výchozí délka sezónního okna (dny) pro neznámý/nenamapovaný task_type.
export const DEFAULT_WINDOW_DAYS = 21;

const BY_ID = new Map(TASK_TYPES.map((t) => [t.id, t]));

// Emoji v titulku → kanonický task_type (jen jednoznačné případy).
// Sezónní úkony nesou v titulku emoji z plantDatabase.careActions; tímto jim
// přiřadíme reálný task_type místo natvrdo 'jine' (audit §3 bod 3+4).
// Pozn.: záměrně NEmapujeme nejednoznačné emoji (🌱 = výsev i hnojení) ani emoji,
// které by změnily iCal eligibilitu (💧→zalivka, 🔍→kontrola jsou z kalendáře vyloučené),
// aby refaktor nezměnil chování — ty zůstanou 'jine' a iCal je dál matchuje přes emoji.
const EMOJI_TO_TYPE = {
  '✂️': 'strihani',
  '🧺': 'sklizen',
  '🪴': 'presazeni',
};

export function taskIcon(type) {
  return BY_ID.get(type)?.icon ?? '📋';
}

export function taskLabel(type) {
  return BY_ID.get(type)?.label ?? type;
}

// Název SVG ikony (components/Icon.jsx) pro daný task_type — pro TasksPage.
export function taskIconName(type) {
  return BY_ID.get(type)?.iconName ?? 'leaf';
}

// Odvodí reálný task_type ze sezónního care emoji; fallback 'jine'.
export function taskTypeFromEmoji(emoji) {
  return EMOJI_TO_TYPE[emoji] ?? 'jine';
}

// Mrazově citlivé typy úkonů — přesazování/výsadba ven. Tendr sazenice mráz nezvládnou,
// proto u nich Tasks/Home ukazují mrazové varování + nabídku přeplánování (viz frost.js).
export function isFrostSensitiveType(type) {
  return !!BY_ID.get(type)?.frostSensitive;
}

// Délka sezónního okna (dny) daného task_type — po jejím překročení po termínu
// považujeme sezónní okno za promeškané (viz seasonWindow.js).
export function windowDaysForType(type) {
  return BY_ID.get(type)?.windowDays ?? DEFAULT_WINDOW_DAYS;
}

// Počasová preference task_type ('dry' / 'mild' / null) — pro výběr ideálního dne
// v rámci nejbližšího týdne dle předpovědi (viz idealDay.js).
export function weatherPrefForType(type) {
  return BY_ID.get(type)?.weatherPref ?? null;
}

// iCal kategorie pro filtr odběru kalendáře (key v URL `types=` ↔ label v UI).
// Konzumuje GardenDetailPage (CalendarSubscribeModal); backend matchuje přes ICAL_TYPE_FILTERS.
export const ICAL_CATEGORIES = [
  { key: 'pruning',     label: 'Stříhání a řez',        icon: '✂️' },
  { key: 'fertilizing', label: 'Hnojení',               icon: '🌱' },
  { key: 'planting',    label: 'Výsadba a přesazování', icon: '🪴' },
  { key: 'sowing',      label: 'Předpěstování / výsev', icon: '🌰' },
  { key: 'protection',  label: 'Ochrana před zimou',    icon: '🛡️' },
  { key: 'prevention',  label: 'Preventivní ošetření',  icon: '🐛' },
  { key: 'harvest',     label: 'Sklizeň',               icon: '🧺' },
];
