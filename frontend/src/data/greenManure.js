// Zelené hnojení po sklizni — meziplodina pro prázdné záhony. Po sklizni zeleninového
// záhonu je HLAVNÍ podzimní úkon zasít zelené hnojení / meziplodinu (hořčice, svazenka,
// jetel, žito) — kořeny nakypří půdu, nadzemní hmota se zaryje/zamulčuje, zabrání
// vyplavení živin a erozi přes zimu.
//
// ZÁHONOVÁ vrstva jako „Osevní postup" (cropRotation.js) — reuse geometrického bedForPin
// a roku z pinů. Cíleně DOPLŇUJE rotaci: zatímco rotace HLÍDÁ čeleď při výsadbě, tahle
// vrstva proaktivně navrhne, CO zasít do záhonu, který se na podzim uvolnil (zelenina
// sklizena, místo prázdné). ČISTĚ KLIENTSKÁ vrstva — žádné nové schéma ani endpoint.
//
// Volba směsi dle sezónního okna výsevu:
//   - mráz-citlivá hořčice/svazenka pro brzký výsev (8–9) — vymrzne přes zimu sama,
//   - ozimé žito/jetel pro pozdější výsev (10) — přezimuje, na jaře se zaryje.
// Termín výsevu posunutý dle klim. zóny/expozice přes sdílený dateForMonth (jeden zdroj
// pravdy s RecommendedTasks/BulkCareModal), nikdy do minulosti. Zelené hnojení je úkon
// k záhonu, ale úkol potřebuje pin → naváže se na reprezentativní pin v záhonu.
import { dateForMonth } from '../components/RecommendedTasks.jsx';
import { bedForPin } from './cropRotation.js';
import { getPlantCategory, CATEGORY_DEFS } from '../plantDatabase.js';

// Sezónní okno, kdy kartu vůbec ukazujeme (záhon se na podzim uvolňuje po sklizni).
export const GREEN_MANURE_SEASON = [8, 9, 10]; // srpen–říjen

// Jednoleté plodiny, které se sklidí a uvolní záhon. Trvalky/dřeviny (trvalky, travy,
// cibuloviny, keře, stromy, ovoce, popinave…) = trvalý obyvatel → záhon NENÍ uvolněný.
const ANNUAL_CATEGORIES = new Set(['zelenina', 'letnicky']);

// Dvě směsi zeleného hnojení dle okna výsevu (emoji 🌱 = task_type presazeni — výsev).
//   frostKill   = mráz-citlivá hořčice + svazenka, brzký výsev, přes zimu vymrzne sama,
//   overwinter  = ozimé žito + jetel, pozdní výsev, přezimuje a na jaře se zaryje.
export const MIX_FROST_KILL = { key: 'frostKill', emoji: '🌱' };
export const MIX_OVERWINTER = { key: 'overwinter', emoji: '🌱' };

// Vhodná směs pro daný měsíc výsevu: brzký výsev (8–9) vymrzne sám, říjnový přezimuje.
export function mixForMonth(month) {
  return month <= 9 ? MIX_FROST_KILL : MIX_OVERWINTER;
}

// ---- pure helpery ----
function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Klíč kategorie z libovolného tvaru záznamu (enriched object / nový string / starý id-range).
// Shodné s cropRotation.categoryKeyOf (tam není exportováno).
function categoryKeyOf(plant) {
  const c = plant?.category;
  if (c && typeof c === 'object' && c.key) return c.key;
  if (typeof c === 'string' && CATEGORY_DEFS[c]) return CATEGORY_DEFS[c].key;
  if (plant?.id != null) return getPlantCategory(plant.id)?.key || null;
  return null;
}

