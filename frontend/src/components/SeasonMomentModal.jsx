// Sezónní momenty — kurátorské balíčky úkonů dle ročního období.
// Druhá osa hromadného plánování vedle BulkCareModal: místo „dle typu péče"
// plánuj „dle pojmenovaného sezónního milníku" napříč celou zahradou. Každý moment
// (Jarní probuzení / Letní údržba / Podzimní příprava / Zimní klid) je předdefinovaná
// MNOŽINA care kategorií omezená na okno měsíců → mix typů vázaný na období.
//
// Stejný „zdroj pravdy" jako BulkCareModal (importujeme jeho helpery):
//   - care kategorie (BULK_CATEGORIES), reprezentativní úkon (pickAction — s oknem měsíců),
//   - termíny posunuté dle klimatické zóny / expozice (dateForMonth / getConditionShiftDays),
//   - dedup proti už naplánovaným úkonům (pinAlreadyHas),
//   - žádné nové schéma → smyčka přes POST /api/tasks (Promise.all).
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { findPlantByName } from '../plantDatabase.js';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { monthName, monthNameShort } from '../utils.js';
import { getClimateZone } from '../data/climateZones.js';
import { getConditionShiftDays, dateForMonth } from './RecommendedTasks.jsx';
import { BULK_CATEGORIES, PRIORITY_COLOR, pickAction, pinAlreadyHas } from './BulkCareModal.jsx';

const CAT_BY_ID = Object.fromEntries(BULK_CATEGORIES.map((c) => [c.id, c]));

// Kurátorské momenty — pojmenovaný sezónní milník = okno měsíců + množina care kategorií.
// Okna pokrývají celý rok bez překryvu (jaro 3–5, léto 6–8, podzim 9–11, zima 12,1,2).
const SEASON_MOMENTS = [
  { id: 'spring', emoji: '🌱', months: [3, 4, 5],   categories: ['pruning', 'fertilizing', 'transplant'] },
  { id: 'summer', emoji: '☀️', months: [6, 7, 8],   categories: ['pruning', 'pests', 'fertilizing'] },
  { id: 'autumn', emoji: '🍂', months: [9, 10, 11],  categories: ['transplant', 'mulching', 'protection', 'harvest'] },
  { id: 'winter', emoji: '❄️', months: [12, 1, 2],   categories: ['pruning'] },
];

// Okno momentu jako rozsah „od–do" v lidské řeči (např. „březen–květen").
function momentRange(months) {
  return `${monthName(months[0] - 1)}–${monthName(months[months.length - 1] - 1)}`;
}

