// Karta „✂️ Čas letního řezu" v detailu pinu (Úkony tab). Nenásilně připomene MÍRNÝ
// ZELENÝ ŘEZ letošních letorostů u jádrovin (jabloň/hrušeň/kdoule) a třešně po sklizni
// (viz data/summerPruning.js). Měsíc posunutý dle klim. zóny (dateForMonth). Jeden klik =
// api.createTask na termín řezu. Skryje se mimo gate stromy/ovoce / mimo mapu rodů/druhů
// / mimo sezónu / je-li už naplánováno.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { findPlantByName } from '../plantDatabase.js';
import { summerPruningForPin } from '../data/summerPruning.js';
import { monthNameShort, formatDate } from '../utils.js';

export default function SummerPruningCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(pin.plant_name), [pin.plant_name]);
  const [planned, setPlanned] = useState({}); // key → true (skryj po naplánování)
  const [busy, setBusy] = useState({});

  const hints = useMemo(
    () => summerPruningForPin(pin, plant, pin.garden_conditions),
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
        title: `${h.emoji} ${t('summerPruning.taskTitle', { plant: plant_name })}`,
        task_type: h.taskType,
        frequency_days: null,
        specific_date: h.suggested,
        notes: t('summerPruning.notes'),
      });
      setPlanned((s) => ({ ...s, [key]: true }));
      toast(t('summerPruning.planned', { date: formatDate(h.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('summerPruning.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <div className="summer-pruning-card" role="note">
      <div className="summer-pruning-head">
        <span className="summer-pruning-title">✂️ {t('summerPruning.title')}</span>
        <span className="summer-pruning-sub">{t('summerPruning.subtitle')}</span>
      </div>
      <div className="summer-pruning-list">
        {visible.map((h) => {
          const key = keyOf(h);
          return (
            <div key={key} className="summer-pruning-row">
              <span className="summer-pruning-badge" aria-hidden="true">
                {monthNameShort(h.month - 1)}
              </span>
              <div className="summer-pruning-main">
                <div className="summer-pruning-action">
                  {h.emoji} {t('summerPruning.action')}
                </div>
                <div className="summer-pruning-meta">{t('summerPruning.instr')}</div>
              </div>
              <button
                type="button"
                className="summer-pruning-btn"
                onClick={() => plan(h)}
                disabled={busy[key]}
              >
                {busy[key] ? t('summerPruning.planning') : t('summerPruning.plan')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
