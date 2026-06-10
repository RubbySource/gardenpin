// Ideální den v okně dle počasí — čistě klientská vrstva nad existujícím /api/weather.
// Frost (frost.js) řeší jen „mráz < 2 °C" v 0–2denním okně, fenologie (phenology.js)
// dlouhodobý posun okna o týdny. Tady doplňujeme KRÁTKODOBOU optimalizaci KONKRÉTNÍHO DNE
// v rámci nejbližšího týdne: některé hlavní sezónní úkony mají počasové preference —
//   řez + postřik/kontrola chtějí suchý bezvětrný den (déšť smyje postřik, vlhké řezné rány
//     = houbové infekce → weatherPref 'dry'),
//   přesazení/výsadba mírný den bez mrazu (weatherPref 'mild'),
//   zálivka/hnojení chtějí odložit, když se čeká déšť (příroda zalije/granule smyje
//     → weatherPref 'postrain').
// Pro úkon s termínem 3–7 dní v budoucnu ohodnotíme dny v okně dle 7denní předpovědi
// (precipitation_sum + wind_speed_10m_max + temperature_2m_min) a navrhneme posun na výrazně
// lepší den, pokud existuje. Žádné nové endpointy ani schéma — jen weather fetch.
//
// Vzájemně se vylučuje s frost (0–2 dny) i zmeškaným oknem (po termínu) díky oknu 3–7 dní;
// fenologii (3–45 dní) a historii (3–60 dní) — které posouvají o týdny — ustupuje explicitně
// (jiný DRUH posunu: malý posun dnů, ne týdnů). Nejnižší přednost v řetězci adaptivních hintů.
import { useEffect, useState } from 'react';
import { api } from './api.js';
import { savedWeatherLoc } from './frost.js';
import { daysFromToday } from './utils.js';
import { weatherPrefForType } from './data/taskTypes.js';
import { phenologyState } from './phenology.js';
import { careHistoryState } from './careHistory.js';

const TTL = 30 * 60 * 1000; // 30 min — předpověď se v rámci sezení nemění (jako frost.js)
const FORECAST_DAYS = 7; // potřebujeme celý nejbližší týden, ne 3denní frost okno

const MIN_DUE_DAYS = 3; // < 3 dny = mrazové „teď" okno (frost) → sem nesahat
const MAX_DUE_DAYS = 7; // dál než týden předpověď nepokrývá
const WINDOW_RADIUS = 3; // hledej lepší den max. ±3 dny od termínu (malý posun, ne týdny)

const FROST_C = 2; // °C — pod tím riziko mrazu (sjednoceno s frost.js FROST_THRESHOLD)
const RAIN_MM = 1.0; // mm — od téhle srážky výš považujeme den za „deštivý"
const WIND_KMH = 30; // km/h — od téhle rychlosti výš je den „větrný"
const MIN_IMPROVEMENT = 3; // termín musí být o tolik horší než nejlepší den, jinak neotravuj

function num(v) {
  return typeof v === 'number' && !Number.isNaN(v) ? v : null;
}

function buildForecast(daily) {
  const byDate = {};
  const days = [];
  if (daily && Array.isArray(daily.time)) {
    daily.time.forEach((iso, i) => {
      const entry = {
        date: iso,
        precip: num(daily.precipitation_sum?.[i]),
        wind: num(daily.wind_speed_10m_max?.[i]),
        tmin: num(daily.temperature_2m_min?.[i]),
      };
      byDate[iso] = entry;
      days.push(entry);
    });
  }
  return { byDate, days };
}

let cache = null; // { at, locKey, data }
let inflight = null; // { locKey, promise }

