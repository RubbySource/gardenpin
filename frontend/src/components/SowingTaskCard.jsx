// Karta „🌱 Předpěstování ze semene" v detailu pinu (Úkony tab). Nenásilně nabídne výsev
// teplomilné zeleniny / letniček DO TRUHLÍKU týdny před výsadbou ven (viz
// data/sowingTasks.js). Datum výsevu je dopočítané zpětně od výsadby ven posunuté dle
// klim. zóny (dateForMonth). Jeden klik = api.createTask na vypočtený výsevní termín.
// Skryje se mimo výsevní sezónu / mimo kategorie zelenina+letnicky / je-li už naplánováno.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { findPlantByName } from '../plantDatabase.js';
import { sowingTaskForPin } from '../data/sowingTasks.js';
import { monthNameShort, formatDate } from '../utils.js';

export default function SowingTaskCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(pin.plant_name), [pin.plant_name]);
  const [planned, setPlanned] = useState({}); // key → true (skryj po naplánování)
  const [busy, setBusy] = useState({});

  const hints = useMemo(
    () => sowingTaskForPin(pin, plant, pin.garden_conditions),
    [pin, plant],
  );
  const keyOf = (h) => `${h.kind}-${h.suggested}`;
  const visible = hints.filter((h) => !planned[keyOf(h)]);
  if (visible.length === 0) return null;

  const plant_name = plant?.nameCz || pin.plant_name;

  const plan = async (h) => {
    const key = keyOf(h);
    if (busy[key]) return;
    setBusy((s) => ({ ...s, [key]: true }));
    try {
      await api.createTask({
        pin_id: pin.id,
        title: `${h.emoji} ${t('sowingTasks.taskTitle', { plant: plant_name })}`,
        task_type: h.taskType,
        frequency_days: null,
        specific_date: h.suggested,
        notes: t('sowingTasks.notes', { date: formatDate(h.plantDate) }),
      });
      setPlanned((s) => ({ ...s, [key]: true }));
      toast(t('sowingTasks.planned', { date: formatDate(h.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('sowingTasks.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <div className="sowing-task-card" role="note">
      <div className="sowing-task-head">
        <span className="sowing-task-title">🌱 {t('sowingTasks.title')}</span>
        <span className="sowing-task-sub">{t('sowingTasks.subtitle')}</span>
      </div>
      <div className="sowing-task-list">
        {visible.map((h) => {
          const key = keyOf(h);
          return (
            <div key={key} className="sowing-task-row">
              <span className="sowing-task-badge" aria-hidden="true">
                {monthNameShort(h.month - 1)}
              </span>
              <div className="sowing-task-main">
                <div className="sowing-task-action">{h.emoji} {t('sowingTasks.action')}</div>
                <div className="sowing-task-meta">
                  {t('sowingTasks.meta', { date: formatDate(h.plantDate) })}
                  {' · '}
                  {t('sowingTasks.leadWeeks', { count: h.leadWeeks })}
                </div>
              </div>
              <button
                type="button"
                className="sowing-task-btn"
                onClick={() => plan(h)}
                disabled={busy[key]}
              >
                {busy[key] ? t('sowingTasks.planning') : t('sowingTasks.plan')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
