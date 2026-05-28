// Karta „🍅 Čas pasínkovat rajče" v detailu pinu (Úkony tab). Připomene letní
// průběžný úkon u indeterminovaných rajčat — vylamování zálistků (primary, měsíc 6)
// a apical pinch (vyštípnutí vrcholu, měsíc 8) pro dozrávání zbývajících plodů.
// Měsíc posunutý dle klim. zóny (dateForMonth). Jeden klik = api.createTask na termín.
// Skryje se mimo gate `zelenina` / mimo Solanum lycopersicum / mimo sezónu /
// je-li úkon v daném měsíci už naplánován.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { findPlantByName } from '../plantDatabase.js';
import { tomatoSuckeringForPin } from '../data/tomatoSuckering.js';
import { monthNameShort, formatDate } from '../utils.js';

export default function TomatoSuckeringCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(pin.plant_name), [pin.plant_name]);
  const [planned, setPlanned] = useState({});
  const [busy, setBusy] = useState({});

  const hints = useMemo(
    () => tomatoSuckeringForPin(pin, plant, pin.garden_conditions),
    [pin, plant],
  );
  const keyOf = (h) => `${h.kind}-${h.suggested}`;
  const visible = hints.filter((h) => !planned[keyOf(h)]);
  if (visible.length === 0) return null;

  const plant_name = plant?.nameCz || pin.plant_name;
  const titleKey = (kind) => (kind === 'apical' ? 'tomatoSuckering.apicalTitle' : 'tomatoSuckering.primaryTitle');
  const instrKey = (kind) => (kind === 'apical' ? 'tomatoSuckering.apicalInstr' : 'tomatoSuckering.primaryInstr');
  const notesKey = (kind) => (kind === 'apical' ? 'tomatoSuckering.apicalNotes' : 'tomatoSuckering.primaryNotes');

  const plan = async (h) => {
    const key = keyOf(h);
    if (busy[key]) return;
    setBusy((s) => ({ ...s, [key]: true }));
    try {
      await api.createTask({
        pin_id: pin.id,
        title: `${h.emoji} ${t(titleKey(h.kind), { plant: plant_name })}`,
        task_type: h.taskType,
        frequency_days: null,
        specific_date: h.suggested,
        notes: t(notesKey(h.kind)),
      });
      setPlanned((s) => ({ ...s, [key]: true }));
      toast(t('tomatoSuckering.planned', { date: formatDate(h.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('tomatoSuckering.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <div className="tomato-suckering-card" role="note">
      <div className="tomato-suckering-head">
        <span className="tomato-suckering-title">🍅 {t('tomatoSuckering.title')}</span>
        <span className="tomato-suckering-sub">{t('tomatoSuckering.subtitle')}</span>
      </div>
      <div className="tomato-suckering-list">
        {visible.map((h) => {
          const key = keyOf(h);
          return (
            <div key={key} className="tomato-suckering-row">
              <span className="tomato-suckering-badge" aria-hidden="true">
                {monthNameShort(h.month - 1)}
              </span>
              <div className="tomato-suckering-main">
                <div className="tomato-suckering-action">
                  {h.emoji} {t(titleKey(h.kind), { plant: plant_name })}
                </div>
                <div className="tomato-suckering-meta">{t(instrKey(h.kind))}</div>
              </div>
              <button
                type="button"
                className="tomato-suckering-btn"
                onClick={() => plan(h)}
                disabled={busy[key]}
              >
                {busy[key] ? t('tomatoSuckering.planning') : t('tomatoSuckering.plan')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
