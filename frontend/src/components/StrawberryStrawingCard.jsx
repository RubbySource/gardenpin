// Karta „🌾 Čas pomulčovat jahodník slámou" v detailu pinu (Úkony tab). Nenásilně
// připomene před začátkem dozrávání plodů ROZPROSTŘÍT vrstvu suché slámy mezi
// rostliny a pod květenství — drží plody nad zemí (čisté, neuhnijí), odrazí slimáky,
// drží vlhkost (viz data/strawberryStrawing.js). Měsíc posunutý dle klim. zóny
// (dateForMonth — v chladnějších zónách později, ať sláma odpovídá pozdějšímu
// nasazení plodů). Jeden klik = api.createTask na termín strawingu. Skryje se
// mimo gate `ovoce` / mimo rod Fragaria / mimo sezónu / je-li už naplánováno.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { findPlantByName } from '../plantDatabase.js';
import { strawberryStrawingForPin } from '../data/strawberryStrawing.js';
import { monthNameShort, formatDate } from '../utils.js';

export default function StrawberryStrawingCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(pin.plant_name), [pin.plant_name]);
  const [planned, setPlanned] = useState({}); // key → true (skryj po naplánování)
  const [busy, setBusy] = useState({});

  const hints = useMemo(
    () => strawberryStrawingForPin(pin, plant, pin.garden_conditions),
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
        title: `${h.emoji} ${t('strawberryStrawing.taskTitle', { plant: plant_name })}`,
        task_type: h.taskType,
        frequency_days: null,
        specific_date: h.suggested,
        notes: t('strawberryStrawing.notes'),
      });
      setPlanned((s) => ({ ...s, [key]: true }));
      toast(t('strawberryStrawing.planned', { date: formatDate(h.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('strawberryStrawing.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <div className="strawberry-strawing-card" role="note">
      <div className="strawberry-strawing-head">
        <span className="strawberry-strawing-title">🌾 {t('strawberryStrawing.title')}</span>
        <span className="strawberry-strawing-sub">{t('strawberryStrawing.subtitle')}</span>
      </div>
      <div className="strawberry-strawing-list">
        {visible.map((h) => {
          const key = keyOf(h);
          return (
            <div key={key} className="strawberry-strawing-row">
              <span className="strawberry-strawing-badge" aria-hidden="true">
                {monthNameShort(h.month - 1)}
              </span>
              <div className="strawberry-strawing-main">
                <div className="strawberry-strawing-action">
                  {h.emoji} {t('strawberryStrawing.action')}
                </div>
                <div className="strawberry-strawing-meta">{t('strawberryStrawing.instr')}</div>
              </div>
              <button
                type="button"
                className="strawberry-strawing-btn"
                onClick={() => plan(h)}
                disabled={busy[key]}
              >
                {busy[key] ? t('strawberryStrawing.planning') : t('strawberryStrawing.plan')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
