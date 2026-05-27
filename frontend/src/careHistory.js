// Učení z historie péče — adaptivní termíny dle loňska. Čistě klientská vrstva nad
// existující care_history: appka eviduje, KDY uživatel reálně úkon splnil. Tady pro
// nadcházející jednorázový sezónní úkon (specific_date) porovnáme navržené datum s tím,
// kdy TENTÝŽ úkon (stejný pin + shoda akce/titulku) reálně proběhl v PŘEDCHOZÍCH letech.
// Pokud se loňský (nebo průměr za 2–3 roky) reálný den v roce liší o ≥ MIN_DIFF_DAYS,
// nabídneme posun termínu na ten „osobní" den letošního roku (api.snoozeTask).
//
// Data tahá lehký endpoint /api/care-history/doy (agregace per pin+akce → den v roce),
// ať se nestahuje celá care_history. Strukturální základ termínů (zóna/expozice/výška) je
// už zapečený v specific_date přes getConditionShiftDays/dateForMonth; historie přidává
// „osobní" složku navrch.
//
// Pořadí adaptivních hintů: frost → zmeškané okno → fenologie → historie. Historie má
// nejnižší přednost → ustoupí fenologii (phenologyState). Frost (0–2 dny v budoucnu) ani
// zmeškané okno (po termínu) se s naším oknem (3–60 dní v budoucnu) nepřekrývají.
import { useEffect, useState } from 'react';
import { api } from './api.js';
import { daysFromToday } from './utils.js';
import { phenologyState } from './phenology.js';

const TTL = 5 * 60 * 1000; // 5 min — historie se mění pomalu
const MIN_DUE_DAYS = 3; // < 3 dny = mimo plánovací okno (a mimo mrazové „teď" okno)
const HORIZON_DAYS = 60; // dál do budoucna osobní termín neplánujeme
const MAX_YEARS = 3; // průměrujeme přes max. 3 poslední předchozí roky
const MIN_DIFF_DAYS = 7; // pod tímhle rozdílem termín neotravuj

// Klíč lookup mapy — musí odpovídat formátu z backendu (`${pin_id} ${action}`).
const keyFor = (pinId, action) => `${pinId} ${action}`;

// Den v roce (1–366) → YYYY-MM-DD v daném roce, skládáno z lokálních složek (jako
// seasonWindow.js / phenology.js). new Date(rok,0,1) = 1. ledna; setDate(doy) přeteče
// do správného měsíce (doy=32 → 1. února), takže timezone neposune výsledek.
function doyToISO(year, doy) {
  const d = new Date(year, 0, 1);
  d.setDate(doy);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Vstupní pole [{ pin_id, action, years }] → Map pro O(1) lookup.
function buildLookup(rows) {
  const m = new Map();
  for (const r of rows || []) {
    if (!r || r.pin_id == null || !r.action) continue;
    m.set(keyFor(r.pin_id, r.action), r);
  }
  return m;
}

let cache = null; // { at, data: Map }
let inflight = null; // Promise<Map>

export async function loadCareHistory() {
  if (cache && Date.now() - cache.at < TTL) return cache.data;
  if (inflight) return inflight;
  inflight = api
    .careHistoryDoy()
    .then((rows) => {
      const data = buildLookup(rows);
      cache = { at: Date.now(), data };
      inflight = null;
      return data;
    })
    .catch((e) => {
      inflight = null;
      throw e;
    });
  return inflight;
}

// React hook — vrátí lookup Map (nebo null offline / při chybě). Cachováno mezi stránkami.
export function useCareHistory() {
  const [lookup, setLookup] = useState(() => cache?.data ?? null);
  useEffect(() => {
    let alive = true;
    loadCareHistory()
      .then((d) => alive && setLookup(d))
      .catch(() => {}); // offline-first: tiše schovat
    return () => {
      alive = false;
    };
  }, []);
  return lookup;
}

// Adaptivní stav úkolu z historie, nebo null. Jen jednorázové sezónní úkony (specific_date)
// s termínem 3–60 dní v budoucnu, kde osobní historie posune ideální den o ≥ MIN_DIFF_DAYS.
// `pheno` (volitelné) → ustoupíme fenologii, pokud zrovna ukazuje (vyšší přednost).
export function careHistoryState(task, lookup, pheno) {
  if (!lookup || !task?.specific_date || task?.pin_id == null || !task?.title) return null;
  // Fenologie má přednost (pořadí frost → okno → fenologie → historie).
  if (phenologyState(task, pheno)) return null;

  const date = String(task.specific_date).slice(0, 10);
  const due = daysFromToday(date);
  if (due === null || due < MIN_DUE_DAYS || due > HORIZON_DAYS) return null;

  const entry = lookup.get(keyFor(task.pin_id, task.title));
  if (!entry || !Array.isArray(entry.years)) return null;

  const curYear = Number(date.slice(0, 4));
  // Jen předchozí roky (ne letošní cílový), nejnovější první, max. 3.
  const prior = entry.years
    .filter((y) => y && Number(y.year) < curYear && Number.isFinite(Number(y.doy)))
    .sort((a, b) => b.year - a.year)
    .slice(0, MAX_YEARS);
  if (prior.length === 0) return null;

  const lastYearDoy = Math.round(Number(prior[0].doy));
  const avgDoy = Math.round(prior.reduce((s, y) => s + Number(y.doy), 0) / prior.length);
  const multi = prior.length >= 2;
  const targetDoy = multi ? avgDoy : lastYearDoy; // ≥2 roky → robustnější průměr

  const suggested = doyToISO(curYear, targetDoy);
  const sugDue = daysFromToday(suggested);
  if (sugDue === null || sugDue < 0) return null; // návrh nikdy do minulosti

  const diff = Math.abs(due - sugDue);
  if (diff < MIN_DIFF_DAYS) return null; // termín už je v podstatě „tvůj"

  return {
    mode: multi ? 'avg' : 'last',
    suggested, // YYYY-MM-DD letošního roku
    lastYearDate: doyToISO(curYear, lastYearDoy),
    avgDate: doyToISO(curYear, avgDoy),
    years: prior.length,
    days: diff,
    earlier: sugDue < due, // tvůj termín je dřív než navržený
  };
}
