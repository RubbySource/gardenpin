// Mrazově-chytré přeplánování — čistě klientská vrstva nad existujícím /api/weather.
// Open-Meteo vrací 3denní předpověď (daily.temperature_2m_min). U mrazově citlivých
// úkonů (přesazení/výsadba — viz taskTypes.isFrostSensitiveType) naplánovaných na den
// s předpovězeným mrazem ukazujeme varování + nabídku posunout na první den bez mrazu.
// Žádné nové endpointy ani schéma — jen weather fetch + task list.
import { useEffect, useState } from 'react';
import { api } from './api.js';
import { localeCode } from './i18n.js';
import { isFrostSensitiveType } from './data/taskTypes.js';

export const FROST_THRESHOLD = 2; // °C — pod touto hodnotou je riziko mrazu (sjednoceno s WeatherWidget)

const PRAGUE = { lat: 50.08, lon: 14.44 };
const TTL = 30 * 60 * 1000; // 30 min — předpověď se v rámci sezení nemění tak rychle

// Stejný zdroj polohy jako WeatherWidget (localStorage 'weatherLoc', fallback Praha).
// Exportováno, ať fenologická vrstva (phenology.js) bere polohu ze stejného zdroje.
export function savedWeatherLoc() {
  try {
    const s = JSON.parse(localStorage.getItem('weatherLoc'));
    if (s && typeof s.lat === 'number' && typeof s.lon === 'number') return s;
  } catch {}
  return PRAGUE;
}
const savedLoc = savedWeatherLoc;

function buildForecast(daily) {
  const byDate = {};
  const days = [];
  if (daily && Array.isArray(daily.time)) {
    daily.time.forEach((iso, i) => {
      const min = daily.temperature_2m_min?.[i];
      const frost = typeof min === 'number' && min < FROST_THRESHOLD;
      const entry = { date: iso, min, frost };
      byDate[iso] = entry;
      days.push(entry);
    });
  }
  return { byDate, days };
}

let cache = null; // { at, locKey, data }
let inflight = null; // { locKey, promise }

// Naplní cache z dat, která už načetl WeatherWidget — ušetří druhý fetch na Home.
export function primeFrostForecast(loc, daily) {
  if (!loc || !daily) return;
  cache = { at: Date.now(), locKey: `${loc.lat},${loc.lon}`, data: buildForecast(daily) };
}

export async function loadFrostForecast() {
  const loc = savedLoc();
  const locKey = `${loc.lat},${loc.lon}`;
  if (cache && cache.locKey === locKey && Date.now() - cache.at < TTL) return cache.data;
  if (inflight && inflight.locKey === locKey) return inflight.promise;
  const promise = api
    .weather(loc.lat, loc.lon)
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

// React hook — vrátí předpověď (nebo null offline / při chybě). Cachováno mezi stránkami.
export function useFrostForecast() {
  const [forecast, setForecast] = useState(() => cache?.data ?? null);
  useEffect(() => {
    let alive = true;
    loadFrostForecast()
      .then((d) => alive && setForecast(d))
      .catch(() => {}); // offline-first: tiše schovat
    return () => {
      alive = false;
    };
  }, []);
  return forecast;
}

function taskDateISO(task) {
  const d = task?.next_due || task?.specific_date;
  return d ? String(d).slice(0, 10) : null;
}

// Mrazové riziko úkolu: { date, min } pokud je úkol mrazově citlivý A jeho termín
// padá na předpovězený mrazivý den; jinak null.
export function frostRiskForTask(task, forecast) {
  if (!forecast || !task || !isFrostSensitiveType(task.task_type)) return null;
  const iso = taskDateISO(task);
  if (!iso) return null;
  const entry = forecast.byDate[iso];
  return entry && entry.frost ? { date: iso, min: entry.min } : null;
}

// Bezpečné přičtení dnů k YYYY-MM-DD (přes UTC, ať timezone neposune datum).
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

// První den bez mrazu PO `fromISO` v předpovědi; když takový v okně není,
// posuneme na den po posledním předpovězeném dni (ven z mrazivého okna).
export function firstFrostFreeDate(forecast, fromISO) {
  if (!forecast || !forecast.days.length || !fromISO) return null;
  const later = forecast.days.filter((d) => d.date > fromISO);
  const free = later.find((d) => !d.frost);
  if (free) return free.date;
  const last = forecast.days[forecast.days.length - 1].date;
  const base = last > fromISO ? last : fromISO;
  return addDays(base, 1);
}

// Krátké lokalizované datum (den + měsíc) pro mrazový badge — přes UTC, ať nesklouzne.
export function shortFrostDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(localeCode(), {
    day: 'numeric',
    month: 'numeric',
    timeZone: 'UTC',
  });
}
