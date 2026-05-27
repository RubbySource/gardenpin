// Karta „🪴 Čas rozdělit trs" v detailu pinu (Úkony tab). Nenásilně nabídne dělení trsu
// trvalek / okrasných trav, které po N letech zhušťují a hůř kvetou (viz
// data/divisionTasks.js). Jeden klik = api.createTask na sezónní okno (podzim u jarně/letně
// kvetoucích, brzy zjara u podzimních + trav) posunuté dle klim. zóny (dateForMonth).
// Skryje se, není-li co nabídnout.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { findPlantByName } from '../plantDatabase.js';
import { divisionTasksForPin } from '../data/divisionTasks.js';
import { monthNameShort, formatDate } from '../utils.js';

export default function DivisionTaskCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(pin.plant_name), [pin.plant_name]);
  const [planned, setPlanned] = useState({}); // key → true (skryj po naplánování)
  const [busy, setBusy] = useState({});

  const hints = useMemo(
    () => divisionTasksForPin(pin, plant, pin.garden_conditions),
    [pin, plant],
  );
  const keyOf = (h) => `${h.kind}-${h.suggested}`;
  const visible = hints.filter((h) => !planned[keyOf(h)]);
  if (visible.length === 0) return null;

  const age = visible[0].age;

  const plan = async (h) => {
    const key = keyOf(h);
    if (busy[key]) return;
    setBusy((s) => ({ ...s, [key]: true }));
    try {
      await api.createTask({
        pin_id: pin.id,
        title: `${h.emoji} ${t('divisionTasks.action')}`,
        task_type: h.taskType,
        frequency_days: null,
        specific_date: h.suggested,
        notes: t('divisionTasks.notes', { age: h.age }),
      });
      setPlanned((s) => ({ ...s, [key]: true }));
      toast(t('divisionTasks.planned', { date: formatDate(h.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('divisionTasks.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <div className="division-task-card" role="note">
      <div className="division-task-head">
        <span className="division-task-title">🪴 {t('divisionTasks.title')}</span>
        {age >= 1 && (
          <span className="division-task-sub">{t('divisionTasks.ageSummary', { count: age })}</span>
        )}
      </div>
      <div className="division-task-list">
        {visible.map((h) => {
          const key = keyOf(h);
          return (
            <div key={key} className="division-task-row">
              <span className="division-task-badge" aria-hidden="true">
                {monthNameShort(h.month - 1)}
              </span>
              <div className="division-task-main">
                <div className="division-task-action">{h.emoji} {t('divisionTasks.action')}</div>
                <div className="division-task-meta">
                  {t(h.season === 'autumn' ? 'divisionTasks.metaAutumn' : 'divisionTasks.metaSpring')}
                </div>
              </div>
              <button
                type="button"
                className="division-task-btn"
                onClick={() => plan(h)}
                disabled={busy[key]}
              >
                {busy[key] ? t('divisionTasks.planning') : t('divisionTasks.plan')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
