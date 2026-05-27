// Karta „🧪 Úprava pH půdy" v detailu pinu (Úkony tab). Nenásilně připomene OKYSELENÍ
// stanoviště pod ACIDOFILNÍ rostlinou (borůvka, pěnišník/azalka, vřes, kamélie…) — na
// podzim zapracovat síru/rašelinu, aby si rostlina udržela kyselou půdu (pH ~4,5–5,5).
// Měsíc je posunutý dle klim. zóny (dateForMonth). Jeden klik = api.createTask na termín.
// Skryje se mimo sezónu (10–11) / mimo acidofilní gate / je-li už naplánováno. Viz
// data/soilPh.js.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { findPlantByName } from '../plantDatabase.js';
import { soilAcidifyForPin } from '../data/soilPh.js';
import { monthNameShort, formatDate } from '../utils.js';

export default function SoilAcidCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(pin.plant_name), [pin.plant_name]);
  const dedupMarker = t('soilPh.acidDedup');
  const [planned, setPlanned] = useState({}); // key → true (skryj po naplánování)
  const [busy, setBusy] = useState({});

  const hints = useMemo(
    () => soilAcidifyForPin(pin, plant, pin.garden_conditions, dedupMarker),
    [pin, plant, dedupMarker],
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
        title: `${h.emoji} ${t('soilPh.acidTaskTitle', { plant: plant_name })}`,
        task_type: h.taskType,
        frequency_days: null,
        specific_date: h.suggested,
        notes: t('soilPh.acidNotes'),
      });
      setPlanned((s) => ({ ...s, [key]: true }));
      toast(t('soilPh.planned', { date: formatDate(h.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('soilPh.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <div className="soil-ph-card" role="note">
      <div className="soil-ph-head">
        <span className="soil-ph-title">🧪 {t('soilPh.acidTitle')}</span>
        <span className="soil-ph-sub">{t('soilPh.acidSubtitle')}</span>
      </div>
      <div className="soil-ph-list">
        {visible.map((h) => {
          const key = keyOf(h);
          return (
            <div key={key} className="soil-ph-row">
              <span className="soil-ph-badge" aria-hidden="true">{monthNameShort(h.month - 1)}</span>
              <div className="soil-ph-main">
                <div className="soil-ph-action">{h.emoji} {t('soilPh.acidAction')}</div>
                <div className="soil-ph-meta">{t('soilPh.acidInstr')}</div>
              </div>
              <button
                type="button"
                className="soil-ph-btn-inline"
                onClick={() => plan(h)}
                disabled={busy[key]}
              >
                {busy[key] ? t('soilPh.planning') : t('soilPh.plan')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
