// Karta „✂️ Čas letního řezu růže" v detailu pinu (Úkony tab). Nenásilně připomene
// DEADHEADING + LIGHT CUTBACK po první vlně kvetení u remontantních (opakovaně kvetoucích)
// růží — pro nasazení druhé vlny v 8–9 (viz data/summerRosePruning.js). Měsíc posunutý
// dle klim. zóny (dateForMonth). Jeden klik = api.createTask na termín. Skryje se mimo
// gate kere/okrasne/popinave/bylinky/trvalky / mimo rod Rosa / historická Rosa /
// mimo sezónu / je-li už naplánováno.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { findPlantByName } from '../plantDatabase.js';
import { summerRosePruningForPin } from '../data/summerRosePruning.js';
import { monthNameShort, formatDate } from '../utils.js';

export default function SummerRosePruningCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(pin.plant_name), [pin.plant_name]);
  const [planned, setPlanned] = useState({}); // key → true (skryj po naplánování)
  const [busy, setBusy] = useState({});

  const hints = useMemo(
    () => summerRosePruningForPin(pin, plant, pin.garden_conditions),
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
        title: `${h.emoji} ${t('summerRosePruning.taskTitle', { plant: plant_name })}`,
        task_type: h.taskType,
        frequency_days: null,
        specific_date: h.suggested,
        notes: t('summerRosePruning.notes'),
      });
      setPlanned((s) => ({ ...s, [key]: true }));
      toast(t('summerRosePruning.planned', { date: formatDate(h.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('summerRosePruning.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <div className="summer-rose-pruning-card" role="note">
      <div className="summer-rose-pruning-head">
        <span className="summer-rose-pruning-title">✂️ {t('summerRosePruning.title')}</span>
        <span className="summer-rose-pruning-sub">{t('summerRosePruning.subtitle')}</span>
      </div>
      <div className="summer-rose-pruning-list">
        {visible.map((h) => {
          const key = keyOf(h);
          return (
            <div key={key} className="summer-rose-pruning-row">
              <span className="summer-rose-pruning-badge" aria-hidden="true">
                {monthNameShort(h.month - 1)}
              </span>
              <div className="summer-rose-pruning-main">
                <div className="summer-rose-pruning-action">
                  {h.emoji} {t('summerRosePruning.action')}
                </div>
                <div className="summer-rose-pruning-meta">{t('summerRosePruning.instr')}</div>
              </div>
              <button
                type="button"
                className="summer-rose-pruning-btn"
                onClick={() => plan(h)}
                disabled={busy[key]}
              >
                {busy[key] ? t('summerRosePruning.planning') : t('summerRosePruning.plan')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
