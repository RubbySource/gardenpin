// Hromadné sezónní úkony dle druhu rostliny.
// V detailu zahrady (akční menu) otevře dvoukrokový iOS bottom-sheet:
//   1. vyber typ péče (hnojivo / zastřihni / přesaď…),
//   2. náhled dotčených druhů (počet rostlin + cílový měsíc dle sezónního okna)
//      a jedním klikem vytvoří úkol pro VŠECHNY piny stejného druhu najednou.
//
// Stejný „zdroj pravdy" jako YearPlanModal:
//   - termíny posunuté dle klimatické zóny / expozice (getConditionShiftDays / dateForMonth),
//   - dedup proti už naplánovaným úkonům (pinAlreadyHas — task_type + měsíc),
//   - žádné nové schéma → smyčka přes POST /api/tasks (Promise.all).
//
// Seskupujeme dle care emoji (reliable klíč v seasonalTasks — viz buildSeasonalTasks,
// které zahazuje původní `type` a nechává jen emoji), task_type úkonu nastavíme
// explicitně dle vybrané kategorie (uživatel záměr potvrdil výběrem).
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { findPlantByName } from '../plantDatabase.js';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { monthName, monthNameShort } from '../utils.js';
import { getClimateZone } from '../data/climateZones.js';
import { getConditionShiftDays, dateForMonth } from './RecommendedTasks.jsx';

// Kurátorský seznam hlavních sezónních úkonů (vize: žádné zalévání ani micro-tasky).
// emojis = care emoji v seasonalTasks, které do kategorie spadají; taskType = kanonický
// task_type pro vytvořené úkoly; labelKey = i18n; emoji = ikona kategorie.
const BULK_CATEGORIES = [
  { id: 'pruning',     emojis: ['✂️'], taskType: 'strihani',  emoji: '✂️', labelKey: 'bulkCare.catPruning' },
  { id: 'fertilizing', emojis: ['🌱'], taskType: 'hnojeni',   emoji: '🌱', labelKey: 'bulkCare.catFertilizing' },
  { id: 'transplant',  emojis: ['🪴'], taskType: 'presazeni', emoji: '🪴', labelKey: 'bulkCare.catTransplant' },
  { id: 'protection',  emojis: ['🛡️'], taskType: 'jine',      emoji: '🛡️', labelKey: 'bulkCare.catProtection' },
  { id: 'mulching',    emojis: ['🌾'], taskType: 'jine',      emoji: '🌾', labelKey: 'bulkCare.catMulching' },
  { id: 'harvest',     emojis: ['🧺'], taskType: 'sklizen',   emoji: '🧺', labelKey: 'bulkCare.catHarvest' },
  { id: 'pests',       emojis: ['🐛'], taskType: 'kontrola',  emoji: '🐛', labelKey: 'bulkCare.catPests' },
];

const PRIORITY_COLOR = {
  high:   'var(--danger)',
  medium: 'var(--primary)',
  low:    'var(--text-dim)',
};

function monthFromIso(iso) {
  if (!iso) return null;
  const m = /^\d{4}-(\d{2})/.exec(iso);
  return m ? parseInt(m[1], 10) : null;
}

// Pin už úkon naplánovaný má (stejná logika jako YearPlanModal.isAlreadyScheduled):
// přesné cílové datum + akce v titulku, NEBO stejný měsíc + ne-'jine' task_type,
// NEBO stejný měsíc + akce v titulku.
function pinAlreadyHas(pinTasks, action, month, taskType, conditions) {
  if (!pinTasks?.length) return false;
  const actLower = action.toLowerCase();
  const targetDate = dateForMonth(month, conditions);
  for (const e of pinTasks) {
    if (e.specific_date === targetDate && e.title && e.title.toLowerCase().includes(actLower)) return true;
    const m = monthFromIso(e.specific_date);
    if (m !== month) continue;
    if (taskType !== 'jine' && e.task_type === taskType) return true;
    if (e.title && e.title.toLowerCase().includes(actLower)) return true;
  }
  return false;
}

// Vybere reprezentativní úkon kategorie pro druh: nejbližší nadcházející měsíc
// (>= aktuální), jinak nejbližší v roce. Druh tak má jeden cílový měsíc.
function pickAction(seasonalTasks, emojis, monthNow) {
  const matching = seasonalTasks.filter((s) => emojis.includes(s.emoji));
  if (!matching.length) return null;
  const sorted = matching.slice().sort((a, b) => a.month - b.month);
  return sorted.find((s) => s.month >= monthNow) || sorted[0];
}

