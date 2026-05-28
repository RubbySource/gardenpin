// Karta „🕸️ Čas zakrýt úrodu" v detailu pinu (Úkony tab). Nenásilně připomene NATÁHNOUT
// OCHRANNOU SÍŤ přes keře/stromky drobného/peckového ovoce TĚSNĚ PŘED VYBARVENÍM plodů,
// aby úrodu nesezobali ptáci (viz data/fruitNetting.js). Měsíc posunutý dle klim. zóny
// (dateForMonth — v chladnějších zónách později, ať síť jde k reálnému zrání). Jeden klik =
// api.createTask na termín síťování. Skryje se mimo gate / mimo sezónu / je-li už naplánováno.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { findPlantByName } from '../plantDatabase.js';
import { fruitNettingForPin } from '../data/fruitNetting.js';
import { monthNameShort, formatDate } from '../utils.js';

export default function FruitNettingCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(pin.plant_name), [pin.plant_name]);
  const [planned, setPlanned] = useState({}); // key → true (skryj po naplánování)
  const [busy, setBusy] = useState({});

  const hints = useMemo(
    () => fruitNettingForPin(pin, plant, pin.garden_conditions),
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
        title: `${h.emoji} ${t('fruitNetting.taskTitle', { plant: plant_name })}`,
        task_type: h.taskType,
        frequency_days: null,
        specific_date: h.suggested,
        notes: t('fruitNetting.notes'),
      });
      setPlanned((s) => ({ ...s, [key]: true }));
      toast(t('fruitNetting.planned', { date: formatDate(h.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('fruitNetting.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <div className="fruit-netting-card" role="note">
      <div className="fruit-netting-head">
        <span className="fruit-netting-title">🕸️ {t('fruitNetting.title')}</span>
        <span className="fruit-netting-sub">{t('fruitNetting.subtitle')}</span>
      </div>
      <div className="fruit-netting-list">
        {visible.map((h) => {
          const key = keyOf(h);
          return (
            <div key={key} className="fruit-netting-row">
              <span className="fruit-netting-badge" aria-hidden="true">
                {monthNameShort(h.month - 1)}
              </span>
              <div className="fruit-netting-main">
                <div className="fruit-netting-action">
                  {h.emoji} {t('fruitNetting.action', { plant: plant_name })}
                </div>
                <div className="fruit-netting-meta">{t('fruitNetting.instr')}</div>
              </div>
              <button
                type="button"
                className="fruit-netting-btn"
                onClick={() => plan(h)}
                disabled={busy[key]}
              >
                {busy[key] ? t('fruitNetting.planning') : t('fruitNetting.plan')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
