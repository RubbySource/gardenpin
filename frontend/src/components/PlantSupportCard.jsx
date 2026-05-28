// Karta „🪜 Čas na opory" v detailu pinu (Úkony tab). Nenásilně připomene POSTAVIT OPORY
// a VYVÁZAT VÝHONY včas — dřív, než vysoká trvalka / popínavá vyžene (viz
// data/plantSupports.js). Měsíc je posunutý dle klim. zóny (dateForMonth). Jeden klik =
// api.createTask na termín postavení opory. Skryje se mimo gate / mimo sezónu (4–5) /
// je-li už naplánováno.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { findPlantByName } from '../plantDatabase.js';
import { plantSupportForPin } from '../data/plantSupports.js';
import { monthNameShort, formatDate } from '../utils.js';

// type → i18n klíče (label typu opory + krátká instrukce)
const TYPE_KEY = {
  ring: { label: 'typeRing', instr: 'instrRing' },
  stake: { label: 'typeStake', instr: 'instrStake' },
  trellis: { label: 'typeTrellis', instr: 'instrTrellis' },
};

export default function PlantSupportCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(pin.plant_name), [pin.plant_name]);
  const [planned, setPlanned] = useState({}); // key → true (skryj po naplánování)
  const [busy, setBusy] = useState({});

  const hints = useMemo(
    () => plantSupportForPin(pin, plant, pin.garden_conditions),
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
      const instr = t(`plantSupports.${TYPE_KEY[h.type].instr}`);
      await api.createTask({
        pin_id: pin.id,
        title: `${h.emoji} ${t('plantSupports.taskTitle', { plant: plant_name })}`,
        task_type: h.taskType,
        frequency_days: null,
        specific_date: h.suggested,
        notes: t('plantSupports.notes', { instr }),
      });
      setPlanned((s) => ({ ...s, [key]: true }));
      toast(t('plantSupports.planned', { date: formatDate(h.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('plantSupports.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <div className="plant-support-card" role="note">
      <div className="plant-support-head">
        <span className="plant-support-title">🪜 {t('plantSupports.title')}</span>
        <span className="plant-support-sub">{t('plantSupports.subtitle')}</span>
      </div>
      <div className="plant-support-list">
        {visible.map((h) => {
          const key = keyOf(h);
          const tk = TYPE_KEY[h.type] || TYPE_KEY.ring;
          return (
            <div key={key} className="plant-support-row">
              <span className="plant-support-badge" aria-hidden="true">
                {monthNameShort(h.month - 1)}
              </span>
              <div className="plant-support-main">
                <div className="plant-support-action">
                  {h.emoji} {t(`plantSupports.${tk.label}`)}
                </div>
                <div className="plant-support-meta">{t(`plantSupports.${tk.instr}`)}</div>
              </div>
              <button
                type="button"
                className="plant-support-btn"
                onClick={() => plan(h)}
                disabled={busy[key]}
              >
                {busy[key] ? t('plantSupports.planning') : t('plantSupports.plan')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
