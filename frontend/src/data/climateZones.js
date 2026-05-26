// Klimatické zóny střední Evropy — posun fenologických termínů podle regionu.
//
// offsetDays = o kolik dní se posouvají doporučené sezónní úkony oproti
// celostátnímu průměru ČR (baseline = Středočeský kraj, offset 0). Kladná
// hodnota = chladnější region (jaro přichází později, úkony se oddálí).
// Záporná = teplejší region (úkony se uspíší). Hodnoty vycházejí z
// dlouhodobého nástupu vegetace: teplé nížiny (jižní Morava, Vídeňská pánev,
// Porýní, Dolní Slezsko) vs. chladné vrchoviny, podhůří a severovýchod
// (Vysočina, Alpy, Tatry, Podlasí). Nadmořská výška zahrady se započítává
// zvlášť — tady jde o regionální klima.
//
// hardy = orientační reprezentativní USDA zóna mrazuvzdornosti regionu
// (střední Evropa se pohybuje zhruba 5b–8a). Slouží jako informace v nápovědě.
//
// ID: české kraje mají holé 3-písmenné kódy (zpětná kompatibilita s uloženými
// daty). Zahraniční regiony mají prefix země (DE-/AT-/PL-/SK-), ASCII bez
// diakritiky, aby šly bezpečně uložit do DB i do URL.
//
// POZN.: backend má vlastní zrcadlový seznam ID + labelů v
// `backend/climateZones.js` (validace + PDF export). Při změně ID/labelu
// aktualizuj oba soubory.

export const COUNTRIES = [
  { code: 'CZ', label: 'Česko', flag: '🇨🇿' },
  { code: 'SK', label: 'Slovensko', flag: '🇸🇰' },
  { code: 'DE', label: 'Německo', flag: '🇩🇪' },
  { code: 'AT', label: 'Rakousko', flag: '🇦🇹' },
  { code: 'PL', label: 'Polsko', flag: '🇵🇱' },
];

