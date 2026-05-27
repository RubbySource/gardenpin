// Fenologicky přesnější termíny — čistě klientská vrstva nad Open-Meteo.
// Pevný kalendářní měsíc (přes getConditionShiftDays/dateForMonth) je strukturální základ;
// tahle vrstva ho doladí o TEPLOTNÍ složku letošní sezóny: teplé jaro posune ideální okno
// dřív, studené později. Pro nadcházející sezónní úkon ukážeme nenáhlavní hint
// „🌡️ Ideální okno: teď" / „🌡️ Letos asi o ~N dní později/dříve" + akci posunout termín.
//
// Model = odchylka aktuálních teplot od dlouhodobého normálu (lehká aproximace, jak vize
// připouští). Stáhneme posledních ~30 dní denního průměru (temperature_2m_mean přes
// past_days) a porovnáme s sinusovým ročním normálem pro danou zeměp. šířku. Průměrná
// teplotní anomálie (°C) × citlivost (dny/°C) = posun fenofáze ve dnech. Výsledek je
// tvrdě clampnutý (gentle hint, ne tvrdé pravidlo) a gated na dostupnost dat (offline → null).
//
// Neduplikuje frost (frost.js = jen mrazové dny v 3denní předpovědi pro citlivou výsadbu);
// tahle vrstva ladí optimální termín řezu/hnojení/přesazení dle nastřádaného tepla. Vzájemně
// se vylučují: fenologie se ukazuje jen u úkolů s termínem ≥ 3 dny (mimo mrazové i overdue okno).
import { useEffect, useState } from 'react';
import { api } from './api.js';
import { savedWeatherLoc } from './frost.js';
import { daysFromToday } from './utils.js';

const TTL = 30 * 60 * 1000; // 30 min — sdíleno se stylem cache frost.js
const PAST_DAYS = 30; // okno průměrování (kompletní minulé dny)
const MIN_VALID_DAYS = 14; // min. vzorek, jinak data nepovažujeme za dostupná
const SENS_DAYS_PER_C = 3; // o kolik dní 1 °C odchylky posune fenofázi (konzervativně)
const MAX_SHIFT = 18; // ±dny clamp (gentle, v souladu s getConditionShiftDays ±21)

// Den v roce (1–366) z YYYY-MM-DD — přes UTC, ať timezone neposune.
function dayOfYear(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000);
}

// Sinusový roční normál denního průměru teploty pro střední Evropu.
// Hrubá zeměpisná aproximace (nemá lokální normály) — proto výstup tvrdě clampujeme
// a hint je čistě poradní. Nejchladnější ~20. ledna, kontinentální amplituda ~9.5 °C.
function normalMeanTemp(doy, lat) {
  const L = Math.max(45, Math.min(56, lat));
  const annualMean = 9.8 - 0.6 * (L - 48); // °C — klesá k severu
  const amplitude = 9.5; // °C — roční amplituda
  const coldestDoy = 20;
  return annualMean - amplitude * Math.cos((2 * Math.PI * (doy - coldestDoy)) / 365);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Bezpečné přičtení dnů k YYYY-MM-DD ze složek lokálního data (jako seasonWindow.js).
function addDaysISO(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// Teplotní posun fenofáze ze série denních průměrů, nebo null (málo dat).
// + anomálie (tepleji) → sezóna napřed → dřívější termín → záporný shift.
function computeTempShift(daily, lat) {
  if (!daily || !Array.isArray(daily.time) || !Array.isArray(daily.temperature_2m_mean)) return null;
  const today = todayISO();
  let sum = 0;
  let n = 0;
  daily.time.forEach((iso, i) => {
    const mean = daily.temperature_2m_mean[i];
    if (typeof mean !== 'number' || iso >= today) return; // jen kompletní minulé dny
    sum += mean - normalMeanTemp(dayOfYear(iso), lat);
    n++;
  });
  if (n < MIN_VALID_DAYS) return null;
  const anomaly = sum / n; // °C
  const shift = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, Math.round(-anomaly * SENS_DAYS_PER_C)));
  return { shift, anomaly: Math.round(anomaly * 10) / 10, sampleDays: n };
}

let cache = null; // { at, locKey, data }
let inflight = null; // { locKey, promise }

export async function loadPhenology() {
  const loc = savedWeatherLoc();
  const locKey = `${loc.lat},${loc.lon}`;
  if (cache && cache.locKey === locKey && Date.now() - cache.at < TTL) return cache.data;
  if (inflight && inflight.locKey === locKey) return inflight.promise;
  const promise = api
    .weather(loc.lat, loc.lon, { past_days: PAST_DAYS, forecast_days: 1 })
    .then((d) => {
      const s = computeTempShift(d.daily, loc.lat);
      const data = s ? { available: true, ...s } : { available: false };
      cache = { at: Date.now(), locKey, data };
      inflight = null;
      return data;
    })
    .catch((e) => {
      inflight = null;
      throw e;
    });
  inflight = { locKey, promise };
  return promise;
}

// React hook — vrátí fenologický stav (nebo null offline / při chybě). Cachováno mezi stránkami.
export function usePhenology() {
  const [pheno, setPheno] = useState(() => cache?.data ?? null);
  useEffect(() => {
    let alive = true;
    loadPhenology()
      .then((d) => alive && setPheno(d))
      .catch(() => {}); // offline-first: tiše schovat
    return () => {
      alive = false;
    };
  }, []);
  return pheno;
}

const GROWING_MONTHS = new Set([3, 4, 5, 6, 7, 8, 9, 10]); // GDD/anomálie smysl jen v sezóně
const HORIZON_DAYS = 45; // dál do budoucna letošní počasí nepredikuje
const MIN_DUE_DAYS = 3; // < 3 dny = mrazové/„teď" okno → fenologii tam neukazuj (žádný překryv s frost)
const NOW_WINDOW = 3; // ideální termín do ≤3 dnů od dneška = „teď"
const MIN_SHIFT = 5; // pod tímhle posun neotravuj (termín už je v podstatě správně)

// Fenologický stav úkolu, nebo null. Jen jednorázové sezónní úkony (specific_date)
// v růstové sezóně, s termínem 3–45 dní v budoucnu a smysluplným teplotním posunem.
export function phenologyState(task, pheno) {
  if (!pheno?.available || !task?.specific_date) return null;
  const date = String(task.specific_date).slice(0, 10);
  const month = Number(date.slice(5, 7));
  if (!GROWING_MONTHS.has(month)) return null;
  const due = daysFromToday(date);
  if (due === null || due < MIN_DUE_DAYS || due > HORIZON_DAYS) return null;
  const shift = pheno.shift || 0;
  const adjusted = addDaysISO(date, shift);
  const adjustedDue = daysFromToday(adjusted);

  let mode;
  let suggested;
  if (adjustedDue <= NOW_WINDOW) {
    // anomálie přitáhla ideální termín na ~dnešek (nikdy nenavrhuj minulost)
    mode = 'now';
    suggested = todayISO();
  } else {
    mode = shift > 0 ? 'later' : 'earlier';
    suggested = adjusted;
  }
  if (Math.abs(shift) < MIN_SHIFT) return null; // posun pod práh → nic neukazuj
  return { mode, suggested, days: Math.abs(shift), anomaly: pheno.anomaly };
}
