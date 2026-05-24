// Databáze chorob a škůdců — offline, lokální datová sada.
// Každý záznam je vázán na rostliny přes `plantTags` (substring v názvu rostliny,
// porovnává se bez diakritiky) a má sezónní okno rizika `months: [začátek, konec]`
// (čísla 1–12, včetně obou hranic).
//   kind: 'disease' = choroba, 'pest' = škůdce
//   symptom    = jak poznat
//   prevention = preventivní hlavní úkon (do sekce „Na co si dát pozor")

export const PEST_DATABASE = [
  // ==================== CHOROBY ====================
  {
    id: 'plisen-bramborova',
    name: 'Plíseň bramborová a rajčatová',
    kind: 'disease',
    icon: '🍂',
    months: [6, 9],
    plantTags: ['rajče', 'brambor'],
    symptom: 'Hnědé olejovité skvrny na listech a plodech, na rubu listů bělavý povlak. Ve vlhku rychle hnije.',
    prevention: 'Zalévej u kořene, nikdy na listy. Drž rozestupy a vzdušnost. Před deštivým obdobím preventivní postřik mědí.',
  },
  {
    id: 'padli',
    name: 'Padlí',
    kind: 'disease',
    icon: '🤍',
    months: [6, 9],
    plantTags: ['okurka', 'cuketa', 'dýně', 'tykev', 'patizon', 'patison', 'růže', 'rybíz', 'angrešt'],
    symptom: 'Bílý moučnatý povlak na listech a stoncích, listy postupně žloutnou a usychají.',
    prevention: 'Vysazuj odolné odrůdy, drž vzdušnost. Při prvních příznacích odstraň napadené listy a ošetři sírou.',
  },
  {
    id: 'plisen-okurkova',
    name: 'Plíseň okurková (peronospora)',
    kind: 'disease',
    icon: '🍂',
    months: [7, 9],
    plantTags: ['okurka'],
    symptom: 'Žluté hranaté skvrny mezi žilkami na líci listu, na rubu šedofialový povlak. Listy rychle zasychají.',
    prevention: 'Větrej skleník, zalévej ráno a u kořene. Pěstuj odolné odrůdy, napadené listy ihned odstraň.',
  },
  {
    id: 'strupovitost',
    name: 'Strupovitost jádrovin',
    kind: 'disease',
    icon: '🍂',
    months: [4, 8],
    plantTags: ['jabloň', 'hrušeň', 'hruška'],
    symptom: 'Olivově hnědé až černé strupovité skvrny na listech a plodech, plody praskají a deformují se.',
    prevention: 'Shrabuj a likviduj spadané listí. Prosvětluj korunu řezem. Preventivní postřik na jaře při rašení.',
  },
  {
    id: 'moniliova-hniloba',
    name: 'Monilióza (hniloba peckovin)',
    kind: 'disease',
    icon: '🍄',
    months: [4, 8],
    plantTags: ['třešeň', 'višeň', 'švestka', 'slivoň', 'meruňka', 'broskvoň', 'jabloň'],
    symptom: 'Náhle uschlé květy a větvičky, na plodech hnědé hnijící skvrny s prstenci výtrusů.',
    prevention: 'Vyřezávej a pal napadené větve i mumie plodů. Prosvětluj korunu. Postřik v době květu.',
  },
  {
    id: 'plisen-seda',
    name: 'Plíseň šedá (botrytida)',
    kind: 'disease',
    icon: '🍄',
    months: [5, 8],
    plantTags: ['jahod', 'malin', 'růže'],
    symptom: 'Šedý plstnatý povlak na plodech a poupatech, plody hnijí, poupata nerozkvetou.',
    prevention: 'Mulčuj jahody slámou, ať plody neleží na zemi. Drž rozestupy, sklízej včas a odstraňuj nahnilé plody.',
  },
  {
    id: 'cerna-skvrnitost-ruzi',
    name: 'Černá skvrnitost růží',
    kind: 'disease',
    icon: '⚫',
    months: [6, 9],
    plantTags: ['růže'],
    symptom: 'Černé skvrny s paprsčitým okrajem na listech, listy žloutnou a předčasně opadávají.',
    prevention: 'Shrabuj opadané listí, zalévej u kořene. Sázej odolné odrůdy a drž keře vzdušné.',
  },
  {
    id: 'kadeřavost-broskvoně',
    name: 'Kadeřavost broskvoně',
    kind: 'disease',
    icon: '🍂',
    months: [3, 5],
    plantTags: ['broskvoň', 'meruňka', 'nektarinka'],
    symptom: 'Listy se kadeří, puchýřnatě bobtnají a červenají, později opadávají. Strom slábne.',
    prevention: 'Klíčový je postřik před rašením pupenů (konec února / březen). Po rozvití listů už pomoc nezabírá.',
  },
  {
    id: 'rez-ruzi',
    name: 'Rez',
    kind: 'disease',
    icon: '🟠',
    months: [6, 9],
    plantTags: ['růže', 'česnek', 'hrušeň', 'hruška'],
    symptom: 'Oranžové až rezavě hnědé kupky výtrusů na rubu listů, líc se skvrní a žloutne.',
    prevention: 'Odstraňuj napadené listy, drž porost vzdušný a zalévej u kořene. Likviduj rostlinné zbytky na podzim.',
  },
  {
    id: 'hnednuti-buxusu',
    name: 'Plíseň zimostrázu (hnědnutí buxusu)',
    kind: 'disease',
    icon: '🍂',
    months: [5, 9],
    plantTags: ['buxus', 'zimostráz'],
    symptom: 'Tmavé skvrny na listech, černé pruhy na výhonech, holá místa v keři. Listy hromadně opadávají.',
    prevention: 'Stříhej za sucha, vyhni se zálivce na listy. Vyřezávej napadené části, prosvětluj keř.',
  },
  {
    id: 'kuvel-rybizu',
    name: 'Antraknóza a rzivost rybízu',
    kind: 'disease',
    icon: '🍂',
    months: [6, 8],
    plantTags: ['rybíz', 'angrešt'],
    symptom: 'Drobné hnědé skvrny na listech, listy předčasně žloutnou a opadávají už v létě.',
    prevention: 'Shrabuj spadané listí, prosvětluj keře řezem. Mulčuj a zalévej u kořene.',
  },

  // ==================== ŠKŮDCI ====================
  {
    id: 'msice',
    name: 'Mšice',
    kind: 'pest',
    icon: '🐛',
    months: [5, 7],
    plantTags: ['růže', 'rajče', 'paprika', 'jabloň', 'třešeň', 'fazol', 'bob', 'kalina', 'slivoň', 'okurka'],
    symptom: 'Kolonie drobného hmyzu na vrcholcích a poupatech, lepkavá medovice, kroutící se listy.',
    prevention: 'Podporuj slunéčka a zlatoočky. Při náletu otři kolonie nebo ostříkni vodou, lze i roztok mýdla.',
  },
  {
    id: 'mandelinka-bramborova',
    name: 'Mandelinka bramborová',
    kind: 'pest',
    icon: '🪲',
    months: [5, 8],
    plantTags: ['brambor', 'lilek', 'rajče'],
    symptom: 'Žlutočerně pruhovaní brouci a oranžové larvy ožírají listy až na holé stonky.',
    prevention: 'Pravidelně kontroluj rub listů, sbírej brouky i vajíčka. Zasahuj hned na začátku náletu.',
  },
  {
    id: 'molice',
    name: 'Molice skleníková',
    kind: 'pest',
    icon: '🦟',
    months: [6, 9],
    plantTags: ['rajče', 'paprika', 'okurka', 'fuchsie', 'pelargón', 'muškát'],
    symptom: 'Drobné bílé mušky vylétají při doteku rostliny, na listech medovice a černě.',
    prevention: 'Větrej skleník, vyvěs žluté lepové desky. Kontroluj nové sazenice před přemístěním k ostatním.',
  },
  {
    id: 'sviluska',
    name: 'Sviluška chmelová',
    kind: 'pest',
    icon: '🕷️',
    months: [7, 9],
    plantTags: ['okurka', 'fazol', 'růže', 'rajče', 'maliník'],
    symptom: 'Jemné pavučinky v paždí listů, listy mramorovité, žloutnou a usychají. Šíří se za sucha a horka.',
    prevention: 'Zvyšuj vzdušnou vlhkost rosením, zalévej dostatečně. Napadené listy odstraň, podporuj dravé roztoče.',
  },
  {
    id: 'plzaci',
    name: 'Plzáci a slimáci',
    kind: 'pest',
    icon: '🐌',
    months: [5, 9],
    plantTags: ['salát', 'jahod', 'zelí', 'brokolice', 'kapusta', 'okrasná tráva', 'jiřina', 'dahlia'],
    symptom: 'Nepravidelné okousané otvory v listech a plodech, lesklé slizké stopy, škoda hlavně po dešti.',
    prevention: 'Sbírej za vlhkých večerů, použij pivní pasti nebo bariéru z drcených skořápek. Udržuj okolí bez úkrytů.',
  },
  {
    id: 'belasci',
    name: 'Housenky bělásků',
    kind: 'pest',
    icon: '🐛',
    months: [6, 8],
    plantTags: ['zelí', 'brokolice', 'kapusta', 'květák', 'kedlubna', 'ředkev'],
    symptom: 'Zelené nebo žlutočerné housenky ožírají listy košťálovin až na žilnatinu, znečišťují trus.',
    prevention: 'Použij ochrannou síť proti motýlům, kontroluj rub listů a sbírej snůšky vajíček i housenky.',
  },
  {
    id: 'obalec-jablecny',
    name: 'Obaleč jablečný (červivost)',
    kind: 'pest',
    icon: '🐛',
    months: [6, 8],
    plantTags: ['jabloň', 'hrušeň', 'hruška', 'ořešák'],
    symptom: 'Červivé plody s chodbičkami k jádřinci, plody předčasně opadávají.',
    prevention: 'Pověs feromonové lapače na sledování náletu, přikládej lepové pásy na kmeny, sbírej spadané plody.',
  },
  {
    id: 'zavijec-zimostrazovy',
    name: 'Zavíječ zimostrázový',
    kind: 'pest',
    icon: '🐛',
    months: [4, 9],
    plantTags: ['buxus', 'zimostráz'],
    symptom: 'Zelené housenky s pavučinou uvnitř keře, ožrané listy, holé výhony. Často několik generací za rok.',
    prevention: 'Pravidelně prohlížej nitro keře, vyvěs feromonové lapače. Housenky sbírej nebo ošetři přípravkem na bázi Bacillus thuringiensis.',
  },
  {
    id: 'kvetopas-jabloňový',
    name: 'Květopas jabloňový',
    kind: 'pest',
    icon: '🪲',
    months: [3, 5],
    plantTags: ['jabloň', 'hrušeň', 'hruška'],
    symptom: 'Poupata nerozkvetou, hnědnou a vypadají jako spálená — larva vyžírá vnitřek květu.',
    prevention: 'Přikládej lepové pásy na kmeny brzy zjara, za chladných rán sklepávej brouky na plachtu.',
  },
  {
    id: 'pilatka-svestkova',
    name: 'Pilatky na peckovinách',
    kind: 'pest',
    icon: '🐛',
    months: [4, 6],
    plantTags: ['švestka', 'slivoň', 'třešeň', 'meruňka'],
    symptom: 'Mladé plůdky opadávají, uvnitř vykousaná dutina s larvou a vlhkým trusem.',
    prevention: 'Vyvěs bílé lepové desky v době květu, sbírej a likviduj předčasně opadané plůdky.',
  },
];

