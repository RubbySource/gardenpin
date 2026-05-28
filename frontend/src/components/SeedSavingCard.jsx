// Karta „🌾 Čas nasbírat semena" v detailu pinu (Úkony tab). Nenásilně připomene
// pozdně-letní / podzimní SBĚR ZASCHLÝCH SEMENÍKŮ pro příští sezónu (viz data/seedSaving.js).
// Měsíc posunutý dle klim. zóny (dateForMonth — v chladnějších zónách později).
// Jeden klik = api.createTask na termín sběru. Skryje se mimo gate / mimo sezónu /
// je-li už naplánováno.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { findPlantByName } from '../plantDatabase.js';
import { seedSavingForPin } from '../data/seedSaving.js';
import { monthNameShort, formatDate } from '../utils.js';

// type → i18n klíče (label typu sběru + krátká instrukce)
const TYPE_KEY = {
  earlyAutumn: { label: 'typeEarlyAutumn', instr: 'instrEarlyAutumn' },
  midAutumn: { label: 'typeMidAutumn', instr: 'instrMidAutumn' },
  lateAutumn: { label: 'typeLateAutumn', instr: 'instrLateAutumn' },
};

export default function SeedSavingCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(pin.plant_name), [pin.plant_name]);
  const [planned, setPlanned] = useState({}); // key → true (skryj po naplánování)
  const [busy, setBusy] = useState({});

  const hints = useMemo(
    () => seedSavingForPin(pin, plant, pin.garden_conditions),
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
      const instr = t(`seedSaving.${TYPE_KEY[h.type].instr}`);
      await api.createTask({
        pin_id: pin.id,
        title: `${h.emoji} ${t('seedSaving.taskTitle', { plant: plant_name })}`,
        task_type: h.taskType,
        frequency_days: null,
        specific_date: h.suggested,
        notes: t('seedSaving.notes', { instr }),
      });
      setPlanned((s) => ({ ...s, [key]: true }));
      toast(t('seedSaving.planned', { date: formatDate(h.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('seedSaving.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <div className="seed-saving-card" role="note">
      <div className="seed-saving-head">
        <span className="seed-saving-title">🌾 {t('seedSaving.title')}</span>
        <span className="seed-saving-sub">{t('seedSaving.subtitle')}</span>
      </div>
      <div className="seed-saving-list">
        {visible.map((h) => {
          const key = keyOf(h);
          const tk = TYPE_KEY[h.type] || TYPE_KEY.midAutumn;
          return (
            <div key={key} className="seed-saving-row">
              <span className="seed-saving-badge" aria-hidden="true">
                {monthNameShort(h.month - 1)}
              </span>
              <div className="seed-saving-main">
                <div className="seed-saving-action">
                  {h.emoji} {t(`seedSaving.${tk.label}`)}
                </div>
                <div className="seed-saving-meta">{t(`seedSaving.${tk.instr}`)}</div>
              </div>
              <button
                type="button"
                className="seed-saving-btn"
                onClick={() => plan(h)}
                disabled={busy[key]}
              >
                {busy[key] ? t('seedSaving.planning') : t('seedSaving.plan')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
