// Karta „🌳 Čas na roubování" v detailu pinu (Úkony tab). Nenásilně připomene MNOŽENÍ
// ROUBOVÁNÍM / OČKOVÁNÍM u ovocných stromů — ve správném okně dle typu (jarní roubování /
// letní očkování, viz data/graftingTasks.js). Měsíc je posunutý dle klim. zóny (dateForMonth).
// Jeden klik = api.createTask na termín roubování. Skryje se mimo gate ovoce/stromy / mimo
// sezónu / je-li už naplánováno.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { findPlantByName } from '../plantDatabase.js';
import { graftingTaskForPin } from '../data/graftingTasks.js';
import { monthNameShort, formatDate } from '../utils.js';

// type → i18n klíče (label typu + krátká instrukce)
const TYPE_KEY = {
  spring: { label: 'typeSpring', instr: 'instrSpring' },
  summer: { label: 'typeSummer', instr: 'instrSummer' },
};

export default function GraftingTaskCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(pin.plant_name), [pin.plant_name]);
  const [planned, setPlanned] = useState({}); // key → true (skryj po naplánování)
  const [busy, setBusy] = useState({});

  const hints = useMemo(
    () => graftingTaskForPin(pin, plant, pin.garden_conditions),
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
      const instr = t(`graftingTasks.${TYPE_KEY[h.type].instr}`);
      await api.createTask({
        pin_id: pin.id,
        title: `${h.emoji} ${t('graftingTasks.taskTitle', { plant: plant_name })}`,
        task_type: h.taskType,
        frequency_days: null,
        specific_date: h.suggested,
        notes: t('graftingTasks.notes', { instr }),
      });
      setPlanned((s) => ({ ...s, [key]: true }));
      toast(t('graftingTasks.planned', { date: formatDate(h.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('graftingTasks.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <div className="grafting-task-card" role="note">
      <div className="grafting-task-head">
        <span className="grafting-task-title">🌳 {t('graftingTasks.title')}</span>
        <span className="grafting-task-sub">{t('graftingTasks.subtitle')}</span>
      </div>
      <div className="grafting-task-list">
        {visible.map((h) => {
          const key = keyOf(h);
          const tk = TYPE_KEY[h.type] || TYPE_KEY.spring;
          return (
            <div key={key} className="grafting-task-row">
              <span className="grafting-task-badge" aria-hidden="true">
                {monthNameShort(h.month - 1)}
              </span>
              <div className="grafting-task-main">
                <div className="grafting-task-action">
                  {h.emoji} {t(`graftingTasks.${tk.label}`)}
                </div>
                <div className="grafting-task-meta">{t(`graftingTasks.${tk.instr}`)}</div>
              </div>
              <button
                type="button"
                className="grafting-task-btn"
                onClick={() => plan(h)}
                disabled={busy[key]}
              >
                {busy[key] ? t('graftingTasks.planning') : t('graftingTasks.plan')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
