// Sanity test pro „Podzimní draselné přihnojení pro vyzrání dřeva".
// woodRipeningFeed.js importuje RecommendedTasks.jsx (React/JSX) → nejde načíst v čistém node,
// proto REPLIKUJEME pure logiku (stejně jako test-trunk-whitewash / test-fruit-thinning / …).
// Replika je věrná woodRipeningFeed.js a je now-aware (deterministické testy).
// Kategorie-gate běží proti REÁLNÉ plantDatabase načtené dynamickým importem → ověří, že
// trvalé dřeviny (jabloň/rybíz/zimostráz/plamének) resolvují a byliny/trvalky/zelenina/
// letnicky/cibuloviny jsou vyřazené.
// dateForMonth/getConditionShiftDays = věrná replika; getZoneOffsetDays importujeme
// z reálného climateZones.js (jeden zdroj pravdy pro posun klim. zóny).
// Spuštění: node scripts/test-wood-ripening.cjs
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const root = path.join(__dirname, '..');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);

// ---------- replika pure logiky (woodRipeningFeed.js) ----------
const WOOD_RIPENING_HORIZON_DAYS = 60;
const WOOD_RIPENING_SEASON = [8, 9];
const WOOD_RIPENING_IDEAL_MONTH = 8;
const WOOD_RIPENING_EMOJI = '🍂';
const WOOD_RIPENING_CATEGORIES = new Set(['ovoce', 'stromy', 'kere', 'popinave']);

function categoryKey(plant) {
  const c = plant && plant.category;
  if (!c) return null;
  return typeof c === 'string' ? c : c.key || null;
}
function woodRipeningAppliesTo(plant) {
  if (!plant) return false;
  return WOOD_RIPENING_CATEGORIES.has(categoryKey(plant));
}
function monthFromIso(iso) {
  const m = /^\d{4}-(\d{2})/.exec(iso || '');
  return m ? parseInt(m[1], 10) : null;
}
function isoToday(now) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function daysFromToday(dateStr, now) {
  if (!dateStr) return null;
  const today = new Date(now.getTime());
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}
function hasWoodRipeningInMonth(pinTasks, month, curYear, marker) {
  const mk = marker ? String(marker).toLowerCase() : null;
  for (const e of pinTasks || []) {
    const iso = e.specific_date || e.next_due || '';
    if (monthFromIso(iso) !== month) continue;
    if (!e.frequency_days && Number(String(iso).slice(0, 4)) !== curYear) continue;
    const title = (e.title || '').trim();
    const lowered = title.toLowerCase();
    if (mk && lowered.includes(mk)) return true;
    if (/\bPK\b|K2O/i.test(title)) return true;
  }
  return false;
}