export default function BulkCareModal({ garden, pins, onClose, onCreated }) {
  const { t } = useTranslation();
  const conditions = useMemo(
    () => ({
      soil_type: garden.soil_type,
      exposure: garden.exposure,
      altitude_m: garden.altitude_m,
      climate_zone: garden.climate_zone,
    }),
    [garden.soil_type, garden.exposure, garden.altitude_m, garden.climate_zone],
  );
  const shiftDays = getConditionShiftDays(conditions);
  const zone = getClimateZone(conditions.climate_zone);
  const monthNow = new Date().getMonth() + 1;

  const [catId, setCatId] = useState(null); // null = krok 1 (výběr kategorie)
  const [existingByPin, setExistingByPin] = useState(null); // null dokud se nenačtou úkoly
  const [selected, setSelected] = useState({});
  const [creating, setCreating] = useState(false);

  // Esc + zámek scrollu (stejně jako YearPlanModal / Modal.jsx)
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Načti existující úkoly v této zahradě (dedup proti už naplánovaným). Jednou.
  useEffect(() => {
    let cancelled = false;
    api.listTasks()
      .then((all) => {
        if (cancelled) return;
        const map = {};
        for (const tk of all) {
          if (tk.garden_id !== garden.id) continue;
          (map[tk.pin_id] ||= []).push(tk);
        }
        setExistingByPin(map);
      })
      .catch(() => { if (!cancelled) setExistingByPin({}); });
    return () => { cancelled = true; };
  }, [garden.id]);

  // Seskup piny dle druhu (jen ty s plant_name) + resolve seasonalTasks (memo cache).
  const species = useMemo(() => {
    const cache = new Map();
    const lookup = (name) => {
      if (!cache.has(name)) cache.set(name, findPlantByName(name)?.seasonalTasks || []);
      return cache.get(name);
    };
    const groups = new Map();
    for (const p of pins) {
      if (!p.plant_name) continue;
      if (!groups.has(p.plant_name)) {
        groups.set(p.plant_name, { plantName: p.plant_name, pins: [], seasonalTasks: lookup(p.plant_name) });
      }
      groups.get(p.plant_name).pins.push(p);
    }
    return [...groups.values()];
  }, [pins]);

  // Kategorie dostupné v této zahradě (mají aspoň jeden odpovídající druh) + souhrn.
  const availableCategories = useMemo(() => {
    return BULK_CATEGORIES.map((cat) => {
      let pinCount = 0;
      let speciesCount = 0;
      for (const sp of species) {
        if (pickAction(sp.seasonalTasks, cat.emojis, monthNow)) {
          speciesCount += 1;
          pinCount += sp.pins.length;
        }
      }
      return { ...cat, label: t(cat.labelKey), pinCount, speciesCount };
    }).filter((c) => c.speciesCount > 0);
  }, [species, monthNow, t]);

  const activeCat = BULK_CATEGORIES.find((c) => c.id === catId);

  // Řádky kroku 2: jeden řádek per druh (reprezentativní úkon kategorie).
  const rows = useMemo(() => {
    if (!activeCat) return [];
    return species
      .map((sp) => {
        const action = pickAction(sp.seasonalTasks, activeCat.emojis, monthNow);
        if (!action) return null;
        const needing = sp.pins.filter(
          (p) => !pinAlreadyHas(existingByPin?.[p.id], action.action, action.month, activeCat.taskType, conditions),
        );
        return {
          key: sp.plantName,
          plantName: sp.plantName,
          totalPins: sp.pins.length,
          needing,
          action,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.action.month - b.action.month);
  }, [activeCat, species, existingByPin, conditions, monthNow]);

  // Při vstupu do kroku 2 přednastav výběr na druhy, které mají co plánovat.
  const enterCategory = (id) => {
    setCatId(id);
  };
  useEffect(() => {
    if (!activeCat) return;
    const s = {};
    rows.forEach((r) => { if (r.needing.length > 0) s[r.key] = true; });
    setSelected(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catId, existingByPin]);

  const selectableRows = rows.filter((r) => r.needing.length > 0);
  const selectedRows = selectableRows.filter((r) => selected[r.key]);
  const totalTasks = selectedRows.reduce((n, r) => n + r.needing.length, 0);
  const allSelected = selectableRows.length > 0 && selectedRows.length === selectableRows.length;

  const toggle = (key) => setSelected((s) => ({ ...s, [key]: !s[key] }));
  const toggleAll = () => {
    if (allSelected) {
      setSelected({});
    } else {
      const s = {};
      selectableRows.forEach((r) => { s[r.key] = true; });
      setSelected(s);
    }
  };

  const create = async () => {
    if (totalTasks === 0) return;
    setCreating(true);
    try {
      const calls = [];
      for (const r of selectedRows) {
        const specificDate = dateForMonth(r.action.month, conditions);
        const note = t('bulkCare.notes', { month: monthName(r.action.month - 1).toLowerCase() });
        for (const p of r.needing) {
          calls.push(
            api.createTask({
              pin_id: p.id,
              title: `${activeCat.emoji} ${r.action.action}`,
              task_type: activeCat.taskType,
              frequency_days: null,
              specific_date: specificDate,
              notes: note,
            }),
          );
        }
      }
      await Promise.all(calls);
      toast(t('bulkCare.created', { count: calls.length }));
      onCreated?.();
      onClose();
    } catch (e) {
      toast(t('common.error', { msg: e.message }));
      setCreating(false);
    }
  };

  return (
    <div className="yp-backdrop" onClick={onClose}>
      <div className="yp-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="yp-grip" aria-hidden="true" />
        <div className="yp-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            {activeCat && (
              <button type="button" className="bc-back" onClick={() => setCatId(null)}>
                ‹ {t('bulkCare.back')}
              </button>
            )}
            <div className="yp-title">🌿 {t('bulkCare.title')}</div>
            <div className="yp-subtitle">
              {activeCat
                ? t('bulkCare.subtitleCategory', { category: activeCat.label })
                : t('bulkCare.subtitle')}
            </div>
          </div>
          <button className="yp-close" onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>

        {!activeCat ? (
          /* KROK 1 — výběr typu péče */
          availableCategories.length === 0 ? (
            <div className="yp-allplanned small muted">{t('bulkCare.noCategories')}</div>
          ) : (
            <div className="bc-cat-grid">
              {availableCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className="bc-cat-card"
                  onClick={() => enterCategory(cat.id)}
                >
                  <span className="bc-cat-emoji" aria-hidden="true">{cat.emoji}</span>
                  <span className="bc-cat-label">{cat.label}</span>
                  <span className="bc-cat-count">
                    {t('bulkCare.plantsCount', { count: cat.pinCount })}
                    {cat.speciesCount > 1 && ` · ${t('bulkCare.speciesCount', { count: cat.speciesCount })}`}
                  </span>
                </button>
              ))}
            </div>
          )
        ) : (
          /* KROK 2 — náhled dotčených druhů + potvrzení */
          <>
            {shiftDays !== 0 && (
              <div className="yp-shift small muted">
                {zone
                  ? (shiftDays > 0
                      ? t('recommended.zoneShiftLater', { zone: zone.label, days: shiftDays })
                      : t('recommended.zoneShiftEarlier', { zone: zone.label, days: -shiftDays }))
                  : (shiftDays > 0
                      ? t('recommended.microColder', { days: shiftDays })
                      : t('recommended.microWarmer', { days: -shiftDays }))}
              </div>
            )}

            {selectableRows.length > 0 ? (
              <button type="button" className="yp-selectall" onClick={toggleAll}>
                {allSelected ? t('bulkCare.deselectAll') : t('bulkCare.selectAll')}
              </button>
            ) : (
              <div className="yp-allplanned small muted">{t('bulkCare.allPlanned')}</div>
            )}

            <div className="yp-list">
              {rows.map((r) => {
                const planned = r.needing.length === 0;
                const checked = !planned && !!selected[r.key];
                return (
                  <button
                    type="button"
                    key={r.key}
                    className={`yp-row ${planned ? 'is-planned' : ''}`}
                    onClick={() => !planned && toggle(r.key)}
                    disabled={planned}
                  >
                    <span className={`yp-check ${checked ? 'on' : ''} ${planned ? 'planned' : ''}`} aria-hidden="true">
                      {(checked || planned) ? '✓' : ''}
                    </span>
                    <span
                      className="yp-month"
                      style={{ background: PRIORITY_COLOR[r.action.priority] || PRIORITY_COLOR.medium }}
                    >
                      {monthNameShort(r.action.month - 1)}
                    </span>
                    <span className="yp-action">
                      <span className="bc-plant">{r.plantName}</span>
                      <span className="bc-row-action muted small">{activeCat.emoji} {r.action.action}</span>
                    </span>
                    {planned ? (
                      <span className="yp-planned-badge">{t('bulkCare.planned')}</span>
                    ) : (
                      <span className="bc-count" title={t('bulkCare.pinsTitle', { count: r.needing.length })}>
                        ×{r.needing.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="yp-footer">
              <button type="button" className="btn ghost" onClick={() => setCatId(null)} disabled={creating}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn" onClick={create} disabled={creating || totalTasks === 0}>
                {creating ? t('bulkCare.creating') : t('bulkCare.create', { count: totalTasks })}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