export const CLIMATE_ZONES = [
  // ── Česko (14 krajů) — holé ID kvůli zpětné kompatibilitě ──────────────
  { id: 'PHA', country: 'CZ', label: 'Hlavní město Praha',    offsetDays: -3, hardy: '7a' },
  { id: 'STC', country: 'CZ', label: 'Středočeský kraj',      offsetDays:  0, hardy: '6b' },
  { id: 'JHC', country: 'CZ', label: 'Jihočeský kraj',        offsetDays:  4, hardy: '6a' },
  { id: 'PLK', country: 'CZ', label: 'Plzeňský kraj',         offsetDays:  2, hardy: '6b' },
  { id: 'KVK', country: 'CZ', label: 'Karlovarský kraj',      offsetDays:  5, hardy: '6a' },
  { id: 'ULK', country: 'CZ', label: 'Ústecký kraj',          offsetDays:  0, hardy: '6b' },
  { id: 'LBK', country: 'CZ', label: 'Liberecký kraj',        offsetDays:  5, hardy: '6a' },
  { id: 'HKK', country: 'CZ', label: 'Královéhradecký kraj',  offsetDays:  3, hardy: '6a' },
  { id: 'PAK', country: 'CZ', label: 'Pardubický kraj',       offsetDays:  2, hardy: '6b' },
  { id: 'VYS', country: 'CZ', label: 'Kraj Vysočina',         offsetDays:  7, hardy: '5b' },
  { id: 'JHM', country: 'CZ', label: 'Jihomoravský kraj',     offsetDays: -5, hardy: '7a' },
  { id: 'OLK', country: 'CZ', label: 'Olomoucký kraj',        offsetDays:  1, hardy: '6b' },
  { id: 'ZLK', country: 'CZ', label: 'Zlínský kraj',          offsetDays:  1, hardy: '6b' },
  { id: 'MSK', country: 'CZ', label: 'Moravskoslezský kraj',  offsetDays:  3, hardy: '6a' },

  // ── Slovensko (8 krajů) ────────────────────────────────────────────────
  { id: 'SK-BL', country: 'SK', label: 'Bratislavský kraj',   offsetDays: -5, hardy: '7a' },
  { id: 'SK-TT', country: 'SK', label: 'Trnavský kraj',       offsetDays: -4, hardy: '7a' },
  { id: 'SK-TN', country: 'SK', label: 'Trenčiansky kraj',    offsetDays:  0, hardy: '6b' },
  { id: 'SK-NR', country: 'SK', label: 'Nitriansky kraj',     offsetDays: -4, hardy: '7a' },
  { id: 'SK-ZA', country: 'SK', label: 'Žilinský kraj',       offsetDays:  5, hardy: '6a' },
  { id: 'SK-BB', country: 'SK', label: 'Banskobystrický kraj', offsetDays: 3, hardy: '6a' },
  { id: 'SK-PO', country: 'SK', label: 'Prešovský kraj',      offsetDays:  6, hardy: '5b' },
  { id: 'SK-KE', country: 'SK', label: 'Košický kraj',        offsetDays:  1, hardy: '6b' },

  // ── Německo (16 spolkových zemí) ───────────────────────────────────────
  { id: 'DE-BW', country: 'DE', label: 'Bádensko-Württembersko (Baden-Württemberg)', offsetDays: -4, hardy: '7b' },
  { id: 'DE-BY', country: 'DE', label: 'Bavorsko (Bayern)',                offsetDays:  2, hardy: '6b' },
  { id: 'DE-BE', country: 'DE', label: 'Berlín (Berlin)',                  offsetDays: -2, hardy: '7a' },
  { id: 'DE-BB', country: 'DE', label: 'Braniborsko (Brandenburg)',        offsetDays: -1, hardy: '7a' },
  { id: 'DE-HB', country: 'DE', label: 'Brémy (Bremen)',                   offsetDays: -2, hardy: '8a' },
  { id: 'DE-HH', country: 'DE', label: 'Hamburk (Hamburg)',               offsetDays: -2, hardy: '8a' },
  { id: 'DE-HE', country: 'DE', label: 'Hesensko (Hessen)',                offsetDays: -3, hardy: '7a' },
  { id: 'DE-MV', country: 'DE', label: 'Meklenbursko-Přední Pomořansko (Mecklenburg-Vorpommern)', offsetDays: 1, hardy: '7b' },
  { id: 'DE-NI', country: 'DE', label: 'Dolní Sasko (Niedersachsen)',      offsetDays: -2, hardy: '8a' },
  { id: 'DE-NW', country: 'DE', label: 'Severní Porýní-Vestfálsko (Nordrhein-Westfalen)', offsetDays: -4, hardy: '8a' },
  { id: 'DE-RP', country: 'DE', label: 'Porýní-Falc (Rheinland-Pfalz)',    offsetDays: -5, hardy: '7b' },
  { id: 'DE-SL', country: 'DE', label: 'Sársko (Saarland)',                offsetDays: -5, hardy: '7b' },
  { id: 'DE-SN', country: 'DE', label: 'Sasko (Sachsen)',                  offsetDays:  2, hardy: '7a' },
  { id: 'DE-ST', country: 'DE', label: 'Sasko-Anhaltsko (Sachsen-Anhalt)', offsetDays: -2, hardy: '7a' },
  { id: 'DE-SH', country: 'DE', label: 'Šlesvicko-Holštýnsko (Schleswig-Holstein)', offsetDays: 1, hardy: '8a' },
  { id: 'DE-TH', country: 'DE', label: 'Durynsko (Thüringen)',             offsetDays:  2, hardy: '6b' },

  // ── Rakousko (9 spolkových zemí) ───────────────────────────────────────
  { id: 'AT-B',  country: 'AT', label: 'Burgenland',                       offsetDays: -6, hardy: '7b' },
  { id: 'AT-K',  country: 'AT', label: 'Korutany (Kärnten)',               offsetDays:  1, hardy: '6b' },
  { id: 'AT-NO', country: 'AT', label: 'Dolní Rakousy (Niederösterreich)', offsetDays: -3, hardy: '7a' },
  { id: 'AT-OO', country: 'AT', label: 'Horní Rakousy (Oberösterreich)',   offsetDays:  1, hardy: '6b' },
  { id: 'AT-S',  country: 'AT', label: 'Salcbursko (Salzburg)',            offsetDays:  5, hardy: '6a' },
  { id: 'AT-ST', country: 'AT', label: 'Štýrsko (Steiermark)',             offsetDays:  0, hardy: '6b' },
  { id: 'AT-T',  country: 'AT', label: 'Tyrolsko (Tirol)',                 offsetDays:  8, hardy: '6a' },
  { id: 'AT-V',  country: 'AT', label: 'Vorarlbersko (Vorarlberg)',        offsetDays:  4, hardy: '7a' },
  { id: 'AT-W',  country: 'AT', label: 'Vídeň (Wien)',                      offsetDays: -5, hardy: '7b' },

  // ── Polsko (16 vojvodství) ─────────────────────────────────────────────
  { id: 'PL-DS', country: 'PL', label: 'Dolnoslezské (Dolnośląskie)',      offsetDays: -3, hardy: '7a' },
  { id: 'PL-KP', country: 'PL', label: 'Kujavsko-pomořské (Kujawsko-Pomorskie)', offsetDays: 2, hardy: '6b' },
  { id: 'PL-LU', country: 'PL', label: 'Lublinské (Lubelskie)',            offsetDays:  3, hardy: '6a' },
  { id: 'PL-LB', country: 'PL', label: 'Lubušské (Lubuskie)',              offsetDays: -1, hardy: '7a' },
  { id: 'PL-LD', country: 'PL', label: 'Lodžské (Łódzkie)',                offsetDays:  2, hardy: '6b' },
  { id: 'PL-MA', country: 'PL', label: 'Malopolské (Małopolskie)',         offsetDays:  2, hardy: '6b' },
  { id: 'PL-MZ', country: 'PL', label: 'Mazovské (Mazowieckie)',           offsetDays:  2, hardy: '6a' },
  { id: 'PL-OP', country: 'PL', label: 'Opolské (Opolskie)',               offsetDays: -2, hardy: '7a' },
  { id: 'PL-PK', country: 'PL', label: 'Podkarpatské (Podkarpackie)',      offsetDays:  3, hardy: '6a' },
  { id: 'PL-PD', country: 'PL', label: 'Podlaské (Podlaskie)',             offsetDays:  8, hardy: '5b' },
  { id: 'PL-PM', country: 'PL', label: 'Pomořské (Pomorskie)',             offsetDays:  3, hardy: '7a' },
  { id: 'PL-SL', country: 'PL', label: 'Slezské (Śląskie)',                offsetDays:  0, hardy: '6b' },
  { id: 'PL-SK', country: 'PL', label: 'Svatokřížské (Świętokrzyskie)',    offsetDays:  3, hardy: '6a' },
  { id: 'PL-WN', country: 'PL', label: 'Warmijsko-mazurské (Warmińsko-Mazurskie)', offsetDays: 6, hardy: '6a' },
  { id: 'PL-WP', country: 'PL', label: 'Velkopolské (Wielkopolskie)',      offsetDays:  0, hardy: '7a' },
  { id: 'PL-ZP', country: 'PL', label: 'Západopomořanské (Zachodniopomorskie)', offsetDays: 2, hardy: '7a' },
];

