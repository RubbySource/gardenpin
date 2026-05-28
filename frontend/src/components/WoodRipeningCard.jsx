// Karta „🍂 Čas posílit dřevo na zimu" v detailu pinu (Úkony tab). Nenásilně připomene
// PK PŘIHNOJENÍ trvalých dřevin koncem léta / začátkem podzimu — draslík podpoří vyzrání
// letošního dřeva a mrazuvzdornost, dusík už NE (viz data/woodRipeningFeed.js). Měsíc
// posunutý dle klim. zóny (dateForMonth). Jeden klik = api.createTask na termín PK okna.
// Skryje se mimo gate (dřeviny ovoce/stromy/kere/popinave) / mimo sezónu (8–9) / je-li
// už naplánováno.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { findPlantByName } from '../plantDatabase.js';
import { woodRipeningForPin } from '../data/woodRipeningFeed.js';
import { monthNameShort, formatDate } from '../utils.js';

export default function WoodRipeningCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(pin.plant_name), [pin.plant_name]);
  const [planned, setPlanned] = useState({}); // key → true (skryj po naplánování)
  const [busy, setBusy] = useState({});

  const dedupMarker = t('woodRipening.dedup');
  const hints = useMemo(
    () => woodRipeningForPin(pin, plant, pin.garden_conditions, dedupMarker),
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
        title: `${h.emoji} ${t('woodRipening.taskTitle', { plant: plant_name })}`,
        task_type: h.taskType,
        frequency_days: null,
        specific_date: h.suggested,
        notes: t('woodRipening.notes'),
      });
      setPlanned((s) => ({ ...s, [key]: true }));
      toast(t('woodRipening.planned', { date: formatDate(h.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('woodRipening.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <div className="wood-ripening-card" role="note">
      <div className="wood-ripening-head">
        <span className="wood-ripening-title">🍂 {t('woodRipening.title')}</span>
        <span className="wood-ripening-sub">{t('woodRipening.subtitle')}</span>
      </div>
      <div className="wood-ripening-list">
        {visible.map((h) => {
          const key = keyOf(h);
          return (
            <div key={key} className="wood-ripening-row">
              <span className="wood-ripening-badge" aria-hidden="true">
                {monthNameShort(h.month - 1)}
              </span>
              <div className="wood-ripening-main">
                <div className="wood-ripening-action">
                  {h.emoji} {t('woodRipening.action')}
                </div>
                <div className="wood-ripening-meta">{t('woodRipening.instr')}</div>
              </div>
              <button
                type="button"
                className="wood-ripening-btn"
                onClick={() => plan(h)}
                disabled={busy[key]}
              >
                {busy[key] ? t('woodRipening.planning') : t('woodRipening.plan')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
