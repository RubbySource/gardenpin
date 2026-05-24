// Doporučené úkony — sekce v detailu pinu zobrazující sezónní úkoly pro danou rostlinu.
// Pro každý úkol je tlačítko, které ho jedním klikem přidá jako konkrétní task
// (specific_date = 15. den daného měsíce, letošní rok nebo příští dle aktuálního měsíce).
import React, { useMemo, useState } from 'react';
import { findPlantByName } from '../plantDatabase.js';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { getClimateZone, getZoneOffsetDays } from '../data/climateZones.js';

const MONTH_NAMES_CZ = [
  '', 'leden', 'únor', 'březen', 'duben', 'květen', 'červen',
  'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec',
];

const PRIORITY_META = {
  high:   { label: 'Důležité', color: '#c0392b', bg: 'rgba(192,57,43,0.10)' },
  medium: { label: 'Standardní', color: '#2d5a27', bg: 'rgba(45,90,39,0.10)' },
  low:    { label: 'Doplňkové', color: '#6b6b70', bg: 'rgba(107,107,112,0.10)' },
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
        notes: `Doporučený úkon (${MONTH_NAMES_CZ[task.month]})`,
      });
      setAdded((s) => ({ ...s, [key]: true }));
      toast('✅ Úkol přidán');
      onTaskAdded?.();
    } catch (e) {
      toast('Chyba: ' + e.message);
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
          notes: `Doporučený úkon (${MONTH_NAMES_CZ[task.month]})`,
        }),
      ));
      const newAdded = { ...added };
      remaining.forEach((t) => { newAdded[`${t.month}-${t.action}`] = true; });
      setAdded(newAdded);
      toast(`✅ Přidáno ${remaining.length} úkolů na rok`);
      onTaskAdded?.();
    } catch (e) {
      toast('Chyba: ' + e.message);
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
          🌿 Doporučené úkony{' '}
          <span className="muted small" style={{ fontWeight: 400 }}>
            ({tasks.length} {tasks.length === 1 ? 'úkon' : (tasks.length < 5 ? 'úkony' : 'úkonů')})
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
                ? `📍 Upraveno pro tvou lokalitu (${zone.label}) — termíny ${shiftDays > 0 ? `posunuty o +${shiftDays} dní` : `uspíšeny o ${-shiftDays} dní`}`
                : (shiftDays > 0
                    ? `🌡️ Chladnější mikroklima zahrady — termíny posunuty o +${shiftDays} dní`
                    : `🌡️ Teplejší mikroklima zahrady — termíny posunuty o ${shiftDays} dní`)}
            </div>
          )}
          {remaining.length > 1 && (
            <button
              className="btn ghost small block mb-2"
              onClick={addAll}
              disabled={addingAll}
            >
              {addingAll
                ? 'Přidávám…'
                : `+ Přidat všech ${remaining.length} úkonů na rok`}
            </button>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {tasks.map((task, i) => {
              const key = `${task.month}-${task.action}`;
              const isAdded = isTaskAlreadyAdded(task.action, task.month, existingTasks, gardenConditions) || added[key];
              const isAdding = adding[key];
              const isPast = task.month < monthNow;
              const prio = PRIORITY_META[task.priority] || PRIORITY_META.medium;
              return (
                <div
                  key={i}
                  className={`recommended-task ${isAdded ? 'is-added' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    background: isAdded ? '#f5f0e8' : '#fff',
                    border: '1px solid rgba(0,0,0,0.06)',
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
                    title={prio.label}
                  >
                    {MONTH_NAMES_CZ[task.month].slice(0, 3)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>
                      {task.emoji} {task.action}
                    </div>
                    {isPast && !isAdded && (
                      <div className="muted small">Letos už proběhlo — naplánuje na příští rok</div>
                    )}
                  </div>
                  {isAdded ? (
                    <span className="badge" style={{ background: prio.bg, color: prio.color }}>
                      ✓ Přidáno
                    </span>
                  ) : (
                    <button
                      className="btn ghost small"
                      onClick={() => addTask(task)}
                      disabled={isAdding}
                      title={`${prio.label} — přidat jako úkol na ${MONTH_NAMES_CZ[task.month]}`}
                    >
                      {isAdding ? '…' : '+ Přidat'}
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
