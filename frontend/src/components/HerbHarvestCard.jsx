// Karta „🌿 Čas sklidit bylinku na sušení" v detailu pinu (Úkony tab). Nenásilně
// připomene LETNÍ HARVEST kuchyňských bylinek ve fázi maximálního obsahu éterických
// olejů (těsně před / na začátku kvetení) pro sušení na zimu — viz data/herbHarvest.js.
// Měsíc posunutý dle klim. zóny (dateForMonth). Jeden klik = api.createTask na termín.
// Skryje se mimo gate `bylinky` / mimo selektor rodů a druhů / mimo sezónu /
// je-li už sklizeň na sušení v daném měsíci naplánována.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { findPlantByName } from '../plantDatabase.js';
import { herbHarvestForPin } from '../data/herbHarvest.js';
import { monthNameShort, formatDate } from '../utils.js';

export default function HerbHarvestCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(pin.plant_name), [pin.plant_name]);
  const [planned, setPlanned] = useState({}); // key → true (skryj po naplánování)
  const [busy, setBusy] = useState({});

  const hints = useMemo(
    () => herbHarvestForPin(pin, plant, pin.garden_conditions),
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
        title: `${h.emoji} ${t('herbHarvest.taskTitle', { plant: plant_name })}`,
        task_type: h.taskType,
        frequency_days: null,
        specific_date: h.suggested,
        notes: t('herbHarvest.notes'),
      });
      setPlanned((s) => ({ ...s, [key]: true }));
      toast(t('herbHarvest.planned', { date: formatDate(h.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('herbHarvest.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <div className="herb-harvest-card" role="note">
      <div className="herb-harvest-head">
        <span className="herb-harvest-title">🌿 {t('herbHarvest.title')}</span>
        <span className="herb-harvest-sub">{t('herbHarvest.subtitle')}</span>
      </div>
      <div className="herb-harvest-list">
        {visible.map((h) => {
          const key = keyOf(h);
          return (
            <div key={key} className="herb-harvest-row">
              <span className="herb-harvest-badge" aria-hidden="true">
                {monthNameShort(h.month - 1)}
              </span>
              <div className="herb-harvest-main">
                <div className="herb-harvest-action">
                  {h.emoji} {t('herbHarvest.action')}
                </div>
                <div className="herb-harvest-meta">{t('herbHarvest.instr')}</div>
              </div>
              <button
                type="button"
                className="herb-harvest-btn"
                onClick={() => plan(h)}
                disabled={busy[key]}
              >
                {busy[key] ? t('herbHarvest.planning') : t('herbHarvest.plan')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
