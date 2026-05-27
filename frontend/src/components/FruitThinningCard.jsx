// Karta „🍎 Čas probrat plody" v detailu pinu (Úkony tab). Nenásilně připomene RUČNÍ PROBÍRKU
// NÁSADY u jádrovin a velkoplodých peckovin po June drop (viz data/fruitThinning.js) — ponechat
// silnější plody na správný rozestup, ať zbylé vyrostou větší a strom nestřídá plodnost. Měsíc
// posunutý dle klim. zóny (dateForMonth). Jeden klik = api.createTask na termín probírky. Skryje
// se mimo gate ovoce/stromy / mimo sezónu / je-li už naplánováno.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { findPlantByName } from '../plantDatabase.js';
import { fruitThinningForPin } from '../data/fruitThinning.js';
import { monthNameShort, formatDate } from '../utils.js';

// type → i18n klíče (label typu + krátká instrukce rozestupu)
const TYPE_KEY = {
  pome: { label: 'typePome', instr: 'instrPome' },
  stone: { label: 'typeStone', instr: 'instrStone' },
};

export default function FruitThinningCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(pin.plant_name), [pin.plant_name]);
  const [planned, setPlanned] = useState({}); // key → true (skryj po naplánování)
  const [busy, setBusy] = useState({});

  const hints = useMemo(
    () => fruitThinningForPin(pin, plant, pin.garden_conditions),
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
      const instr = t(`fruitThinning.${TYPE_KEY[h.type].instr}`);
      await api.createTask({
        pin_id: pin.id,
        title: `${h.emoji} ${t('fruitThinning.taskTitle', { plant: plant_name })}`,
        task_type: h.taskType,
        frequency_days: null,
        specific_date: h.suggested,
        notes: t('fruitThinning.notes', { instr }),
      });
      setPlanned((s) => ({ ...s, [key]: true }));
      toast(t('fruitThinning.planned', { date: formatDate(h.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('fruitThinning.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <div className="fruit-thinning-card" role="note">
      <div className="fruit-thinning-head">
        <span className="fruit-thinning-title">🍎 {t('fruitThinning.title')}</span>
        <span className="fruit-thinning-sub">{t('fruitThinning.subtitle')}</span>
      </div>
      <div className="fruit-thinning-list">
        {visible.map((h) => {
          const key = keyOf(h);
          const tk = TYPE_KEY[h.type] || TYPE_KEY.pome;
          return (
            <div key={key} className="fruit-thinning-row">
              <span className="fruit-thinning-badge" aria-hidden="true">
                {monthNameShort(h.month - 1)}
              </span>
              <div className="fruit-thinning-main">
                <div className="fruit-thinning-action">
                  {h.emoji} {t(`fruitThinning.${tk.label}`)}
                </div>
                <div className="fruit-thinning-meta">{t(`fruitThinning.${tk.instr}`)}</div>
              </div>
              <button
                type="button"
                className="fruit-thinning-btn"
                onClick={() => plan(h)}
                disabled={busy[key]}
              >
                {busy[key] ? t('fruitThinning.planning') : t('fruitThinning.plan')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
