// Doporučené úkony — sekce v detailu pinu zobrazující sezónní úkoly pro danou rostlinu.
// Pro každý úkol je tlačítko, které ho jedním klikem přidá jako konkrétní task
// (specific_date = 15. den daného měsíce, letošní rok nebo příští dle aktuálního měsíce).
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { findPlantByName } from '../plantDatabase.js';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { monthName, monthNameShort } from '../utils.js';
import { getClimateZone, getZoneOffsetDays } from '../data/climateZones.js';

// Barvy přes CSS proměnné, ať se v dark mode přebarví automaticky.
// `label` se počítá uvnitř komponenty přes t() (PRIORITY_LABEL_KEY).
const PRIORITY_META = {
  high:   { color: 'var(--danger)',    bg: 'rgba(192,57,43,0.10)' },
  medium: { color: 'var(--primary)',   bg: 'var(--forest-soft)' },
  low:    { color: 'var(--text-dim)',  bg: 'rgba(107,107,112,0.10)' },
};
const PRIORITY_LABEL_KEY = {
  high: 'recommended.prioHigh',
  medium: 'recommended.prioMedium',
  low: 'recommended.prioLow',
};

// Posun termínů úkonů podle pěstebních podmínek zahrady.
// Klimatická zóna ČR (kraj) → regionální nástup vegetace.
// Severní expozice / vysoká nadm. výška → chladnější mikroklima → pozdější termíny.
// Jižní expozice / nížina → teplejší → dřívější termíny.
// Vrací celé dny (kladné = oddálit, záporné = uspíšit). Max ±21 dní.
function getConditionShiftDays(conditions) {
  if (!conditions) return 0;
  let shift = 0;
  // Klimatická zóna ČR — regionální posun jara (jižní Morava dříve, Vysočina později)
  shift += getZoneOffsetDays(conditions.climate_zone);
  if (conditions.exposure === 'N') shift += 14;
  if (conditions.exposure === 'S') shift -= 7;
  // Nadm. výška: nad 600 m = horské oblasti (pozdější jaro), pod 200 m = nížiny
  if (typeof conditions.altitude_m === 'number') {
    if (conditions.altitude_m >= 600) shift += 14;
    else if (conditions.altitude_m >= 400) shift += 7;
    else if (conditions.altitude_m <= 200) shift -= 7;
  }
  return Math.max(-21, Math.min(21, shift));
}

function dateForMonth(month, conditions) {
  const now = new Date();
  const year = month >= (now.getMonth() + 1) ? now.getFullYear() : now.getFullYear() + 1;
  // Začni 15. dne měsíce, posuň podle podmínek (±dny)
  const d = new Date(year, month - 1, 15);
  d.setDate(d.getDate() + getConditionShiftDays(conditions));
  return d.toISOString().slice(0, 10);
}

function isTaskAlreadyAdded(action, month, existingTasks, conditions) {
  const date = dateForMonth(month, conditions);
  return existingTasks.some(
    (t) => t.specific_date === date && (t.title === action || t.title.endsWith(action)),
  );
}

