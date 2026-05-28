// Karta „🌤️ Čas otužit sazenici" v detailu pinu (Úkony tab). Nenásilně připomene v pozdním
// jaru POSTUPNÉ 7–14 DENNÍ OTUŽOVÁNÍ sazenic vypěstovaných v interiéru, než se vysadí natrvalo
// ven (viz data/hardeningOff.js). Bez otužování slunce spálí listy, vítr poláme stonky a teplotní
// šok zastaví růst o 2–3 týdny. Měsíc posunutý dle klim. zóny (dateForMonth — v chladnějších
// zónách později). Jeden klik = api.createTask na termín otužování. Skryje se mimo gate / mimo
// sezónu (4–6) / je-li už naplánováno.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { findPlantByName } from '../plantDatabase.js';
import { hardeningOffForPin } from '../data/hardeningOff.js';
import { monthNameShort, formatDate } from '../utils.js';

// type → i18n klíče (label typu otužování + krátká instrukce)
const TYPE_KEY = {
  coolSeason: { label: 'typeCoolSeason', instr: 'instrCoolSeason' },
  warmSeason: { label: 'typeWarmSeason', instr: 'instrWarmSeason' },
  heatLoving: { label: 'typeHeatLoving', instr: 'instrHeatLoving' },
};

export default function HardeningOffCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(pin.plant_name), [pin.plant_name]);
  const [planned, setPlanned] = useState({}); // key → true (skryj po naplánování)
  const [busy, setBusy] = useState({});

  const hints = useMemo(
    () => hardeningOffForPin(pin, plant, pin.garden_conditions),
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
      const instr = t(`hardeningOff.${TYPE_KEY[h.type].instr}`);
      await api.createTask({
        pin_id: pin.id,
        title: `${h.emoji} ${t('hardeningOff.taskTitle', { plant: plant_name })}`,
        task_type: h.taskType,
        frequency_days: null,
        specific_date: h.suggested,
        notes: t('hardeningOff.notes', { instr }),
      });
      setPlanned((s) => ({ ...s, [key]: true }));
      toast(t('hardeningOff.planned', { date: formatDate(h.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('hardeningOff.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <div className="hardening-off-card" role="note">
      <div className="hardening-off-head">
        <span className="hardening-off-title">🌤️ {t('hardeningOff.title')}</span>
        <span className="hardening-off-sub">{t('hardeningOff.subtitle')}</span>
      </div>
      <div className="hardening-off-list">
        {visible.map((h) => {
          const key = keyOf(h);
          const tk = TYPE_KEY[h.type] || TYPE_KEY.warmSeason;
          return (
            <div key={key} className="hardening-off-row">
              <span className="hardening-off-badge" aria-hidden="true">
                {monthNameShort(h.month - 1)}
              </span>
              <div className="hardening-off-main">
                <div className="hardening-off-action">
                  {h.emoji} {t(`hardeningOff.${tk.label}`)}
                </div>
                <div className="hardening-off-meta">{t(`hardeningOff.${tk.instr}`)}</div>
              </div>
              <button
                type="button"
                className="hardening-off-btn"
                onClick={() => plan(h)}
                disabled={busy[key]}
              >
                {busy[key] ? t('hardeningOff.planning') : t('hardeningOff.plan')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