const ZONE_BY_ID = new Map(CLIMATE_ZONES.map((z) => [z.id, z]));

export function getClimateZone(id) {
  if (!id) return null;
  return ZONE_BY_ID.get(id) || null;
}

// Posun ve dnech daný zvoleným regionem (0 pokud není nastaveno).
export function getZoneOffsetDays(id) {
  const z = getClimateZone(id);
  return z ? z.offsetDays : 0;
}

// Země, do které region patří ('CZ' default fallback pro neznámé/holé CZ kódy).
export function getZoneCountry(id) {
  const z = getClimateZone(id);
  return z ? z.country : 'CZ';
}

// Regiony jedné země v pořadí, v jakém jsou definované.
export function getZonesByCountry(code) {
  return CLIMATE_ZONES.filter((z) => z.country === code);
}

// Krátký lidský popis charakteru regionu — pro tooltip / nápovědu.
// Country-neutrální (platí napříč střední Evropou), volitelně s USDA zónou.
export function describeZone(id) {
  const z = getClimateZone(id);
  if (!z) return '';
  let phrase;
  if (z.offsetDays <= -4) phrase = 'teplý region — jaro přichází dříve';
  else if (z.offsetDays <= -1) phrase = 'mírně teplejší region';
  else if (z.offsetDays <= 1) phrase = 'průměrné středoevropské klima';
  else if (z.offsetDays <= 4) phrase = 'mírně chladnější region';
  else phrase = 'chladný region — jaro přichází později';
  return z.hardy ? `${phrase} · USDA ${z.hardy}` : phrase;
}
