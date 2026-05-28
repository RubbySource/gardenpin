// Karta „🌿 Čas mulčovat" v detailu pinu (Úkony tab). Nenásilně připomene na jaře (4–5)
// ULOŽIT 5–8 cm organického mulče (drcená kůra, štěpka, sláma, listí) okolo trvalek/keřů/
// stromů/ovoce — pro 30–40 % více půdní vlhkosti v létě, méně plevele a izolaci kořenové
// zóny (viz data/springMulching.js). Měsíc posunutý dle klim. zóny (dateForMonth —
// v chladnějších zónách později). Jeden klik = api.createTask na termín mulčování.
// Skryje se mimo gate / mimo sezónu (4–5) / je-li už naplánováno / pro vyloučené rody
// (Lavandula/Helleborus/Iris germanica…).
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { findPlantByName } from '../plantDatabase.js';
import { springMulchingForPin } from '../data/springMulching.js';
import { monthNameShort, formatDate } from '../utils.js';

// type → i18n klíče (label typu mulčování + krátká instrukce)
const TYPE_KEY = {
  perennial: { label: 'typePerennial', instr: 'instrPerennial' },
  woody: { label: 'typeWoody', instr: 'instrWoody' },
};

export default function SpringMulchingCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(pin.plant_name), [pin.plant_name]);
  const [planned, setPlanned] = useState({}); // key → true (skryj po naplánování)
  const [busy, setBusy] = useState({});

  const hints = useMemo(
    () => springMulchingForPin(pin, plant, pin.garden_conditions),
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
      const instr = t(`springMulching.${TYPE_KEY[h.type].instr}`);
      await api.createTask({
        pin_id: pin.id,
        title: `${h.emoji} ${t('springMulching.taskTitle', { plant: plant_name })}`,
        task_type: h.taskType,
        frequency_days: null,
        specific_date: h.suggested,
        notes: t('springMulching.notes', { instr }),
      });
      setPlanned((s) => ({ ...s, [key]: true }));
      toast(t('springMulching.planned', { date: formatDate(h.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('springMulching.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <div className="spring-mulching-card" role="note">
      <div className="spring-mulching-head">
        <span className="spring-mulching-title">🌿 {t('springMulching.title')}</span>
        <span className="spring-mulching-sub">{t('springMulching.subtitle')}</span>
      </div>
      <div className="spring-mulching-list">
        {visible.map((h) => {
          const key = keyOf(h);
          const tk = TYPE_KEY[h.type] || TYPE_KEY.perennial;
          return (
            <div key={key} className="spring-mulching-row">
              <span className="spring-mulching-badge" aria-hidden="true">
                {monthNameShort(h.month - 1)}
              </span>
              <div className="spring-mulching-main">
                <div className="spring-mulching-action">
                  {h.emoji} {t(`springMulching.${tk.label}`)}
                </div>
                <div className="spring-mulching-meta">{t(`springMulching.${tk.instr}`)}</div>
              </div>
              <button
                type="button"
                className="spring-mulching-btn"
                onClick={() => plan(h)}
                disabled={busy[key]}
              >
                {busy[key] ? t('springMulching.planning') : t('springMulching.plan')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
