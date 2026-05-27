// Karta „🌷 Čas zasadit cibule" v detailu pinu (Úkony tab). Nenásilně připomene PODZIMNÍ
// výsadbu jarně kvetoucích cibulovin (tulipán/narcis/krokus/hyacint…), aby přes zimu
// zakořenily a na jaře kvetly (viz data/bulbPlanting.js). Datum výsadby je posunuté dle
// klim. zóny (dateForMonth). Jeden klik = api.createTask na výsadbový termín. Skryje se
// mimo výsadbovou sezónu / mimo kategorii cibuloviny / je-li už naplánováno.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { findPlantByName } from '../plantDatabase.js';
import { bulbPlantingForPin } from '../data/bulbPlanting.js';
import { monthNameShort, formatDate } from '../utils.js';

export default function BulbPlantingCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(pin.plant_name), [pin.plant_name]);
  const [planned, setPlanned] = useState({}); // key → true (skryj po naplánování)
  const [busy, setBusy] = useState({});

  const hints = useMemo(
    () => bulbPlantingForPin(pin, plant, pin.garden_conditions),
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
        title: `${h.emoji} ${t('bulbPlanting.taskTitle', { plant: plant_name })}`,
        task_type: h.taskType,
        frequency_days: null,
        specific_date: h.suggested,
        notes: t('bulbPlanting.notes', { depth: h.depthCm }),
      });
      setPlanned((s) => ({ ...s, [key]: true }));
      toast(t('bulbPlanting.planned', { date: formatDate(h.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('bulbPlanting.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <div className="bulb-planting-card" role="note">
      <div className="bulb-planting-head">
        <span className="bulb-planting-title">🌷 {t('bulbPlanting.title')}</span>
        <span className="bulb-planting-sub">{t('bulbPlanting.subtitle')}</span>
      </div>
      <div className="bulb-planting-list">
        {visible.map((h) => {
          const key = keyOf(h);
          return (
            <div key={key} className="bulb-planting-row">
              <span className="bulb-planting-badge" aria-hidden="true">
                {monthNameShort(h.month - 1)}
              </span>
              <div className="bulb-planting-main">
                <div className="bulb-planting-action">{h.emoji} {t('bulbPlanting.action')}</div>
                <div className="bulb-planting-meta">
                  {t('bulbPlanting.meta', { depth: h.depthCm })}
                </div>
              </div>
              <button
                type="button"
                className="bulb-planting-btn"
                onClick={() => plan(h)}
                disabled={busy[key]}
              >
                {busy[key] ? t('bulbPlanting.planning') : t('bulbPlanting.plan')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
