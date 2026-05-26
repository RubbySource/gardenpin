// Zrcadlo klimatických zón pro backend (CommonJS) — validace climate_zone
// při POST/PUT a labely pro PDF/email export sezónního plánu.
//
// Zdroj pravdy pro UI + offsetDays je frontend/src/data/climateZones.js (ESM).
// Zde držíme jen ID → label. Při změně ID/labelu aktualizuj oba soubory.

const ZONE_LABELS = {
  // Česko
  PHA: 'Hlavní město Praha',
  STC: 'Středočeský kraj',
  JHC: 'Jihočeský kraj',
  PLK: 'Plzeňský kraj',
  KVK: 'Karlovarský kraj',
  ULK: 'Ústecký kraj',
  LBK: 'Liberecký kraj',
  HKK: 'Královéhradecký kraj',
  PAK: 'Pardubický kraj',
  VYS: 'Kraj Vysočina',
  JHM: 'Jihomoravský kraj',
  OLK: 'Olomoucký kraj',
  ZLK: 'Zlínský kraj',
  MSK: 'Moravskoslezský kraj',
  // Slovensko
  'SK-BL': 'Bratislavský kraj',
  'SK-TT': 'Trnavský kraj',
  'SK-TN': 'Trenčiansky kraj',
  'SK-NR': 'Nitriansky kraj',
  'SK-ZA': 'Žilinský kraj',
  'SK-BB': 'Banskobystrický kraj',
  'SK-PO': 'Prešovský kraj',
  'SK-KE': 'Košický kraj',
  // Německo
  'DE-BW': 'Bádensko-Württembersko (Baden-Württemberg)',
  'DE-BY': 'Bavorsko (Bayern)',
  'DE-BE': 'Berlín (Berlin)',
  'DE-BB': 'Braniborsko (Brandenburg)',
  'DE-HB': 'Brémy (Bremen)',
  'DE-HH': 'Hamburk (Hamburg)',
  'DE-HE': 'Hesensko (Hessen)',
  'DE-MV': 'Meklenbursko-Přední Pomořansko (Mecklenburg-Vorpommern)',
  'DE-NI': 'Dolní Sasko (Niedersachsen)',
  'DE-NW': 'Severní Porýní-Vestfálsko (Nordrhein-Westfalen)',
  'DE-RP': 'Porýní-Falc (Rheinland-Pfalz)',
  'DE-SL': 'Sársko (Saarland)',
  'DE-SN': 'Sasko (Sachsen)',
  'DE-ST': 'Sasko-Anhaltsko (Sachsen-Anhalt)',
  'DE-SH': 'Šlesvicko-Holštýnsko (Schleswig-Holstein)',
  'DE-TH': 'Durynsko (Thüringen)',
  // Rakousko
  'AT-B': 'Burgenland',
  'AT-K': 'Korutany (Kärnten)',
  'AT-NO': 'Dolní Rakousy (Niederösterreich)',
  'AT-OO': 'Horní Rakousy (Oberösterreich)',
  'AT-S': 'Salcbursko (Salzburg)',
  'AT-ST': 'Štýrsko (Steiermark)',
  'AT-T': 'Tyrolsko (Tirol)',
  'AT-V': 'Vorarlbersko (Vorarlberg)',
  'AT-W': 'Vídeň (Wien)',
  // Polsko
  'PL-DS': 'Dolnoslezské (Dolnośląskie)',
  'PL-KP': 'Kujavsko-pomořské (Kujawsko-Pomorskie)',
  'PL-LU': 'Lublinské (Lubelskie)',
  'PL-LB': 'Lubušské (Lubuskie)',
  'PL-LD': 'Lodžské (Łódzkie)',
  'PL-MA': 'Malopolské (Małopolskie)',
  'PL-MZ': 'Mazovské (Mazowieckie)',
  'PL-OP': 'Opolské (Opolskie)',
  'PL-PK': 'Podkarpatské (Podkarpackie)',
  'PL-PD': 'Podlaské (Podlaskie)',
  'PL-PM': 'Pomořské (Pomorskie)',
  'PL-SL': 'Slezské (Śląskie)',
  'PL-SK': 'Svatokřížské (Świętokrzyskie)',
  'PL-WN': 'Warmijsko-mazurské (Warmińsko-Mazurskie)',
  'PL-WP': 'Velkopolské (Wielkopolskie)',
  'PL-ZP': 'Západopomořanské (Zachodniopomorskie)',
};

const VALID_ZONE_IDS = Object.keys(ZONE_LABELS);

// Vrátí platné ID nebo null (pro uložení do DB).
function normalizeZoneId(value) {
  return VALID_ZONE_IDS.includes(value) ? value : null;
}

module.exports = { ZONE_LABELS, VALID_ZONE_IDS, normalizeZoneId };
