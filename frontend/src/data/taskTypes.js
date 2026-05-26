// Jednotná taxonomie typů úkonů — SINGLE SOURCE OF TRUTH.
//
// Sjednocuje tři dříve rozcházející se slovníky (viz docs/FUNCTIONAL_AUDIT.md §3 body 3, 4, 7):
//   - utils.TASK_TYPES (emoji ikony)
//   - TasksPage.TASK_TYPE_ICON (SVG ikony — měl ŠPATNÉ klíče zaliti/rez/vysadba…)
//   - iCal filtr (anglické klíče pruning/fertilizing…)
//
// Každý typ nese: id (kanonický task_type v DB), label (cs), icon (emoji),
// iconName (název SVG ikony v components/Icon.jsx) a icalCategory (do jaké iCal kategorie spadá).
//
// POZN. backend (backend/server.js → ICAL_TYPE_FILTERS) zrcadlí icalCategory + id;
// při změně typů drž backend v souladu.

export const TASK_TYPES = [
  { id: 'zalivka',   label: 'Zálivka',   icon: '💧', iconName: 'droplet',  icalCategory: null },
  { id: 'hnojeni',   label: 'Hnojení',   icon: '🌱', iconName: 'sparkles', icalCategory: 'fertilizing' },
  { id: 'strihani',  label: 'Stříhání',  icon: '✂️', iconName: 'scissors', icalCategory: 'pruning' },
  { id: 'presazeni', label: 'Přesazení', icon: '🪴', iconName: 'leaf',     icalCategory: 'planting', frostSensitive: true },
  { id: 'plet',      label: 'Plení',     icon: '🌿', iconName: 'leaf',     icalCategory: null },
  { id: 'sklizen',   label: 'Sklizeň',   icon: '🧺', iconName: 'leaf',     icalCategory: 'harvest' },
  { id: 'kontrola',  label: 'Kontrola',  icon: '🔍', iconName: 'search',   icalCategory: null },
  { id: 'jine',      label: 'Jiné',      icon: '📋', iconName: 'leaf',     icalCategory: null },
];

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
