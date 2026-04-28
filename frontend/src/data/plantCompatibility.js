// Plant compatibility data — companion planting & allelopathy
// Pairs use lowercase keywords (without diacritics) that are matched against pin.plant_name
// via a normalized substring check, so "Rajče" matches "Rajče cherry", "Cibule" matches "Cibule kuchyňská" atd.

export const INCOMPATIBLE_PAIRS = [
  // Fenykl je notoricky agresivní allelopat
  ['fenykl', 'rajče'],
  ['fenykl', 'paprika'],
  ['fenykl', 'fazol'],
  ['fenykl', 'kopr'],
  ['fenykl', 'koriandr'],
  ['fenykl', 'mrkev'],
  ['fenykl', 'okurka'],

  // Cibulovité brzdí luskoviny
  ['cibule', 'hrách'],
  ['cibule', 'fazol'],
  ['česnek', 'hrách'],
  ['česnek', 'fazol'],
  ['pórek', 'fazol'],
  ['pažitka', 'hrách'],

  // Brambory: nesnáší rajče (společné choroby) ani okurky
  ['brambor', 'rajče'],
  ['brambor', 'okurka'],
  ['brambor', 'dýně'],
  ['brambor', 'malin'],
  ['brambor', 'slunečnice'],

  // Zelí (brukvovité) — nesnáší jahody, rajčata, fazoly
  ['zelí', 'jahod'],
  ['zelí', 'rajče'],
  ['brokolice', 'rajče'],
  ['brokolice', 'jahod'],
  ['kedlubna', 'rajče'],

  // Kopr potlačuje růst některých zelenin po vykvetení
  ['kopr', 'mrkev'],
  ['kopr', 'rajče'],

  // Slunečnice (allelopat) brzdí brambory a fazole
  ['slunečnice', 'brambor'],
  ['slunečnice', 'fazol'],

  // Ořešák / líska / vlašské stromy — silné allelopaty
  ['líska', 'rajče'],
  ['líska', 'jabloň'],

  // Šalvěj brzdí okurky
  ['šalvěj', 'okurka'],

  // Pelyněk a okolní rostliny
  ['pelyněk', 'fenykl'],

  // Mrkev × kopr (po odkvětu)
  ['mrkev', 'kopr'],

  // Jahody × zelí (vícekrát ověřené)
  ['jahod', 'zelí'],
  ['jahod', 'kapusta'],

  // Rajče × kukuřice (společný škůdce)
  ['rajče', 'kukuřice'],

  // Petržel × salát (potlačení)
  ['petržel', 'salát'],

  // Levandule × máta (oba dominantní)
  ['levandule', 'máta'],

  // Oleandr je toxický pro mnoho jedlých (jen poznámka — ponecháno mimo)
];