// Normalizace pro porovnání bez diakritiky a velkých písmen.
function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Vrátí choroby a škůdce relevantní pro danou rostlinu (podle názvu).
export function getWarningsForPlant(plantName) {
  const n = norm(plantName);
  if (!n) return [];
  return PEST_DATABASE.filter((w) =>
    w.plantTags.some((tag) => n.includes(norm(tag))),
  );
}

// Je dané riziko aktivní v zadaném měsíci (1–12)?
export function isActiveInMonth(warning, month) {
  const [a, b] = warning.months;
  if (a <= b) return month >= a && month <= b;
  // okno přes přelom roku (pojistka, v datech zatím nevyužito)
  return month >= a || month <= b;
}

// Vrátí všechna rizika aktivní v daném měsíci (1–12).
export function getWarningsForMonth(month) {
  return PEST_DATABASE.filter((w) => isActiveInMonth(w, month));
}

const MONTHS_CZ = [
  '', 'leden', 'únor', 'březen', 'duben', 'květen', 'červen',
  'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec',
];

// Textový popis měsíčního rozsahu rizika, např. "červen–září".
export function monthRangeLabel(months) {
  const [a, b] = months;
  if (a === b) return MONTHS_CZ[a] || '';
  return `${MONTHS_CZ[a] || ''}–${MONTHS_CZ[b] || ''}`;
}

// Lidský popisek typu rizika.
export function kindLabel(kind) {
  return kind === 'pest' ? 'Škůdce' : 'Choroba';
}
