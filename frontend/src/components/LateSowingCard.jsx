// Karta „🌱 Čas druhého výsevu" v detailu pinu (Úkony tab). Nenásilně připomene v pozdním
// létě / na začátku podzimu DRUHÝ VÝSEV chladovzdorných druhů (špenát/polníček/rukola/
// mangold/řepa/ředkvička/zimní salát) na uvolněné záhony po hlavní jarní sklizni
// + sázbu OZIMÉHO ČESNEKU v 10 (viz data/lateSowing.js). Bez druhého výsevu zůstanou
// záhony ležet ladem a zarostou plevelem. Měsíc posunutý dle klim. zóny (dateForMonth).
// Jeden klik = api.createTask na termín výsevu. Skryje se mimo gate / mimo sezónu (7–10)
// / je-li už naplánováno.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { findPlantByName } from '../plantDatabase.js';
import { lateSowingForPin } from '../data/lateSowing.js';
import { monthNameShort, formatDate } from '../utils.js';

// type → i18n klíče (label typu okna + krátká instrukce)
const TYPE_KEY = {
  midsummer:   { label: 'typeMidsummer',   instr: 'instrMidsummer' },
  lateSummer:  { label: 'typeLateSummer',  instr: 'instrLateSummer' },
  earlyAutumn: { label: 'typeEarlyAutumn', instr: 'instrEarlyAutumn' },
  autumn:      { label: 'typeAutumn',      instr: 'instrAutumn' },
};

export default function LateSowingCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(pin.plant_name), [pin.plant_name]);
  const [planned, setPlanned] = useState({});
  const [busy, setBusy] = useState({});

  const hints = useMemo(
    () => lateSowingForPin(pin, plant, pin.garden_conditions),
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
      const instr = t(`lateSowing.${TYPE_KEY[h.type].instr}`);
      await api.createTask({
        pin_id: pin.id,
        title: `${h.emoji} ${t('lateSowing.taskTitle', { plant: plant_name })}`,
        task_type: h.taskType,
        frequency_days: null,
        specific_date: h.suggested,
        notes: t('lateSowing.notes', { instr }),
      });
      setPlanned((s) => ({ ...s, [key]: true }));
      toast(t('lateSowing.planned', { date: formatDate(h.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('lateSowing.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <div className="late-sowing-card" role="note">
      <div className="late-sowing-head">
        <span className="late-sowing-title">🌱 {t('lateSowing.title')}</span>
        <span className="late-sowing-sub">{t('lateSowing.subtitle')}</span>
      </div>
      <div className="late-sowing-list">
        {visible.map((h) => {
          const key = keyOf(h);
          const tk = TYPE_KEY[h.type] || TYPE_KEY.lateSummer;
          return (
            <div key={key} className="late-sowing-row">
              <span className="late-sowing-badge" aria-hidden="true">
                {monthNameShort(h.month - 1)}
              </span>
              <div className="late-sowing-main">
                <div className="late-sowing-action">
                  {h.emoji} {t(`lateSowing.${tk.label}`)}
                </div>
                <div className="late-sowing-meta">{t(`lateSowing.${tk.instr}`)}</div>
              </div>
              <button
                type="button"
                className="late-sowing-btn"
                onClick={() => plan(h)}
                disabled={busy[key]}
              >
                {busy[key] ? t('lateSowing.planning') : t('lateSowing.plan')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
