// Karta „🪵 Čas nabílit kmeny" v detailu pinu (Úkony tab). Nenásilně připomene podzimní
// NÁTĚR KMENE vápnem u ovocných stromů/dřevin — ochrana před zimním sluncem a mrazovými
// deskami (viz data/trunkWhitewash.js). Měsíc posunutý dle klim. zóny (dateForMonth).
// Jeden klik = api.createTask na termín bílení. Skryje se mimo gate ovoce/stromy / mimo
// sezónu (11–12) / je-li už naplánováno.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { findPlantByName } from '../plantDatabase.js';
import { trunkWhitewashForPin } from '../data/trunkWhitewash.js';
import { monthNameShort, formatDate } from '../utils.js';

export default function TrunkWhitewashCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(pin.plant_name), [pin.plant_name]);
  const [planned, setPlanned] = useState({}); // key → true (skryj po naplánování)
  const [busy, setBusy] = useState({});

  const hints = useMemo(
    () => trunkWhitewashForPin(pin, plant, pin.garden_conditions),
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
        title: `${h.emoji} ${t('trunkWhitewash.taskTitle', { plant: plant_name })}`,
        task_type: h.taskType,
        frequency_days: null,
        specific_date: h.suggested,
        notes: t('trunkWhitewash.notes'),
      });
      setPlanned((s) => ({ ...s, [key]: true }));
      toast(t('trunkWhitewash.planned', { date: formatDate(h.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('trunkWhitewash.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <div className="trunk-whitewash-card" role="note">
      <div className="trunk-whitewash-head">
        <span className="trunk-whitewash-title">🪵 {t('trunkWhitewash.title')}</span>
        <span className="trunk-whitewash-sub">{t('trunkWhitewash.subtitle')}</span>
      </div>
      <div className="trunk-whitewash-list">
        {visible.map((h) => {
          const key = keyOf(h);
          return (
            <div key={key} className="trunk-whitewash-row">
              <span className="trunk-whitewash-badge" aria-hidden="true">
                {monthNameShort(h.month - 1)}
              </span>
              <div className="trunk-whitewash-main">
                <div className="trunk-whitewash-action">
                  {h.emoji} {t('trunkWhitewash.action')}
                </div>
                <div className="trunk-whitewash-meta">{t('trunkWhitewash.instr')}</div>
              </div>
              <button
                type="button"
                className="trunk-whitewash-btn"
                onClick={() => plan(h)}
                disabled={busy[key]}
              >
                {busy[key] ? t('trunkWhitewash.planning') : t('trunkWhitewash.plan')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