export const GOOD_PAIRS = [
  // Klasické zahradní kombinace
  ['rajče', 'bazalka'],
  ['rajče', 'mrkev'],
  ['rajče', 'petržel'],
  ['rajče', 'pažitka'],
  ['rajče', 'měsíček'],
  ['rajče', 'cibule'],
  ['rajče', 'česnek'],

  // Růže — symbol companion plantingu
  ['růže', 'česnek'],
  ['růže', 'levandule'],
  ['růže', 'pažitka'],
  ['růže', 'měsíček'],

  // Mrkev má spoustu kamarádů
  ['cibule', 'mrkev'],
  ['česnek', 'mrkev'],
  ['mrkev', 'pórek'],
  ['mrkev', 'salát'],
  ['mrkev', 'hrách'],

  // Fazole fixují dusík → super pro náročné
  ['fazol', 'mrkev'],
  ['fazol', 'okurka'],
  ['fazol', 'kukuřice'],
  ['fazol', 'salát'],
  ['fazol', 'dýně'],
  ['fazol', 'cuketa'],

  // Brukvovité × bylinky odpuzující škůdce
  ['zelí', 'kopr'],
  ['zelí', 'máta'],
  ['zelí', 'šalvěj'],
  ['zelí', 'tymián'],
  ['brokolice', 'celer'],

  // Bylinky obecně dobré ke zelenině
  ['bazalka', 'paprika'],
  ['bazalka', 'okurka'],
  ['měsíček', 'okurka'],
  ['měsíček', 'paprika'],
  ['měsíček', 'fazol'],

  // Jahody mají rády pažitku, salát, špenát
  ['jahod', 'pažitka'],
  ['jahod', 'salát'],
  ['jahod', 'špenát'],
  ['jahod', 'česnek'],
  ['jahod', 'cibule'],
  ['jahod', 'borůvka'],

  // Okurka × kopr a slunečnice (opora)
  ['okurka', 'kopr'],
  ['okurka', 'slunečnice'],
  ['okurka', 'hrách'],

  // Levandule odpuzuje mšice — ke všemu okrasnému
  ['levandule', 'růže'],
  ['levandule', 'šalvěj'],
  ['levandule', 'rozmarýn'],
  ['levandule', 'tymián'],

  // Heřmánek je „doktor zahrady"
  ['heřmánek', 'zelí'],
  ['heřmánek', 'cibule'],
  ['heřmánek', 'máta'],

  // Borůvka × rododendron (kyselá půda)
  ['borůvka', 'rododendron'],
  ['borůvka', 'pěnišník'],

  // Klasika: rajče × bazalka × paprika
  ['paprika', 'bazalka'],
  ['paprika', 'mrkev'],

  // Kukuřice + dýně + fazole = "Three sisters"
  ['kukuřice', 'dýně'],
  ['kukuřice', 'fazol'],

  // Špenát × jahoda × ředkvička
  ['špenát', 'ředkv'],
  ['ředkv', 'mrkev'],
  ['ředkv', 'salát'],
];

// ----- Normalization helpers -----
function normalize(s) {
  if (!s) return '';
  return s
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .trim();
}

// Match if one of the names contains the key (substring on normalized form)
function matches(plantName, key) {
  const np = normalize(plantName);
  const nk = normalize(key);
  if (!np || !nk) return false;
  return np.includes(nk);
}

function pairMatches(name1, name2, key1, key2) {
  return (
    (matches(name1, key1) && matches(name2, key2)) ||
    (matches(name1, key2) && matches(name2, key1))
  );
}

/**
 * Returns 'good' | 'bad' | 'neutral' for a pair of plant names.
 * Empty / missing names return 'neutral'.
 */
export function checkCompatibility(plantName1, plantName2) {
  if (!plantName1 || !plantName2) return 'neutral';
  // Same plant — neutral (no warning for duplicates)
  if (normalize(plantName1) === normalize(plantName2)) return 'neutral';

  for (const [a, b] of INCOMPATIBLE_PAIRS) {
    if (pairMatches(plantName1, plantName2, a, b)) return 'bad';
  }
  for (const [a, b] of GOOD_PAIRS) {
    if (pairMatches(plantName1, plantName2, a, b)) return 'good';
  }
  return 'neutral';
}

/**
 * For an array of garden pins, returns:
 *   { conflicts: [{ a, b }], goods: [{ a, b }] }
 * Where a/b are pin objects. Each pair is reported once (i < j).
 */
export function getCompatibilityWarnings(gardenPins) {
  const conflicts = [];
  const goods = [];
  if (!Array.isArray(gardenPins)) return { conflicts, goods };
  const pins = gardenPins.filter((p) => p && p.plant_name);
  for (let i = 0; i < pins.length; i++) {
    for (let j = i + 1; j < pins.length; j++) {
      const r = checkCompatibility(pins[i].plant_name, pins[j].plant_name);
      if (r === 'bad') conflicts.push({ a: pins[i], b: pins[j] });
      else if (r === 'good') goods.push({ a: pins[i], b: pins[j] });
    }
  }
  return { conflicts, goods };
}