export default function RecommendedTasks({ plantName, pinId, existingTasks, gardenConditions, onTaskAdded }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(plantName), [plantName]);
  const [adding, setAdding] = useState({});
  const [added, setAdded] = useState({});
  const [addingAll, setAddingAll] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  if (!plant || !plant.seasonalTasks?.length) return null;

  const tasks = plant.seasonalTasks;
  const monthNow = new Date().getMonth() + 1;
  const shiftDays = getConditionShiftDays(gardenConditions);
  const zone = getClimateZone(gardenConditions?.climate_zone);
  const remaining = tasks.filter(
    (t) => !isTaskAlreadyAdded(t.action, t.month, existingTasks, gardenConditions) && !added[`${t.month}-${t.action}`],
  );

  const addTask = async (task) => {
    const key = `${task.month}-${task.action}`;
    setAdding((s) => ({ ...s, [key]: true }));
    try {
      await api.createTask({
        pin_id: pinId,
        title: `${task.emoji} ${task.action}`,
        task_type: 'jine',
        frequency_days: null,
        specific_date: dateForMonth(task.month, gardenConditions),
        notes: t('recommended.notes', { month: monthName(task.month - 1).toLowerCase() }),
      });
      setAdded((s) => ({ ...s, [key]: true }));
      toast(t('recommended.taskAdded'));
      onTaskAdded?.();
    } catch (e) {
      toast(t('common.error', { msg: e.message }));
    } finally {
      setAdding((s) => ({ ...s, [key]: false }));
    }
  };

  const addAll = async () => {
    if (remaining.length === 0) return;
    setAddingAll(true);
    try {
      await Promise.all(remaining.map((task) =>
        api.createTask({
          pin_id: pinId,
          title: `${task.emoji} ${task.action}`,
          task_type: 'jine',
          frequency_days: null,
          specific_date: dateForMonth(task.month, gardenConditions),
          notes: t('recommended.notes', { month: monthName(task.month - 1).toLowerCase() }),
        }),
      ));
      const newAdded = { ...added };
      remaining.forEach((rt) => { newAdded[`${rt.month}-${rt.action}`] = true; });
      setAdded(newAdded);
      toast(t('recommended.addedCount', { count: remaining.length }));
      onTaskAdded?.();
    } catch (e) {
      toast(t('common.error', { msg: e.message }));
    } finally {
      setAddingAll(false);
    }
  };

  return (
    <div className="recommended-tasks field">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
          cursor: 'pointer',
        }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <label style={{ margin: 0, cursor: 'pointer' }}>
          {t('recommended.header')}{' '}
          <span className="muted small" style={{ fontWeight: 400 }}>
            ({t('recommended.taskCount', { count: tasks.length })})
          </span>
        </label>
        <span className="muted small">{collapsed ? '▸' : '▾'}</span>
      </div>

      {!collapsed && (
        <>
          {shiftDays !== 0 && (
            <div
              className="small muted mb-2"
              style={{
                padding: '6px 10px',
                background: 'rgba(74,124,58,0.08)',
                borderRadius: 8,
              }}
            >
              {zone
                ? (shiftDays > 0
                    ? t('recommended.zoneShiftLater', { zone: zone.label, days: shiftDays })
                    : t('recommended.zoneShiftEarlier', { zone: zone.label, days: -shiftDays }))
                : (shiftDays > 0
                    ? t('recommended.microColder', { days: shiftDays })
                    : t('recommended.microWarmer', { days: shiftDays }))}
            </div>
          )}
          {remaining.length > 1 && (
            <button
              className="btn ghost small block mb-2"
              onClick={addAll}
              disabled={addingAll}
            >
              {addingAll
                ? t('recommended.adding')
                : t('recommended.addAll', { count: remaining.length })}
            </button>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {tasks.map((task, i) => {
              const key = `${task.month}-${task.action}`;
              const isAdded = isTaskAlreadyAdded(task.action, task.month, existingTasks, gardenConditions) || added[key];
              const isAdding = adding[key];
              const isPast = task.month < monthNow;
              const prio = PRIORITY_META[task.priority] || PRIORITY_META.medium;
              const prioLabel = t(PRIORITY_LABEL_KEY[task.priority] || PRIORITY_LABEL_KEY.medium);
              return (
                <div
                  key={i}
                  className={`recommended-task ${isAdded ? 'is-added' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    background: isAdded ? 'var(--sand)' : 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    opacity: isAdded ? 0.6 : 1,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      color: '#fff',
                      background: prio.color,
                      padding: '3px 7px',
                      borderRadius: 999,
                      flexShrink: 0,
                      minWidth: 36,
                      textAlign: 'center',
                    }}
                    title={prioLabel}
                  >
                    {monthNameShort(task.month - 1)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>
                      {task.emoji} {task.action}
                    </div>
                    {isPast && !isAdded && (
                      <div className="muted small">{t('recommended.pastThisYear')}</div>
                    )}
                  </div>
                  {isAdded ? (
                    <span className="badge" style={{ background: prio.bg, color: prio.color }}>
                      {t('recommended.added')}
                    </span>
                  ) : (
                    <button
                      className="btn ghost small"
                      onClick={() => addTask(task)}
                      disabled={isAdding}
                      title={t('recommended.addTaskTitle', { prio: prioLabel, month: monthName(task.month - 1).toLowerCase() })}
                    >
                      {isAdding ? '…' : t('recommended.add')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
