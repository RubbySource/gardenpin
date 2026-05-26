// Celoroční plán péče jedním klikem.
// V detailu pinu otevře náhled VŠECH hlavních sezónních úkonů rostliny na rok dopředu
// (zastřihni v X, hnojivo v Y, přesaď v Z) s možností odškrtnout, které nechceš,
// a vytvoří je NAJEDNOU přes POST /api/tasks (žádné nové schéma).
//
// - Termíny posunuté dle klimatické zóny / expozice zahrady (sdílený getConditionShiftDays).
// - Přeskočí úkony, které pin už naplánované má (dedup dle task_type + měsíc, viz isAlreadyScheduled).
// - task_type odvozen z care emoji (taskTypeFromEmoji), ne natvrdo 'jine'.
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { findPlantByName } from '../plantDatabase.js';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { monthName, monthNameShort, taskTypeFromEmoji } from '../utils.js';
import { getClimateZone } from '../data/climateZones.js';
import { getConditionShiftDays, dateForMonth } from './RecommendedTasks.jsx';

const PRIORITY_META = {
  high:   { color: 'var(--danger)',   bg: 'rgba(192,57,43,0.10)' },
  medium: { color: 'var(--primary)',  bg: 'var(--forest-soft)' },
  low:    { color: 'var(--text-dim)', bg: 'rgba(107,107,112,0.10)' },
};
const PRIORITY_LABEL_KEY = {
  high: 'recommended.prioHigh',
  medium: 'recommended.prioMedium',
  low: 'recommended.prioLow',
};

function monthFromIso(iso) {
  if (!iso) return null;
  const m = /^\d{4}-(\d{2})/.exec(iso);
  return m ? parseInt(m[1], 10) : null;
}

// Pin už úkon naplánovaný má, pokud existující úkol:
//  - má přesně stejné cílové datum + odpovídající titulek (re-add ze stejného generátoru), nebo
//  - spadá do stejného měsíce a stejného (ne-'jine') task_type, nebo
//  - spadá do stejného měsíce a titulek obsahuje stejnou akci.
// 'jine' typy schválně NEslučujeme čistě dle typu (kolabovalo by to různé úkony v měsíci).
function isAlreadyScheduled(task, existingTasks, conditions) {
  if (!existingTasks?.length) return false;
  const tt = taskTypeFromEmoji(task.emoji);
  const actLower = task.action.toLowerCase();
  const targetDate = dateForMonth(task.month, conditions);
  for (const e of existingTasks) {
    if (e.specific_date === targetDate && e.title && e.title.toLowerCase().includes(actLower)) return true;
    const m = monthFromIso(e.specific_date);
    if (m !== task.month) continue;
    if (tt !== 'jine' && e.task_type === tt) return true;
    if (e.title && e.title.toLowerCase().includes(actLower)) return true;
  }
  return false;
}

export default function YearPlanModal({ plantName, pinId, existingTasks, gardenConditions, onCreated, onClose }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(plantName), [plantName]);
  const tasks = plant?.seasonalTasks || [];
  const shiftDays = getConditionShiftDays(gardenConditions);
  const zone = getClimateZone(gardenConditions?.climate_zone);

  const rows = useMemo(
    () =>
      tasks.map((task) => ({
        ...task,
        key: `${task.month}-${task.action}`,
        taskType: taskTypeFromEmoji(task.emoji),
        already: isAlreadyScheduled(task, existingTasks, gardenConditions),
      })),
    [tasks, existingTasks, gardenConditions],
  );

  const selectable = rows.filter((r) => !r.already);

  const [selected, setSelected] = useState(() => {
    const s = {};
    selectable.forEach((r) => { s[r.key] = true; });
    return s;
  });
  const [creating, setCreating] = useState(false);

  // Esc + zámek scrollu (stejně jako Modal.jsx)
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

  const selectedCount = selectable.filter((r) => selected[r.key]).length;
  const allSelected = selectable.length > 0 && selectedCount === selectable.length;

  const toggle = (key) => setSelected((s) => ({ ...s, [key]: !s[key] }));
  const toggleAll = () => {
    if (allSelected) {
      setSelected({});
    } else {
      const s = {};
      selectable.forEach((r) => { s[r.key] = true; });
      setSelected(s);
    }
  };

  const create = async () => {
    const chosen = selectable.filter((r) => selected[r.key]);
    if (chosen.length === 0) return;
    setCreating(true);
    try {
      await Promise.all(
        chosen.map((r) =>
          api.createTask({
            pin_id: pinId,
            title: `${r.emoji} ${r.action}`,
            task_type: r.taskType,
            frequency_days: null,
            specific_date: dateForMonth(r.month, gardenConditions),
            notes: t('yearPlan.notes', { month: monthName(r.month - 1).toLowerCase() }),
          }),
        ),
      );
      toast(t('yearPlan.created', { count: chosen.length }));
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
          <div>
            <div className="yp-title">📅 {t('yearPlan.title')}</div>
            <div className="yp-subtitle">{t('yearPlan.subtitle', { plant: plantName })}</div>
          </div>
          <button className="yp-close" onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>

        {shiftDays !== 0 && (
          <div className="yp-shift small muted">
            {zone
              ? (shiftDays > 0
                  ? t('recommended.zoneShiftLater', { zone: zone.label, days: shiftDays })
                  : t('recommended.zoneShiftEarlier', { zone: zone.label, days: -shiftDays }))
              : (shiftDays > 0
                  ? t('recommended.microColder', { days: shiftDays })
                  : t('recommended.microWarmer', { days: shiftDays }))}
          </div>
        )}

        {selectable.length > 0 ? (
          <button type="button" className="yp-selectall" onClick={toggleAll}>
            {allSelected ? t('yearPlan.deselectAll') : t('yearPlan.selectAll')}
          </button>
        ) : (
          <div className="yp-allplanned small muted">{t('yearPlan.allPlanned')}</div>
        )}

        <div className="yp-list">
          {rows.map((r) => {
            const prio = PRIORITY_META[r.priority] || PRIORITY_META.medium;
            const prioLabel = t(PRIORITY_LABEL_KEY[r.priority] || PRIORITY_LABEL_KEY.medium);
            const checked = !r.already && !!selected[r.key];
            return (
              <button
                type="button"
                key={r.key}
                className={`yp-row ${r.already ? 'is-planned' : ''}`}
                onClick={() => !r.already && toggle(r.key)}
                disabled={r.already}
              >
                <span className={`yp-check ${checked ? 'on' : ''} ${r.already ? 'planned' : ''}`} aria-hidden="true">
                  {(checked || r.already) ? '✓' : ''}
                </span>
                <span className="yp-month" style={{ background: prio.color }} title={prioLabel}>
                  {monthNameShort(r.month - 1)}
                </span>
                <span className="yp-action">
                  {r.emoji} {r.action}
                </span>
                {r.already && <span className="yp-planned-badge">{t('yearPlan.planned')}</span>}
              </button>
            );
          })}
        </div>

        <div className="yp-footer">
          <button type="button" className="btn ghost" onClick={onClose} disabled={creating}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn" onClick={create} disabled={creating || selectedCount === 0}>
            {creating ? t('yearPlan.creating') : t('yearPlan.create', { count: selectedCount })}
          </button>
        </div>
      </div>
    </div>
  );
}
