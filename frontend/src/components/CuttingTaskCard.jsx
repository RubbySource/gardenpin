// Karta „✂️ Čas na řízky" v detailu pinu (Úkony tab). Nenásilně připomene MNOŽENÍ ŘÍZKY
// u keřů, popínavých a polodřevitých trvalek/bylin — ve správném okně dle typu řízku
// (bylinné / polovyzrálé / dřevité, viz data/cuttingTasks.js). Měsíc je posunutý dle
// klim. zóny (dateForMonth). Jeden klik = api.createTask na termín řízkování. Skryje se
// mimo řízkovou sezónu / mimo gate kere/popinave+polodřevité / je-li už naplánováno.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { findPlantByName } from '../plantDatabase.js';
import { cuttingTaskForPin } from '../data/cuttingTasks.js';
import { monthNameShort, formatDate } from '../utils.js';

// type → i18n klíče (label typu řízku + krátká instrukce)
const TYPE_KEY = {
  softwood: { label: 'typeSoftwood', instr: 'instrSoftwood' },
  semiripe: { label: 'typeSemiripe', instr: 'instrSemiripe' },
  hardwood: { label: 'typeHardwood', instr: 'instrHardwood' },
};

export default function CuttingTaskCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(pin.plant_name), [pin.plant_name]);
  const [planned, setPlanned] = useState({}); // key → true (skryj po naplánování)
  const [busy, setBusy] = useState({});

  const hints = useMemo(
    () => cuttingTaskForPin(pin, plant, pin.garden_conditions),
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
      const instr = t(`cuttingTasks.${TYPE_KEY[h.type].instr}`);
      await api.createTask({
        pin_id: pin.id,
        title: `${h.emoji} ${t('cuttingTasks.taskTitle', { plant: plant_name })}`,
        task_type: h.taskType,
        frequency_days: null,
        specific_date: h.suggested,
        notes: t('cuttingTasks.notes', { instr }),
      });
      setPlanned((s) => ({ ...s, [key]: true }));
      toast(t('cuttingTasks.planned', { date: formatDate(h.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('cuttingTasks.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <div className="cutting-task-card" role="note">
      <div className="cutting-task-head">
        <span className="cutting-task-title">✂️ {t('cuttingTasks.title')}</span>
        <span className="cutting-task-sub">{t('cuttingTasks.subtitle')}</span>
      </div>
      <div className="cutting-task-list">
        {visible.map((h) => {
          const key = keyOf(h);
          const tk = TYPE_KEY[h.type] || TYPE_KEY.semiripe;
          return (
            <div key={key} className="cutting-task-row">
              <span className="cutting-task-badge" aria-hidden="true">
                {monthNameShort(h.month - 1)}
              </span>
              <div className="cutting-task-main">
                <div className="cutting-task-action">
                  {h.emoji} {t(`cuttingTasks.${tk.label}`)}
                </div>
                <div className="cutting-task-meta">{t(`cuttingTasks.${tk.instr}`)}</div>
              </div>
              <button
                type="button"
                className="cutting-task-btn"
                onClick={() => plan(h)}
                disabled={busy[key]}
              >
                {busy[key] ? t('cuttingTasks.planning') : t('cuttingTasks.plan')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