// Obsazenost záhonu z jeho pinů (už geometricky vyfiltrovaných):
//   annualCount = počet pinů s jednoletou plodinou (zelenina/letnicky),
//   occupied    = je v záhonu pin, který NENÍ jednoletá plodina (trvalka/dřevina/neznámá)
//                 → záhon je obsazený trvalým obyvatelem, na podzim se neuvolní.
// `lookup` = findPlantByName.
export function bedOccupancy(bedPins, lookup) {
  let annualCount = 0;
  let occupied = false;
  for (const p of bedPins || []) {
    const cat = p?.plant_name && typeof lookup === 'function' ? categoryKeyOf(lookup(p.plant_name)) : null;
    if (cat && ANNUAL_CATEGORIES.has(cat)) annualCount++;
    else occupied = true; // dřevina/trvalka/neznámá → záhon není uvolněný
  }
  return { annualCount, occupied };
}

// Dedup na úrovni záhonu: některý úkol v záhonu už LETOS je naplánovaný výsev hnojení.
// `marker` = lokalizovaná podřetězcová značka (z titulku, např. „zelené hnojení").
function bedHasGreenManure(tasks, marker, year) {
  if (!tasks?.length || !marker) return false;
  const mk = String(marker).toLowerCase();
  const yr = String(year);
  return tasks.some(
    (tk) =>
      tk &&
      tk.task_type === 'presazeni' &&
      String(tk.specific_date || '').slice(0, 4) === yr &&
      String(tk.title || '').toLowerCase().includes(mk),
  );
}

// Hlavní logika: vrať seznam uvolněných záhonů, do kterých lze zasít zelené hnojení
// (řazeno dle názvu záhonu). Mimo sezónu (8–10) → []. Záhon kvalifikuje, má-li ≥1 jednoletou
// plodinu a žádného trvalého obyvatele. Termín výsevu = 15. dne aktuálního měsíce posunutý
// dle podmínek, nikdy do minulosti; směs dle měsíce (mixForMonth).
//   pins/beds  = aktuální piny a záhony zahrady,
//   lookup     = findPlantByName,
//   conditions = garden conditions (posun termínu),
//   existingByPin = mapa pin_id → [tasky] (dedup na úrovni záhonu),
//   dedupMarker   = lokalizovaná značka v titulku pro dedup.
export function greenManureForGarden({
  pins, beds, lookup, conditions = null, existingByPin = {}, dedupMarker = null, now = new Date(),
}) {
  const month = now.getMonth() + 1;
  if (!GREEN_MANURE_SEASON.includes(month)) return [];
  if (!Array.isArray(beds) || !Array.isArray(pins) || typeof lookup !== 'function') return [];

  const todayISO = isoLocal(now);
  const year = now.getFullYear();
  const mix = mixForMonth(month);
  // Termín = 15. dne aktuálního měsíce posunutý dle zóny/expozice, nikdy do minulosti.
  const cal = dateForMonth(month, conditions);
  const suggested = cal < todayISO ? todayISO : cal;

  const out = [];
  for (const bed of beds) {
    const bedPins = pins.filter((p) => bedForPin(p, [bed]) === bed);
    if (!bedPins.length) continue; // bez pinů netušíme, že je to zeleninový záhon
    const { annualCount, occupied } = bedOccupancy(bedPins, lookup);
    if (occupied || annualCount < 1) continue; // obsazený trvalkou/dřevinou nebo bez plodiny
    // Dedup na úrovni záhonu — některý pin v záhonu už má letos naplánovaný výsev hnojení.
    const bedTasks = bedPins.flatMap((p) => existingByPin[p.id] || []);
    if (bedHasGreenManure(bedTasks, dedupMarker, year)) continue;

    out.push({
      bedId: bed.id,
      bedName: bed.name,
      bedColor: bed.color || null,
      pinId: bedPins[0].id, // reprezentativní pin v záhonu (úkol potřebuje pin_id)
      mixKey: mix.key,
      emoji: mix.emoji,
      suggested,
      month,
    });
  }
  return out.sort((a, b) => String(a.bedName || '').localeCompare(String(b.bedName || '')));
}
