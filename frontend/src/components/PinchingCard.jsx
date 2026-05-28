// Karta „✂️ Čas vyštípnout vrcholy" v detailu pinu (Úkony tab). Nenásilně připomene v pozdním
// jaru/začátku léta VYŠTÍPNOUT VRCHOLOVÝ PUPEN — donutí rostlinu vyhnat boční výhony, takže
// místo jednoho dlouhého stonku vyroste hustý kompaktní trs s 2–4× více květy (viz
// data/pinching.js). Měsíc posunutý dle klim. zóny (dateForMonth — v chladnějších zónách
// později). Jeden klik = api.createTask na termín pinčování. Skryje se mimo gate / mimo
// sezónu (5–6) / je-li už naplánováno.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { findPlantByName } from '../plantDatabase.js';
import { pinchingForPin } from '../data/pinching.js';
import { monthNameShort, formatDate } from '../utils.js';

// type → i18n klíče (label typu pinčování + krátká instrukce)
const TYPE_KEY = {
  chelseaChop: { label: 'typeChelseaChop', instr: 'instrChelseaChop' },
  annualPinch: { label: 'typeAnnualPinch', instr: 'instrAnnualPinch' },
};

export default function PinchingCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(pin.plant_name), [pin.plant_name]);
  const [planned, setPlanned] = useState({}); // key → true (skryj po naplánování)
  const [busy, setBusy] = useState({});

  const hints = useMemo(
    () => pinchingForPin(pin, plant, pin.garden_conditions),
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
      const instr = t(`pinching.${TYPE_KEY[h.type].instr}`);
      await api.createTask({
        pin_id: pin.id,
        title: `${h.emoji} ${t('pinching.taskTitle', { plant: plant_name })}`,
        task_type: h.taskType,
        frequency_days: null,
        specific_date: h.suggested,
        notes: t('pinching.notes', { instr }),
      });
      setPlanned((s) => ({ ...s, [key]: true }));
      toast(t('pinching.planned', { date: formatDate(h.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('pinching.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <div className="pinching-card" role="note">
      <div className="pinching-head">
        <span className="pinching-title">✂️ {t('pinching.title')}</span>
        <span className="pinching-sub">{t('pinching.subtitle')}</span>
      </div>
      <div className="pinching-list">
        {visible.map((h) => {
          const key = keyOf(h);
          const tk = TYPE_KEY[h.type] || TYPE_KEY.annualPinch;
          return (
            <div key={key} className="pinching-row">
              <span className="pinching-badge" aria-hidden="true">
                {monthNameShort(h.month - 1)}
              </span>
              <div className="pinching-main">
                <div className="pinching-action">
                  {h.emoji} {t(`pinching.${tk.label}`)}
                </div>
                <div className="pinching-meta">{t(`pinching.${tk.instr}`)}</div>
              </div>
              <button
                type="button"
                className="pinching-btn"
                onClick={() => plan(h)}
                disabled={busy[key]}
              >
                {busy[key] ? t('pinching.planning') : t('pinching.plan')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
