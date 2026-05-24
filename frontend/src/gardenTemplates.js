// Šablony zahrad — předpřipravené sady rostlin podle typu zahrady.
// Každá šablona obsahuje seznam českých jmen rostlin z plantDatabase.js;
// při použití se pro každou rostlinu vytvoří pin v gridu + všechny její sezónní úkony.

export const GARDEN_TEMPLATES = [
  {
    key: 'zeleninova',
    name: 'Zeleninová zahrada',
    icon: '🥕',
    color: '#5a9a4d',
    description: 'Klasická užitková zahrada: rajčata, paprika, okurky, salát, mrkev a další.',
    plants: [
      'Rajče',
      'Paprika',
      'Okurka salátová',
      'Salát hlávkový',
      'Mrkev',
      'Cibule kuchyňská',
      'Česnek',
      'Cuketa',
      'Hrášek zahradní',
      'Fazole keříčková',
      'Špenát',
    ],
  },
  {
    key: 'okrasna',
    name: 'Okrasná zahrada',
    icon: '🌼',
    color: '#d97a1b',
    description: 'Trvalky a květy pro krásu od jara do podzimu: levandule, růže, denivky, hortenzie.',
    plants: [
      'Levandule',
      'Růže zahradní',
      'Denivka (Hemerocallis)',
      'Echinacea (třapatka)',
      'Šalvěj lékařská',
      'Hortenzie',
      'Tulipán',
      'Narcis',
    ],
  },
  {
    key: 'ovocna',
    name: 'Ovocná zahrada',
    icon: '🍓',
    color: '#c0392b',
    description: 'Stromy, keře a drobné ovoce pro vlastní sklizeň: jahody, maliny, jabloň, třešeň.',
    plants: [
      'Jahodník',
      'Malina',
      'Rybíz červený',
      'Angrešt',
      'Borůvka',
      'Jabloň',
      'Hruška',
      'Švestka',
      'Třešeň',
    ],
  },
  {
    key: 'bylinkova',
    name: 'Bylinková zahrada',
    icon: '🌿',
    color: '#4a7c3a',
    description: 'Aromatické a léčivé byliny do kuchyně i čaje: bazalka, máta, tymián, šalvěj.',
    plants: [
      'Bazalka',
      'Máta peprná',
      'Tymián',
      'Rozmarýn',
      'Šalvěj lékařská',
      'Petržel kořenová',
      'Pažitka',
      'Oregano',
      'Meduňka lékařská',
    ],
  },
];

// Vrátí šablonu podle klíče
export function getTemplate(key) {
  return GARDEN_TEMPLATES.find((t) => t.key === key) || null;
}

// Vygeneruje pozice pinů v gridu (rovnoměrně rozprostřené v rozsahu 0.15–0.85)
// count — kolik pozic potřebujeme. Vrací pole {x, y} v relativních souřadnicích.
export function gridPositions(count) {
  const cols = count <= 4 ? 2 : count <= 9 ? 3 : 4;
  const rows = Math.ceil(count / cols);
  const xStep = 0.7 / Math.max(cols - 1, 1);
  const yStep = 0.7 / Math.max(rows - 1, 1);
  const out = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = cols === 1 ? 0.5 : 0.15 + c * xStep;
    const y = rows === 1 ? 0.5 : 0.15 + r * yStep;
    out.push({ x, y });
  }
  return out;
}