export default function SeasonMomentModal({ garden, pins, onClose, onCreated }) {
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

  const [momentId, setMomentId] = useState(null); // null = krok 1 (výběr momentu)
  const [existingByPin, setExistingByPin] = useState(null); // null dokud se nenačtou úkoly
  const [selected, setSelected] = useState({});
  const [creating, setCreating] = useState(false);

  // Esc + zámek scrollu (stejně jako YearPlanModal / BulkCareModal)
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

  // Momenty dostupné v zahradě (mají aspoň jeden druh s úkonem v okně) + souhrn.
  // Pořadí: aktuální sezóna první, pak chronologicky vpřed (nadcházející období).
  const availableMoments = useMemo(() => {
    const activeIdx = SEASON_MOMENTS.findIndex((m) => m.months.includes(monthNow));
    const ordered = activeIdx >= 0
      ? [...SEASON_MOMENTS.slice(activeIdx), ...SEASON_MOMENTS.slice(0, activeIdx)]
      : SEASON_MOMENTS;
    return ordered.map((m) => {
      const win = m.months;
      let pinCount = 0;
      let speciesCount = 0;
      for (const sp of species) {
        const hit = m.categories.some((cid) =>
          pickAction(sp.seasonalTasks, CAT_BY_ID[cid].emojis, monthNow, win),
        );
        if (hit) { speciesCount += 1; pinCount += sp.pins.length; }
      }
      return {
        ...m,
        name: t(`seasonMoment.${m.id}Name`),
        desc: t(`seasonMoment.${m.id}Desc`),
        range: momentRange(m.months),
        isNow: m.months.includes(monthNow),
        pinCount,
        speciesCount,
      };
    }).filter((m) => m.speciesCount > 0);
  }, [species, monthNow, t]);

  const activeMoment = SEASON_MOMENTS.find((m) => m.id === momentId);

  // Řádky kroku 2: jeden řádek per (druh × kategorie momentu) — reprezentativní úkon
  // v okně momentu. Mix typů (řez + hnojení + výsadba…) je tím, co dělá moment momentem.
  const rows = useMemo(() => {
    if (!activeMoment) return [];
    const win = activeMoment.months;
    const out = [];
    for (const sp of species) {
      for (const cid of activeMoment.categories) {
        const cat = CAT_BY_ID[cid];
        const action = pickAction(sp.seasonalTasks, cat.emojis, monthNow, win);
        if (!action) continue;
        const needing = sp.pins.filter(
          (p) => !pinAlreadyHas(existingByPin?.[p.id], action.action, action.month, cat.taskType, conditions),
        );
        out.push({
          key: `${sp.plantName}__${cid}`,
          plantName: sp.plantName,
          cat,
          totalPins: sp.pins.length,
          needing,
          action,
        });
      }
    }
    return out.sort((a, b) => a.action.month - b.action.month || a.plantName.localeCompare(b.plantName));
  }, [activeMoment, species, existingByPin, conditions, monthNow]);

  // Při vstupu do kroku 2 přednastav výběr na řádky, které mají co plánovat.
  useEffect(() => {
    if (!activeMoment) return;
    const s = {};
    rows.forEach((r) => { if (r.needing.length > 0) s[r.key] = true; });
    setSelected(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [momentId, existingByPin]);

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
        const note = t('seasonMoment.notes', { moment: activeMoment ? t(`seasonMoment.${activeMoment.id}Name`) : '' });
        for (const p of r.needing) {
          calls.push(
            api.createTask({
              pin_id: p.id,
              title: `${r.cat.emoji} ${r.action.action}`,
              task_type: r.cat.taskType,
              frequency_days: null,
              specific_date: specificDate,
              notes: note,
            }),
          );
        }
      }
      await Promise.all(calls);
      toast(t('seasonMoment.created', { count: calls.length }));
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
            {activeMoment && (
              <button type="button" className="bc-back" onClick={() => setMomentId(null)}>
                ‹ {t('seasonMoment.back')}
              </button>
            )}
            <div className="yp-title">🍂 {t('seasonMoment.title')}</div>
            <div className="yp-subtitle">
              {activeMoment
                ? t('seasonMoment.subtitleMoment', { moment: t(`seasonMoment.${activeMoment.id}Name`) })
                : t('seasonMoment.subtitle')}
            </div>
          </div>
          <button className="yp-close" onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>

        {!activeMoment ? (
          /* KROK 1 — výběr sezónního momentu */
          availableMoments.length === 0 ? (
            <div className="yp-allplanned small muted">{t('seasonMoment.noMoments')}</div>
          ) : (
            <div className="sm-moment-list">
              {availableMoments.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="sm-moment-card"
                  onClick={() => setMomentId(m.id)}
                >
                  <span className="sm-moment-emoji" aria-hidden="true">{m.emoji}</span>
                  <span className="sm-moment-body">
                    <span className="sm-moment-top">
                      <span className="sm-moment-name">{m.name}</span>
                      {m.isNow && <span className="sm-moment-now">{t('seasonMoment.nowBadge')}</span>}
                    </span>
                    <span className="sm-moment-range">{m.range}</span>
                    <span className="sm-moment-desc">{m.desc}</span>
                    <span className="sm-moment-count">
                      {t('seasonMoment.plantsCount', { count: m.pinCount })}
                      {m.speciesCount > 1 && ` · ${t('seasonMoment.speciesCount', { count: m.speciesCount })}`}
                    </span>
                  </span>
                  <span className="sm-moment-cats" aria-hidden="true">
                    {m.categories.map((cid) => (
                      <span key={cid} className="sm-moment-cat">{CAT_BY_ID[cid].emoji}</span>
                    ))}
                  </span>
                </button>
              ))}
            </div>
          )
        ) : (
          /* KROK 2 — náhled dotčených úkonů + potvrzení */
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
                {allSelected ? t('seasonMoment.deselectAll') : t('seasonMoment.selectAll')}
              </button>
            ) : (
              <div className="yp-allplanned small muted">{t('seasonMoment.allPlanned')}</div>
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
                      <span className="bc-row-action muted small">{r.cat.emoji} {r.action.action}</span>
                    </span>
                    {planned ? (
                      <span className="yp-planned-badge">{t('seasonMoment.planned')}</span>
                    ) : (
                      <span className="bc-count" title={t('seasonMoment.pinsTitle', { count: r.needing.length })}>
                        ×{r.needing.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="yp-footer">
              <button type="button" className="btn ghost" onClick={() => setMomentId(null)} disabled={creating}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn" onClick={create} disabled={creating || totalTasks === 0}>
                {creating ? t('seasonMoment.creating') : t('seasonMoment.create', { count: totalTasks })}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
