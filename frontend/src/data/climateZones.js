// Klimatické zóny ČR — posun fenologických termínů podle kraje.
// offsetDays = o kolik dní se posouvají doporučené sezónní úkony oproti
// celostátnímu průměru. Kladná hodnota = chladnější region (jaro přichází
// později, úkony se oddálí). Záporná = teplejší region (úkony se uspíší).
// Vychází z dlouhodobého nástupu vegetace: teplé nížiny (jižní Morava,
// Polabí) vs. chladné vrchoviny a podhůří (Vysočina, Krušné/Jizerské hory).
// Nadmořská výška zahrady se započítává zvlášť — tady jde o regionální klima.

export const CLIMATE_ZONES = [
  { id: 'PHA', label: 'Hlavní město Praha',    offsetDays: -3 },
  { id: 'STC', label: 'Středočeský kraj',      offsetDays:  0 },
  { id: 'JHC', label: 'Jihočeský kraj',        offsetDays:  4 },
  { id: 'PLK', label: 'Plzeňský kraj',         offsetDays:  2 },
  { id: 'KVK', label: 'Karlovarský kraj',      offsetDays:  5 },
  { id: 'ULK', label: 'Ústecký kraj',          offsetDays:  0 },
  { id: 'LBK', label: 'Liberecký kraj',        offsetDays:  5 },
  { id: 'HKK', label: 'Královéhradecký kraj',  offsetDays:  3 },
  { id: 'PAK', label: 'Pardubický kraj',       offsetDays:  2 },
  { id: 'VYS', label: 'Kraj Vysočina',         offsetDays:  7 },
  { id: 'JHM', label: 'Jihomoravský kraj',     offsetDays: -5 },
  { id: 'OLK', label: 'Olomoucký kraj',        offsetDays:  1 },
  { id: 'ZLK', label: 'Zlínský kraj',          offsetDays:  1 },
  { id: 'MSK', label: 'Moravskoslezský kraj',  offsetDays:  3 },
];

const ZONE_BY_ID = new Map(CLIMATE_ZONES.map((z) => [z.id, z]));

export function getClimateZone(id) {
  if (!id) return null;
  return ZONE_BY_ID.get(id) || null;
}

// Posun ve dnech daný zvoleným krajem (0 pokud není nastaveno).
export function getZoneOffsetDays(id) {
  const z = getClimateZone(id);
  return z ? z.offsetDays : 0;
}

// Krátký lidský popis charakteru regionu — pro tooltip / nápovědu.
export function describeZone(id) {
  const z = getClimateZone(id);
  if (!z) return '';
  if (z.offsetDays <= -3) return 'teplý region — jaro přichází dříve';
  if (z.offsetDays >= 5) return 'chladný region — jaro přichází později';
  if (z.offsetDays >= 2) return 'mírně chladnější region';
  return 'průměrné klima ČR';
}