export async function loadIdealForecast() {
  const loc = savedWeatherLoc();
  const locKey = `${loc.lat},${loc.lon}`;
  if (cache && cache.locKey === locKey && Date.now() - cache.at < TTL) return cache.data;
  if (inflight && inflight.locKey === locKey) return inflight.promise;
  const promise = api
    .weather(loc.lat, loc.lon, { forecast_days: FORECAST_DAYS })
    .then((d) => {
      const data = buildForecast(d.daily);
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

// React hook — vrátí 7denní předpověď s precip/wind (nebo null offline / při chybě). Cachováno.
export function useIdealDay() {
  const [forecast, setForecast] = useState(() => cache?.data ?? null);
  useEffect(() => {
    let alive = true;
    loadIdealForecast()
      .then((d) => alive && setForecast(d))
      .catch(() => {}); // offline-first: tiše schovat
    return () => {
      alive = false;
    };
  }, []);
  return forecast;
}

// Den vstupuje do hodnocení jen s kompletními daty.
function scorable(d) {
  return d && d.precip != null && d.wind != null && d.tmin != null;
}

// Náklad dne pro danou preferenci (NIŽŠÍ = lepší). Suchý bezvětrný den → ~0.
export function dayCost(d, pref) {
  if (pref === 'mild') {
    // Mráz je tvrdá penalizace (citlivá výsadba), těžký déšť a silný vítr lehčí.
    const frost = d.tmin < FROST_C ? (FROST_C - d.tmin) * 4 + 8 : 0;
    return frost + d.precip * 0.6 + Math.max(0, d.wind - WIND_KMH) * 0.2;
  }
  if (pref === 'postrain') {
    // Zálivka/hnojivo — déšť úkol nahradí (zalije za nás / granule smyje).
    // Silná penalizace srážek (chceme suchý den po dešti), vítr ignorujeme — zalévat se dá za větru taky.
    return d.precip * 2.0;
  }
  // 'dry' — déšť dominuje (smyje postřik / vlhké rány), vítr sekundárně.
  return d.precip * 1.5 + Math.max(0, d.wind - 20) * 0.3;
}

// Rozdíl dnů b−a mezi YYYY-MM-DD (přes UTC, ať timezone neposune).
function diffDays(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Nejlepší den v okně, nebo null. Jen jednorázové sezónní úkony (specific_date) s počasovou
// preferencí (weatherPref) a termínem 3–7 dní v budoucnu, kde existuje v okně ±3 dnů výrazně
// lepší den dle předpovědi. Návrh nikdy do minulosti. Ustupuje fenologii i historii.
export function bestDayInWindow(task, forecast, pheno, history) {
  if (!forecast || !forecast.days.length || !task?.specific_date) return null;
  const pref = weatherPrefForType(task.task_type);
  if (!pref) return null;
  // Vyšší přednost: posun o týdny (fenologie/historie) → tam neukazuj denní optimalizaci.
  if (phenologyState(task, pheno)) return null;
  if (careHistoryState(task, history, pheno)) return null;

  const date = String(task.specific_date).slice(0, 10);
  const due = daysFromToday(date);
  if (due === null || due < MIN_DUE_DAYS || due > MAX_DUE_DAYS) return null;

  const scheduled = forecast.byDate[date];
  if (!scorable(scheduled)) return null; // bez dat termínu není co porovnávat

  const today = todayISO();
  const candidates = forecast.days.filter(
    (d) => scorable(d) && d.date >= today && Math.abs(diffDays(d.date, date)) <= WINDOW_RADIUS,
  );
  if (candidates.length === 0) return null;

  const schedCost = dayCost(scheduled, pref);
  let best = scheduled;
  let bestCost = schedCost;
  for (const d of candidates) {
    const c = dayCost(d, pref);
    if (c < bestCost) {
      bestCost = c;
      best = d;
    }
  }
  if (best.date === date) return null; // termín už je nejlepší den v okně
  if (schedCost - bestCost < MIN_IMPROVEMENT) return null; // zlepšení pod práh → neotravuj

  return {
    date: best.date, // YYYY-MM-DD — navržený lepší den
    pref, // 'dry' | 'mild' — pro tooltip „proč"
    earlier: best.date < date, // navržený den je dřív než termín
  };
}
