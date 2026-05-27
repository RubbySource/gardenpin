// Sanity test pro „Osevní postup — rotace plodin v záhonech".
// Na rozdíl od ostatních testů (které replikují pure logiku) tady cropRotation.js NEMÁ
// žádný React/i18n import → načteme PŘÍMO reálný ESM modul + reálnou plantDatabase přes
// dynamický import a testujeme proti skutečným datům:
//   (1) matchování botanických čeledí proti REÁLNÉ DB (každý zeleninový/letničkový rod je
//       buď namapovaný na rotační čeleď, nebo vědomě vyřazen jako trvalka),
//   (2) integrita registru ROTATION_FAMILIES (labelKey v cs.json, emoji, skupina),
//   (3) rozhodovací logika (geometrie pin↔záhon, rok pinu, varování při výsadbě,
//       doporučení rotace, přehled zahrady).
// Spuštění: node scripts/test-crop-rotation.cjs
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

(async () => {
  const cr = await imp('frontend/src/data/cropRotation.js');
  const db = await imp('frontend/src/plantDatabase.js');
  const {
    ROTATION_FAMILIES, ROTATION_GROUP_ORDER, ROTATION_LOOKBACK_YEARS, GENUS_FAMILY,
    PERENNIAL_GENERA, familyForPlant, familyForPinName, bedForPin, pinYear,
    bedFamilyHistory, suggestRotationFamilies, rotationCheckForPlanting, gardenRotationOverview,
  } = cr;
  const cs = JSON.parse(fs.readFileSync(path.join(root, 'frontend/src/locales/cs.json'), 'utf8'));

  // ---------- (1) Matchování čeledí proti REÁLNÉ DB ----------
  const enriched = db.PLANT_DATABASE.map(db.enrichPlant);
  const targets = enriched.filter((p) => ['zelenina', 'letnicky'].includes(p.category.key));
  ok(targets.length >= 90, `DB má dost rotačních rostlin (${targets.length})`);

  let mapped = 0;
  let perennial = 0;
  const unresolved = [];
  for (const p of targets) {
    const genus = (p.nameLat || '').trim().split(/\s+/)[0];
    const fam = familyForPlant(p);
    if (fam) { mapped++; continue; }
    if (PERENNIAL_GENERA.has(genus)) { perennial++; continue; }
    unresolved.push(`${p.nameCz} [${genus}]`);
  }
  ok(unresolved.length === 0, `žádný rod není tiše nepřiřazen (unresolved: ${unresolved.join('; ')})`);
  ok(mapped >= 80, `většina rotačních rostlin má čeleď (${mapped})`);
  ok(perennial >= 5, `trvalky vyřazeny (${perennial})`);

  // Konkrétní očekávané čeledi (kotva proti regresi mapování).
  ok(familyForPinName('Rajče') === 'solanaceae', 'rajče → lilkovité');
  ok(familyForPinName('Brokolice') === 'brassicaceae', 'brokolice → košťálovité');
  ok(familyForPinName('Hrášek zahradní') === 'fabaceae', 'hrášek → bobovité');
  ok(familyForPinName('Mrkev') === 'apiaceae', 'mrkev → miříkovité');
  ok(familyForPinName('Cibule kuchyňská') === 'amaryllidaceae', 'cibule → cibulová zelenina');
  ok(familyForPinName('Cuketa') === 'cucurbitaceae', 'cuketa → tykvovité');
  ok(familyForPinName('Surfinie') === 'solanaceae', 'surfinie (letnička) → lilkovité');
  ok(familyForPinName('Chřest zahradní') === null, 'chřest → null (trvalka)');
  ok(familyForPinName('Topinambur') === null, 'topinambur → null (trvalka)');
  // Dřeviny/trvalky mimo rotaci.
  ok(familyForPinName('Rajče') && familyForPlant(db.findPlantByName('Hortenzie Annabelle')) === null, 'keř → null');

  // Každý rod v GENUS_FAMILY ukazuje na existující čeleď.
  for (const [g, fam] of Object.entries(GENUS_FAMILY)) {
    ok(ROTATION_FAMILIES[fam], `GENUS_FAMILY[${g}] → existující čeleď '${fam}'`);
  }

  // ---------- (2) Integrita registru ROTATION_FAMILIES ----------
  let coreCount = 0;
  for (const [key, meta] of Object.entries(ROTATION_FAMILIES)) {
    ok(ROTATION_GROUP_ORDER.includes(meta.group), `${key}: skupina '${meta.group}' v cyklu`);
    ok(typeof meta.emoji === 'string' && meta.emoji.length > 0, `${key}: má emoji`);
    ok(meta.labelKey.startsWith('cropRotation.'), `${key}: labelKey v namespace cropRotation`);
    const leaf = meta.labelKey.split('.')[1];
    ok(cs.cropRotation && typeof cs.cropRotation[leaf] === 'string', `cs.json má překlad ${meta.labelKey}`);
    if (meta.core) coreCount++;
  }
  ok(coreCount === 9, `9 jádrových zeleninových čeledí (${coreCount})`);
  // Každá nutriční skupina je zastoupena aspoň jednou jádrovou čeledí.
  for (const grp of ROTATION_GROUP_ORDER) {
    ok(Object.values(ROTATION_FAMILIES).some((m) => m.core && m.group === grp), `skupina '${grp}' má jádrovou čeleď`);
  }

  // ---------- (3a) Geometrie pin ↔ záhon ----------
  const bedA = { id: 1, name: 'A', x: 10, y: 10, width: 30, height: 30, color: '#a00' };
  const bedB = { id: 2, name: 'B', x: 60, y: 60, width: 20, height: 20 };
  const beds = [bedA, bedB];
  ok(bedForPin({ x: 25, y: 25 }, beds) === bedA, 'pin uvnitř A');
  ok(bedForPin({ x: 65, y: 65 }, beds) === bedB, 'pin uvnitř B');
  ok(bedForPin({ x: 50, y: 50 }, beds) === null, 'pin mimo všechny záhony → null');
  ok(bedForPin({ x: 10, y: 10 }, beds) === bedA, 'pin na hraně (vlevo nahoře) → A');
  ok(bedForPin({ x: 40, y: 40 }, beds) === bedA, 'pin na hraně (vpravo dole) → A');

  // ---------- (3b) Rok pinu ----------
  ok(pinYear({ planting_date: '2024-05-01' }) === 2024, 'rok z planting_date');
  ok(pinYear({ created_at: '2023-03-10T08:00:00Z' }) === 2023, 'fallback rok z created_at');
  ok(pinYear({}) === null, 'bez data → null');

  // ---------- (3c) suggestRotationFamilies ----------
  {
    // Po lilkovitých (heavy) doporuč skupinu ZA heavy v cyklu (root) jako první.
    const sug = suggestRotationFamilies(new Set(['solanaceae']), 'heavy');
    ok(sug.length > 0, 'po lilkovitých nějaké doporučení');
    ok(['apiaceae', 'amaryllidaceae'].includes(sug[0]), `nejdřív kořenová skupina (${sug[0]})`);
    ok(!sug.includes('solanaceae') && !sug.includes('cucurbitaceae'), 'nedoporučí čeleď ze stejné (heavy) skupiny');
  }
  {
    // Prázdná historie → nějaká jádrová doporučení (bez recent constraintu).
    const sug = suggestRotationFamilies(new Set(), null);
    ok(sug.length === 3, 'prázdná historie → 3 doporučení');
  }

  // ---------- (3d) rotationCheckForPlanting ----------
  const NOW = new Date(2026, 4, 15); // květen 2026
  const mkPin = (id, x, y, name, year) => ({ id, x, y, plant_name: name, planting_date: `${year}-05-01` });
  {
    // V záhonu A loni (2025) rostlo rajče → letos sázím paprika (taky lilkovité) → konflikt.
    const pins = [mkPin(1, 25, 25, 'Rajče', 2025)];
    const r = rotationCheckForPlanting({ plantName: 'Paprika', x: 26, y: 26, beds, pins, now: NOW });
    ok(r && r.family === 'solanaceae', 'check: paprika = lilkovité');
    ok(r.conflictYear === 2025, 'check: konflikt s loňským rajčetem (2025)');
    ok(r.suggestions.length > 0 && !r.suggestions.includes('solanaceae'), 'check: doporučí jinou čeleď');
  }
  {
    // Stejná čeleď, ale před >lookback lety (2022, lookback 3 → mimo) → bez konfliktu.
    const oldYear = NOW.getFullYear() - ROTATION_LOOKBACK_YEARS - 1;
    const pins = [mkPin(1, 25, 25, 'Rajče', oldYear)];
    const r = rotationCheckForPlanting({ plantName: 'Paprika', x: 26, y: 26, beds, pins, now: NOW });
    ok(r && r.conflictYear === null, `check: rajče před >lookback lety (${oldYear}) → bez konfliktu`);
  }
  {
    // Jiná čeleď v záhonu (mrkev = miříkovité) → sázím rajče → bez konfliktu.
    const pins = [mkPin(1, 25, 25, 'Mrkev', 2025)];
    const r = rotationCheckForPlanting({ plantName: 'Rajče', x: 26, y: 26, beds, pins, now: NOW });
    ok(r && r.conflictYear === null, 'check: jiná čeleď loni → bez konfliktu');
  }
  {
    // Rajče už LETOS v záhonu (stejná sezóna) → není rotační konflikt (jen společná výsadba).
    const pins = [mkPin(1, 25, 25, 'Rajče', NOW.getFullYear())];
    const r = rotationCheckForPlanting({ plantName: 'Paprika', x: 26, y: 26, beds, pins, now: NOW });
    ok(r && r.conflictYear === null, 'check: stejná čeleď LETOS (ne minulý rok) → bez konfliktu');
  }
  {
    // Pin mimo záhon → null (žádný rotační kontext).
    ok(rotationCheckForPlanting({ plantName: 'Rajče', x: 50, y: 50, beds, pins: [], now: NOW }) === null, 'check: mimo záhon → null');
    // Rostlina mimo rotaci (keř) → null.
    ok(rotationCheckForPlanting({ plantName: 'Hortenzie Annabelle', x: 25, y: 25, beds, pins: [], now: NOW }) === null, 'check: keř → null');
    // Trvalka (chřest) → null.
    ok(rotationCheckForPlanting({ plantName: 'Chřest zahradní', x: 25, y: 25, beds, pins: [], now: NOW }) === null, 'check: chřest → null');
  }

  // ---------- (3e) bedFamilyHistory ----------
  {
    const pins = [mkPin(1, 25, 25, 'Rajče', 2024), mkPin(2, 30, 30, 'Paprika', 2025), mkPin(3, 65, 65, 'Mrkev', 2025)];
    const hist = bedFamilyHistory(bedA, pins);
    ok(hist.has('solanaceae'), 'historie A: lilkovité přítomné');
    ok(!hist.has('apiaceae'), 'historie A: mrkev z B se nezapočítá');
    const e = hist.get('solanaceae');
    ok(e.latestYear === 2025 && e.years.length === 2, 'historie A: lilkovité 2024+2025, latest 2025');
  }

  // ---------- (3f) gardenRotationOverview ----------
  {
    // A: lilkovité dva roky po sobě (2024+2025) → warning. B: mrkev jednou → bez warningu.
    const pins = [mkPin(1, 25, 25, 'Rajče', 2024), mkPin(2, 30, 30, 'Paprika', 2025), mkPin(3, 65, 65, 'Mrkev', 2025)];
    const ov = gardenRotationOverview({ beds, pins, now: NOW });
    ok(ov.length === 2, 'overview: 2 záhony s rotačními rostlinami');
    const a = ov.find((o) => o.bed.id === 1);
    const b = ov.find((o) => o.bed.id === 2);
    ok(a.warnings.length === 1 && a.warnings[0].family === 'solanaceae', 'overview A: warning na opakované lilkovité');
    ok(b.warnings.length === 0, 'overview B: jednorázová mrkev → bez warningu');
    ok(a.suggestions.length > 0 && !a.suggestions.includes('solanaceae'), 'overview A: doporučí rotaci pryč od lilkovitých');
    ok(a.families.some((f) => f.family === 'solanaceae' && f.plantNames.length === 2), 'overview A: 2 druhy lilkovitých');
  }
  {
    // Záhon bez rotačních rostlin se v přehledu neobjeví.
    const pins = [mkPin(1, 25, 25, 'Hortenzie Annabelle', 2025)];
    ok(gardenRotationOverview({ beds, pins, now: NOW }).length === 0, 'overview: jen keře → prázdný přehled');
  }

  console.log(`\n✅ All ${passed} crop-rotation assertions passed.`);
})().catch((e) => { console.error('❌', e); process.exit(1); });