(async () => {
  const cz = await imp('frontend/src/data/climateZones.js');
  const { getZoneOffsetDays } = cz;

  // getConditionShiftDays + dateForMonth — věrná replika RecommendedTasks.jsx (now-aware).
  function getConditionShiftDays(conditions) {
    if (!conditions) return 0;
    let shift = 0;
    shift += getZoneOffsetDays(conditions.climate_zone);
    if (conditions.exposure === 'N') shift += 14;
    if (conditions.exposure === 'S') shift -= 7;
    if (typeof conditions.altitude_m === 'number') {
      if (conditions.altitude_m >= 600) shift += 14;
      else if (conditions.altitude_m >= 400) shift += 7;
      else if (conditions.altitude_m <= 200) shift -= 7;
    }
    return Math.max(-21, Math.min(21, shift));
  }
  function dateForMonth(month, conditions, now) {
    const year = month >= now.getMonth() + 1 ? now.getFullYear() : now.getFullYear() + 1;
    const d = new Date(year, month - 1, 15);
    d.setDate(d.getDate() + getConditionShiftDays(conditions));
    return d.toISOString().slice(0, 10);
  }
  function woodRipeningForPin(pin, plant, conditions, dedupMarker, now) {
    if (!pin || !plant) return [];
    if (!woodRipeningAppliesTo(plant)) return [];
    const curMonth = now.getMonth() + 1;
    if (!WOOD_RIPENING_SEASON.includes(curMonth)) return [];
    const anchorMonth = Math.max(WOOD_RIPENING_IDEAL_MONTH, curMonth);
    let suggested = dateForMonth(anchorMonth, conditions, now);
    let due = daysFromToday(suggested, now);
    if (due === null) return [];
    if (due < 0) { suggested = isoToday(now); due = 0; }
    if (due > WOOD_RIPENING_HORIZON_DAYS) return [];
    const m = monthFromIso(suggested);
    if (hasWoodRipeningInMonth(pin.tasks || [], m, now.getFullYear(), dedupMarker)) return [];
    return [{
      kind: 'woodRipening', month: m, suggested, due,
      taskType: 'hnojeni', emoji: WOOD_RIPENING_EMOJI,
    }];
  }

  // ---------- (1) Kategorie-gate proti REÁLNÉ DB ----------
  const db = await imp('frontend/src/plantDatabase.js');
  const enriched = db.PLANT_DATABASE.map(db.enrichPlant);
  const byCz = (name) => enriched.find((p) => p.nameCz === name);
  const appliesCz = (name) => woodRipeningAppliesTo(byCz(name));

  // trvalé dřeviny v gate → true
  ok(appliesCz('Jabloň') === true, 'jabloň (Malus, stromy) → PK přihnojení se týká');
  ok(appliesCz('Rybíz červený') === true, 'rybíz (Ribes, ovoce) → týká');
  ok(appliesCz('Borůvka') === true, 'borůvka (Vaccinium, ovoce) → týká');
  ok(appliesCz('Buxus (zimostráz)') === true, 'zimostráz (Buxus, kere) → týká');
  ok(appliesCz('Plamének Jackmanii') === true, 'plamének (Clematis, popinave) → týká');
  ok(appliesCz('Růže popínavá Rambler') === true, 'pnoucí růže (Rosa, popinave) → týká');
  ok(byCz('Jabloň').category.key === 'stromy', 'integrita: jabloň je v gate kategorii stromy');
  ok(byCz('Borůvka').category.key === 'ovoce', 'integrita: borůvka je v gate kategorii ovoce');

  // mimo gate → false
  ok(woodRipeningAppliesTo(byCz('Rajče')) === false, 'rajče (zelenina) → mimo gate');
  ok(woodRipeningAppliesTo(byCz('Mrkev')) === false, 'mrkev (zelenina) → mimo gate');
  ok(woodRipeningAppliesTo(byCz('Tulipán')) === false, 'tulipán (cibulovina) → mimo gate (nemá vyzrávající dřevo)');
  ok(woodRipeningAppliesTo(byCz('Levandule')) === false, 'levandule (bylinky) → mimo gate');
  ok(woodRipeningAppliesTo({ category: { key: 'trvalky' }, nameLat: 'Hosta sieboldiana' }) === false,
    'trvalka (Hosta) → mimo gate');
  ok(woodRipeningAppliesTo({ category: { key: 'letnicky' }, nameLat: 'Tagetes patula' }) === false,
    'letnička (Tagetes) → mimo gate');
  ok(woodRipeningAppliesTo({ category: { key: 'jehlicnany' }, nameLat: 'Thuja occidentalis' }) === false,
    'jehličnan (Thuja) → mimo gate (záměrně užší gate)');
  ok(woodRipeningAppliesTo(null) === false, 'bez rostliny → false');
  // string kategorie (před enrichPlant) také funguje
  ok(woodRipeningAppliesTo({ category: 'stromy', nameLat: 'Quercus robur' }) === true,
    'holý string category=stromy → PK přihnojení se týká');
  ok(woodRipeningAppliesTo({ category: 'kere', nameLat: 'Buddleja davidii' }) === true,
    'holý string category=kere → týká');
  ok(woodRipeningAppliesTo({ category: 'popinave', nameLat: 'Clematis montana' }) === true,
    'holý string category=popinave → týká');

  // ---------- (2) Logika woodRipeningForPin (now-aware) ----------
  const pin = (tasks) => ({ id: 1, tasks: tasks || [] });
  const tree = { category: { key: 'stromy' }, nameLat: 'Malus domestica' };
  const veg = { category: { key: 'zelenina' }, nameLat: 'Solanum lycopersicum' };

  {
    const r = woodRipeningForPin(pin(), tree, null, 'draseln', new Date(2030, 7, 3)); // 3. srpna
    ok(r.length === 1 && r[0].kind === 'woodRipening', 'srpen: jabloň → návrh PK přihnojení');
    ok(r[0].month === 8, 'srpnové okno → měsíc 8');
    ok(r[0].taskType === 'hnojeni' && r[0].emoji === '🍂', 'task_type hnojeni, emoji 🍂');
    ok(r[0].due >= 0 && r[0].due <= WOOD_RIPENING_HORIZON_DAYS, 'okno v budoucnu a v horizontu');
  }
  {
    // pozdní srpen — ideál 15. 8. už minul → clamp na dnešek, nikdy do minulosti
    const now = new Date(2030, 7, 22); // 22. srpna
    const r = woodRipeningForPin(pin(), tree, null, 'draseln', now)[0];
    ok(r && r.due === 0 && r.suggested === isoToday(now), 'pozdní srpen: ideál minul → naplánuj na dnešek');
    ok(r.month === 8, 'pozdní srpen: měsíc stále 8');
  }
  {
    // září — kotvíme na září (jinak rollover na srpen příštího roku)
    const r = woodRipeningForPin(pin(), tree, null, 'draseln', new Date(2030, 8, 5))[0]; // 5. září
    ok(r && r.month === 9, 'září: kotva 9 → měsíc 9 (žádný rollover na příští rok)');
    ok(r.due >= 0 && r.due <= WOOD_RIPENING_HORIZON_DAYS, 'září: v budoucnu a v horizontu');
  }
  {
    // pozdní září — ideál 15. 9. minul → clamp na dnešek
    const now = new Date(2030, 8, 25); // 25. září
    const r = woodRipeningForPin(pin(), tree, null, 'draseln', now)[0];
    ok(r && r.due === 0 && r.month === 9, 'pozdní září: ideál minul → dnešek, měsíc 9');
  }

  // mimo sezónu (8–9) → []
  ok(woodRipeningForPin(pin(), tree, null, 'draseln', new Date(2030, 6, 15)).length === 0, 'červenec → mimo sezónu → []');
  ok(woodRipeningForPin(pin(), tree, null, 'draseln', new Date(2030, 9, 15)).length === 0, 'říjen → mimo sezónu → []');
  ok(woodRipeningForPin(pin(), tree, null, 'draseln', new Date(2030, 4, 15)).length === 0, 'květen → mimo sezónu → []');
  ok(woodRipeningForPin(pin(), tree, null, 'draseln', new Date(2030, 0, 15)).length === 0, 'leden → mimo sezónu → []');

  // mimo gate v sezóně → []
  ok(woodRipeningForPin(pin(), veg, null, 'draseln', new Date(2030, 7, 3)).length === 0, 'srpen: rajče (zelenina) → []');

  // ---------- (3) Posun klim. zóny / expozice ----------
  {
    const now = new Date(2030, 7, 3); // 3. srpna (ideál v budoucnu pro všechny varianty)
    const base = woodRipeningForPin(pin(), tree, null, 'draseln', now)[0];
    const north = woodRipeningForPin(pin(), tree, { exposure: 'N' }, 'draseln', now)[0];
    ok(north.suggested > base.suggested, 'severní expozice → pozdější PK (sdílený dateForMonth)');
    ok(getZoneOffsetDays('JHC') !== 0, 'climateZones: JHC má nenulový posun (kotva pro zónu)');
    const jhc = woodRipeningForPin(pin(), tree, { climate_zone: 'JHC' }, 'draseln', now)[0];
    ok(jhc.suggested > base.suggested, 'klim. zóna JHC (chladnější) → pozdější PK');
    ok(north.due <= WOOD_RIPENING_HORIZON_DAYS && jhc.due <= WOOD_RIPENING_HORIZON_DAYS,
      'posunuté termíny stále v horizontu');
  }

  // ---------- (4) Dedup proti existujícímu PK přihnojení v měsíci ----------
  {
    const now = new Date(2030, 7, 3); // srpnové okno (měsíc 8)
    const y = now.getFullYear();
    // Lokalizovaný marker „draseln" v cs titulku → potlačeno.
    const cs = [{ title: '🍂 Draselné hnojení Jabloň', task_type: 'hnojeni', specific_date: `${y}-08-10` }];
    ok(woodRipeningForPin(pin(cs), tree, null, 'draseln', now).length === 0,
      'dedup: titulek „draseln" v srpnu → potlačeno');
    // Jazykově nezávislá pojistka „PK" → potlačeno (i bez markeru).
    const pk = [{ title: 'Aplikovat PK hnojivo', task_type: 'hnojeni', specific_date: `${y}-08-12` }];
    ok(woodRipeningForPin(pin(pk), tree, null, 'draseln', now).length === 0,
      'dedup: chemická značka „PK" v titulku → potlačeno');
    // 'hnojeni' bez markeru PK → NEdedupovat (task_type je příliš obecný, sdílí ho běžné přihnojení).
    const nitrog = [{ title: 'Přihnojit zahradním hnojivem', task_type: 'hnojeni', specific_date: `${y}-08-08` }];
    ok(woodRipeningForPin(pin(nitrog), tree, null, 'draseln', now).length === 1,
      'dedup: běžné přihnojení bez markeru → návrh svítí (task_type obecný)');
    // PK přihnojení v JINÉM měsíci (září) než cílový (srpen) → nevadí.
    const other = [{ title: '🍂 Draselné hnojení Jabloň', task_type: 'hnojeni', specific_date: `${y}-09-10` }];
    ok(woodRipeningForPin(pin(other), tree, null, 'draseln', now).length === 1,
      'dedup: PK v JINÉM měsíci nevadí → návrh svítí');
    // loňské PK (jednorázové) v srpnu → nevadí (jiný rok).
    const lastYear = [{ title: '🍂 Draselné hnojení Jabloň', task_type: 'hnojeni', specific_date: `${y - 1}-08-10` }];
    ok(woodRipeningForPin(pin(lastYear), tree, null, 'draseln', now).length === 1,
      'dedup: loňské PK (jiný rok) → návrh svítí');
    // Opakovaný úkol (frequency_days) — rok nehlídáme, marker rozhodne.
    const recur = [{ title: '🍂 Draselné hnojení Jabloň', task_type: 'hnojeni', specific_date: `${y - 2}-08-10`, frequency_days: 365 }];
    ok(woodRipeningForPin(pin(recur), tree, null, 'draseln', now).length === 0,
      'dedup: opakovaný úkol s markerem v cílovém měsíci → potlačeno');
    // Bez markeru → jen jazykově nezávislé pojistky chytnou. Test, že K2O zafunguje.
    const k2o = [{ title: 'Dodat K2O na zahradu', task_type: 'hnojeni', specific_date: `${y}-08-15` }];
    ok(woodRipeningForPin(pin(k2o), tree, null, 'draseln', now).length === 0,
      'dedup: chemická značka „K2O" v titulku → potlačeno');
  }

  // ---------- (5) Chybějící vstup ----------
  ok(woodRipeningForPin(null, tree, null, 'draseln', new Date(2030, 7, 3)).length === 0, 'bez pinu → []');
  ok(woodRipeningForPin(pin(), null, null, 'draseln', new Date(2030, 7, 3)).length === 0, 'bez rostliny → []');

  // ---------- (6) i18n parita (dedup marker je podřetězec lokalizovaného titulku) ----------
  const langs = ['cs', 'en', 'de', 'pl', 'sk'];
  for (const lang of langs) {
    const ns = JSON.parse(fs.readFileSync(path.join(root, `frontend/src/locales/${lang}.json`), 'utf8'));
    const wr = ns.woodRipening;
    ok(!!wr, `${lang}: namespace woodRipening existuje`);
    const baseKeys = ['title', 'subtitle', 'taskTitle', 'dedup', 'action', 'instr',
      'plan', 'planning', 'planned', 'planFailed', 'notes'];
    for (const k of baseKeys) ok(typeof wr[k] === 'string' && wr[k].length > 0, `${lang}.woodRipening.${k} je neprázdný string`);
    // dedup marker musí být podřetězec taskTitle v daném jazyce (po lowercase)
    const title = wr.taskTitle.replace('{{plant}}', 'Plant').toLowerCase();
    ok(title.includes(wr.dedup.toLowerCase()),
      `${lang}: dedup „${wr.dedup}" je podřetězec taskTitle „${wr.taskTitle}" (po lowercase)`);
  }

  console.log(`\n✅ All ${passed} wood-ripening assertions passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
