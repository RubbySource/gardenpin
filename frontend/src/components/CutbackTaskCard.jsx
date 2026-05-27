// Karta „✂️ Čas na sestřih" v detailu pinu (Úkony tab). Nenásilně připomene KAŽDOROČNÍ
// SEŘÍZNUTÍ odumřelé nadzemní části trvalek a okrasných trav (viz data/perennialCutback.js) —
// strukturní/podzimně kvetoucí a trávy se nechávají přes zimu a stříhají brzy zjara, měkké
// trvalky bez zimní hodnoty po zatažení na podzim. Měsíc posunutý dle klim. zóny (dateForMonth).
// Jeden klik = api.createTask na termín sestřihu. Skryje se mimo gate trvalky/travy / mimo
// sezónu / je-li už naplánováno.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { findPlantByName } from '../plantDatabase.js';
import { perennialCutbackForPin } from '../data/perennialCutback.js';
import { monthNameShort, formatDate } from '../utils.js';

export default function CutbackTaskCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(pin.plant_name), [pin.plant_name]);
  const [planned, setPlanned] = useState({}); // key → true (skryj po naplánování)
  const [busy, setBusy] = useState({});

  const hints = useMemo(
    () => perennialCutbackForPin(pin, plant, pin.garden_conditions),
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
      const meta = t(h.season === 'spring' ? 'perennialCutback.metaSpring' : 'perennialCutback.metaAutumn');
      await api.createTask({
        pin_id: pin.id,
        title: `${h.emoji} ${t('perennialCutback.taskTitle', { plant: plant_name })}`,
        task_type: h.taskType,
        frequency_days: null,
        specific_date: h.suggested,
        notes: t('perennialCutback.notes', { meta }),
      });
      setPlanned((s) => ({ ...s, [key]: true }));
      toast(t('perennialCutback.planned', { date: formatDate(h.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('perennialCutback.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <div className="cutback-task-card" role="note">
      <div className="cutback-task-head">
        <span className="cutback-task-title">✂️ {t('perennialCutback.title')}</span>
        <span className="cutback-task-sub">{t('perennialCutback.subtitle')}</span>
      </div>
      <div className="cutback-task-list">
        {visible.map((h) => {
          const key = keyOf(h);
          return (
            <div key={key} className="cutback-task-row">
              <span className="cutback-task-badge" aria-hidden="true">
                {monthNameShort(h.month - 1)}
              </span>
              <div className="cutback-task-main">
                <div className="cutback-task-action">{h.emoji} {t('perennialCutback.action')}</div>
                <div className="cutback-task-meta">
                  {t(h.season === 'spring' ? 'perennialCutback.metaSpring' : 'perennialCutback.metaAutumn')}
                </div>
              </div>
              <button
                type="button"
                className="cutback-task-btn"
                onClick={() => plan(h)}
                disabled={busy[key]}
              >
                {busy[key] ? t('perennialCutback.planning') : t('perennialCutback.plan')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
